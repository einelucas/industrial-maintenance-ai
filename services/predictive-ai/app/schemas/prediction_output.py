from enum import Enum

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class PredictionOutput(BaseModel):
    failure_probability: float = Field(..., alias="failureProbability", ge=0, le=1)
    risk_level: RiskLevel = Field(..., alias="riskLevel")
    predicted_class: int = Field(..., alias="predictedClass")
    model_version: str = Field(..., alias="modelVersion")
    features_used: list[str] = Field(..., alias="featuresUsed")
    is_demo_model: bool = Field(..., alias="isDemoModel")

    model_config = {"populate_by_name": True, "protected_namespaces": ()}


class HealthOutput(BaseModel):
    status: str
    app_version: str = Field(..., alias="appVersion")
    model_loaded: bool = Field(..., alias="modelLoaded")
    predictor_type: str = Field(..., alias="predictorType")

    model_config = {"populate_by_name": True, "protected_namespaces": ()}
