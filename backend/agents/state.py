from typing import Annotated, TypedDict, List, Optional, Dict, Any
from langgraph.graph.message import AnyMessage, add_messages

class AgentState(TypedDict):
    """
    State representing the entire Cognitive Cycle for OntoNexus Agent.
    """
    # Conversation history or thought chain
    messages: Annotated[list[AnyMessage], add_messages]
    
    # Context injected from DB
    context: str
    
    # Execution variables
    perception_results: str
    hypotheses: str
    current_plan: str
    execution_status: str
    
    # Memory & Reflection
    reflection_notes: str
    memory_context: str
    plan_approved: Optional[bool]
    reflection_count: int
    
    # Execution tracking
    tool_results: Optional[Dict[str, Any]]
    needs_human_review: bool
    review_decision: Optional[str]
