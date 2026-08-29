from pydantic import BaseModel
from typing import Optional, List


class InferenceRuleSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    type: str
    conditions: List[dict] = []
    conclusion: dict = {}
    confidence: dict = {}
    config: dict = {}
    metadata: dict = {}


class InferenceResultSchema(BaseModel):
    id: str
    rule_id: Optional[str] = None
    rule_name: Optional[str] = None
    result_type: Optional[str] = None
    source_entity_id: Optional[str] = None
    target_entity_id: Optional[str] = None
    inferred_link_type: Optional[str] = None
    inferred_property: Optional[str] = None
    inferred_value: Optional[str] = None
    confidence: Optional[float] = None
    evidence: Optional[str] = None
    status: str = "active"


class InferenceRuleListResponse(BaseModel):
    results: List[InferenceRuleSchema]
    total: int
