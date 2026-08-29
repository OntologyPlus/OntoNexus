from sqlalchemy import Column, String, Float, Integer, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class SkillWeight(Base):
    __tablename__ = "skill_weights"

    skill_name = Column(String, primary_key=True)
    weight = Column(Float, nullable=False, default=1.0)
    samples = Column(Integer, nullable=False, default=0)
    last_score = Column(Float, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SkillOutcome(Base):
    __tablename__ = "skill_outcomes"

    id = Column(String, primary_key=True)
    skill_name = Column(String, nullable=False, index=True)
    object_id = Column(String, nullable=True, index=True)
    action_id = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")
    effectiveness = Column(Float, nullable=True)
    note = Column(Text, nullable=True)
    evaluate_after = Column(DateTime, nullable=True, index=True)
    evaluated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
