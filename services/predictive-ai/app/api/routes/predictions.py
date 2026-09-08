from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import verify_internal_api_key
from app.schemas.prediction_input import PredictionInput

router = APIRouter(tags=["predictions"], dependencies=[Depends(verify_internal_api_key)])


@router.post("/predict", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
def predict_failure(
    payload: PredictionInput,
) -> None:
    if not payload.has_any_feature():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ao menos uma medição de sensor deve ser informada.",
        )

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Predição mecânica legada desativada; use o contrato térmico obrigatório.",
    )
