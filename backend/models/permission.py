from sqlalchemy import Column, String, Boolean, DateTime, Text, Index
from sqlalchemy.sql import func
from database import Base


class ObjectPermission(Base):
    __tablename__ = "object_permissions"
    __table_args__ = (
        Index("idx_permission_user_object", "user_id", "object_type"),
        Index("idx_permission_role", "role"),
    )

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    role = Column(String, nullable=True)
    object_type = Column(String, nullable=False)
    object_id = Column(String, nullable=True)
    can_read = Column(Boolean, default=False)
    can_write = Column(Boolean, default=False)
    can_execute = Column(Boolean, default=False)
    can_admin = Column(Boolean, default=False)
    field_restrictions = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
