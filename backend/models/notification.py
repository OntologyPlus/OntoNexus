from sqlalchemy import Column, String, Boolean, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
    read = Column(Boolean, default=False)
    priority = Column(String, default="medium")
    entity_id = Column(String, nullable=True)
