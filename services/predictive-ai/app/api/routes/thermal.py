"""Endpoints térmicos operacionais da Etapa 8."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import verify_internal_api_key
from app.ml.model_loader import get_thermal_predictor
from app.ml.thermal_predictor import ThermalMlPredictor
from app.schemas.thermal_inference import ThermalHealthOutput, ThermalInferenceRequest, ThermalInferenceResponse

router = APIRouter(prefix="/thermal", tags=["thermal"])


@router.get("/health", response_model=ThermalHealthOutput, response_model_by_alias=True)
def thermal_health(predictor: ThermalMlPredictor = Depends(get_thermal_predictor)) -> ThermalHealthOutput:
    ready = predictor.is_loaded
    return ThermalHealthOutput(
        status="ok" if ready else "unavailable",
        ready=ready,
        modelLoaded=ready,
        predictorType="thermal",
        modelVersion=predictor.model_version,
        modelStage=predictor.model_stage,
        modelChecksum=predictor.model_checksum,
        isSyntheticModel=predictor.metadata.get("isSyntheticModel") if ready else None,
        featureVersion=predictor.metadata.get("featureVersion") if ready else None,
        reason=None if ready else "Artefato térmico ausente, corrompido ou incompatível.",
    )


@router.post(
    "/predict",
    response_model=ThermalInferenceResponse,
    response_model_by_alias=True,
    dependencies=[Depends(verify_internal_api_key)],
)
def thermal_predict(
    payload: ThermalInferenceRequest,
    predictor: ThermalMlPredictor = Depends(get_thermal_predictor),
) -> ThermalInferenceResponse:
    if not predictor.is_loaded:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Modelo térmico indisponível.")
    try:
        return predictor.predict(payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Inferência térmica indisponível.") from error
