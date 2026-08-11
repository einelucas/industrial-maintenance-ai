import hashlib
import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.core.logging import get_logger
from app.ml.preprocessing import available_features, input_to_frame
from app.schemas.prediction_input import PredictionInput, RiskThresholds
from app.schemas.prediction_output import PredictionOutput, RiskLevel

logger = get_logger(__name__)

# Faixas de risco padrão (ver seção 23 do escopo) — usadas quando o Next.js
# não envia `thresholds` no payload (ex.: faixas configuráveis via UI ainda
# não salvas, ou chamada direta ao FastAPI em testes/dev).
RISK_THRESHOLDS: list[tuple[float, RiskLevel]] = [
    (0.30, RiskLevel.LOW),
    (0.60, RiskLevel.MODERATE),
    (0.80, RiskLevel.HIGH),
    (1.01, RiskLevel.CRITICAL),
]


def classify_risk(probability: float, thresholds: RiskThresholds | None = None) -> RiskLevel:
    bounds = (
        [
            (thresholds.low_max, RiskLevel.LOW),
            (thresholds.moderate_max, RiskLevel.MODERATE),
            (thresholds.high_max, RiskLevel.HIGH),
            (1.01, RiskLevel.CRITICAL),
        ]
        if thresholds is not None
        else RISK_THRESHOLDS
    )
    for upper_bound, level in bounds:
        if probability < upper_bound:
            return level
    return RiskLevel.CRITICAL


class Predictor(ABC):
    """Abstração para qualquer implementação de predição de falha.

    Permite trocar DemoPredictor <-> SklearnPredictor sem alterar os
    endpoints (ver seção 9 do escopo).
    """

    model_version: str
    is_demo: bool

    @abstractmethod
    def predict(self, payload: PredictionInput) -> PredictionOutput: ...

    @property
    @abstractmethod
    def is_loaded(self) -> bool: ...


class DemoPredictor(Predictor):
    """Fallback de DESENVOLVIMENTO.

    Calcula um risco determinístico (hash das features + heurística simples
    de limiares) apenas para permitir que a aplicação funcione ponta-a-ponta
    antes de existir um modelo .joblib treinado. NÃO é Machine Learning real
    e nunca deve ser apresentado como tal na interface.
    """

    model_version = "demo-0.0.0"
    is_demo = True

    @property
    def is_loaded(self) -> bool:
        return True

    def predict(self, payload: PredictionInput) -> PredictionOutput:
        features = available_features(payload)

        if not features:
            probability = 0.15
        else:
            data = payload.model_dump(exclude={"equipment_id"})
            heuristic_hits = 0
            total_checked = 0

            heuristic_rules = {
                "temperature": lambda v: v > 75,
                "air_temperature": lambda v: v > 40,
                "process_temperature": lambda v: v > 60,
                "vibration": lambda v: v > 5.0,
                "pressure": lambda v: v > 8.0,
                "current": lambda v: v > 20.0,
                "tool_wear": lambda v: v > 200,
                "torque": lambda v: v > 60,
                "operating_hours": lambda v: v > 4000,
            }

            for name, rule in heuristic_rules.items():
                value = data.get(name)
                if value is None:
                    continue
                total_checked += 1
                if rule(value):
                    heuristic_hits += 1

            base = heuristic_hits / total_checked if total_checked else 0.2

            # Pequena variação determinística por equipmentId, apenas para que
            # a demo não pareça artificialmente uniforme entre equipamentos.
            digest = hashlib.sha256(payload.equipment_id.encode()).hexdigest()
            jitter = (int(digest[:4], 16) % 100) / 1000  # 0.000–0.099

            probability = min(0.98, max(0.02, base * 0.8 + jitter))

        risk_level = classify_risk(probability, payload.thresholds)

        return PredictionOutput(
            failureProbability=round(probability, 4),
            riskLevel=risk_level,
            predictedClass=1 if probability >= 0.5 else 0,
            modelVersion=self.model_version,
            featuresUsed=features,
            isDemoModel=True,
        )


class SklearnPredictor(Predictor):
    """Predictor real, carregado a partir de models/model.joblib.

    Espera um artefato salvo com joblib contendo um objeto com método
    `predict_proba`, treinado via services/predictive-ai/training/train.py.
    """

    is_demo = False

    def __init__(self, model_path: Path):
        self._model_path = model_path
        self._model: Any = None
        self._metadata: dict[str, Any] = {}
        self.model_version = "unknown"
        self._load()

    def _load(self) -> None:
        if not self._model_path.exists():
            logger.warning("Modelo não encontrado em %s", self._model_path)
            return

        self._model = joblib.load(self._model_path)

        metadata_path = self._model_path.parent / "metadata.json"
        if metadata_path.exists():
            self._metadata = json.loads(metadata_path.read_text())
            self.model_version = self._metadata.get("modelVersion", "unknown")

        logger.info(
            "Modelo carregado: versão=%s algoritmo=%s",
            self.model_version,
            self._metadata.get("algorithm", "?"),
        )

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def trained_features(self) -> list[str]:
        return self._metadata.get("features", [])

    def predict(self, payload: PredictionInput) -> PredictionOutput:
        if not self.is_loaded:
            raise RuntimeError("SklearnPredictor usado sem modelo carregado.")

        frame: pd.DataFrame = input_to_frame(payload)

        columns = self.trained_features or list(frame.columns)
        frame = frame.reindex(columns=columns)
        frame = frame.astype(float)
        frame = frame.fillna(frame.median(numeric_only=True)).fillna(0.0)

        probability = float(self._model.predict_proba(frame)[0][1])
        predicted_class = int(probability >= 0.5)
        risk_level = classify_risk(probability, payload.thresholds)

        return PredictionOutput(
            failureProbability=round(probability, 4),
            riskLevel=risk_level,
            predictedClass=predicted_class,
            modelVersion=self.model_version,
            featuresUsed=[c for c in columns if payload.model_dump().get(c) is not None],
            isDemoModel=False,
        )
