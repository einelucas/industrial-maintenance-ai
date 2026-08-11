import pandas as pd

from app.schemas.prediction_input import PredictionInput

# Ordem canônica de features conhecidas pelo sistema. Um modelo treinado usa
# um subconjunto (ou totalidade) destas colunas — ver metadata.json.
KNOWN_FEATURES = [
    "air_temperature",
    "process_temperature",
    "temperature",
    "rotational_speed",
    "rpm",
    "torque",
    "tool_wear",
    "vibration",
    "pressure",
    "current",
    "operating_hours",
]


def input_to_frame(payload: PredictionInput) -> pd.DataFrame:
    """Converte o payload validado em um DataFrame de 1 linha.

    Mantém apenas as colunas conhecidas, na ordem canônica, preservando
    valores ausentes como NaN para o Predictor decidir como tratá-los.
    """
    data = payload.model_dump(exclude={"equipment_id"})
    ordered = {feature: data.get(feature) for feature in KNOWN_FEATURES}
    return pd.DataFrame([ordered])


def available_features(payload: PredictionInput) -> list[str]:
    """Retorna os nomes das features realmente preenchidas no payload."""
    data = payload.model_dump(exclude={"equipment_id", "thresholds"})
    return [name for name, value in data.items() if value is not None]
