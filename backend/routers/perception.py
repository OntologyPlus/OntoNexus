from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from auth import require_auth
from models.user import User
from models.domain import Doctor, Hospital, SalesTarget, ComplianceAlert
from models.ontology import OntologyObject, TimeSeriesData, ObjectEvent, ObjectLink
from pydantic import BaseModel
from services.reasoning_service import attribution_analysis

router = APIRouter(prefix="/api/perception", tags=["perception"])


class PerceptionResult(BaseModel):
    entity_id: str
    entity_name: str
    entity_type: str
    state: str
    anomalies: List[dict]
    patterns: List[dict]
    alerts: List[dict]
    risk_score: float
    churn_probability: float
    loyalty_score: float
    attribution: Optional[dict] = None


def analyze_prescription_trend(db: Session, doctor_id: str, months: int = 6) -> Dict[str, Any]:
    ts_data = db.query(TimeSeriesData).filter(
        TimeSeriesData.object_id == doctor_id,
        TimeSeriesData.series_name == "prescriptionVolume"
    ).order_by(TimeSeriesData.timestamp.desc()).limit(months).all()

    if len(ts_data) < 2:
        latest = ts_data[0].value if ts_data else None
        return {
            "trend": "stable", "change_pct": 0, "consecutive_decline": False, "data_points": [],
            "latest_value": latest, "period_high": latest, "period_low": latest,
        }

    values = [(d.timestamp, d.value) for d in reversed(ts_data)]
    data_points = [{"timestamp": v[0], "value": v[1]} for v in values]

    first_value = values[0][1]
    last_value = values[-1][1]
    change_pct = ((last_value - first_value) / first_value * 100) if first_value > 0 else 0

    consecutive_decline = True
    for i in range(1, len(values)):
        if values[i][1] >= values[i - 1][1]:
            consecutive_decline = False
            break

    if change_pct < -20:
        trend = "declining"
    elif change_pct > 15:
        trend = "rising"
    else:
        trend = "stable"

    return {
        "trend": trend,
        "change_pct": round(change_pct, 1),
        "consecutive_decline": consecutive_decline,
        "data_points": data_points,
        "latest_value": last_value,
        "period_high": max(v[1] for v in values),
        "period_low": min(v[1] for v in values),
    }


def analyze_visit_gap(db: Session, doctor: Doctor) -> Dict[str, Any]:
    if not doctor.last_visit_date:
        return {"days_since_visit": 999, "is_gap": True, "severity": "high"}

    try:
        last_visit = datetime.strptime(doctor.last_visit_date, "%Y-%m-%d")
        days_since = (datetime.now() - last_visit).days
    except (ValueError, TypeError):
        return {"days_since_visit": 999, "is_gap": True, "severity": "high"}

    recommended_interval = 14
    is_gap = days_since > recommended_interval * 2
    severity = "high" if days_since > recommended_interval * 3 else "medium" if days_since > recommended_interval * 2 else "low"

    return {
        "days_since_visit": days_since,
        "is_gap": is_gap,
        "severity": severity,
        "recommended_interval": recommended_interval,
    }


def analyze_recent_events(db: Session, entity_id: str, limit: int = 3) -> List[Dict[str, Any]]:
    events = db.query(ObjectEvent).filter(
        ObjectEvent.object_id == entity_id
    ).order_by(desc(ObjectEvent.timestamp)).limit(limit).all()

    return [{
        "id": e.id,
        "type": e.event_type,
        "timestamp": e.timestamp,
        "description": e.description,
    } for e in events]


def analyze_competitor_activities(db: Session, entity_id: str) -> Dict[str, Any]:
    links = db.query(ObjectLink).filter(
        ObjectLink.source_id == entity_id,
        ObjectLink.link_type == "WORKS_AT"
    ).all()

    hospital_ids = [link.target_id for link in links]

    activities = db.query(ObjectEvent).filter(
        ObjectEvent.event_type == "CompetitorActivity",
        ObjectEvent.object_id.in_(hospital_ids) if hospital_ids else False
    ).all()

    return {
        "activity_count": len(activities),
        "recent_activities": [{
            "description": a.description,
            "timestamp": a.timestamp,
        } for a in activities[:3]]
    }


