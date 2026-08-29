from sqlalchemy import Column, String, Text, DateTime, Index
from sqlalchemy.sql import func
from database import Base


class ProvenanceRecord(Base):
    __tablename__ = "provenance_records"
    __table_args__ = (
        Index("idx_prov_subject", "subject_id"),
        Index("idx_prov_type", "record_type"),
    )

    id = Column(String, primary_key=True)
    record_type = Column(String, nullable=False)
    subject_id = Column(String, nullable=True)
    agent = Column(String, nullable=True)
    payload = Column(Text, nullable=True)
    prev_hash = Column(String, nullable=False)
    record_hash = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
