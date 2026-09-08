from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)
HEADERS = {"X-API-Key": get_settings().ai_service_api_key}


def test_general_health_reports_thermal_predictor():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["predictorType"] == "thermal"
    assert body["modelLoaded"] is True


def test_health_root_alias():
    assert client.get("/health").status_code == 200


def test_legacy_mechanical_predictor_is_unavailable():
    response = client.post(
        "/api/v1/predict",
        json={"equipmentId": "eq-1", "temperature": 80},
        headers=HEADERS,
    )
    assert response.status_code == 503
    assert "legada desativada" in response.json()["detail"]


def test_legacy_predict_without_api_key_is_rejected():
    response = client.post("/api/v1/predict", json={"equipmentId": "eq-1", "temperature": 80})
    assert response.status_code == 401