def analyze_hospital_perception(db: Session, hospital: Hospital, obj: OntologyObject) -> Dict[str, Any]:
    risk_score = 0.0
    anomalies = []
    patterns = []
    alerts = []

    if hospital.access_status == "pending":
        risk_score += 0.2
        anomalies.append({
            "type": "access_pending",
            "description": f"{obj.name} 准入状态为待审批",
            "severity": "medium",
            "confidence": 0.7
        })
    elif hospital.access_status == "restricted":
        risk_score += 0.4
        anomalies.append({
            "type": "access_restricted",
            "description": f"{obj.name} 准入受限",
            "severity": "high",
            "confidence": 0.85
        })

    doctors_at_hospital = db.query(Doctor).join(
        ObjectLink, ObjectLink.target_id == hospital.id
    ).filter(
        ObjectLink.source_id == Doctor.id,
        ObjectLink.link_type == "WORKS_AT"
    ).all()

    if doctors_at_hospital:
        declining_count = 0
        for doc in doctors_at_hospital:
            trend = analyze_prescription_trend(db, doc.id)
            if trend["trend"] == "declining":
                declining_count += 1

        decline_ratio = declining_count / len(doctors_at_hospital)
        if decline_ratio > 0.5:
            risk_score += 0.3
            alerts.append({
                "type": "doctor_decline",
                "title": f"{obj.name} 超过半数医生处方量下降",
                "description": f"{declining_count}/{len(doctors_at_hospital)} 位医生处方量呈下降趋势",
                "severity": "high",
                "suggestedActions": ["分析医院整体处方趋势", "安排区域学术活动"],
                "relatedMetrics": ["处方量趋势", "医生覆盖率"],
                "confidence": 0.8
            })

    competitor_info = analyze_competitor_activities(db, hospital.id)
    if competitor_info["activity_count"] > 0:
        risk_score += 0.1 * min(competitor_info["activity_count"], 3)
        patterns.append({
            "type": "competitor_presence",
            "description": f"近期发现 {competitor_info['activity_count']} 次竞品活动",
            "confidence": 0.75,
            "details": competitor_info["recent_activities"]
        })

    if hospital.annual_revenue:
        patterns.append({
            "type": "hospital_revenue",
            "description": f"{obj.name} 年度营收 {hospital.annual_revenue:,.0f}",
            "confidence": 0.9
        })

    if risk_score > 0.6:
        state = "critical"
    elif risk_score > 0.3:
        state = "warning"
    else:
        state = "stable"

    if not patterns:
        patterns.append({
            "type": "hospital_coverage",
            "description": f"{obj.name} 覆盖情况正常",
            "confidence": 0.8
        })

    return {
        "risk_score": min(risk_score, 1.0),
        "state": state,
        "anomalies": anomalies,
        "patterns": patterns,
        "alerts": alerts,
        "churn_probability": round(min(risk_score * 0.6, 0.8), 2),
        "loyalty_score": round(max(1.0 - risk_score * 0.5, 0.3), 2),
    }


