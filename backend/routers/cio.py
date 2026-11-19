"""CIO view: governance facts about the AI layer (read-only)."""

from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from actions.contracts import CONTRACTS
from auth import require_auth
from database import get_db
from llm import llm_info
from models.audit import AuditLog
from models.user import User
from services.audit_chain import verify_chain

router = APIRouter(prefix="/api/cio", tags=["cio"])

HARD_RULES = [
    {"id": "HR-001", "title": "无对象不得写", "desc": "任何写操作必须指向一个具体业务对象。"},
    {"id": "HR-002", "title": "高风险必审批", "desc": "R2 及以上风险的动作，未经人工审批不得执行。"},
    {"id": "HR-003", "title": "提交人不得终审", "desc": "AI 或个人提交的动作，不能由同一主体批准（职责分离）。"},
    {"id": "HR-004", "title": "动作须适用于对象类型", "desc": "动作契约声明了适用的对象类型，类型不符直接拒绝。"},
]

GUARANTEES = [
    "事实只来自 ERP/CRM，AI 层不承担业务录入",
    "AI 与人走同一条写入通道：行动网关，没有第二条路径",
    "每次放行、拦截、审批都写入哈希链审计日志，可校验未被篡改",
    "大模型只负责解释与规划；数字必须能追溯到数据，否则标注",
    "大模型不可用时自动降级为确定性逻辑，不中断业务",
]


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(require_auth)) -> Dict[str, Any]:
    from models.action import ActionProposal

    chain = verify_chain(db)
    recent = db.query(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(8).all()
    status_rows = db.query(ActionProposal.status, func.count(ActionProposal.id)).group_by(ActionProposal.status).all()
    by_status = {s or "unknown": n for s, n in status_rows}
    ai_total = db.query(func.count(ActionProposal.id)).filter(ActionProposal.proposed_by == "ai_agent").scalar() or 0
    return {
        "guarantees": GUARANTEES,
        "hard_rules": HARD_RULES,
        "contracts": [
            {"action": c.action_type, "risk": c.risk_level, "requires_approval": c.requires_approval, "applies_to": c.applies_to}
            for c in sorted(CONTRACTS.values(), key=lambda c: (c.risk_level, c.action_type))
        ],
        "audit": {
            "chain": chain,
            "recent": [
                {
                    "id": r.id, "action": r.action, "user_id": r.user_id, "entity_id": r.entity_id,
                    "hash": (r.record_hash or "")[:12], "prev": (r.prev_hash or "")[:12],
                    "at": r.timestamp.isoformat() if r.timestamp else None,
                }
                for r in recent
            ],
        },
        "proposals": {"by_status": by_status, "by_ai_agent": ai_total},
        "llm": llm_info(),
    }
