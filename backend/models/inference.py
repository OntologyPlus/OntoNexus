from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class InferenceRule(Base):
    __tablename__ = "inference_rules"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    ttl = Column(Integer, nullable=True)
    auto_apply = Column(Boolean, default=False)
    condition_pattern = Column(Text, nullable=True)
    condition_filters = Column(Text, nullable=True)
    condition_description = Column(Text, nullable=True)
    conclusion_type = Column(String, nullable=True)
    conclusion_source_pattern = Column(Text, nullable=True)
    conclusion_target_pattern = Column(Text, nullable=True)
    conclusion_link_type = Column(String, nullable=True)
    conclusion_strength_formula = Column(Text, nullable=True)
    conclusion_entity_pattern = Column(Text, nullable=True)
    conclusion_property = Column(String, nullable=True)
    conclusion_value_formula = Column(Text, nullable=True)
    conclusion_alert_type = Column(String, nullable=True)
    conclusion_alert_message_template = Column(Text, nullable=True)
    conclusion_alert_severity = Column(String, nullable=True)
    conclusion_tag_entity_pattern = Column(Text, nullable=True)
    conclusion_tag = Column(String, nullable=True)
    confidence_base = Column(Float, nullable=True)
    confidence_modifiers = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    author = Column(String, nullable=True)
    tags = Column(Text, nullable=True)


class InferenceResult(Base):
    __tablename__ = "inference_results"

    id = Column(String, primary_key=True)
    rule_id = Column(String, nullable=True)
    rule_name = Column(String, nullable=True)
    result_type = Column(String, nullable=True)
    source_entity_id = Column(String, nullable=True)
    target_entity_id = Column(String, nullable=True)
    inferred_link_type = Column(String, nullable=True)
    inferred_property = Column(String, nullable=True)
    inferred_value = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    evidence = Column(Text, nullable=True)
    valid_from = Column(DateTime, nullable=True)
    valid_to = Column(DateTime, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, server_default=func.now())
