"""Contrato versionado do dataset térmico sintético da Etapa 7.

Este módulo pertence exclusivamente ao pipeline offline. Nenhum endpoint de
inferência importa dados, manifestos ou rótulos daqui.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Final

CONTRACT_VERSION: Final = "thermal-dataset-v1"
FEATURE_VERSION: Final = "thermal-features-v1"
SAMPLE_INTERVAL_MINUTES: Final = 30
PRIMARY_HORIZON_HOURS: Final = 24
SECONDARY_HORIZON_HOURS: Final = 7 * 24
MIN_BASELINE_SAMPLES: Final = 10
MAX_TIME_ABOVE_GAP_MINUTES: Final = 180

SEEDS: Final = {
    "development": 20260701,
    "split": 20260702,
    "demo_identity": 20260903,
    "demo_series": 356194,
}

PERIODS: Final = {
    "development": ("2026-01-01T00:00:00Z", "2026-03-31T23:30:00Z"),
    "train": ("2026-01-01T00:00:00Z", "2026-02-15T23:30:00Z"),
    "validation": ("2026-02-16T00:00:00Z", "2026-03-01T23:30:00Z"),
    "test": ("2026-03-02T00:00:00Z", "2026-03-31T23:30:00Z"),
    "demo": ("2026-08-29T07:00:00Z", "2026-09-03T18:00:00Z"),
}

FAILURE_MODES: Final = (
    "NONE",
    "LOOSE_CONNECTION",
    "CONTACT_RESISTANCE",
    "OVERLOAD",
    "PHASE_IMBALANCE",
    "DEGRADED_CONTACT",
    "INSUFFICIENT_VENTILATION",
    "THERMAL_RELAY_DEGRADATION",
    "SENSOR_ERROR",
)

FEATURE_COLUMNS: Final = (
    "temperature_max_c", "temperature_average_c", "ambient_temperature_c",
    "reference_temperature_c", "delta_t_c", "current_a", "load_percent",
    "signal_quality", "mean_5m_c", "mean_5m_sample_count", "mean_15m_c",
    "mean_15m_sample_count", "mean_60m_c", "mean_60m_sample_count",
    "max_1h_c", "max_6h_c", "max_24h_c", "trend_c_per_hour",
    "trend_sample_count", "minutes_above_limit", "consecutive_anomalies",
    "minutes_since_last_valid_reading", "baseline_mean_c", "baseline_stddev_c",
    "baseline_sample_count", "baseline_sufficient", "average_load_percent",
    "average_current_a", "total_history_sample_count", "aggregated_signal_quality",
)

TARGET_COLUMNS: Final = (
    "failure_mode", "anomaly_active", "maintenance_required",
    "failure_within_24h", "failure_within_7d",
)

@dataclass(frozen=True)
class ColumnSpec:
    name: str
    dtype: str
    unit: str | None
    nullable: bool
    role: str
    description: str

RAW_COLUMNS: Final = (
    ColumnSpec("timestamp", "datetime64[ns, UTC]", "UTC", False, "identity", "Instante da medição."),
    ColumnSpec("plant_id", "string", None, False, "identity", "Planta sintética."),
    ColumnSpec("sector_id", "string", None, False, "identity", "Setor sintético."),
    ColumnSpec("equipment_type", "string", None, False, "context", "Família do equipamento."),
    ColumnSpec("panel_id", "string", None, False, "identity", "Painel persistente."),
    ColumnSpec("component_id", "string", None, False, "identity", "Componente persistente."),
    ColumnSpec("thermal_point_id", "string", None, False, "identity", "Ponto persistente."),
    ColumnSpec("component_type", "category", None, False, "context", "Tipo do componente Prisma."),
    ColumnSpec("temperature_max_c", "float64", "degC", True, "feature_source", "Máxima medida; nula sem comunicação."),
    ColumnSpec("temperature_average_c", "float64", "degC", True, "feature_source", "Média térmica da ROI."),
    ColumnSpec("ambient_temperature_c", "float64", "degC", True, "feature_source", "Ambiente com ciclo diário."),
    ColumnSpec("reference_temperature_c", "float64", "degC", True, "feature_source", "Ponto/fase saudável equivalente."),
    ColumnSpec("delta_t_c", "float64", "degC", True, "feature_source", "Máxima menos referência."),
    ColumnSpec("current_a", "float64", "A", True, "feature_source", "Corrente elétrica."),
    ColumnSpec("load_percent", "float64", "%", True, "feature_source", "Carga nominal."),
    ColumnSpec("emissivity", "float64", "ratio", True, "feature_source", "Emissividade usada na medição."),
    ColumnSpec("signal_quality", "float64", "ratio", True, "feature_source", "Qualidade de 0 a 1."),
    ColumnSpec("communication_state", "category", None, False, "quality", "ONLINE, DEGRADED ou OFFLINE."),
    ColumnSpec("operating_state", "category", None, False, "context", "OFF, RUNNING ou MAINTENANCE."),
    ColumnSpec("failure_mode", "category", None, False, "target", "Ground truth offline; nunca enviado à inferência."),
    ColumnSpec("anomaly_active", "bool", None, False, "target", "Episódio anormal ativo."),
    ColumnSpec("maintenance_required", "bool", None, False, "target", "Intervenção prevista pelo simulador."),
    ColumnSpec("failure_within_24h", "bool", None, False, "target", "Evento confirmado nas próximas 24 h."),
    ColumnSpec("failure_within_7d", "bool", None, False, "target", "Evento confirmado nos próximos 7 dias."),
    ColumnSpec("episode_id", "string", None, True, "audit", "Episódio sintético para auditoria, excluído das features."),
    ColumnSpec("hours_to_event", "float64", "h", True, "audit", "Somente auditoria de target; excluído das features."),
)

def contract_manifest() -> dict:
    return {
        "contractVersion": CONTRACT_VERSION,
        "featureVersion": FEATURE_VERSION,
        "sampleIntervalMinutes": SAMPLE_INTERVAL_MINUTES,
        "targets": {
            "primary": {"column": "failure_within_24h", "horizonHours": PRIMARY_HORIZON_HOURS},
            "secondary": {"column": "failure_within_7d", "horizonHours": SECONDARY_HORIZON_HOURS},
        },
        "seeds": SEEDS,
        "periods": PERIODS,
        "columns": [asdict(column) for column in RAW_COLUMNS],
        "featureColumns": list(FEATURE_COLUMNS),
        "targetColumns": list(TARGET_COLUMNS),
        "syntheticData": True,
        "industrialEfficacyClaim": False,
        "generatedAtPolicy": "Deterministic artifacts: no wall-clock timestamps in manifests.",
    }

def parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)

def repository_root() -> Path:
    return Path(__file__).resolve().parents[3]
