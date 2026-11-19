"""OAG vs plain LLM: same question, two answers, streamed in parallel.

Left side gets no business context (what a generic chatbot would see). Right side gets the
permission-trimmed, token-budgeted OAG pack (objects, relations, hard rules, Logic facts).
Both sides get the same length limit so the comparison is fair.
"""

import json
import queue
import threading
import time
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents import war_room
from agents import war_room_logic as L
from auth import identity_from_user, require_auth
from database import SessionLocal
from llm import get_llm_for, is_llm_configured
from models.user import User

router = APIRouter(prefix="/api/oag", tags=["oag"])

PLAIN_SYSTEM = "你是一位医药销售领域的资深顾问。请直接回答用户的问题，不超过 300 字。"
OAG_SUFFIX = (
    "\n\n补充要求：只使用下面本体上下文中出现的事实与数字，没有的数据明确说「数据中没有」；"
    "提到对象时写成「名称（ID）」；总字数不超过 300 字。"
)

COMPARE_PRESETS = [
    {"id": "why", "label": "张主任最近处方为什么下降？", "query": "张主任最近处方为什么下降？"},
    {"id": "who", "label": "华东区有哪些医生需要重点跟进？", "query": "华东区有哪些医生需要重点跟进？"},
    {"id": "target", "label": "诺欣妥本季度销售目标完成得怎么样？", "query": "诺欣妥本季度销售目标完成得怎么样？"},
]


class CompareRequest(BaseModel):
    query: str
    simulate_budget_squeeze: bool = False


def _sse(payload: Dict[str, Any]) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False, default=str) + "\n\n"


def _worker(side: str, messages: list, q: "queue.Queue", source_text: str, known: Dict[str, Dict[str, str]]) -> None:
    t0 = time.time()
    first_ms = None
    text = ""
    error = None
    try:
        llm = get_llm_for("main")
        if llm is None:
            raise RuntimeError("LLM 未配置")
        for chunk in llm.stream(messages):
            token = war_room._content_text(getattr(chunk, "content", ""))
            if not token:
                continue
            if first_ms is None:
                first_ms = int((time.time() - t0) * 1000)
            text += token
            q.put(("token", side, token))
    except Exception as exc:  # noqa: BLE001
        error = str(exc)[:200]
    q.put((
        "done", side,
        {
            "ms": int((time.time() - t0) * 1000),
            "first_token_ms": first_ms,
            "chars": len(text),
            "grounding": L.ground_numbers(text, source_text),
            "cited": L.cited_objects(text, known),
            "error": error,
        },
    ))


def _stream(query: str, squeeze: bool, user):
    db = SessionLocal()
    try:
        from semantic.context_pack import build_context_pack
        from services.oag_service import OAG_SYSTEM_PROMPT

        kwargs = {"hard_rule_budget": 10} if squeeze else {}
        pack = build_context_pack(db, query, user=user, **kwargs)
        view = war_room.pack_summary(pack)
        known = war_room.known_objects(pack)
        source_text = pack.get("pack_text") or ""
    finally:
        db.close()

    yield _sse({"type": "context", "simulated_squeeze": squeeze, **view})

    if not is_llm_configured():
        yield _sse({"type": "error", "message": "LLM 未配置（LLM_API_KEY 为空），无法进行对比。"})
        yield "data: [DONE]\n\n"
        return

    from langchain_core.messages import HumanMessage, SystemMessage

    q: "queue.Queue" = queue.Queue()
    expected = 2
    threading.Thread(
        target=_worker,
        args=("plain", [SystemMessage(content=PLAIN_SYSTEM), HumanMessage(content=query)], q, source_text or query, known),
        daemon=True,
    ).start()

    if pack.get("refuse"):
        message = "拒绝作答：硬规则窗口被裁掉，无法保证回答遵守规则。（宁可不答，也不乱答）"
        yield _sse({"type": "token", "side": "oag", "text": message})
        yield _sse({"type": "side_done", "side": "oag", "refused": True, "ms": 0, "first_token_ms": 0, "chars": len(message),
                    "grounding": {"ok": True, "checked": 0, "ungrounded": []}, "cited": [], "error": None})
        expected = 1
    else:
        system = OAG_SYSTEM_PROMPT + OAG_SUFFIX + "\n\n## 当前 Ontology 上下文\n\n" + (pack.get("pack_text") or "")[:12000]
        threading.Thread(
            target=_worker,
            args=("oag", [SystemMessage(content=system), HumanMessage(content=query)], q, source_text, known),
            daemon=True,
        ).start()

    finished = 0
    while finished < expected:
        try:
            kind, side, payload = q.get(timeout=1.0)
        except queue.Empty:
            yield ": keep-alive\n\n"
            continue
        if kind == "token":
            yield _sse({"type": "token", "side": side, "text": payload})
        else:
            finished += 1
            yield _sse({"type": "side_done", "side": side, **payload})
    yield _sse({"type": "done"})
    yield "data: [DONE]\n\n"


@router.get("/compare/presets")
def compare_presets(user: User = Depends(require_auth)):
    return COMPARE_PRESETS


@router.post("/compare/stream")
def compare_stream(req: CompareRequest, user: User = Depends(require_auth)):
    identity = identity_from_user(user)
    return StreamingResponse(
        _stream(req.query, req.simulate_budget_squeeze, identity),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
