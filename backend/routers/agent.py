"""Agent endpoints.

All Agent runs go through ``agents.war_room`` (perceive -> reason -> plan -> act -> reflect).
World-changing writes only happen via the Action Gateway; there is no second execution path.
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from agents import war_room
from auth import identity_from_user, require_auth
from database import SessionLocal, get_db
from llm import is_llm_configured, llm_info
from models.agent import AgentStatus
from models.user import User

router = APIRouter(prefix="/api/agent", tags=["agent"])


class AgentInvokeRequest(BaseModel):
    query: str


def _sse(event: dict) -> str:
    return "data: " + json.dumps(event, ensure_ascii=False, default=str) + "\n\n"


def _event_stream(query: str, user, replay: Optional[str], record: Optional[str]):
    db = SessionLocal()
    try:
        for event in war_room.stream_events(db, query=query, user=user, replay_key=replay, record_key=record):
            yield _sse(event)
        yield "data: [DONE]\n\n"
    except Exception as exc:  # noqa: BLE001 - never leave the client hanging
        yield _sse({"type": "error", "stage": "stream", "message": str(exc)})
        yield "data: [DONE]\n\n"
    finally:
        db.close()


_SSE_HEADERS = {"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}


@router.post("/run/stream")
def run_stream(
    request: AgentInvokeRequest,
    replay: Optional[str] = Query(default=None, description="Replay a previously recorded run (rehearsal safety net)."),
    record: Optional[str] = Query(default=None, description="Record this live run under a key (admin only)."),
    user: User = Depends(require_auth),
):
    identity = identity_from_user(user)
    record_key = record if getattr(user, "role", None) == "admin" else None
    return StreamingResponse(
        _event_stream(request.query, identity, replay, record_key),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/invoke/stream")
def invoke_stream(request: AgentInvokeRequest, user: User = Depends(require_auth)):
    """Backward-compatible alias of /run/stream."""
    return run_stream(request, replay=None, record=None, user=user)


@router.post("/invoke")
def invoke_agent(request: AgentInvokeRequest, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """Non-streaming variant: runs the same pipeline and returns a compact result."""
    identity = identity_from_user(user)
    result = {"status": "success", "perception": [], "reasoning": "", "plan": [], "execution": [], "reflection": ""}
    for ev in war_room.run(db, query=request.query, user=identity):
        t = ev.get("type")
        if t == "perceive.finding":
            result["perception"].append(ev["finding"])
        elif t == "reason.done":
            result["reasoning"] = ev["text"]
        elif t == "plan.step":
            result["plan"].append(ev["step"])
        elif t == "act.result":
            result["execution"].append(ev)
        elif t == "reflect.done":
            result["reflection"] = ev["text"]
        elif t == "error":
            result["status"] = "error"
            result["error"] = ev.get("message")
        elif t == "done":
            result["run_id"] = ev.get("run_id")
            result["decision_id"] = ev.get("decision_id")
            result["summary"] = ev.get("summary")
    return result


@router.get("/presets")
def presets(user: User = Depends(require_auth)):
    return [{**p, "has_replay": war_room.has_replay(p["id"])} for p in war_room.PRESET_QUESTIONS]


@router.get("/llm-status")
def llm_status(ping: bool = False, user: User = Depends(require_auth)):
    """Lightweight status for the stage indicator. ``ping=true`` makes a real 1-call round trip."""
    info = llm_info()
    state = "online" if info["configured"] else "offline"
    latency_ms = None
    if ping and info["configured"]:
        import time

        t0 = time.time()
        try:
            from langchain_core.messages import HumanMessage

            from llm import get_llm_for

            get_llm_for("fast").invoke([HumanMessage(content="ping")])
            latency_ms = int((time.time() - t0) * 1000)
        except Exception as exc:  # noqa: BLE001
            state = "degraded"
            info["error"] = str(exc)[:200]
    return {**info, "state": state, "latency_ms": latency_ms}


@router.get("/status")
def get_agent_status(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    agents = db.query(AgentStatus).all()
    results = []
    for a in agents:
        results.append({
            "id": a.id,
            "agentName": a.agent_name,
            "agentType": a.agent_type,
            "status": a.agent_status,
            "lastRun": a.last_run.isoformat() if a.last_run else None,
            "memoryStats": {
                "total": a.total_memories,
                "episodic": a.episodic_memories,
                "semantic": a.semantic_memories,
                "procedural": a.procedural_memories,
            },
            "learningStats": {
                "totalExperiences": a.total_experiences,
                "knowledgeItems": a.knowledge_items,
                "successRate": a.success_rate,
            },
            "abilities": {
                "perception": a.perception_ability,
                "reasoning": a.reasoning_ability,
                "planning": a.planning_ability,
                "learning": a.learning_ability,
            },
        })
    return results


@router.post("/sod-demo")
def sod_demo(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    """'试一试：自己批自己' — proves the submitter cannot be the approver (HR-003)."""
    return war_room.sod_demo(db, identity_from_user(user))
