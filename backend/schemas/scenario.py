from pydantic import BaseModel
from typing import Optional, List


class ScenarioParameterSchema(BaseModel):
    name: str
    type: str
    label: str
    defaultValue: Optional[str] = None
    options: Optional[List[dict]] = None
    min: Optional[float] = None
    max: Optional[float] = None
    step: Optional[float] = None
    required: bool = False
    description: Optional[str] = None


class ForecastResultSchema(BaseModel):
    targetValue: float
    forecastValue: float
    achievementRate: float
    riskLevel: str
    confidenceInterval: List[float]


class ComparisonResultSchema(BaseModel):
    baseline: ForecastResultSchema
    scenario: ForecastResultSchema
    delta: float
    impactAnalysis: str


class ScenarioResponse(BaseModel):
    id: str
    type: str
    name: str
    description: Optional[str] = None
    category: str
    parameters: List[ScenarioParameterSchema] = []
    forecastResult: Optional[ForecastResultSchema] = None
    comparisonWithBaseline: Optional[ComparisonResultSchema] = None
    relatedScenarios: Optional[List[str]] = None
    createdAt: Optional[str] = None
    createdBy: Optional[str] = None


class ScenarioListResponse(BaseModel):
    results: List[ScenarioResponse]
    total: int
