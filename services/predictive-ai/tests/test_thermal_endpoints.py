from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.core.config import get_settings
from app.ml.model_loader import get_thermal_predictor
from app.ml.thermal_predictor import ThermalMlPredictor
from training.thermal_dataset_contract import repository_root

client = TestClient(app)
HEADERS = {"X-API-Key": get_settings().ai_service_api_key}


def payload(*, critical: bool = False) -> dict:
    temperature = 75.6 if critical else 36.0
    reference = 40.0 if critical else 34.0
    delta = 35.6 if critical else 2.0
    return {
        "inferenceRequestId": "reading-1:thermal-features-v1",
        "thermalReadingId": "11111111-1111-4111-8111-111111111111",
        "thermalPointId": "22222222-2222-4222-8222-222222222222",
        "componentType": "CIRCUIT_BREAKER",
        "featureVersion": "thermal-features-v1",
        "current": {
            "temperatureMaxC": temperature, "temperatureAverageC": temperature - 1,
            "ambientTemperatureC": 25.0, "referenceTemperatureC": reference,
            "deltaTC": delta, "currentA": 18.0, "loadPercent": 72.0,
            "signalQuality": 0.96, "measuredAt": "2026-09-03T18:00:00Z",
        },
        "window": {
            "mean5mC": temperature, "mean5mSampleCount": 1,
            "mean15mC": temperature, "mean15mSampleCount": 1,
            "mean60mC": temperature - 0.5, "mean60mSampleCount": 2,
            "max1hC": temperature, "max6hC": temperature, "max24hC": temperature,
            "trendCPerHour": 1.0 if critical else 0.1, "trendSampleCount": 2,
            "timeAboveLimitMin": 30.0 if critical else 0.0,
            "consecutiveAnomalousCount": 2 if critical else 0,
            "minutesSinceLastValidReading": 30.0,
        },
        "baseline": {
            "meanC": 34.0, "stdDevC": 1.2, "sampleCount": 100,
            "sufficient": True, "avgLoadPercent": 70.0, "avgCurrentA": 17.0,
        },
        "thresholds": {
            "absoluteLimitC": 70.0, "attentionDeltaTC": 10.0,
            "highDeltaTC": 20.0, "criticalDeltaTC": 30.0,
        },
        "quality": {
            "sufficientForInference": True, "totalHistorySampleCount": 100,
            "aggregatedSignalQuality": 0.95,
        },
    }


def test_thermal_health_exposes_verified_model_without_sensitive_path():
    response = client.get("/api/v1/thermal/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["modelLoaded"] is True
    assert body["predictorType"] == "thermal"
    assert body["modelStage"] == "SYNTHETIC_EXPERIMENTAL"
    assert body["isSyntheticModel"] is True
    assert body["modelChecksum"].startswith("sha256:")
    assert "path" not in json.dumps(body).lower()


def test_thermal_predict_requires_api_key():
    assert client.post("/api/v1/thermal/predict", json=payload()).status_code == 401


def test_normal_prediction_is_valid_explained_and_deterministic():
    first = client.post("/api/v1/thermal/predict", json=payload(), headers=HEADERS)
    second = client.post("/api/v1/thermal/predict", json=payload(), headers=HEADERS)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    body = first.json()
    assert 0 <= body["modelScore"] <= 100
    assert 0 <= body["riskScore"] <= 100
    assert body["explanations"]
    assert body["inferenceRequestId"] == payload()["inferenceRequestId"]
    assert body["modelStage"] == "SYNTHETIC_EXPERIMENTAL"


def test_critical_engineering_floor_is_applied_only_after_valid_ml_score():
    response = client.post("/api/v1/thermal/predict", json=payload(critical=True), headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body["riskLevel"] == "CRITICAL"
    assert body["riskScore"] >= 85
    assert 0 <= body["modelScore"] <= 100
    assert any("após inferência ML válida" in explanation for explanation in body["explanations"])


def test_strict_schema_and_feature_version_fail_with_422():
    extra = payload()
    extra["groundTruth"] = "OVERLOAD"
    assert client.post("/api/v1/thermal/predict", json=extra, headers=HEADERS).status_code == 422
    incompatible = payload()
    incompatible["featureVersion"] = "thermal-features-v0"
    assert client.post("/api/v1/thermal/predict", json=incompatible, headers=HEADERS).status_code == 422


def test_insufficient_history_fails_without_prediction():
    body = payload()
    body["quality"]["sufficientForInference"] = False
    response = client.post("/api/v1/thermal/predict", json=body, headers=HEADERS)
    assert response.status_code == 422


def test_missing_or_corrupted_artifact_disables_health_and_predict():
    dataset_root = repository_root() / "datasets"
    missing = ThermalMlPredictor(dataset_root / ".missing-model.joblib", dataset_root / ".missing-metadata.json")
    app.dependency_overrides[get_thermal_predictor] = lambda: missing
    try:
        health = client.get("/api/v1/thermal/health")
        assert health.status_code == 200
        assert health.json()["ready"] is False
        assert client.post("/api/v1/thermal/predict", json=payload(), headers=HEADERS).status_code == 503
    finally:
        app.dependency_overrides.clear()

    root = repository_root() / "services/predictive-ai/models"
    artifact = dataset_root / ".corrupted-thermal-model.joblib"
    metadata = dataset_root / ".corrupted-thermal-metadata.json"
    try:
        artifact.write_bytes((root / "thermal_model.joblib").read_bytes())
        metadata.write_bytes((root / "metadata.json").read_bytes())
        artifact.write_bytes(artifact.read_bytes() + b"corruption")
        corrupted = ThermalMlPredictor(artifact, metadata)
        assert corrupted.is_loaded is False
        assert "Checksum" in (corrupted.load_error or "")
    finally:
        artifact.unlink(missing_ok=True)
        metadata.unlink(missing_ok=True)
