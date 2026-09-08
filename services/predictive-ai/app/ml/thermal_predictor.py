"""Predictor térmico obrigatório, carregado de bundle sklearn verificável."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.core.logging import get_logger
from app.ml.thermal_features import THERMAL_FEATURE_VERSION, THERMAL_MODEL_FEATURES, request_to_frame
from app.schemas.thermal_inference import RiskLevel, ThermalCause, ThermalInferenceRequest, ThermalInferenceResponse

logger = get_logger(__name__)
ALLOWED_STAGES = {"SYNTHETIC_EXPERIMENTAL", "PLANT_CALIBRATION", "PLANT_VALIDATED"}

RECOMMENDATIONS = {
    ThermalCause.LOOSE_CONNECTION: "Inspecionar aperto e resistência da conexão com procedimento desenergizado.",
    ThermalCause.CONTACT_RESISTANCE: "Verificar resistência de contato e condição das superfícies condutoras.",
    ThermalCause.OVERLOAD: "Revisar corrente, carga e coordenação da proteção do circuito.",
    ThermalCause.PHASE_IMBALANCE: "Comparar fases, corrente e referências térmicas equivalentes.",
    ThermalCause.DEGRADED_CONTACT: "Programar inspeção do contato e avaliar substituição do componente.",
    ThermalCause.INSUFFICIENT_VENTILATION: "Inspecionar ventilação, obstruções e aquecimento comum do painel.",
    ThermalCause.THERMAL_RELAY_DEGRADATION: "Testar o relé térmico e conferir ajuste, bornes e histórico de atuação.",
    ThermalCause.SENSOR_ERROR: "Confirmar emissividade, posicionamento e calibração do sensor antes de intervir.",
}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class ThermalMlPredictor:
    def __init__(self, artifact_path: Path, metadata_path: Path | None = None):
        self.artifact_path = artifact_path
        self.metadata_path = metadata_path or artifact_path.parent / "metadata.json"
        self.bundle: dict[str, Any] | None = None
        self.metadata: dict[str, Any] = {}
        self.load_error: str | None = None
        self._load()

    def _invalidate(self, reason: str) -> None:
        self.bundle = None
        self.load_error = reason
        logger.error("Modelo térmico indisponível: %s", reason)

    def _load(self) -> None:
        if not self.artifact_path.is_file() or not self.metadata_path.is_file():
            self._invalidate("Artefato térmico ou metadados ausentes.")
            return
        try:
            metadata = json.loads(self.metadata_path.read_text(encoding="utf-8"))
            checksum = f"sha256:{file_sha256(self.artifact_path)}"
            if metadata.get("artifactChecksum") != checksum:
                raise ValueError("Checksum do artefato diverge dos metadados.")
            if metadata.get("modelStage") not in ALLOWED_STAGES:
                raise ValueError("Estágio do modelo térmico não é permitido.")
            if metadata.get("featureVersion") != THERMAL_FEATURE_VERSION:
                raise ValueError("Versão de features incompatível.")
            if metadata.get("isSyntheticModel") is not True:
                raise ValueError("Origem do modelo não foi declarada.")
            reproducibility_hash = metadata.get("reproducibilityFingerprint", "")
            if not isinstance(reproducibility_hash, str) or not reproducibility_hash.startswith("sha256:") or len(reproducibility_hash) != 71:
                raise ValueError("Fingerprint de reprodutibilidade inválido.")
            if metadata.get("features") != THERMAL_MODEL_FEATURES:
                raise ValueError("Ordem de features incompatível com o runtime.")
            bundle = joblib.load(self.artifact_path)
            required = {"artifactType", "modelVersion", "modelStage", "featureVersion", "features", "supervisedModel", "anomalyModel", "causeModel", "riskScoreThresholds", "anomalyCenter", "anomalyScale"}
            if not isinstance(bundle, dict) or not required.issubset(bundle):
                raise ValueError("Bundle térmico incompleto.")
            if bundle["artifactType"] != "thermal-ml-ensemble-v1":
                raise ValueError("Tipo de artefato térmico inválido.")
            for key in ("modelVersion", "modelStage", "featureVersion", "features"):
                if bundle[key] != metadata[key]:
                    raise ValueError(f"Campo {key} diverge entre bundle e metadados.")
            if not hasattr(bundle["supervisedModel"], "predict_proba"):
                raise ValueError("Modelo supervisionado obrigatório ausente.")
            if not hasattr(bundle["anomalyModel"], "decision_function") or not hasattr(bundle["causeModel"], "predict_proba"):
                raise ValueError("Modelos complementares inválidos.")
            self.metadata, self.bundle, self.load_error = metadata, bundle, None
        except Exception as error:
            self._invalidate(str(error))

    @property
    def is_loaded(self) -> bool:
        return self.bundle is not None

    @property
    def model_version(self) -> str | None:
        return self.metadata.get("modelVersion") if self.is_loaded else None

    @property
    def model_stage(self) -> str | None:
        return self.metadata.get("modelStage") if self.is_loaded else None

    @property
    def model_checksum(self) -> str | None:
        return self.metadata.get("artifactChecksum") if self.is_loaded else None

    @staticmethod
    def _positive_probability(model: Any, frame: Any) -> float:
        probabilities = model.predict_proba(frame)[0]
        classes = list(model.classes_)
        positive_index = classes.index(True) if True in classes else classes.index(1)
        value = float(probabilities[positive_index])
        if not math.isfinite(value) or not 0 <= value <= 1:
            raise RuntimeError("Modelo supervisionado devolveu probabilidade inválida.")
        return value

    def predict(self, payload: ThermalInferenceRequest) -> ThermalInferenceResponse:
        if not self.bundle:
            raise RuntimeError("Modelo térmico indisponível.")
        if payload.feature_version != THERMAL_FEATURE_VERSION:
            raise ValueError("featureVersion incompatível com o modelo ativo.")
        if not payload.quality.sufficient_for_inference or not payload.baseline.sufficient:
            raise ValueError("Histórico insuficiente para inferência térmica.")
        frame = request_to_frame(payload)
        supervised_probability = self._positive_probability(self.bundle["supervisedModel"], frame)
        anomaly_decision = float(self.bundle["anomalyModel"].decision_function(frame)[0])
        if not math.isfinite(anomaly_decision):
            raise RuntimeError("Detector de anomalia devolveu score inválido.")
        standardized = (anomaly_decision - float(self.bundle["anomalyCenter"])) / float(self.bundle["anomalyScale"])
        anomaly_probability = 1.0 / (1.0 + math.exp(max(-30.0, min(30.0, standardized))))
        model_score = 100.0 * (0.90 * supervised_probability + 0.10 * anomaly_probability)

        risk_score, floor_reason = model_score, None
        current, thresholds = payload.current, payload.thresholds
        if thresholds.absolute_limit_c is not None and current.temperature_max_c >= thresholds.absolute_limit_c:
            risk_score, floor_reason = max(risk_score, 85.0), "temperatura acima do limite absoluto configurado"
        if current.delta_t_c is not None:
            if thresholds.critical_delta_t_c is not None and current.delta_t_c >= thresholds.critical_delta_t_c:
                risk_score, floor_reason = max(risk_score, 85.0), "ΔT acima do limite crítico configurado"
            elif thresholds.high_delta_t_c is not None and current.delta_t_c >= thresholds.high_delta_t_c:
                risk_score, floor_reason = max(risk_score, 60.0), "ΔT acima do limite alto configurado"
            elif thresholds.attention_delta_t_c is not None and current.delta_t_c >= thresholds.attention_delta_t_c:
                risk_score, floor_reason = max(risk_score, 35.0), "ΔT acima do limite de atenção configurado"
        risk_score = min(100.0, risk_score)

        bands = self.bundle["riskScoreThresholds"]
        risk_level = RiskLevel.CRITICAL if risk_score >= bands["critical"] else RiskLevel.HIGH if risk_score >= bands["high"] else RiskLevel.MODERATE if risk_score >= bands["moderate"] else RiskLevel.LOW
        if risk_level is RiskLevel.LOW:
            cause, cause_confidence = ThermalCause.NOT_CONFIRMED, None
        else:
            cause_model = self.bundle["causeModel"]
            probabilities = cause_model.predict_proba(frame)[0]
            cause_index = int(np.argmax(probabilities))
            cause = ThermalCause(str(cause_model.classes_[cause_index]))
            cause_confidence = float(probabilities[cause_index])

        explanations = [f"Modelo supervisionado calibrado: {supervised_probability * 100:.1f}%.", f"Contribuição complementar de anomalia temporal: {anomaly_probability * 100:.1f}%."]
        if current.delta_t_c is not None:
            explanations.append(f"ΔT atual observado: {current.delta_t_c:.1f} °C.")
        if payload.window.trend_c_per_hour is not None:
            explanations.append(f"Tendência térmica de 60 min: {payload.window.trend_c_per_hour:.2f} °C/h.")
        if floor_reason:
            explanations.append(f"Piso de engenharia aplicado após inferência ML válida: {floor_reason}.")

        snapshot = json.dumps(payload.model_dump(mode="json", by_alias=True), sort_keys=True, separators=(",", ":"))
        identity = hashlib.sha256(f"{payload.inference_request_id}|{self.model_checksum}|{snapshot}".encode()).hexdigest()
        return ThermalInferenceResponse(
            inferenceId=f"thermal-{identity[:32]}", inferenceRequestId=payload.inference_request_id,
            modelVersion=self.model_version, modelChecksum=self.model_checksum, modelStage=self.model_stage,
            modelScore=round(model_score, 4), riskScore=round(risk_score, 4), riskLevel=risk_level,
            confidence=round(max(supervised_probability, 1.0 - supervised_probability), 6),
            predictedFailureMode=cause,
            failureModeConfidence=None if cause_confidence is None else round(cause_confidence, 6),
            explanations=explanations, recommendedAction=RECOMMENDATIONS.get(cause),
        )
