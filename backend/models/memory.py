from sqlalchemy import Column, String, Float, Text, DateTime, Integer
from sqlalchemy.sql import func
from database import Base


class AgentMemory(Base):
    __tablename__ = "agent_memories"

    id = Column(String, primary_key=True)
    agent_id = Column(String, nullable=False, index=True)
    memory_type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Text, nullable=True)
    importance = Column(Float, default=0.5)
    decay_rate = Column(Float, default=0.01)
    access_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    last_accessed = Column(DateTime, server_default=func.now(), onupdate=func.now())
    metadata = Column(Text, nullable=True)
    
    query_context = Column(Text, nullable=True)  # 触发查询的上下文
    action_taken = Column(Text, nullable=True)   # 执行的动作
    outcome = Column(String, nullable=True)      # success/failure/partial
    lessons_learned = Column(Text, nullable=True) # 反思结论
