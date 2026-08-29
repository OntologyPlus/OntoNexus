from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    reminder_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=True)
    priority = Column(String, default="medium")
    status = Column(String, default="active")
    entity_id = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
