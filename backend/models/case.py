from sqlalchemy import Column, String, Text, DateTime, Index
from sqlalchemy.sql import func
from database import Base


class DecisionCase(Base):
    """Business work item that groups decisions, actions and observed effects."""
    __tablename__ = "decision_cases"
    __table_args__ = (
        Index("idx_case_status", "status"),
        Index("idx_case_owner", "owner_id"),
    )

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="open")
    priority = Column(String, nullable=False, default="medium")
    owner_id = Column(String, nullable=False)
    entity_ids = Column(Text, nullable=True)
    decision_ids = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    closed_at = Column(DateTime, nullable=True)
