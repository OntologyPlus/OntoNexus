from sqlalchemy import Column, String, Text, DateTime, Index
from sqlalchemy.sql import func
from database import Base


class PersistedEvent(Base):
    __tablename__ = "domain_events"
    __table_args__ = (
        Index("idx_event_causation", "causation_id"),
        Index("idx_event_decision", "decision_id"),
        Index("idx_event_type", "event_type"),
    )

    id = Column(String, primary_key=True)
    event_type = Column(String, nullable=False)
    object_id = Column(String, nullable=True)
    object_type = Column(String, nullable=True)
    object_name = Column(String, nullable=True)
    data = Column(Text, nullable=True)
    source = Column(String, default="system")
    causation_id = Column(String, nullable=True)
    decision_id = Column(String, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
