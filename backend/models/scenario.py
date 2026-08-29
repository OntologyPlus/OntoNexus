from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String, primary_key=True)
    scenario_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    target_value = Column(Integer, nullable=True)
    forecast_value = Column(Integer, nullable=True)
    achievement_rate = Column(Float, nullable=True)
    risk_level = Column(String, nullable=True)
    confidence_interval_low = Column(Integer, nullable=True)
    confidence_interval_high = Column(Integer, nullable=True)
    baseline_target_value = Column(Integer, nullable=True)
    baseline_forecast_value = Column(Integer, nullable=True)
    baseline_achievement_rate = Column(Float, nullable=True)
    baseline_risk_level = Column(String, nullable=True)
    baseline_confidence_interval_low = Column(Integer, nullable=True)
    baseline_confidence_interval_high = Column(Integer, nullable=True)
    delta = Column(Float, nullable=True)
    impact_analysis = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(String, nullable=True)


class ScenarioParameter(Base):
    __tablename__ = "scenario_parameters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    param_type = Column(String, nullable=False)
    label = Column(String, nullable=False)
    default_value = Column(Text, nullable=True)
    options = Column(Text, nullable=True)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    step_value = Column(Float, nullable=True)
    required = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
