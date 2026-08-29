from langchain_core.tools import tool
from typing import Dict, Any
from sqlalchemy.orm import Session
from database import SessionLocal
from models.domain import Doctor, Hospital, Product, SalesTarget, ComplianceAlert
from models.ontology import OntologyObject


def _gateway_submit(action_type: str, object_id: str, params: Dict[str, Any], user_id: str = "agent") -> str:
    db = SessionLocal()
    try:
        from actions.gateway import ActionGateway
        from actions.hard_rules import HardRuleViolation
        result = ActionGateway(db).submit(
            action_type=action_type,
            object_id=object_id,
            params=params,
            user_id=user_id,
        )
        db.commit()
        return json_result(result)
    except HardRuleViolation as exc:
        db.rollback()
        return f"BLOCKED {exc.rule_id}: {exc.message}"
    except Exception as e:
        db.rollback()
        return f"Gateway error: {str(e)}"
    finally:
        db.close()


def json_result(result: Dict[str, Any]) -> str:
    import json
    return json.dumps(result, ensure_ascii=False, default=str)


@tool
def get_customer_context(keyword: str) -> str:
    """Retrieve key statistics regarding Doctors, Hospitals, and prescription volumes. Use this when analyzing customer churn or territory overview."""
    db = SessionLocal()
    try:
        doctor_count = db.query(Doctor).count()
        hospital_count = db.query(Hospital).count()
        doctors = db.query(Doctor).join(OntologyObject, OntologyObject.id == Doctor.id).all()
        
        lines = []
        for d in doctors[:5]:
            obj = db.query(OntologyObject).filter(OntologyObject.id == d.id).first()
            name = obj.name if obj else d.id
            lines.append(f"- {name}：处方量 {d.prescription_volume or 'N/A'}，影响力 {d.influence_score or 'N/A'}")
        
        result = f"医生总数: {doctor_count}, 医院总数: {hospital_count}\n"
        if lines:
            result += "医生数据:\n" + "\n".join(lines)
        return result
    except Exception as e:
        return f"Error retrieving customer context: {str(e)}"
    finally:
        db.close()


@tool
def get_compliance_risks() -> str:
    """Check for active compliance risks or alerts."""
    db = SessionLocal()
    try:
        alerts = db.query(ComplianceAlert).all()
        if not alerts:
            return "当前无合规告警"
        
        lines = []
        for alert in alerts[:5]:
            lines.append(f"- 告警ID: {alert.id}, 类型: {alert.risk_type or 'N/A'}, 状态: {alert.alert_status or 'N/A'}")
        
        return f"当前合规告警数量: {len(alerts)} 条\n" + "\n".join(lines)
    except Exception as e:
        return f"Error retrieving compliance risks: {str(e)}"
    finally:
        db.close()


@tool
def get_sales_target_status() -> str:
    """Check current sales targets achievement."""
    db = SessionLocal()
    try:
        targets = db.query(SalesTarget).all()
        if not targets:
            return "暂无销售目标数据"
        
        avg_rate = sum(t.achievement_rate or 0 for t in targets) / len(targets)
        lines = []
        for t in targets[:5]:
            lines.append(f"- 目标: {t.target_type or 'N/A'}, 达成率: {t.achievement_rate or 'N/A'}%")
        
        return f"当前平均达成率: {avg_rate:.1f}%\n" + "\n".join(lines)
    except Exception as e:
        return f"Error retrieving sales target status: {str(e)}"
    finally:
        db.close()


@tool
def execute_action(action_type: str, target: str, params: Dict[str, Any]) -> str:
    """
    Propose a strategic action via Action Gateway. World-changing writes never bypass the gateway.
    action_type: e.g., 'increase_visits', 'send_academic_materials', 'adjust_budget'.
    target: The specific doctor, hospital, or region ID.
    params: specific arguments for the action.
    """
    merged = dict(params or {})
    merged.setdefault("description", merged.get("description", ""))
    return _gateway_submit(action_type, target, merged)


@tool
def create_visit_record(doctor_id: str, visit_date: str, notes: str = "") -> str:
    """Propose a visit record for a doctor via Action Gateway."""
    return _gateway_submit("create_visit_record", doctor_id, {"visitDate": visit_date, "notes": notes})


@tool
def update_doctor_sentiment(doctor_id: str, sentiment: str) -> str:
    """Propose a doctor sentiment update via Action Gateway."""
    return _gateway_submit("updateSentiment", doctor_id, {"sentiment": sentiment})


@tool
def flag_compliance_risk(entity_id: str, risk_type: str, severity: str = "medium") -> str:
    """Propose a compliance risk flag via Action Gateway."""
    return _gateway_submit("flagComplianceRisk", entity_id, {"riskType": risk_type, "severity": severity})


@tool
def send_notification(user_id: str, message: str, priority: str = "medium") -> str:
    """Propose a notification via Action Gateway (R1, no object required)."""
    return _gateway_submit("send_notification", None, {"user_id": user_id, "message": message, "priority": priority})


AGENT_TOOLS = [
    get_customer_context,
    get_compliance_risks,
    get_sales_target_status,
    execute_action,
    create_visit_record,
    update_doctor_sentiment,
    flag_compliance_risk,
    send_notification
]
