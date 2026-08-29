from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from auth import require_auth
from models.user import User
from models.domain import Doctor, Hospital
from models.ontology import OntologyObject
from pydantic import BaseModel


router = APIRouter(prefix="/api/insights", tags=["insights"])


class InsightItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    confidence: float
    evidence: List[dict]
    suggestedActions: List[str]
    relatedEntities: List[str]
    createdAt: str
    status: str


@router.get("/", response_model=List[InsightItem])
def get_insights(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
    sample_size: int = Query(3, ge=1, le=20),
):
    """Generate insights based on current data patterns."""
    high_q = db.query(Doctor).join(OntologyObject, OntologyObject.id == Doctor.id).filter(Doctor.influence_score > 7)
    high_count = high_q.count()
    high_ids = [row.id for row in high_q.limit(sample_size).all()]

    low_q = db.query(Doctor).join(OntologyObject, OntologyObject.id == Doctor.id).filter(Doctor.prescription_volume < 50)
    low_count = low_q.count()
    low_ids = [row.id for row in low_q.limit(sample_size).all()]

    hospital_count = db.query(func.count(Hospital.id)).join(OntologyObject, OntologyObject.id == Hospital.id).scalar() or 0
    hospital_ids = [row.id for row in db.query(Hospital.id).join(OntologyObject, OntologyObject.id == Hospital.id).limit(sample_size).all()]
    
    insights = []
    timestamp = "now"
    idx = 0
    
    if high_count > 0:
        idx += 1
        insights.append(InsightItem(
            id=f"insight_{idx}",
            type="opportunity",
            title="高影响力医生群体分析",
            description=f"系统识别到 {high_count} 位高影响力医生（评分>7），他们是关键意见领袖，对处方决策有重要影响",
            confidence=0.9,
            evidence=[{
                "type": "influence_analysis",
                "description": f"{high_count} 位医生影响力评分>7",
                "weight": 0.9
            }],
            suggestedActions=["制定KOL管理计划", "邀请参与学术会议", "建立长期合作关系"],
            relatedEntities=high_ids,
            createdAt=timestamp,
            status="active"
        ))
    
    if low_count > 0:
        idx += 1
        insights.append(InsightItem(
            id=f"insight_{idx}",
            type="trend",
            title="低处方量医生群体关注",
            description=f"系统识别到 {low_count} 位处方量偏低的医生（<50），需要分析原因并制定提升策略",
            confidence=0.85,
            evidence=[{
                "type": "volume_analysis",
                "description": f"{low_count} 位医生处方量<50",
                "weight": 0.85
            }],
            suggestedActions=["分析处方量偏低原因", "安排针对性拜访", "提供学术支持"],
            relatedEntities=low_ids,
            createdAt=timestamp,
            status="active"
        ))
    
    if hospital_count > 0:
        idx += 1
        insights.append(InsightItem(
            id=f"insight_{idx}",
            type="correlation",
            title="医院覆盖分析",
            description=f"当前覆盖 {hospital_count} 家医院，建议评估每家医院的医生覆盖深度和产品渗透率",
            confidence=0.8,
            evidence=[{
                "type": "coverage_analysis",
                "description": f"{hospital_count} 家医院已覆盖",
                "weight": 0.8
            }],
            suggestedActions=["评估医院覆盖深度", "分析产品渗透率", "制定医院分级管理策略"],
            relatedEntities=hospital_ids,
            createdAt=timestamp,
            status="active"
        ))
    
    return insights
