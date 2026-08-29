from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class ActionProposal(Base):
    __tablename__ = "action_proposals"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    action_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    entity_name = Column(String, nullable=True)
    entity_type = Column(String, nullable=True)
    priority = Column(String, default="medium")
    confidence = Column(Float, default=0.9)
    status = Column(String, default="pending")
    proposed_by = Column(String, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    reasoning_conclusion = Column(Text, nullable=True)
    reasoning_confidence = Column(Float, nullable=True)
    reasoning_evidence = Column(Text, nullable=True)
    reasoning_alternative_hypotheses = Column(Text, nullable=True)
    reasoning_suggested_actions = Column(Text, nullable=True)
    action_definition_id = Column(String, nullable=True)
    action_definition_name = Column(String, nullable=True)
    action_definition_description = Column(Text, nullable=True)
    action_definition_requires_approval = Column(Boolean, default=False)
    action_definition_preconditions = Column(Text, nullable=True)
    action_definition_side_effects = Column(Text, nullable=True)
    action_definition_write_back_targets = Column(Text, nullable=True)
    
    execution_logs = Column(Text, nullable=True)  # JSON数组存储执行步骤
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
