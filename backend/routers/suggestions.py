from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from auth import require_auth
from models.user import User
from models.domain import Doctor, Hospital, SalesTarget
from models.ontology import OntologyObject
from models.action import ActionProposal
from pydantic import BaseModel


router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])


class EvidenceItem(BaseModel):
    source: str
    observation: str
    weight: float


class SuggestedActionItem(BaseModel):
    actionName: str
    priority: str
    reason: str


class ReasoningChainItem(BaseModel):
    conclusion: str
    evidence: List[EvidenceItem]
    confidence: float
    alternativeHypotheses: list = []
    suggestedActions: List[SuggestedActionItem] = []


class ProactiveSuggestionResponse(BaseModel):
    id: str
    type: str
    priority: str
    title: str
    description: str
    targetEntities: List[str]
    reasoningChain: ReasoningChainItem
    suggestedActions: List[dict]
    expectedImpact: dict
    validUntil: str
    createdAt: str
    status: str


@router.get("/", response_model=List[ProactiveSuggestionResponse])
def get_suggestions(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Generate proactive suggestions based on current data."""
    doctor_rows = (
        db.query(Doctor, OntologyObject)
        .join(OntologyObject, OntologyObject.id == Doctor.id)
        .filter(Doctor.prescription_volume < 80)
        .offset(offset)
        .limit(limit)
        .all()
    )
    remaining = max(0, limit - len(doctor_rows))
    targets = []
    if remaining:
        targets = (
            db.query(SalesTarget)
            .filter(SalesTarget.achievement_rate < 80)
            .limit(remaining)
            .all()
        )
    
    suggestions = []
    timestamp = "now"
    idx = 0
    
    for doctor, obj in doctor_rows:
        name = obj.name if obj else doctor.id
        
        if doctor.prescription_volume and doctor.prescription_volume < 80:
            idx += 1
            suggestions.append(ProactiveSuggestionResponse(
                id=f"suggestion_{idx}",
                type="risk_alert",
                priority="high",
                title=f"{name} 处方量风险预警",
                description=f"{name} 当前处方量 {doctor.prescription_volume}，低于预期水平",
                targetEntities=[doctor.id],
                reasoningChain=ReasoningChainItem(
                    conclusion=f"{name} 需要增加关注和资源投入",
                    evidence=[
                        EvidenceItem(source="prescription_data", observation=f"处方量 {doctor.prescription_volume}", weight=0.8),
                        EvidenceItem(source="influence_score", observation=f"影响力 {doctor.influence_score}", weight=0.6)
                    ],
                    confidence=0.85,
                    suggestedActions=[
                        SuggestedActionItem(actionName="安排拜访", priority="high", reason="了解处方量下降原因"),
                        SuggestedActionItem(actionName="制定学术支持计划", priority="medium", reason="提升产品认知度")
                    ]
                ),
                suggestedActions=[
                    {"id": "act_1", "type": "visit", "name": "安排拜访", "description": f"拜访{name}了解需求", "priority": "high"},
                    {"id": "act_2", "type": "academic", "name": "学术支持", "description": "提供学术资料支持", "priority": "medium"}
                ],
                expectedImpact={
                    "metric": "处方量",
                    "currentValue": doctor.prescription_volume or 0,
                    "projectedValue": (doctor.prescription_volume or 0) * 1.2,
                    "changePercent": 20,
                    "confidence": 0.75
                },
                validUntil="2026-05-15T00:00:00",
                createdAt=timestamp,
                status="active"
            ))
    
    for target in targets:
        if target.achievement_rate and target.achievement_rate < 80:
            idx += 1
            suggestions.append(ProactiveSuggestionResponse(
                id=f"suggestion_{idx}",
                type="optimization_suggestion",
                priority="high",
                title=f"销售目标达成风险: {target.target_type}",
                description=f"当前达成率 {target.achievement_rate}%，需要调整策略",
                targetEntities=[],
                reasoningChain=ReasoningChainItem(
                    conclusion="需要重新评估资源配置和策略",
                    evidence=[
                        EvidenceItem(source="target_data", observation=f"达成率 {target.achievement_rate}%", weight=0.9)
                    ],
                    confidence=0.9,
                    suggestedActions=[
                        SuggestedActionItem(actionName="调整资源分配", priority="high", reason="提升目标达成率"),
                        SuggestedActionItem(actionName="制定追赶计划", priority="high", reason="缩小目标差距")
                    ]
                ),
                suggestedActions=[
                    {"id": "act_3", "type": "resource", "name": "调整资源", "description": "优化资源配置", "priority": "high"}
                ],
                expectedImpact={
                    "metric": "达成率",
                    "currentValue": target.achievement_rate or 0,
                    "projectedValue": (target.achievement_rate or 0) + 10,
                    "changePercent": 10,
                    "confidence": 0.8
                },
                validUntil="2026-05-15T00:00:00",
                createdAt=timestamp,
                status="active"
            ))
    
    return suggestions


class SummaryResponse(BaseModel):
    summary: str
    pending_count: int
    critical_alert_count: int
    avg_achievement_rate: Optional[float] = None
    declining_doctors: List[str] = []
    monitored_entity_count: int = 0
    last_scan_time: str = ""


@router.get("/summary", response_model=SummaryResponse)
def get_summary(
    db: Session = Depends(get_db),
):
    """Generate AI summary based on real backend data."""
    parts = []

    pending_count = db.query(ActionProposal).filter(ActionProposal.status == "pending").count()
    if pending_count > 0:
        parts.append(f"今日有 {pending_count} 项待决策事项需要处理")

    critical_alert_count = db.query(OntologyObject).filter(OntologyObject.status == "critical").count()
    if critical_alert_count > 0:
        parts.append(f"{critical_alert_count} 条高风险预警需要关注")

    avg_rate = db.query(func.avg(SalesTarget.achievement_rate)).filter(SalesTarget.achievement_rate.isnot(None)).scalar()
    if avg_rate is not None:
        avg_rate = float(avg_rate)
        parts.append(f"Q1 销售目标平均达成率 {avg_rate:.1f}%")

    doctor_objects = db.query(OntologyObject).filter(
        OntologyObject.object_type == "Doctor",
        OntologyObject.status.in_(["warning", "critical"])
    ).limit(3).all()
    declining_doctors = [o.name for o in doctor_objects]
    declining_count = db.query(OntologyObject).filter(
        OntologyObject.object_type == "Doctor",
        OntologyObject.status.in_(["warning", "critical"])
    ).count()
    if declining_doctors:
        parts.append(f"{declining_count} 位医生状态异常（{'、'.join(declining_doctors)}）")

    total_entities = db.query(OntologyObject).count()

    if not parts:
        summary = "今日系统运行正常，无待决策事项。AI 持续监控中，发现异常将立即通知您。"
    else:
        summary = "；".join(parts) + "。"

    from datetime import datetime, timezone
    last_scan = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

    return SummaryResponse(
        summary=summary,
        pending_count=pending_count,
        critical_alert_count=critical_alert_count,
        avg_achievement_rate=avg_rate,
        declining_doctors=declining_doctors,
        monitored_entity_count=total_entities,
        last_scan_time=last_scan,
    )
