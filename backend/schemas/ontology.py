from pydantic import BaseModel
from typing import Optional, Any, List, Dict


class ActionParameterCreate(BaseModel):
    name: str
    type: str = "string"
    required: bool = False
    defaultValue: Optional[str] = None
    description: Optional[str] = None


class LinkCreate(BaseModel):
    linkType: str
    targetId: str
    targetName: str = ""
    targetType: str = ""
    properties: Optional[Dict[str, Any]] = None


class ActionCreate(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    parameters: List[ActionParameterCreate] = []
    preconditions: List[str] = []
    sideEffects: List[str] = []
    writeBackTargets: List[str] = []
    requiresApproval: bool = False


class EventCreate(BaseModel):
    id: Optional[str] = None
    eventType: str
    timestamp: str = ""
    description: Optional[str] = None
    relatedObjectId: Optional[str] = None
    relatedObjectName: Optional[str] = None


class TimeSeriesPoint(BaseModel):
    timestamp: str
    value: float


class OntologyObjectCreate(BaseModel):
    name: str
    status: str = "normal"
    lifecycleStage: Optional[str] = None
    sentiment: Optional[str] = None
    complianceRiskLevel: Optional[str] = None
    ownerId: Optional[str] = None
    stakeholders: Optional[List[str]] = None
    properties: Dict[str, Any] = {}
    links: List[LinkCreate] = []
    actions: List[ActionCreate] = []
    events: List[EventCreate] = []
    timeSeries: Dict[str, List[TimeSeriesPoint]] = {}


class OntologyObjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    lifecycleStage: Optional[str] = None
    sentiment: Optional[str] = None
    complianceRiskLevel: Optional[str] = None
    ownerId: Optional[str] = None
    stakeholders: Optional[List[str]] = None
    properties: Optional[Dict[str, Any]] = None


class ActionParameterSchema(BaseModel):
    name: str
    type: str
    required: bool = False
    default_value: Optional[str] = None
    description: Optional[str] = None


class ObjectActionSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    parameters: List[ActionParameterSchema] = []
    preconditions: List[str] = []
    side_effects: List[str] = []
    write_back_targets: List[str] = []
    requires_approval: bool = False


class ObjectEventSchema(BaseModel):
    id: str
    eventType: str
    timestamp: str
    description: Optional[str] = None
    relatedObjectId: Optional[str] = None
    relatedObjectName: Optional[str] = None


class TimeSeriesDataPointSchema(BaseModel):
    timestamp: str
    value: float


class ObjectLinkSchema(BaseModel):
    linkType: str
    targetId: str
    targetName: str
    targetType: str
    properties: Optional[dict] = None


class OntologyObjectResponse(BaseModel):
    id: str
    objectType: str
    name: str
    properties: dict
    links: List[ObjectLinkSchema] = []
    actions: List[ObjectActionSchema] = []
    events: List[ObjectEventSchema] = []
    timeSeries: dict = {}
    interfaces: List[str] = []
    status: Optional[str] = None
    lifecycleStage: Optional[str] = None
    sentiment: Optional[str] = None
    complianceRiskLevel: Optional[str] = None
    ownerId: Optional[str] = None
    stakeholders: Optional[List[str]] = None


class OntologyObjectListResponse(BaseModel):
    model_config = {"populate_by_name": True}
    results: List[OntologyObjectResponse]
    total: int
    page: int = 1
    page_size: int = 20
    has_next: bool = False


class SearchResponse(BaseModel):
    results: List[OntologyObjectResponse]
    total: int
    limit: int


class ActionExecutionRequest(BaseModel):
    action: str
    params: dict = {}
    user_id: str = "default_user"


class ActionExecutionResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    transaction_id: str
