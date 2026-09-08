from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd
import pandas.testing as pdt
import pytest

from training.build_thermal_windows import build_features
from training.generate_thermal_dataset import COMPONENT_DISTRIBUTION, generate_series, point_catalog
from training.thermal_dataset_contract import FEATURE_COLUMNS, PERIODS, RAW_COLUMNS, SEEDS, TARGET_COLUMNS, repository_root


FIXTURE = Path(__file__).parent / "fixtures/thermal_feature_reference.json"


def test_point_catalog_has_55_persistent_identities_and_expected_distribution():
    points = point_catalog()
    assert len(points) == 55
    assert len({point.code for point in points}) == 55
    actual = pd.Series([point.component_type for point in points]).value_counts().to_dict()
    assert actual == COMPONENT_DISTRIBUTION


def test_raw_contract_documents_every_generated_column():
    documented = {column.name for column in RAW_COLUMNS}
    assert set(TARGET_COLUMNS).issubset(documented)
    assert set(FEATURE_COLUMNS).isdisjoint(TARGET_COLUMNS)
    assert all(column.unit is not None for column in RAW_COLUMNS if column.name.endswith(("_c", "_a", "_percent")))


def test_reserved_scenario_is_reproducible_and_contains_55_19_and_critical_case():
    points = point_catalog(prefix="TP").copy()
    # O gerador reservado real usa TP-001, não TP-TP-001; ajuste só para este teste puro.
    points = [point.__class__(point.code.replace("TP-TP-", "TP-"), point.sector_id, point.equipment_type, point.panel_id, point.component_id, point.component_type, point.rated_current, point.baseline_rise, point.reference_base) for point in points]
    first, _ = generate_series(points, *PERIODS["demo"], SEEDS["demo_series"], plant_id="TEST-DEMO", demo=True)
    second, _ = generate_series(points, *PERIODS["demo"], SEEDS["demo_series"], plant_id="TEST-DEMO", demo=True)
    pdt.assert_frame_equal(first, second)
    assert first.thermal_point_id.nunique() == 55
    assert first.loc[first.anomaly_active, "thermal_point_id"].nunique() == 19
    critical = first[(first.thermal_point_id == "TP-039") & (first.temperature_max_c == 75.6) & (first.reference_temperature_c == 40.0) & (first.delta_t_c == 35.6)]
    assert len(critical) == 1
    after = first[(first.thermal_point_id == "TP-039") & (first.timestamp > critical.timestamp.iloc[0])]
    assert after.temperature_max_c.iloc[-1] < 45


def _reference_frame() -> tuple[pd.DataFrame, dict]:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    rows = []
    for reading in fixture["readings"]:
        rows.append({
            "timestamp": pd.Timestamp(reading["measuredAt"]), "thermal_point_id": "POINT", "panel_id": "PANEL",
            "temperature_max_c": reading["temperatureMaxC"], "temperature_average_c": reading["temperatureMaxC"] - 1,
            "ambient_temperature_c": 25, "reference_temperature_c": reading["temperatureMaxC"] - reading["deltaTC"],
            "delta_t_c": reading["deltaTC"], "current_a": reading["currentA"], "load_percent": reading["loadPercent"],
            "signal_quality": reading["signalQuality"],
        })
    return pd.DataFrame(rows), fixture["expected"]


def test_python_windows_match_cross_language_reference_fixture():
    frame, expected = _reference_frame()
    actual = build_features(frame).iloc[-1]
    mapping = {
        "mean5mC": "mean_5m_c", "mean5mSampleCount": "mean_5m_sample_count", "mean15mC": "mean_15m_c",
        "mean15mSampleCount": "mean_15m_sample_count", "mean60mC": "mean_60m_c", "mean60mSampleCount": "mean_60m_sample_count",
        "max1hC": "max_1h_c", "max6hC": "max_6h_c", "max24hC": "max_24h_c", "trendCPerHour": "trend_c_per_hour",
        "trendSampleCount": "trend_sample_count", "timeAboveLimitMin": "minutes_above_limit", "consecutiveAnomalousCount": "consecutive_anomalies",
        "minutesSinceLastValidReading": "minutes_since_last_valid_reading", "baselineMeanC": "baseline_mean_c",
        "baselineStdDevC": "baseline_stddev_c", "baselineSampleCount": "baseline_sample_count", "avgLoadPercent": "average_load_percent",
        "avgCurrentA": "average_current_a", "aggregatedSignalQuality": "aggregated_signal_quality", "totalHistorySampleCount": "total_history_sample_count",
    }
    for expected_name, actual_name in mapping.items():
        assert actual[actual_name] == pytest.approx(expected[expected_name], abs=1e-9)
    assert bool(actual.baseline_sufficient) is expected["sufficientForInference"]


def test_future_mutation_does_not_change_features_at_cutoff():
    frame, _ = _reference_frame()
    future = frame.iloc[-1:].copy()
    future["timestamp"] += pd.Timedelta(minutes=30)
    future["temperature_max_c"] = 400
    with_future = pd.concat([frame, future], ignore_index=True)
    cutoff = frame.timestamp.iloc[-1]
    before = build_features(frame).query("timestamp == @cutoff")[list(FEATURE_COLUMNS)].reset_index(drop=True)
    after = build_features(with_future).query("timestamp == @cutoff")[list(FEATURE_COLUMNS)].reset_index(drop=True)
    pdt.assert_frame_equal(before, after)


def test_generated_artifacts_have_valid_hashes_and_leakage_safe_splits():
    root = repository_root() / "datasets"
    manifest = json.loads((root / "metadata/synthetic_thermal_generation.json").read_text(encoding="utf-8"))
    groups = manifest["splits"]["panelGroups"]
    assert set(groups["train"]).isdisjoint(groups["validation"])
    assert set(groups["train"]).isdisjoint(groups["test"])
    assert set(groups["validation"]).isdisjoint(groups["test"])
    for collection in (manifest["artifacts"], manifest["splits"]["artifacts"]):
        for filename, expected in collection.items():
            matches = list(root.rglob(filename))
            assert len(matches) == 1
            assert hashlib.sha256(matches[0].read_bytes()).hexdigest() == expected


def test_runtime_does_not_import_generator_or_reserved_labels():
    root = repository_root()
    forbidden = ("generate_thermal_dataset", "synthetic_thermal_generation", "reserved_plant_scenario")
    for runtime_root in (root / "services/predictive-ai/app", root / "apps/web/src"):
        for path in runtime_root.rglob("*"):
            if path.suffix not in {".py", ".ts", ".tsx"} or ".test." in path.name or "thermal-simulation" in path.parts:
                continue
            content = path.read_text(encoding="utf-8")
            assert not any(term in content for term in forbidden), path
