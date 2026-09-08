"""Validação final dos artefatos da Etapa 7 e emissão do hash do manifesto."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

from training.thermal_dataset_contract import FEATURE_COLUMNS, PERIODS, SEEDS, TARGET_COLUMNS, repository_root

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def validate(root: Path) -> dict:
    metadata_path = root / "metadata/synthetic_thermal_generation.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    raw = pd.read_csv(root / "raw/synthetic_thermal_timeseries.csv", parse_dates=["timestamp"])
    demo = pd.read_parquet(root / "demo/reserved_plant_scenario.parquet")
    train = pd.read_parquet(root / "processed/thermal_training_windows.parquet")
    validation = pd.read_parquet(root / "processed/thermal_validation_windows.parquet")
    test = pd.read_parquet(root / "processed/thermal_test_windows.parquet")
    report_path = root / "reports/dataset_validation_report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))

    checks = {
        "developmentHas55Points": raw.thermal_point_id.nunique() == 55,
        "reservedHas55Points": demo.thermal_point_id.nunique() == 55,
        "reservedHas19AnomalousPoints": demo.loc[demo.anomaly_active, "thermal_point_id"].nunique() == 19,
        "criticalPeakExactlyOnce": len(demo[(demo.thermal_point_id == "TP-039") & (demo.temperature_max_c == 75.6) & (demo.reference_temperature_c == 40.0) & (demo.delta_t_c == 35.6)]) == 1,
        "criticalRecoversAfterPeak": bool(demo[(demo.thermal_point_id == "TP-039") & (demo.timestamp > demo.loc[(demo.thermal_point_id == "TP-039") & (demo.temperature_max_c == 75.6), "timestamp"].iloc[0])].temperature_max_c.iloc[-1] < 45),
        "developmentAndDemoIdentitiesDistinct": set(raw.thermal_point_id).isdisjoint(set(demo.thermal_point_id)),
        "developmentAndDemoPeriodsDistinct": raw.timestamp.max() < demo.timestamp.min(),
        "seedsDistinct": len(set(SEEDS.values())) == len(SEEDS),
        "panelsDisjoint": set(train.panel_id).isdisjoint(validation.panel_id) and set(train.panel_id).isdisjoint(test.panel_id) and set(validation.panel_id).isdisjoint(test.panel_id),
        "pointsDisjoint": set(train.thermal_point_id).isdisjoint(validation.thermal_point_id) and set(train.thermal_point_id).isdisjoint(test.thermal_point_id) and set(validation.thermal_point_id).isdisjoint(test.thermal_point_id),
        "chronologicalBoundaries": train.timestamp.max() < validation.timestamp.min() < test.timestamp.min(),
        "featuresExcludeTargets": set(FEATURE_COLUMNS).isdisjoint(TARGET_COLUMNS),
        "allSplitsContainBothClasses": all(frame.failure_within_24h.nunique() == 2 for frame in (train, validation, test)),
        "simpleRuleNotPerfect": report["simpleRuleBaseline"]["f1"] < 0.999,
        "mlBaselineNotPerfect": report["baselineLogisticRegression"]["f1"] < 0.999,
        "finalTestNotUsedForModelSelection": report["scope"].endswith("final test split was not read"),
    }
    if not all(checks.values()):
        raise AssertionError({key: value for key, value in checks.items() if not value})
    artifacts = {}
    for group in (metadata["artifacts"], metadata["splits"]["artifacts"]):
        for name, expected in group.items():
            matches = list(root.rglob(name))
            if len(matches) != 1 or sha256(matches[0]) != expected:
                raise AssertionError(f"Hash inválido: {name}")
            artifacts[name] = expected
    artifacts[report_path.name] = sha256(report_path)
    metadata["validation"] = {"checks": checks, "artifacts": artifacts, "result": "PASS"}
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    manifest_hash = sha256(metadata_path)
    (root / "metadata/synthetic_thermal_generation.sha256").write_text(f"{manifest_hash}  synthetic_thermal_generation.json\n", encoding="ascii")
    return {"result": "PASS", "checks": len(checks), "manifestSha256": manifest_hash}

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path, default=repository_root() / "datasets")
    args = parser.parse_args()
    print(json.dumps(validate(args.dataset_root.resolve()), ensure_ascii=False))

if __name__ == "__main__":
    main()