@router.post("/run", response_model=List[PerceptionResult])
def run_perception(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Run perception analysis on all entities and return results."""
    doctors = db.query(Doctor).join(OntologyObject, OntologyObject.id == Doctor.id).all()
    hospitals = db.query(Hospital).join(OntologyObject, OntologyObject.id == Hospital.id).all()

    results = []

    for doctor in doctors:
        obj = db.query(OntologyObject).filter(OntologyObject.id == doctor.id).first()
        name = obj.name if obj else doctor.id

        anomalies = []
        alerts = []
        patterns = []
        risk_score = 0.0

        trend_info = analyze_prescription_trend(db, doctor.id)
        visit_gap = analyze_visit_gap(db, doctor)
        recent_events = analyze_recent_events(db, doctor.id)

        if trend_info["trend"] == "declining":
            risk_score += 0.4 * min(abs(trend_info["change_pct"]) / 30, 1.0)
            anomalies.append({
                "type": "prescription_decline",
                "description": f"{name} 处方量{trend_info['change_pct']}%下降（{trend_info['period_high']}→{trend_info['latest_value']}）",
                "severity": "high" if trend_info["consecutive_decline"] else "medium",
                "confidence": 0.9 if trend_info["consecutive_decline"] else 0.75,
                "trend_data": trend_info["data_points"]
            })
            alerts.append({
                "type": "risk",
                "title": f"{name} 处方量持续下降",
                "description": f"近6个月处方量从 {trend_info['period_high']} 降至 {trend_info['latest_value']}，下降 {abs(trend_info['change_pct'])}%",
                "severity": "high" if trend_info["consecutive_decline"] else "medium",
                "suggestedActions": ["安排拜访了解情况", "分析竞品渗透影响", "准备学术支持方案"],
                "relatedMetrics": ["处方量趋势", "拜访频率"],
                "confidence": 0.85
            })
            patterns.append({
                "type": "prescription_trend",
                "description": f"{name} 处方量{'连续' if trend_info['consecutive_decline'] else ''}下降 {abs(trend_info['change_pct'])}%",
                "confidence": 0.85,
                "trend_data": trend_info["data_points"]
            })
        elif trend_info["trend"] == "rising":
            risk_score -= 0.1
            patterns.append({
                "type": "prescription_trend",
                "description": f"{name} 处方量上升 {trend_info['change_pct']}%（{trend_info['period_low']}→{trend_info['latest_value']}）",
                "confidence": 0.8
            })
        else:
            lv = trend_info.get('latest_value')
            patterns.append({
                "type": "prescription_trend",
                "description": f"{name} 处方量稳定在 {lv if lv is not None else 'N/A'} 左右",
                "confidence": 0.7
            })

        if visit_gap["is_gap"]:
            risk_score += 0.2
            anomalies.append({
                "type": "visit_gap",
                "description": f"{name} 距上次拜访 {visit_gap['days_since_visit']} 天",
                "severity": visit_gap["severity"],
                "confidence": 0.8
            })
            alerts.append({
                "type": "visit_reminder",
                "title": f"{name} 拜访间隔过长",
                "description": f"距上次拜访已 {visit_gap['days_since_visit']} 天，建议尽快安排",
                "severity": visit_gap["severity"],
                "suggestedActions": ["安排学术拜访", "准备拜访材料"],
                "relatedMetrics": ["拜访频率"],
                "confidence": 0.75
            })

        risk_score += 0.2 if obj.status == "warning" else 0.35 if obj.status == "critical" else 0
        risk_score = max(0, min(risk_score, 1.0))

        if doctor.influence_score and doctor.influence_score > 70:
            loyalty_score = 0.6 + (doctor.influence_score - 70) / 100
        elif doctor.influence_score and doctor.influence_score > 50:
            loyalty_score = 0.5
        else:
            loyalty_score = 0.35

        if trend_info["trend"] == "declining":
            loyalty_score -= 0.15
        elif trend_info["trend"] == "rising":
            loyalty_score += 0.1
        loyalty_score = max(0.1, min(loyalty_score, 1.0))

        churn_prob = 0.2
        if trend_info["trend"] == "declining":
            churn_prob += 0.3 * min(abs(trend_info["change_pct"]) / 40, 1.0)
        if visit_gap["is_gap"]:
            churn_prob += 0.2
        if obj.status == "at_risk":
            churn_prob += 0.2
        churn_prob = max(0.05, min(churn_prob, 0.95))

        for event in recent_events:
            if "Competitor" in event.get("type", ""):
                risk_score += 0.1
                patterns.append({
                    "type": "competitor_impact",
                    "description": f"近期事件：{event['description']}",
                    "confidence": 0.7
                })

        if not patterns:
            patterns.append({
                "type": "status_normal",
                "description": f"{name} 各项指标正常",
                "confidence": 0.7
            })

        state = "critical" if risk_score > 0.6 else "warning" if risk_score > 0.3 else "stable"

        results.append(PerceptionResult(
            entity_id=doctor.id,
            entity_name=name,
            entity_type="doctor",
            state=state,
            anomalies=anomalies,
            patterns=patterns,
            alerts=alerts,
            risk_score=round(risk_score, 2),
            churn_probability=round(churn_prob, 2),
            loyalty_score=round(loyalty_score, 2)
        ))

    for hospital in hospitals:
        obj = db.query(OntologyObject).filter(OntologyObject.id == hospital.id).first()
        name = obj.name if obj else hospital.id

        hosp_analysis = analyze_hospital_perception(db, hospital, obj)

        results.append(PerceptionResult(
            entity_id=hospital.id,
            entity_name=name,
            entity_type="hospital",
            state=hosp_analysis["state"],
            anomalies=hosp_analysis["anomalies"],
            patterns=hosp_analysis["patterns"],
            alerts=hosp_analysis["alerts"],
            risk_score=hosp_analysis["risk_score"],
            churn_probability=hosp_analysis["churn_probability"],
            loyalty_score=hosp_analysis["loyalty_score"]
        ))

    for result in results:
        obj = db.query(OntologyObject).filter(OntologyObject.id == result.entity_id).first()
        if obj:
            obj.status = result.state
    db.commit()

    return results


class PerceptionEntityResponse(BaseModel):
    entity_id: str
    entity_name: str
    entity_type: str
    state: str
    anomalies: List[dict]
    patterns: List[dict]
    alerts: List[dict]
    risk_score: float
    churn_probability: float
    loyalty_score: float


@router.get("/{entity_id}", response_model=PerceptionEntityResponse)
def get_entity_perception(
    entity_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get perception analysis for a specific entity."""
    doctor = db.query(Doctor).filter(Doctor.id == entity_id).first()
    if not doctor:
        hospital = db.query(Hospital).filter(Hospital.id == entity_id).first()
        if not hospital:
            raise HTTPException(status_code=404, detail="Entity not found")

        obj = db.query(OntologyObject).filter(OntologyObject.id == hospital.id).first()
        name = obj.name if obj else hospital.id

        hosp_analysis = analyze_hospital_perception(db, hospital, obj)

        return PerceptionEntityResponse(
            entity_id=hospital.id,
            entity_name=name,
            entity_type="hospital",
            state=hosp_analysis["state"],
            anomalies=hosp_analysis["anomalies"],
            patterns=hosp_analysis["patterns"],
            alerts=hosp_analysis["alerts"],
            risk_score=hosp_analysis["risk_score"],
            churn_probability=hosp_analysis["churn_probability"],
            loyalty_score=hosp_analysis["loyalty_score"]
        )

    obj = db.query(OntologyObject).filter(OntologyObject.id == doctor.id).first()
    name = obj.name if obj else doctor.id

    trend_info = analyze_prescription_trend(db, doctor.id)
    visit_gap = analyze_visit_gap(db, doctor)
    recent_events = analyze_recent_events(db, doctor.id)

    anomalies = []
    alerts = []
    patterns = []
    risk_score = 0.0

    if trend_info["trend"] == "declining":
        risk_score += 0.4 * min(abs(trend_info["change_pct"]) / 30, 1.0)
        anomalies.append({
            "type": "prescription_decline",
            "description": f"{name} 处方量{trend_info['change_pct']}%下降",
            "severity": "high" if trend_info["consecutive_decline"] else "medium",
            "confidence": 0.9 if trend_info["consecutive_decline"] else 0.75,
        })
        alerts.append({
            "type": "risk",
            "title": f"{name} 处方量持续下降",
            "description": f"近6个月处方量从 {trend_info['period_high']} 降至 {trend_info['latest_value']}，下降 {abs(trend_info['change_pct'])}%",
            "severity": "high" if trend_info["consecutive_decline"] else "medium",
            "suggestedActions": ["安排拜访了解情况", "分析竞品渗透影响"],
            "relatedMetrics": ["处方量趋势"],
            "confidence": 0.85
        })
        patterns.append({
            "type": "prescription_trend",
            "description": f"{name} 处方量{'连续' if trend_info['consecutive_decline'] else ''}下降 {abs(trend_info['change_pct'])}%",
            "confidence": 0.85,
        })
    elif trend_info["trend"] == "rising":
        patterns.append({
            "type": "prescription_trend",
            "description": f"{name} 处方量上升 {trend_info['change_pct']}%",
            "confidence": 0.8
        })

    if visit_gap["is_gap"]:
        risk_score += 0.2
        anomalies.append({
            "type": "visit_gap",
            "description": f"{name} 距上次拜访 {visit_gap['days_since_visit']} 天",
            "severity": visit_gap["severity"],
            "confidence": 0.8
        })

    risk_score += 0.2 if obj.status == "warning" else 0.35 if obj.status == "critical" else 0
    risk_score = max(0, min(risk_score, 1.0))

    state = "critical" if risk_score > 0.6 else "warning" if risk_score > 0.3 else "stable"

    if doctor.influence_score and doctor.influence_score > 70:
        loyalty_score = 0.6 + (doctor.influence_score - 70) / 100
    else:
        loyalty_score = 0.35

    if trend_info["trend"] == "declining":
        loyalty_score -= 0.15
    loyalty_score = max(0.1, min(loyalty_score, 1.0))

    churn_prob = 0.2
    if trend_info["trend"] == "declining":
        churn_prob += 0.3 * min(abs(trend_info["change_pct"]) / 40, 1.0)
    if visit_gap["is_gap"]:
        churn_prob += 0.2
    churn_prob = max(0.05, min(churn_prob, 0.95))

    for event in recent_events:
        patterns.append({
            "type": "recent_event",
            "description": event["description"],
            "confidence": 0.7
        })

    return PerceptionEntityResponse(
        entity_id=doctor.id,
        entity_name=name,
        entity_type="doctor",
        state=state,
        anomalies=anomalies,
        patterns=patterns,
        alerts=alerts,
        risk_score=round(risk_score, 2),
        churn_probability=round(churn_prob, 2),
        loyalty_score=round(loyalty_score, 2)
    )


@router.post("/{entity_id}/with-attribution")
def get_entity_perception_with_attribution(
    entity_id: str,
    target_metric: str = "prescription_volume",
    period: str = "90d",
    method: str = "shapley",
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get perception analysis with automatic attribution linkage."""
    doctor = db.query(Doctor).filter(Doctor.id == entity_id).first()
    if not doctor:
        hospital = db.query(Hospital).filter(Hospital.id == entity_id).first()
        if not hospital:
            raise HTTPException(status_code=404, detail="Entity not found")

        obj = db.query(OntologyObject).filter(OntologyObject.id == hospital.id).first()
        name = obj.name if obj else hospital.id
        hosp_analysis = analyze_hospital_perception(db, hospital, obj)

        attribution_result = attribution_analysis(db, entity_id, target_metric, period, method)

        return {
            "entity_id": hospital.id,
            "entity_name": name,
            "entity_type": "hospital",
            "state": hosp_analysis["state"],
            "anomalies": hosp_analysis["anomalies"],
            "patterns": hosp_analysis["patterns"],
            "alerts": hosp_analysis["alerts"],
            "risk_score": hosp_analysis["risk_score"],
            "churn_probability": hosp_analysis["churn_probability"],
            "loyalty_score": hosp_analysis["loyalty_score"],
            "attribution": attribution_result,
        }

    obj = db.query(OntologyObject).filter(OntologyObject.id == doctor.id).first()
    name = obj.name if obj else doctor.id

    trend_info = analyze_prescription_trend(db, doctor.id)
    visit_gap = analyze_visit_gap(db, doctor)
    recent_events = analyze_recent_events(db, doctor.id)

    anomalies = []
    alerts = []
    patterns = []
    risk_score = 0.0

    if trend_info["trend"] == "declining":
        risk_score += 0.4 * min(abs(trend_info["change_pct"]) / 30, 1.0)
        anomalies.append({
            "type": "prescription_decline",
            "description": f"{name} 处方量{trend_info['change_pct']}%下降",
            "severity": "high" if trend_info["consecutive_decline"] else "medium",
            "confidence": 0.9 if trend_info["consecutive_decline"] else 0.75,
        })
        alerts.append({
            "type": "risk",
            "title": f"{name} 处方量持续下降",
            "description": f"近6个月处方量从 {trend_info['period_high']} 降至 {trend_info['latest_value']}，下降 {abs(trend_info['change_pct'])}%",
            "severity": "high" if trend_info["consecutive_decline"] else "medium",
            "suggestedActions": ["安排拜访了解情况", "分析竞品渗透影响"],
            "relatedMetrics": ["处方量趋势"],
            "confidence": 0.85
        })
        patterns.append({
            "type": "prescription_trend",
            "description": f"{name} 处方量{'连续' if trend_info['consecutive_decline'] else ''}下降 {abs(trend_info['change_pct'])}%",
            "confidence": 0.85,
        })
    elif trend_info["trend"] == "rising":
        patterns.append({
            "type": "prescription_trend",
            "description": f"{name} 处方量上升 {trend_info['change_pct']}%",
            "confidence": 0.8
        })

    if visit_gap["is_gap"]:
        risk_score += 0.2
        anomalies.append({
            "type": "visit_gap",
            "description": f"{name} 距上次拜访 {visit_gap['days_since_visit']} 天",
            "severity": visit_gap["severity"],
            "confidence": 0.8
        })

    risk_score += 0.2 if obj.status == "warning" else 0.35 if obj.status == "critical" else 0
    risk_score = max(0, min(risk_score, 1.0))

    state = "critical" if risk_score > 0.6 else "warning" if risk_score > 0.3 else "stable"

    if doctor.influence_score and doctor.influence_score > 70:
        loyalty_score = 0.6 + (doctor.influence_score - 70) / 100
    else:
        loyalty_score = 0.35

    if trend_info["trend"] == "declining":
        loyalty_score -= 0.15
    loyalty_score = max(0.1, min(loyalty_score, 1.0))

    churn_prob = 0.2
    if trend_info["trend"] == "declining":
        churn_prob += 0.3 * min(abs(trend_info["change_pct"]) / 40, 1.0)
    if visit_gap["is_gap"]:
        churn_prob += 0.2
    churn_prob = max(0.05, min(churn_prob, 0.95))

    for event in recent_events:
        patterns.append({
            "type": "recent_event",
            "description": event["description"],
            "confidence": 0.7
        })

    attribution_result = attribution_analysis(db, entity_id, target_metric, period, method)

    return {
        "entity_id": doctor.id,
        "entity_name": name,
        "entity_type": "doctor",
        "state": state,
        "anomalies": anomalies,
        "patterns": patterns,
        "alerts": alerts,
        "risk_score": round(risk_score, 2),
        "churn_probability": round(churn_prob, 2),
        "loyalty_score": round(loyalty_score, 2),
        "attribution": attribution_result,
    }
