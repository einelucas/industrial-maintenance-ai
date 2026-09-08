"""Treina, seleciona, calibra e publica o bundle térmico da Etapa 8."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score, brier_score_loss, f1_score, precision_score,
    recall_score, roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.ml.thermal_features import (
    CATEGORICAL_THERMAL_FEATURES, NUMERIC_THERMAL_FEATURES,
    THERMAL_FEATURE_VERSION, THERMAL_MODEL_FEATURES,
)
from training.thermal_dataset_contract import PERIODS, SEEDS, repository_root

DEFAULT_TARGET = "failure_within_24h"
ALLOWED_STAGES = {"SYNTHETIC_EXPERIMENTAL", "PLANT_CALIBRATION", "PLANT_VALIDATED"}
CAUSES = [
    "LOOSE_CONNECTION", "CONTACT_RESISTANCE", "OVERLOAD", "PHASE_IMBALANCE",
    "DEGRADED_CONTACT", "INSUFFICIENT_VENTILATION",
    "THERMAL_RELAY_DEGRADATION", "SENSOR_ERROR",
]
COMPONENT_TYPES = ["CIRCUIT_BREAKER", "CONTACTOR", "THERMAL_RELAY", "BUSBAR", "TERMINAL"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def preprocessing(*, dense: bool = False, scale: bool = False) -> ColumnTransformer:
    numeric_steps: list[tuple[str, Any]] = [("imputer", SimpleImputer(strategy="median"))]
    if scale:
        numeric_steps.append(("scale", StandardScaler()))
    return ColumnTransformer([
        ("numeric", Pipeline(numeric_steps), NUMERIC_THERMAL_FEATURES),
        ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=not dense), CATEGORICAL_THERMAL_FEATURES),
    ])


def candidates(seed: int) -> dict[str, Pipeline]:
    return {
        "logistic_regression": Pipeline([
            ("features", preprocessing(scale=True)),
            ("model", LogisticRegression(max_iter=700, class_weight="balanced", random_state=seed)),
        ]),
        "random_forest": Pipeline([
            ("features", preprocessing()),
            ("model", RandomForestClassifier(
                n_estimators=160, max_depth=14, min_samples_leaf=4,
                class_weight="balanced_subsample", random_state=seed, n_jobs=1,
            )),
        ]),
        "gradient_boosting": Pipeline([
            ("features", preprocessing(dense=True)),
            ("model", GradientBoostingClassifier(
                n_estimators=120, learning_rate=0.05, max_depth=3,
                min_samples_leaf=8, random_state=seed,
            )),
        ]),
    }


def best_threshold(y_true: pd.Series, scores: np.ndarray) -> float:
    options = np.linspace(0.10, 0.90, 81)
    ranked = [(f1_score(y_true, scores >= value, zero_division=0), value) for value in options]
    return float(max(ranked, key=lambda item: (item[0], -abs(item[1] - 0.5)))[1])


def binary_metrics(y_true: pd.Series, scores: np.ndarray, threshold: float) -> dict[str, float]:
    predicted = scores >= threshold
    return {
        "threshold": threshold,
        "precision": float(precision_score(y_true, predicted, zero_division=0)),
        "recall": float(recall_score(y_true, predicted, zero_division=0)),
        "f1": float(f1_score(y_true, predicted, zero_division=0)),
        "prAuc": float(average_precision_score(y_true, scores)),
        "rocAuc": float(roc_auc_score(y_true, scores)),
        "brier": float(brier_score_loss(y_true, scores)),
    }


def segmented_metrics(frame: pd.DataFrame, scores: np.ndarray, target: str, threshold: float, column: str) -> dict[str, dict[str, float | int | None]]:
    result: dict[str, dict[str, float | int | None]] = {}
    for value, indices in frame.groupby(column, observed=True).groups.items():
        positions = frame.index.get_indexer(indices)
        y = frame.loc[indices, target]
        part_scores = scores[positions]
        result[str(value)] = {
            "rows": int(len(y)),
            "positives": int(y.sum()),
            "precision": float(precision_score(y, part_scores >= threshold, zero_division=0)),
            "recall": float(recall_score(y, part_scores >= threshold, zero_division=0)),
            "f1": float(f1_score(y, part_scores >= threshold, zero_division=0)),
            "prAuc": float(average_precision_score(y, part_scores)) if y.nunique() == 2 else None,
        }
    return result


def false_alerts_per_point_day(frame: pd.DataFrame, scores: np.ndarray, target: str, threshold: float) -> float:
    false_alerts = int(((scores >= threshold) & ~frame[target].to_numpy(dtype=bool)).sum())
    point_days = frame.assign(day=frame.timestamp.dt.floor("D"))[["thermal_point_id", "day"]].drop_duplicates().shape[0]
    return float(false_alerts / point_days)


def fit_candidate(name: str, model: Pipeline, x: pd.DataFrame, y: pd.Series) -> Pipeline:
    if name == "gradient_boosting":
        positive_weight = max(1.0, float((~y).sum() / max(1, y.sum())))
        weights = np.where(y.to_numpy(dtype=bool), positive_weight, 1.0)
        model.fit(x, y, model__sample_weight=weights)
    else:
        model.fit(x, y)
    return model


def current_commit(root: Path) -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=root, check=True,
            capture_output=True, text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def reproducibility_fingerprint(bundle: dict[str, Any], probe: pd.DataFrame) -> str:
    """Hash semântico estável; não depende da representação pickle do sklearn."""
    features = probe[THERMAL_MODEL_FEATURES]
    digest = hashlib.sha256(json.dumps({
        "artifactType": bundle["artifactType"], "modelVersion": bundle["modelVersion"],
        "modelStage": bundle["modelStage"], "featureVersion": bundle["featureVersion"],
        "features": bundle["features"], "riskScoreThresholds": bundle["riskScoreThresholds"],
    }, sort_keys=True, separators=(",", ":")).encode())
    outputs = (
        bundle["supervisedModel"].predict_proba(features),
        bundle["anomalyModel"].decision_function(features),
        bundle["causeModel"].predict_proba(features),
    )
    for values in outputs:
        canonical = np.round(np.asarray(values, dtype="<f8"), 10)
        digest.update(canonical.tobytes(order="C"))
    digest.update("|".join(map(str, bundle["causeModel"].classes_)).encode())
    return f"sha256:{digest.hexdigest()}"


def train(
    dataset: Path,
    validation_dataset: Path,
    test_dataset: Path,
    output_dir: Path,
    target: str,
    seed: int,
    model_stage: str,
    training_start: str | None,
    training_end: str | None,
) -> dict[str, Any]:
    if model_stage not in ALLOWED_STAGES:
        raise ValueError(f"Estágio inválido: {model_stage}")
    train_frame = pd.read_parquet(dataset)
    validation_frame = pd.read_parquet(validation_dataset)
    if training_start:
        train_frame = train_frame[train_frame.timestamp >= pd.Timestamp(training_start)]
    if training_end:
        train_frame = train_frame[train_frame.timestamp <= pd.Timestamp(training_end)]
    if not set(THERMAL_MODEL_FEATURES).issubset(train_frame.columns):
        raise ValueError("Dataset não contém todas as features térmicas do runtime.")
    if target not in train_frame or train_frame[target].nunique() != 2 or validation_frame[target].nunique() != 2:
        raise ValueError("Target binário inválido em treino/validação.")

    x_train, y_train = train_frame[THERMAL_MODEL_FEATURES], train_frame[target].astype(bool)
    x_validation, y_validation = validation_frame[THERMAL_MODEL_FEATURES], validation_frame[target].astype(bool)
    fitted: dict[str, Pipeline] = {}
    candidate_metrics: dict[str, dict[str, float]] = {}
    for name, estimator in candidates(seed).items():
        fitted[name] = fit_candidate(name, estimator, x_train, y_train)
        scores = fitted[name].predict_proba(x_validation)[:, 1]
        candidate_metrics[name] = binary_metrics(y_validation, scores, best_threshold(y_validation, scores))

    winner_name = max(
        candidate_metrics,
        key=lambda name: (
            candidate_metrics[name]["prAuc"], candidate_metrics[name]["recall"],
            candidate_metrics[name]["f1"], -candidate_metrics[name]["brier"],
        ),
    )
    winner = fitted[winner_name]

    # A primeira metade cronológica da validação calibra; a segunda mede e fixa o threshold.
    validation_sorted = validation_frame.sort_values("timestamp").reset_index(drop=True)
    boundary = len(validation_sorted) // 2
    calibration = validation_sorted.iloc[:boundary]
    validation_eval = validation_sorted.iloc[boundary:]
    calibrated = CalibratedClassifierCV(estimator=winner, method="sigmoid", cv="prefit")
    calibrated.fit(calibration[THERMAL_MODEL_FEATURES], calibration[target].astype(bool))
    validation_scores = calibrated.predict_proba(validation_eval[THERMAL_MODEL_FEATURES])[:, 1]
    decision_threshold = best_threshold(validation_eval[target], validation_scores)
    validation_metrics = binary_metrics(validation_eval[target], validation_scores, decision_threshold)

    anomaly = Pipeline([
        ("features", preprocessing(dense=True, scale=True)),
        ("model", IsolationForest(n_estimators=120, max_samples=1024, contamination="auto", random_state=seed, n_jobs=1)),
    ])
    anomaly.fit(x_train.loc[~y_train])
    normal_decisions = anomaly.decision_function(x_train.loc[~y_train])
    anomaly_center = float(np.median(normal_decisions))
    anomaly_scale = float(max(np.std(normal_decisions), 1e-6))

    cause_rows = train_frame[train_frame.failure_mode.isin(CAUSES)].copy()
    cause_model = Pipeline([
        ("features", preprocessing()),
        ("model", RandomForestClassifier(
            n_estimators=160, max_depth=14, min_samples_leaf=3,
            class_weight="balanced_subsample", random_state=seed + 1, n_jobs=1,
        )),
    ])
    cause_model.fit(cause_rows[THERMAL_MODEL_FEATURES], cause_rows.failure_mode)

    # Só agora o teste final é aberto: algoritmo, calibração e threshold já estão congelados.
    test_frame = pd.read_parquet(test_dataset)
    test_scores = calibrated.predict_proba(test_frame[THERMAL_MODEL_FEATURES])[:, 1]
    test_metrics = binary_metrics(test_frame[target], test_scores, decision_threshold)
    test_for_segments = test_frame.reset_index(drop=True).copy()
    test_for_segments["load_band"] = pd.cut(
        test_for_segments.load_percent,
        bins=[-np.inf, 40, 70, 100, np.inf], labels=["LOW", "MEDIUM", "HIGH", "OVERLOAD"],
    )
    by_component = segmented_metrics(test_for_segments, test_scores, target, decision_threshold, "component_type")
    by_load = segmented_metrics(test_for_segments, test_scores, target, decision_threshold, "load_band")
    false_alert_rate = false_alerts_per_point_day(test_for_segments, test_scores, target, decision_threshold)
    cause_test = test_frame[test_frame.failure_mode.isin(CAUSES)]
    cause_accuracy = float((cause_model.predict(cause_test[THERMAL_MODEL_FEATURES]) == cause_test.failure_mode).mean()) if len(cause_test) else None

    root = repository_root()
    train_hash = sha256(dataset)
    reserved_path = root / "datasets/demo/reserved_plant_scenario.parquet"
    reserved_hash = sha256(reserved_path)
    config_fingerprint = json.dumps({
        "winner": winner_name, "seed": seed, "target": target,
        "features": THERMAL_MODEL_FEATURES, "stage": model_stage,
    }, sort_keys=True).encode()
    model_version = f"thermal-2026.09.08-{hashlib.sha256(config_fingerprint + train_hash.encode()).hexdigest()[:12]}"
    bundle = {
        "artifactType": "thermal-ml-ensemble-v1",
        "modelVersion": model_version,
        "modelStage": model_stage,
        "featureVersion": THERMAL_FEATURE_VERSION,
        "features": THERMAL_MODEL_FEATURES,
        "supervisedModel": calibrated,
        "supervisedAlgorithm": winner_name,
        "anomalyModel": anomaly,
        "anomalyCenter": anomaly_center,
        "anomalyScale": anomaly_scale,
        "causeModel": cause_model,
        "riskScoreThresholds": {"moderate": 30.0, "high": 55.0, "critical": 75.0},
        "eventDecisionThreshold": decision_threshold,
    }
    reproducibility_hash = reproducibility_fingerprint(bundle, test_frame)
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / "thermal_model.joblib"
    metadata_path = output_dir / "metadata.json"
    reuse_verified_artifact = False
    if artifact_path.is_file() and metadata_path.is_file():
        try:
            previous = json.loads(metadata_path.read_text(encoding="utf-8"))
            previous_raw_hash = f"sha256:{sha256(artifact_path)}"
            previous_bundle = joblib.load(artifact_path)
            previous_semantic_hash = reproducibility_fingerprint(previous_bundle, test_frame)
            reuse_verified_artifact = (
                previous.get("reproducibilityFingerprint") == reproducibility_hash == previous_semantic_hash
                and previous.get("artifactChecksum") == previous_raw_hash
                and previous.get("modelVersion") == model_version
            )
        except Exception:
            reuse_verified_artifact = False
    if not reuse_verified_artifact:
        # zlib evita timestamps no cabeçalho. O fingerprint acima trata a
        # representação interna de estimadores, que o sklearn não promete
        # serializar byte a byte de modo canônico entre processos.
        joblib.dump(bundle, artifact_path, compress=("zlib", 3), protocol=4)
    artifact_hash = sha256(artifact_path)

    legacy_path = output_dir / "legacy_mechanical_metadata.json"
    if metadata_path.exists() and not legacy_path.exists():
        previous = json.loads(metadata_path.read_text(encoding="utf-8"))
        if previous.get("modelStage") is None:
            legacy_path.write_text(json.dumps(previous, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    metadata: dict[str, Any] = {
        "artifactType": bundle["artifactType"],
        "modelVersion": model_version,
        "modelStage": model_stage,
        "isSyntheticModel": True,
        "industrialEfficacyClaim": False,
        "trainedAt": "2026-09-08T00:00:00Z",
        "trainingTimestampPolicy": "Fixed stage release timestamp for reproducible metadata.",
        "algorithm": winner_name,
        "candidateMetrics": candidate_metrics,
        "features": THERMAL_MODEL_FEATURES,
        "transformations": "median imputation; standardization/one-hot according to persisted sklearn pipelines; sigmoid calibration",
        "featureVersion": THERMAL_FEATURE_VERSION,
        "target": target,
        "predictionHorizonHours": 24,
        "trainingDatasetHash": f"sha256:{train_hash}",
        "reservedScenarioHash": f"sha256:{reserved_hash}",
        "artifactChecksum": f"sha256:{artifact_hash}",
        "reproducibilityFingerprint": reproducibility_hash,
        "trainingPeriod": [str(train_frame.timestamp.min()), str(train_frame.timestamp.max())],
        "validationPeriod": [str(validation_frame.timestamp.min()), str(validation_frame.timestamp.max())],
        "testPeriod": [str(test_frame.timestamp.min()), str(test_frame.timestamp.max())],
        "generationSeed": SEEDS["development"],
        "trainingSeed": seed,
        "validationMetrics": validation_metrics,
        "testMetrics": test_metrics,
        "metricsByComponentType": by_component,
        "componentTypesAbsentFromFinalTest": sorted(set(COMPONENT_TYPES) - set(by_component)),
        "metricsByLoadBand": by_load,
        "falseAlertsPerPointDay": false_alert_rate,
        "causeClassifierAccuracyOnFinalTestEpisodes": cause_accuracy,
        "calibration": {"method": "sigmoid", "validationBrier": validation_metrics["brier"]},
        "thresholds": {"eventDecision": decision_threshold, **bundle["riskScoreThresholds"]},
        "datasetManifestHash": (root / "datasets/metadata/synthetic_thermal_generation.sha256").read_text(encoding="ascii").split()[0],
        "codeVersion": current_commit(root),
        "artifactDistribution": "Generated during a controlled build with python -m training.train_thermal_models; checksum is mandatory at runtime.",
        "finalTestPolicy": "Opened once after winner, calibration method and thresholds were frozen.",
        "limitations": [
            "Treinado exclusivamente com dados sintéticos; não comprova eficácia industrial.",
            "Requer calibração com dados reais da planta antes de uso de segurança.",
            "O classificador de causa é uma hipótese para revisão humana, não diagnóstico autônomo.",
            f"Acurácia do classificador de causa no teste sintético: {cause_accuracy:.4f}; requer melhoria e calibração real.",
        ],
    }
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    report_path = root / "datasets/reports/thermal_model_evaluation.json"
    report_path.write_text(json.dumps(metadata, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    return metadata


def main() -> None:
    # Alguns estimadores mantêm estruturas cuja ordem de pickle depende do
    # hash seed do processo. Reexecutar a CLI com seed fixo torna o checksum
    # do artefato reproduzível entre processos, não apenas as predições.
    deterministic_environment = {
        "PYTHONHASHSEED": "0", "OMP_NUM_THREADS": "1", "MKL_NUM_THREADS": "1",
        "OPENBLAS_NUM_THREADS": "1", "NUMEXPR_NUM_THREADS": "1",
    }
    if any(os.environ.get(key) != value for key, value in deterministic_environment.items()):
        environment = os.environ.copy()
        environment.update(deterministic_environment)
        completed = subprocess.run(
            [sys.executable, "-m", "training.train_thermal_models", *sys.argv[1:]],
            cwd=repository_root() / "services/predictive-ai",
            env=environment,
            check=False,
        )
        raise SystemExit(completed.returncode)
    root = repository_root()
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=root / "datasets/processed/thermal_training_windows.parquet")
    parser.add_argument("--validation-dataset", type=Path, default=root / "datasets/processed/thermal_validation_windows.parquet")
    parser.add_argument("--test-dataset", type=Path, default=root / "datasets/processed/thermal_test_windows.parquet")
    parser.add_argument("--output-dir", type=Path, default=root / "services/predictive-ai/models")
    parser.add_argument("--target", default=DEFAULT_TARGET)
    parser.add_argument("--random-seed", type=int, default=20260801)
    parser.add_argument("--model-stage", default="SYNTHETIC_EXPERIMENTAL")
    parser.add_argument("--training-start")
    parser.add_argument("--training-end")
    args = parser.parse_args()
    metadata = train(
        args.dataset.resolve(), args.validation_dataset.resolve(), args.test_dataset.resolve(),
        args.output_dir.resolve(), args.target, args.random_seed, args.model_stage,
        args.training_start, args.training_end,
    )
    print(json.dumps({
        "modelVersion": metadata["modelVersion"], "algorithm": metadata["algorithm"],
        "artifactChecksum": metadata["artifactChecksum"],
        "reproducibilityFingerprint": metadata["reproducibilityFingerprint"],
        "testMetrics": metadata["testMetrics"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
