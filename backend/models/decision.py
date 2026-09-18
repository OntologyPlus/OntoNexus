from sqlalchemy import Column, String, Text, DateTime, Float, Index
from sqlalchemy.sql import func
from database import Base


class DecisionRecord(Base):
    __tablename__ = "decision_records"
    __table_args__ = (
        Index("idx_decision_category", "category"),
        Index("idx_decision_outcome", "outcome"),
        Index("idx_decision_causation", "causation_id"),
        Index("idx_decision_parent", "parent_decision_id"),
        Index("idx_decision_case", "case_id"),
    )

    id = Column(String, primary_key=True)
    category = Column(String, nullable=False)
    scenario = Column(Text, nullable=False)
    reasoning = Column(Text, nullable=True)
    outcome = Column(String, nullable=False)
    confidence = Column(Float, default=0.0)
    decision_maker = Column(String, nullable=True)
    evidence_ids = Column(Text, nullable=True)
    policy_version = Column(String, nullable=True)
    policy_result = Column(Text, nullable=True)
    causation_id = Column(String, nullable=True)
    parent_decision_id = Column(String, nullable=True)
    entity_ids = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    case_id = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class DecisionEdge(Base):
    __tablename__ = "decision_edges"
    __table_args__ = (
        Index("idx_decision_edge_source", "source_id"),
        Index("idx_decision_edge_target", "target_id"),
    )

    id = Column(String, primary_key=True)
    source_id = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    relation = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class PolicyDefinition(Base):
    __tablename__ = "policy_definitions"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    version = Column(String, default="1.0")
    rules_json = Column(Text, nullable=False)
    active = Column(String, default="true")
    created_at = Column(DateTime, server_default=func.now())
