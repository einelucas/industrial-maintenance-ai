from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.ml.model_loader import get_predictor
from app.ml.predictor import Predictor
from app.schemas.prediction_output import HealthOutput

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOutput, response_model_by_alias=True)
def health_check(
    settings: Settings = Depends(get_settings),
    predictor: Predictor = Depends(get_predictor),
) -> HealthOutput:
    return HealthOutput(
        status="ok",
        appVersion=settings.app_version,
        modelLoaded=predictor.is_loaded,
        predictorType="demo" if predictor.is_demo else "sklearn",
    )
