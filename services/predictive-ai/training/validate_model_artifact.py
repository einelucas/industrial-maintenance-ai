"""Valida o bundle térmico e seus metadados sem executar o FastAPI."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.ml.thermal_features import THERMAL_MODEL_FEATURES
from app.ml.thermal_predictor import ThermalMlPredictor, file_sha256
from training.thermal_dataset_contract import TARGET_COLUMNS, repository_root
from training.train_thermal_models import reproducibility_fingerprint


def validate(artifact: Path, metadata: Path, probe_dataset: Path) -> dict:
    predictor = ThermalMlPredictor(artifact, metadata)
    if not predictor.is_loaded:
        raise AssertionError(predictor.load_error or "Artefato térmico inválido.")
    details = json.loads(metadata.read_text(encoding="utf-8"))
    bundle = joblib.load(artifact)
    if set(THERMAL_MODEL_FEATURES) & set(TARGET_COLUMNS):
        raise AssertionError("Target presente nas features do modelo.")
    if details["trainingDatasetHash"] == details["reservedScenarioHash"]:
        raise AssertionError("Treino e cenário reservado não podem ter o mesmo hash.")
    full_probe = pd.read_parquet(probe_dataset)
    probe = full_probe[THERMAL_MODEL_FEATURES].head(3)
    first = bundle["supervisedModel"].predict_proba(probe)
    second = bundle["supervisedModel"].predict_proba(probe)
    if not np.array_equal(first, second) or not np.isfinite(first).all():
        raise AssertionError("Inferência do artefato não é determinística/finita.")
    result = {
        "result": "PASS",
        "artifactChecksum": f"sha256:{file_sha256(artifact)}",
        "reproducibilityFingerprint": details["reproducibilityFingerprint"],
        "modelVersion": predictor.model_version,
        "modelStage": predictor.model_stage,
        "featureCount": len(THERMAL_MODEL_FEATURES),
        "supervisedModelRequired": True,
        "groundTruthInFeatures": False,
        "deterministicProbe": True,
    }
    if result["artifactChecksum"] != details["artifactChecksum"]:
        raise AssertionError("Checksum final divergente.")
    if reproducibility_fingerprint(bundle, full_probe) != details["reproducibilityFingerprint"]:
        raise AssertionError("Fingerprint semântico divergente.")
    return result


def main() -> None:
    root = repository_root()
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", type=Path, default=root / "services/predictive-ai/models/thermal_model.joblib")
    parser.add_argument("--metadata", type=Path, default=root / "services/predictive-ai/models/metadata.json")
    parser.add_argument("--probe-dataset", type=Path, default=root / "datasets/processed/thermal_test_windows.parquet")
    args = parser.parse_args()
    print(json.dumps(validate(args.artifact.resolve(), args.metadata.resolve(), args.probe_dataset.resolve()), ensure_ascii=False))


if __name__ == "__main__":
    main()
