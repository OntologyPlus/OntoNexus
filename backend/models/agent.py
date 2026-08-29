from sqlalchemy import Column, String, Integer, Float, DateTime
from sqlalchemy.sql import func
from database import Base


class AgentStatus(Base):
    __tablename__ = "agent_status"

    id = Column(String, primary_key=True)
    agent_name = Column(String, nullable=False)
    agent_type = Column(String, nullable=False)
    agent_status = Column(String, default="idle")
    last_run = Column(DateTime, nullable=True)
    total_memories = Column(Integer, default=0)
    episodic_memories = Column(Integer, default=0)
    semantic_memories = Column(Integer, default=0)
    procedural_memories = Column(Integer, default=0)
    total_experiences = Column(Integer, default=0)
    knowledge_items = Column(Integer, default=0)
    success_rate = Column(Float, default=0)
    perception_ability = Column(Float, default=0)
    reasoning_ability = Column(Float, default=0)
    planning_ability = Column(Float, default=0)
    learning_ability = Column(Float, default=0)
