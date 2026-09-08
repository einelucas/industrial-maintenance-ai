"""Carregamento singleton do modelo térmico; nunca oferece fallback."""

from functools import lru_cache

from app.core.config import get_settings
from app.ml.thermal_predictor import ThermalMlPredictor


@lru_cache
def get_thermal_predictor() -> ThermalMlPredictor:
    settings = get_settings()
    return ThermalMlPredictor(settings.resolved_model_path, settings.resolved_metadata_path)


def reset_model_cache() -> None:
    get_thermal_predictor.cache_clear()
