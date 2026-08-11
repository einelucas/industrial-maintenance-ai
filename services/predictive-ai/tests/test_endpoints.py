from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)
settings = get_settings()


def test_health_ok():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "predictorType" in body


def test_health_root_alias():
    response = client.get("/health")
    assert response.status_code == 200


def test_predict_without_api_key_is_rejected():
    response = client.post("/api/v1/predict", json={"equipmentId": "eq-1", "temperature": 80})
    assert response.status_code == 401


def test_predict_with_valid_api_key():
    response = client.post(
        "/api/v1/predict",
        json={
            "equipmentId": "eq-1",
            "temperature": 82.5,
            "vibration": 6.1,
            "pressure": 7.0,
            "rpm": 1800,
            "current": 21.0,
            "operatingHours": 4500,
        },
        headers={"X-API-Key": settings.ai_service_api_key},
    )
    assert response.status_code == 200
    body = response.json()
    assert 0 <= body["failureProbability"] <= 1
    assert body["riskLevel"] in {"LOW", "MODERATE", "HIGH", "CRITICAL"}
    assert body["predictedClass"] in {0, 1}
    assert isinstance(body["featuresUsed"], list)


def test_predict_requires_at_least_one_feature():
    response = client.post(
        "/api/v1/predict",
        json={"equipmentId": "eq-2"},
        headers={"X-API-Key": settings.ai_service_api_key},
    )
    assert response.status_code == 422
