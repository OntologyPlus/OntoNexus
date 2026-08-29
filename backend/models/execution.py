from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(String, primary_key=True)
    action_name = Column(String, nullable=False)
    tool_name = Column(String, nullable=False)
    parameters = Column(Text, nullable=True)
    status = Column(String, default="success")
    result = Column(Text, nullable=True)
    plan_id = Column(String, nullable=True)
    user_id = Column(String, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
