from typing import Optional
import json
import logging
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import SessionLocal, get_db
from auth import require_auth, get_current_user, identity_from_user
from models.user import User
from schemas.chat import ChatRequest, ChatResponse
from services.chat_service import create_or_get_thread, save_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from ai.orchestrator import orchestrate

    identity = identity_from_user(user)
    thread = create_or_get_thread(db, identity.id, req.thread_id)
    save_message(db, thread.id, "user", req.message)
    result = orchestrate(db, req.message, user=identity, thread_id=thread.id, context=req.context)
    response_text = result.get("response") or ""
    save_message(db, thread.id, "assistant", response_text)
    return ChatResponse(
        response=response_text,
        thread_id=thread.id,
        actions=[],
        reasoning=result.get("skill"),
    )


def _sse_line(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


def _stream_orchestrator(message: str, thread_id: str, user, context=None):
    from ai.orchestrator import orchestrate_stream

    db = SessionLocal()
    try:
        yield _sse_line({"type": "connected"})
        save_message(db, thread_id, "user", message)
        full_answer = ""
        try:
            for event in orchestrate_stream(db, message, user=user, thread_id=thread_id, context=context):
                event_type = event.get("type")
                if event_type == "content":
                    full_answer = event.get("content") or full_answer
                elif event_type == "done":
                    full_answer = event.get("answer") or event.get("content") or full_answer
                yield _sse_line(event)
            if full_answer:
                save_message(db, thread_id, "assistant", full_answer)
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Orchestrator stream error: %s", e)
            yield _sse_line({"type": "error", "content": "抱歉，服务出现错误，请稍后再试。"})
            yield "data: [DONE]\n\n"
    finally:
        db.close()


@router.post("/chat/stream")
async def chat_stream(
    req: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    identity = identity_from_user(user)
    thread = create_or_get_thread(db, identity.id, req.thread_id)
    return StreamingResponse(
        _stream_orchestrator(req.message, thread.id, identity, req.context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/stream/chat")
async def stream_chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    return await chat_stream(req, db, user)


@router.post("/oag")
async def oag_chat_endpoint(
    request: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from services.oag_service import oag_chat
    result = await oag_chat(db, request.get("message", ""), user.id if user else "anonymous")
    return result


@router.post("/oag/stream")
async def oag_chat_stream_endpoint(
    request: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from services.oag_service import oag_chat_stream

    async def _gen():
        yield _sse_line({"type": "connected"})
        full_answer = ""
        async for chunk_type, chunk_content in oag_chat_stream(db, request.get("message", "")):
            full_answer += chunk_content
            yield _sse_line({"type": "content", "content": chunk_content, "answer": full_answer})
        yield _sse_line({"type": "done", "answer": full_answer, "content": full_answer})
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/oag/analyze/{object_id}")
async def oag_analyze_endpoint(
    object_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from services.oag_service import oag_object_analysis
    result = oag_object_analysis(db, object_id)
    return result
