"""Contrato Pydantic estrito espelhado do gateway térmico Next.js."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid", allow_inf_nan=False, protected_namespaces=())


class ComponentType(str, Enum):
    CIRCUIT_BREAKER = "CIRCUIT_BREAKER"
    CONTACTOR = "CONTACTOR"
    THERMAL_RELAY = "THERMAL_RELAY"
    BUSBAR = "BUSBAR"
    TERMINAL = "TERMINAL"
    OTHER = "OTHER"


class ThermalCause(str, Enum):
    LOOSE_CONNECTION = "LOOSE_CONNECTION"
    CONTACT_RESISTANCE = "CONTACT_RESISTANCE"
    OVERLOAD = "OVERLOAD"
    PHASE_IMBALANCE = "PHASE_IMBALANCE"
    DEGRADED_CONTACT = "DEGRADED_CONTACT"
    INSUFFICIENT_VENTILATION = "INSUFFICIENT_VENTILATION"
    THERMAL_RELAY_DEGRADATION = "THERMAL_RELAY_DEGRADATION"
    PROCESS_CONDITION = "PROCESS_CONDITION"
    SENSOR_ERROR = "SENSOR_ERROR"
    NOT_CONFIRMED = "NOT_CONFIRMED"
    OTHER = "OTHER"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CurrentReading(StrictModel):
    temperature_max_c: float = Field(alias="temperatureMaxC")
    temperature_average_c: float | None = Field(alias="temperatureAverageC")
    ambient_temperature_c: float | None = Field(alias="ambientTemperatureC")
    reference_temperature_c: float | None = Field(alias="referenceTemperatureC")
    delta_t_c: float | None = Field(alias="deltaTC")
    current_a: float | None = Field(alias="currentA")
    load_percent: float | None = Field(alias="loadPercent")
    signal_quality: float | None = Field(alias="signalQuality", ge=0, le=1)
    measured_at: datetime = Field(alias="measuredAt")


class WindowFeatures(StrictModel):
    mean_5m_c: float | None = Field(alias="mean5mC")
    mean_5m_sample_count: int = Field(alias="mean5mSampleCount", ge=0)
    mean_15m_c: float | None = Field(alias="mean15mC")
    mean_15m_sample_count: int = Field(alias="mean15mSampleCount", ge=0)
    mean_60m_c: float | None = Field(alias="mean60mC")
    mean_60m_sample_count: int = Field(alias="mean60mSampleCount", ge=0)
    max_1h_c: float | None = Field(alias="max1hC")
    max_6h_c: float | None = Field(alias="max6hC")
    max_24h_c: float | None = Field(alias="max24hC")
    trend_c_per_hour: float | None = Field(alias="trendCPerHour")
    trend_sample_count: int = Field(alias="trendSampleCount", ge=0)
    time_above_limit_min: float | None = Field(alias="timeAboveLimitMin", ge=0)
    consecutive_anomalous_count: int = Field(alias="consecutiveAnomalousCount", ge=0)
    minutes_since_last_valid_reading: float | None = Field(alias="minutesSinceLastValidReading", ge=0)


class BaselineFeatures(StrictModel):
    mean_c: float | None = Field(alias="meanC")
    std_dev_c: float | None = Field(alias="stdDevC", ge=0)
    sample_count: int = Field(alias="sampleCount", ge=0)
    sufficient: bool
    avg_load_percent: float | None = Field(alias="avgLoadPercent")
    avg_current_a: float | None = Field(alias="avgCurrentA")


class EngineeringThresholds(StrictModel):
    absolute_limit_c: float | None = Field(alias="absoluteLimitC")
    attention_delta_t_c: float | None = Field(alias="attentionDeltaTC")
    high_delta_t_c: float | None = Field(alias="highDeltaTC")
    critical_delta_t_c: float | None = Field(alias="criticalDeltaTC")

    @model_validator(mode="after")
    def ordered_delta_thresholds(self) -> "EngineeringThresholds":
        values = [self.attention_delta_t_c, self.high_delta_t_c, self.critical_delta_t_c]
        if all(value is not None for value in values) and not values[0] < values[1] < values[2]:
            raise ValueError("attentionDeltaTC < highDeltaTC < criticalDeltaTC é obrigatório.")
        return self


class QualityFeatures(StrictModel):
    sufficient_for_inference: bool = Field(alias="sufficientForInference")
    total_history_sample_count: int = Field(alias="totalHistorySampleCount", ge=0)
    aggregated_signal_quality: float | None = Field(alias="aggregatedSignalQuality", ge=0, le=1)


class ThermalInferenceRequest(StrictModel):
    inference_request_id: str = Field(alias="inferenceRequestId", min_length=1)
    thermal_reading_id: UUID = Field(alias="thermalReadingId")
    thermal_point_id: UUID = Field(alias="thermalPointId")
    component_type: ComponentType = Field(alias="componentType")
    feature_version: str = Field(alias="featureVersion", min_length=1)
    current: CurrentReading
    window: WindowFeatures
    baseline: BaselineFeatures
    thresholds: EngineeringThresholds
    quality: QualityFeatures


class ThermalInferenceResponse(StrictModel):
    inference_id: str = Field(alias="inferenceId", min_length=1)
    inference_request_id: str = Field(alias="inferenceRequestId", min_length=1)
    model_version: str = Field(alias="modelVersion", min_length=1)
    model_checksum: str = Field(alias="modelChecksum", pattern=r"^sha256:[a-f0-9]{64}$")
    model_stage: str = Field(alias="modelStage", min_length=1)
    model_score: float = Field(alias="modelScore", ge=0, le=100)
    risk_score: float = Field(alias="riskScore", ge=0, le=100)
    risk_level: RiskLevel = Field(alias="riskLevel")
    confidence: float = Field(ge=0, le=1)
    predicted_failure_mode: ThermalCause = Field(alias="predictedFailureMode")
    failure_mode_confidence: float | None = Field(alias="failureModeConfidence", ge=0, le=1)
    explanations: list[str] = Field(min_length=1)
    recommended_action: str | None = Field(alias="recommendedAction")


class ThermalHealthOutput(StrictModel):
    status: str
    ready: bool
    model_loaded: bool = Field(alias="modelLoaded")
    predictor_type: str = Field(alias="predictorType")
    model_version: str | None = Field(alias="modelVersion")
    model_stage: str | None = Field(alias="modelStage")
    model_checksum: str | None = Field(alias="modelChecksum")
    is_synthetic_model: bool | None = Field(alias="isSyntheticModel")
    feature_version: str | None = Field(alias="featureVersion")
    reason: str | None = None
