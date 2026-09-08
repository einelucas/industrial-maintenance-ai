from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.ml.model_loader import get_thermal_predictor
from app.ml.thermal_predictor import ThermalMlPredictor
from app.schemas.prediction_output import HealthOutput

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOutput, response_model_by_alias=True)
def health_check(
    settings: Settings = Depends(get_settings),
    predictor: ThermalMlPredictor = Depends(get_thermal_predictor),
) -> HealthOutput:
    return HealthOutput(
        status="ok" if predictor.is_loaded else "unavailable",
        appVersion=settings.app_version,
        modelLoaded=predictor.is_loaded,
        predictorType="thermal",
    )
