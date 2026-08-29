from sqlalchemy import Column, String, DateTime, Text, UniqueConstraint, Index
from sqlalchemy.sql import func
from database import Base


class SourceBinding(Base):
    """CRM/ERP external key → ontology object id. Not a second SoT."""

    __tablename__ = "source_bindings"
    __table_args__ = (
        UniqueConstraint("source_system", "external_id", name="uq_source_external"),
        Index("idx_source_binding_object", "object_id"),
    )

    id = Column(String, primary_key=True)
    source_system = Column(String, nullable=False)
    external_id = Column(String, nullable=False)
    object_id = Column(String, nullable=False)
    object_type = Column(String, nullable=False)
    last_status = Column(String, nullable=True)
    last_error = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())
