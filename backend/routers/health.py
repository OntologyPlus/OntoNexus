from fastapi import APIRouter
from schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="healthy", name="OntoNexus API", version="1.0.0")
