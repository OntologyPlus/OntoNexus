from typing import List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from models.ontology import OntologyObject
from models.domain import SalesTarget, BudgetCategory, VisitFeedback


def get_decision_effects(db: Session, decision_id: str) -> Dict[str, Any]:
    from models.decision import DecisionRecord

    rec = db.query(DecisionRecord).filter(DecisionRecord.id == decision_id).first()
    if rec:
        metrics = _compute_metrics(db, None)
        return {
            "decisionId": rec.id,
            "decisionName": rec.category,
            "decisionType": rec.outcome,
            "scenario": rec.scenario,
            "reasoning": rec.reasoning,
            "metrics": metrics,
            "computedAt": datetime.now(timezone.utc).isoformat(),
        }

    obj = db.query(OntologyObject).filter(OntologyObject.id == decision_id).first()
    if not obj:
        return {"error": "Decision not found", "metrics": []}

    metrics = _compute_metrics(db, obj)
    return {
        "decisionId": decision_id,
        "decisionName": obj.name,
        "decisionType": obj.object_type,
        "metrics": metrics,
        "computedAt": datetime.now(timezone.utc).isoformat(),
    }


def _compute_metrics(db: Session, decision_obj) -> List[Dict[str, Any]]:
    metrics = []

    sales_growth = _compute_sales_growth(db)
    metrics.append(sales_growth)

    customer_satisfaction = _compute_customer_satisfaction(db)
    metrics.append(customer_satisfaction)

    execution_efficiency = _compute_execution_efficiency(db, decision_obj)
    metrics.append(execution_efficiency)

    resource_utilization = _compute_resource_utilization(db)
    metrics.append(resource_utilization)

    return metrics


def _compute_sales_growth(db: Session) -> Dict[str, Any]:
    row = db.query(
        func.avg(SalesTarget.achievement_rate),
        func.count(SalesTarget.id),
    ).filter(SalesTarget.achievement_rate.isnot(None)).first()
    count = int(row[1] or 0) if row else 0
    if not count:
        return {"name": "销售增长", "expected": 15, "actual": 0, "unit": "%", "status": "below"}

    actual = round(float(row[0] or 0), 1)
    expected = 15

    return {
        "name": "销售增长",
        "expected": expected,
        "actual": actual,
        "unit": "%",
        "status": "exceeded" if actual > expected else "met" if actual >= expected * 0.8 else "below",
        "detail": f"平均达成率 {actual}%，基于 {count} 个销售目标",
    }


def _compute_customer_satisfaction(db: Session) -> Dict[str, Any]:
    total_with_sentiment = (
        db.query(func.count(VisitFeedback.id))
        .filter(VisitFeedback.feedback_sentiment.isnot(None))
        .scalar()
        or 0
    )
    if not total_with_sentiment:
        return {"name": "客户满意度", "expected": 85, "actual": 0, "unit": "%", "status": "below"}

    positive = (
        db.query(func.count(VisitFeedback.id))
        .filter(VisitFeedback.feedback_sentiment == "positive")
        .scalar()
        or 0
    )

    actual = round(positive / total_with_sentiment * 100, 1)
    expected = 85

    return {
        "name": "客户满意度",
        "expected": expected,
        "actual": actual,
        "unit": "%",
        "status": "exceeded" if actual > expected else "met" if actual >= expected * 0.8 else "below",
        "detail": f"正面反馈比例 {actual}%，基于 {total_with_sentiment} 条反馈",
    }


def _compute_execution_efficiency(db: Session, decision_obj) -> Dict[str, Any]:
    from models.action import ActionProposal

    q = db.query(ActionProposal)
    if decision_obj is not None and getattr(decision_obj, "id", None):
        scoped = q.filter(ActionProposal.entity_id == decision_obj.id)
        if scoped.count() == 0:
            scoped = q
        q = scoped

    total = q.count()
    if not total:
        return {"name": "执行效率", "expected": 100, "actual": 0, "unit": "%", "status": "below"}
    completed = q.filter(ActionProposal.status.in_(["approved", "executed"])).count()
    actual = round(completed / total * 100, 1)
    expected = 100

    return {
        "name": "执行效率",
        "expected": expected,
        "actual": actual,
        "unit": "%",
        "status": "exceeded" if actual >= 100 else "met" if actual >= 80 else "below",
    }


def _compute_resource_utilization(db: Session) -> Dict[str, Any]:
    rate_expr = case(
        (
            (BudgetCategory.budget_amount.isnot(None))
            & (BudgetCategory.budget_amount > 0)
            & (BudgetCategory.used_amount.isnot(None)),
            BudgetCategory.used_amount * 100.0 / BudgetCategory.budget_amount,
        ),
        (
            BudgetCategory.execution_rate.isnot(None),
            BudgetCategory.execution_rate * 100.0,
        ),
        else_=None,
    )
    row = db.query(func.avg(rate_expr), func.count(rate_expr)).first()
    count = int(row[1] or 0) if row else 0
    if not count:
        return {"name": "资源利用率", "expected": 90, "actual": 0, "unit": "%", "status": "below"}

    actual = round(float(row[0] or 0), 1)
    expected = 90

    return {
        "name": "资源利用率",
        "expected": expected,
        "actual": actual,
        "unit": "%",
        "status": "exceeded" if actual > expected else "met" if actual >= expected * 0.8 else "below",
        "detail": f"平均使用率 {actual}%，基于 {count} 个预算分类",
    }
