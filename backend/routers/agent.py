from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
from models.user import User
from models.agent import AgentStatus

from langchain_core.messages import HumanMessage
import os
import json

router = APIRouter(prefix="/api/agent", tags=["agent"])

class AgentInvokeRequest(BaseModel):
    query: str


@router.post("/invoke")
def invoke_agent(
    request: AgentInvokeRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    try:
        from agents.cognitive_graph import app
        
        initial_state = {
            "messages": [HumanMessage(content=request.query)],
            "perception_results": "",
            "hypotheses": "",
            "current_plan": "",
            "execution_status": ""
        }
        
        final_state = app.invoke(initial_state)
        
        return {
            "status": "success",
            "perception": final_state.get("perception_results", ""),
            "reasoning": final_state.get("hypotheses", ""),
            "plan": final_state.get("current_plan", ""),
            "execution": final_state.get("execution_status", "")
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="Agent graph is not initialized properly.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {str(e)}")


async def generate_agent_stream(query: str, user_id: Optional[str] = None) -> AsyncGenerator[str, None]:
    """生成Agent流式响应"""
    try:
        from services.chat_service import invoke_agent_stream
        from agents.cognitive_graph import app
        from services.ws_manager import manager

        initial_state = {
            "messages": [HumanMessage(content=query)],
            "perception_results": "",
            "hypotheses": "",
            "current_plan": "",
            "execution_status": ""
        }

        step_messages = {
            "perceive": "正在扫描系统数据...",
            "reason": "正在进行推理分析...",
            "plan": "正在制定行动计划...",
            "execute": "正在执行计划...",
            "reflect": "正在反思总结...",
            "human_review": "等待人工审批...",
        }

        # 发送开始信号
        yield f"data: {json.dumps({'type': 'start', 'message': 'Agent启动'})}\n\n"

        final_state = None
        async for event in app.astream(initial_state):
            for node_name, node_output in event.items():
                # 发送节点进度
                progress_data = {
                    "type": "progress",
                    "step": node_name,
                    "detail": step_messages.get(node_name, f"执行节点：{node_name}"),
                }
                yield f"data: {json.dumps(progress_data, ensure_ascii=False)}\n\n"

                # 同时发送到WebSocket
                if user_id:
                    try:
                        await manager.send_agent_progress(user_id, node_name, progress_data["detail"])
                    except:
                        pass
                
                final_state = node_output

        # 发送最终结果
        if final_state:
            result_data = {
                "type": "complete",
                "perception": final_state.get("perception_results", ""),
                "reasoning": final_state.get("hypotheses", ""),
                "plan": final_state.get("current_plan", ""),
                "execution": final_state.get("execution_status", ""),
                "needs_review": final_state.get("needs_human_review", False),
                "pending_action_id": final_state.get("pending_action_id"),
            }
            yield f"data: {json.dumps(result_data, ensure_ascii=False)}\n\n"

    except Exception as e:
        error_data = {"type": "error", "message": str(e)}
        yield f"data: {json.dumps(error_data)}\n\n"


@router.post("/invoke/stream")
async def invoke_agent_stream(
    request: AgentInvokeRequest,
    user: Optional[User] = Depends(get_current_user),
):
    """流式调用Agent，通过SSE返回实时进度"""
    user_id = user.id if user else None
    return StreamingResponse(
        generate_agent_stream(request.query, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/status")
def get_agent_status(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
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
