from sqlalchemy import Column, String, Text, DateTime, Integer, Index
from sqlalchemy.sql import func
from database import Base


class OntologyChangeRequest(Base):
    __tablename__ = "ontology_change_requests"
    __table_args__ = (
        Index("idx_change_request_status", "status"),
        Index("idx_change_request_type", "change_type"),
    )

    id = Column(String, primary_key=True)
    change_type = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=True)
    change_description = Column(Text, nullable=True)
    before_snapshot = Column(Text, nullable=True)
    after_snapshot = Column(Text, nullable=True)
    impact_analysis = Column(Text, nullable=True)
    status = Column(String, default="pending")
    requested_by = Column(String, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class OntologyVersion(Base):
    __tablename__ = "ontology_versions"
    __table_args__ = (
        Index("idx_version_number", "version_number"),
    )

    id = Column(String, primary_key=True)
    version_number = Column(Integer, nullable=False)
    snapshot = Column(Text, nullable=False)
    object_count = Column(Integer, default=0)
    link_count = Column(Integer, default=0)
    action_count = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
