from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import verify_internal_api_key
from app.ml.model_loader import get_predictor
from app.ml.predictor import Predictor
from app.schemas.prediction_input import PredictionInput
from app.schemas.prediction_output import PredictionOutput

router = APIRouter(tags=["predictions"], dependencies=[Depends(verify_internal_api_key)])


@router.post("/predict", response_model=PredictionOutput, response_model_by_alias=True)
def predict_failure(
    payload: PredictionInput,
    predictor: Predictor = Depends(get_predictor),
) -> PredictionOutput:
    if not payload.has_any_feature():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ao menos uma medição de sensor deve ser informada.",
        )

    return predictor.predict(payload)
