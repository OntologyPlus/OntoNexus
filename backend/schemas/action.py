from pydantic import BaseModel
from typing import Optional, List


class ReasoningEvidenceSchema(BaseModel):
    source: str
    observation: str
    weight: float


class SuggestedActionSchema(BaseModel):
    actionName: str
    priority: str
    reason: str


class ReasoningChainSchema(BaseModel):
    conclusion: str
    evidence: List[ReasoningEvidenceSchema] = []
    confidence: float
    alternativeHypotheses: List[dict] = []
    suggestedActions: List[SuggestedActionSchema] = []


class ActionDefinitionSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    parameters: List[dict] = []
    preconditions: List[str] = []
    side_effects: List[str] = []
    write_back_targets: List[str] = []
    requires_approval: bool = False


class PendingActionSchema(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    type: str
    entity_id: str
    entity_name: str
    entity_type: str
    priority: str = "medium"
    status: str = "pending"
    timestamp: str
    proposed_by: Optional[str] = None
    confidence: float = 0.9
    reasoning_chain: Optional[ReasoningChainSchema] = None
    action_definition: Optional[ActionDefinitionSchema] = None


class ActionApprovalRequest(BaseModel):
    approved: bool
    user_id: str = "default_user"
    feedback: Optional[str] = None


class ActionApprovalResponse(BaseModel):
    action_id: str
    status: str
    message: str
