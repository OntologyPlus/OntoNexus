from sqlalchemy import Column, String, Text, Float, DateTime, Index
from sqlalchemy.sql import func
from database import Base


class EffectRecord(Base):
    __tablename__ = "effect_records"
    __table_args__ = (Index("idx_effect_case", "case_id"), Index("idx_effect_action", "action_id"))

    id = Column(String, primary_key=True)
    case_id = Column(String, nullable=True)
    decision_id = Column(String, nullable=True)
    action_id = Column(String, nullable=True)
    metric = Column(String, nullable=False)
    baseline = Column(Float, nullable=True)
    target = Column(Float, nullable=True)
    actual = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    status = Column(String, nullable=False, default="observing")
    note = Column(Text, nullable=True)
    observed_at = Column(DateTime, server_default=func.now())
