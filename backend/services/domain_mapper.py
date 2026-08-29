from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from models.domain import (
    Doctor, Hospital, Product, SalesRep, VisitRecord, SalesTarget,
    ComplianceAlert, AcademicEvent, Territory, RecoveryPlan,
    SalesFlow, MarketPotential, HospitalDevelopment, TerritoryPerformance,
    ProductFlow, BudgetCategory, ExpenseClassification, CostDriver,
    LaborPayment, ExpenseROI, CustomerCategory, VisitFeedback,
    PDCAPlan, HospitalStrategy, DepartmentResearch, RWSProject,
    ClinicalTrial, PatientProgram, ResearchCollaboration,
    MeetingCompliance, ExpenseCompliance, CustomerCompliance, ComplianceRule,
)

DOMAIN_MODEL_MAP = {
    "Doctor": Doctor,
    "Hospital": Hospital,
    "Product": Product,
    "SalesRep": SalesRep,
    "VisitRecord": VisitRecord,
    "SalesTarget": SalesTarget,
    "ComplianceAlert": ComplianceAlert,
    "AcademicEvent": AcademicEvent,
    "Territory": Territory,
    "RecoveryPlan": RecoveryPlan,
    "SalesFlow": SalesFlow,
    "MarketPotential": MarketPotential,
    "HospitalDevelopment": HospitalDevelopment,
    "TerritoryPerformance": TerritoryPerformance,
    "ProductFlow": ProductFlow,
    "BudgetCategory": BudgetCategory,
    "ExpenseClassification": ExpenseClassification,
    "CostDriver": CostDriver,
    "LaborPayment": LaborPayment,
    "ExpenseROI": ExpenseROI,
    "CustomerCategory": CustomerCategory,
    "VisitFeedback": VisitFeedback,
    "PDCAPlan": PDCAPlan,
    "HospitalStrategy": HospitalStrategy,
    "DepartmentResearch": DepartmentResearch,
    "RWSProject": RWSProject,
    "ClinicalTrial": ClinicalTrial,
    "PatientProgram": PatientProgram,
    "ResearchCollaboration": ResearchCollaboration,
    "MeetingCompliance": MeetingCompliance,
    "ExpenseCompliance": ExpenseCompliance,
    "CustomerCompliance": CustomerCompliance,
    "ComplianceRule": ComplianceRule,
}

FIELD_SEPARATOR = ","


def _split_field(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(FIELD_SEPARATOR) if v.strip()]


def _join_field(values: List[str]) -> str:
    return FIELD_SEPARATOR.join(values)


def _create_domain_row(db: Session, object_type: str, obj_id: str, properties: Dict[str, Any]):
    model_class = DOMAIN_MODEL_MAP.get(object_type)
    if not model_class:
        return
    col_names = {c.name for c in model_class.__table__.columns}
    filtered = {}
    for k, v in properties.items():
        db_field = k
        if db_field in col_names:
            if isinstance(v, list):
                v = _join_field([str(i) for i in v])
            filtered[db_field] = v
    if not filtered:
        filtered = {"id": obj_id}
    else:
        filtered["id"] = obj_id
    row = model_class(**filtered)
    db.add(row)


def _update_domain_row(db: Session, object_type: str, obj_id: str, properties: Dict[str, Any]):
    model_class = DOMAIN_MODEL_MAP.get(object_type)
    if not model_class:
        return
    row = db.query(model_class).filter(model_class.id == obj_id).first()
    if not row:
        _create_domain_row(db, object_type, obj_id, properties)
        return
    col_names = {c.name for c in model_class.__table__.columns}
    for k, v in properties.items():
        if k in col_names and k != "id":
            if isinstance(v, list):
                v = _join_field([str(i) for i in v])
            setattr(row, k, v)
