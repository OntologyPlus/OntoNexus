from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, Float, Index
from sqlalchemy.sql import func
from database import Base


class OntologyObject(Base):
    __tablename__ = "ontology_objects"
    __table_args__ = (
        Index("idx_ontology_object_type", "object_type"),
        Index("idx_ontology_status", "status"),
        Index("idx_ontology_owner_id", "owner_id"),
    )

    id = Column(String, primary_key=True)
    object_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="normal")
    lifecycle_stage = Column(String, nullable=True)
    sentiment = Column(String, nullable=True)
    compliance_risk_level = Column(String, nullable=True)
    owner_id = Column(String, nullable=True)
    stakeholders = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ObjectLink(Base):
    __tablename__ = "object_links"
    __table_args__ = (
        Index("idx_object_link_source", "source_id"),
        Index("idx_object_link_target", "target_id"),
        Index("idx_object_link_type", "link_type"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String, nullable=False, index=True)
    link_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    target_name = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    link_strength = Column(Float, nullable=True)
    link_frequency = Column(String, nullable=True)
    link_volume = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=True)
    valid_from = Column(String, nullable=True)
    valid_to = Column(String, nullable=True)
    provenance = Column(String, nullable=True)
    inverse_relation = Column(String, nullable=True)


class ObjectAction(Base):
    __tablename__ = "object_actions"

    id = Column(String, primary_key=True)
    object_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    requires_approval = Column(Boolean, default=False)
    preconditions = Column(Text, nullable=True)
    side_effects = Column(Text, nullable=True)
    write_back_targets = Column(Text, nullable=True)


class ActionParameter(Base):
    __tablename__ = "action_parameters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    param_type = Column(String, nullable=False)
    required = Column(Boolean, default=False)
    default_value = Column(Text, nullable=True)
    description = Column(Text, nullable=True)


class ObjectEvent(Base):
    __tablename__ = "object_events"

    id = Column(String, primary_key=True)
    object_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    related_object_id = Column(String, nullable=True)
    related_object_name = Column(String, nullable=True)


class TimeSeriesData(Base):
    __tablename__ = "time_series_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    object_id = Column(String, nullable=False, index=True)
    series_name = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    value = Column(Float, nullable=False)
