from functools import lru_cache

from app.core.config import get_settings
from app.core.logging import get_logger
from app.ml.predictor import DemoPredictor, Predictor, SklearnPredictor

logger = get_logger(__name__)


@lru_cache
def get_predictor() -> Predictor:
    """Retorna a implementação de Predictor ativa (singleton por processo).

    Se existir um modelo .joblib válido em MODEL_PATH, usa SklearnPredictor.
    Caso contrário, usa DemoPredictor e loga um aviso claro de que a API
    está operando em modo demonstração (sem ML real).
    """
    settings = get_settings()
    sklearn_predictor = SklearnPredictor(settings.resolved_model_path)

    if sklearn_predictor.is_loaded:
        return sklearn_predictor

    logger.warning(
        "Nenhum modelo treinado encontrado em %s — usando DemoPredictor "
        "(fallback de desenvolvimento, NÃO é Machine Learning real).",
        settings.resolved_model_path,
    )
    return DemoPredictor()
