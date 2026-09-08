"""Ordem canônica e adaptação do contrato térmico para o bundle sklearn."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pandas as pd

if TYPE_CHECKING:
    from app.schemas.thermal_inference import ThermalInferenceRequest

THERMAL_FEATURE_VERSION = "thermal-features-v1"

NUMERIC_THERMAL_FEATURES = [
    "temperature_max_c", "temperature_average_c", "ambient_temperature_c",
    "reference_temperature_c", "delta_t_c", "current_a", "load_percent",
    "signal_quality", "mean_5m_c", "mean_5m_sample_count", "mean_15m_c",
    "mean_15m_sample_count", "mean_60m_c", "mean_60m_sample_count",
    "max_1h_c", "max_6h_c", "max_24h_c", "trend_c_per_hour",
    "trend_sample_count", "minutes_above_limit", "consecutive_anomalies",
    "minutes_since_last_valid_reading", "baseline_mean_c", "baseline_stddev_c",
    "baseline_sample_count", "baseline_sufficient", "average_load_percent",
    "average_current_a", "total_history_sample_count", "aggregated_signal_quality",
]
CATEGORICAL_THERMAL_FEATURES = ["component_type"]
THERMAL_MODEL_FEATURES = NUMERIC_THERMAL_FEATURES + CATEGORICAL_THERMAL_FEATURES


def request_feature_values(payload: "ThermalInferenceRequest") -> dict[str, Any]:
    return {
        "temperature_max_c": payload.current.temperature_max_c,
        "temperature_average_c": payload.current.temperature_average_c,
        "ambient_temperature_c": payload.current.ambient_temperature_c,
        "reference_temperature_c": payload.current.reference_temperature_c,
        "delta_t_c": payload.current.delta_t_c,
        "current_a": payload.current.current_a,
        "load_percent": payload.current.load_percent,
        "signal_quality": payload.current.signal_quality,
        "mean_5m_c": payload.window.mean_5m_c,
        "mean_5m_sample_count": payload.window.mean_5m_sample_count,
        "mean_15m_c": payload.window.mean_15m_c,
        "mean_15m_sample_count": payload.window.mean_15m_sample_count,
        "mean_60m_c": payload.window.mean_60m_c,
        "mean_60m_sample_count": payload.window.mean_60m_sample_count,
        "max_1h_c": payload.window.max_1h_c,
        "max_6h_c": payload.window.max_6h_c,
        "max_24h_c": payload.window.max_24h_c,
        "trend_c_per_hour": payload.window.trend_c_per_hour,
        "trend_sample_count": payload.window.trend_sample_count,
        "minutes_above_limit": payload.window.time_above_limit_min,
        "consecutive_anomalies": payload.window.consecutive_anomalous_count,
        "minutes_since_last_valid_reading": payload.window.minutes_since_last_valid_reading,
        "baseline_mean_c": payload.baseline.mean_c,
        "baseline_stddev_c": payload.baseline.std_dev_c,
        "baseline_sample_count": payload.baseline.sample_count,
        "baseline_sufficient": payload.baseline.sufficient,
        "average_load_percent": payload.baseline.avg_load_percent,
        "average_current_a": payload.baseline.avg_current_a,
        "total_history_sample_count": payload.quality.total_history_sample_count,
        "aggregated_signal_quality": payload.quality.aggregated_signal_quality,
        "component_type": payload.component_type.value,
    }


def request_to_frame(payload: "ThermalInferenceRequest") -> pd.DataFrame:
    return pd.DataFrame([request_feature_values(payload)], columns=THERMAL_MODEL_FEATURES)
