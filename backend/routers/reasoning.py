from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.user import User
from services.reasoning_service import (
    validate_consistency, causal_reasoning, temporal_reasoning, implicit_relation_mining,
    attribution_analysis, multi_dimension_attribution, validate_attribution, generate_attribution_report,
)

router = APIRouter(prefix="/api/reasoning", tags=["reasoning"])


@router.post("/validate")
def validate(
    object_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    return validate_consistency(db, object_type)


@router.post("/causal")
def causal(
    source_id: str = Query(...),
    depth: int = Query(2, ge=1, le=5),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    return causal_reasoning(db, source_id, depth)


@router.post("/temporal")
def temporal(
    object_id: str = Query(...),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    return temporal_reasoning(db, object_id)


@router.post("/implicit-relations")
def implicit_relations(
    object_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    return implicit_relation_mining(db, object_type)


@router.post("/abductive")
def abductive(
    observation: str = Query(...),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    from models.domain import Doctor, Hospital
    from models.ontology import OntologyObject, TimeSeriesData, ObjectEvent
    from sqlalchemy import desc

    results = []
    doctors = db.query(Doctor).join(OntologyObject).all()
    for doctor in doctors:
        obj = db.query(OntologyObject).filter(OntologyObject.id == doctor.id).first()
        if obj and (obj.status == "warning" or obj.status == "critical"):
            ts = db.query(TimeSeriesData).filter(
                TimeSeriesData.object_id == doctor.id,
                TimeSeriesData.series_name == "prescriptionVolume"
            ).order_by(desc(TimeSeriesData.timestamp)).limit(3).all()
            
            explanations = []
            if len(ts) >= 2 and ts[-1].value < ts[0].value:
                explanations.append(f"处方量从{ts[0].value}降至{ts[-1].value}，可能存在竞品渗透或客户关系变化")
            
            events = db.query(ObjectEvent).filter(
                ObjectEvent.object_id == doctor.id
            ).order_by(desc(ObjectEvent.timestamp)).limit(2).all()
            for event in events:
                if "竞品" in event.description or "下降" in event.description:
                    explanations.append(f"近期事件：{event.description}")
            
            if not explanations:
                explanations.append("需要更多数据来确定原因")
            
            results.append({
                "entityId": doctor.id,
                "entityName": obj.name,
                "observation": observation,
                "explanations": explanations,
                "confidence": 0.7 if explanations else 0.3,
            })
    
    return {"observations": observation, "abductiveResults": results, "totalFound": len(results)}


@router.post("/status")
def reasoning_status(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    return {
        "implemented": ["validate", "causal", "temporal", "implicit-relations", "abductive", "attribution", "attribution-dimensions", "attribution-validate", "attribution-report"],
        "beta": ["analogy", "counterfactual"],
        "planned": ["hierarchical", "multi-step", "constraint-check", "coordination"],
    }


@router.post("/attribution")
def attribution(
    target_id: str = Query(..., description="目标实体ID"),
    target_metric: str = Query("prescription_volume", description="目标指标"),
    period: str = Query("90d", description="分析周期"),
    method: str = Query("shapley", description="归因方法"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """
    量化归因分析 API
    
    计算各因素对目标指标变化的贡献度百分比。
    
    支持的归因方法:
    - shapley: 基于 Shapley 值的多因素贡献分配
    - regression: 基于线性回归系数的贡献度计算
    - decomposition: 时间序列分解归因
    - comparison: 对比分析归因
    """
    return attribution_analysis(db, target_id, target_metric, period, method)


@router.post("/attribution/dimensions")
def attribution_dimensions(
    target_id: str = Query(..., description="目标实体ID"),
    target_metric: str = Query("prescription_volume", description="目标指标"),
    period: str = Query("90d", description="分析周期"),
    dimensions: Optional[str] = Query(None, description="维度列表，逗号分隔"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """
    多维度归因分析 API
    
    支持从客户、产品、时间、行为、竞争等维度进行归因拆解。
    """
    dims = dimensions.split(",") if dimensions else None
    return multi_dimension_attribution(db, target_id, target_metric, period, dims)


@router.post("/attribution/validate")
def attribution_validate_endpoint(
    target_id: str = Query(..., description="目标实体ID"),
    target_metric: str = Query("prescription_volume", description="目标指标"),
    period: str = Query("90d", description="分析周期"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """
    归因假设验证 API
    
    通过历史回测、交叉验证、敏感性分析等方法验证归因结论的有效性。
    """
    return validate_attribution(db, target_id, target_metric, period)


@router.post("/attribution/report")
def attribution_report(
    target_id: str = Query(..., description="目标实体ID"),
    target_metric: str = Query("prescription_volume", description="目标指标"),
    period: str = Query("90d", description="分析周期"),
    format: str = Query("json", description="报告格式"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """
    归因分析报告 API
    生成结构化的归因分析报告，包含执行摘要、详细归因、多维拆解、趋势分析、建议行动等。
    """
    return generate_attribution_report(db, target_id, target_metric, period, format)
