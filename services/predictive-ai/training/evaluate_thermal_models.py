"""Caracteriza o dataset e roda baseline de vazamento somente em treino/validação.

Não seleciona artefato operacional e nunca abre o split de teste final.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).resolve().parents[3] / "datasets" / ".matplotlib-cache"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from training.thermal_dataset_contract import FEATURE_COLUMNS, TARGET_COLUMNS, repository_root

MODEL_FEATURES = [column for column in FEATURE_COLUMNS if not column.endswith("sample_count") and column not in {"baseline_sufficient", "total_history_sample_count"}]
CATEGORICAL = ["component_type", "equipment_type"]

def metrics(y_true: pd.Series, scores: np.ndarray, threshold: float = 0.5) -> dict:
    predicted = scores >= threshold
    return {
        "precision": precision_score(y_true, predicted, zero_division=0),
        "recall": recall_score(y_true, predicted, zero_division=0),
        "f1": f1_score(y_true, predicted, zero_division=0),
        "prAuc": average_precision_score(y_true, scores),
        "rocAuc": roc_auc_score(y_true, scores),
    }

def plot_scenarios(raw: pd.DataFrame, output: Path) -> list[str]:
    output.mkdir(parents=True, exist_ok=True)
    paths = []
    modes = ["NONE"] + sorted(mode for mode in raw.failure_mode.unique() if mode != "NONE")
    for mode in modes:
        candidates = raw[raw.failure_mode == mode]
        if candidates.empty:
            continue
        point = candidates.thermal_point_id.iloc[0]
        center = candidates.timestamp.iloc[len(candidates) // 2]
        sample = raw[(raw.thermal_point_id == point) & (raw.timestamp.between(center - pd.Timedelta(hours=48), center + pd.Timedelta(hours=48)))]
        figure, temperature_axis = plt.subplots(figsize=(10, 4.5))
        temperature_axis.plot(sample.timestamp, sample.temperature_max_c, label="Temperatura máxima (°C)", color="#dc2626")
        temperature_axis.plot(sample.timestamp, sample.reference_temperature_c, label="Referência (°C)", color="#2563eb")
        load_axis = temperature_axis.twinx()
        load_axis.plot(sample.timestamp, sample.load_percent, label="Carga (%)", color="#7c3aed", alpha=0.35)
        temperature_axis.set_title(f"Dados sintéticos · {mode} · {point}")
        temperature_axis.set_ylabel("°C"); load_axis.set_ylabel("% carga")
        temperature_axis.grid(alpha=0.2); figure.autofmt_xdate(); figure.tight_layout()
        name = f"scenario_{mode.lower()}.png"
        figure.savefig(output / name, dpi=130); plt.close(figure); paths.append(name)
    return paths

def evaluate(train_path: Path, validation_path: Path, raw_path: Path, output: Path) -> dict:
    train = pd.read_parquet(train_path)
    validation = pd.read_parquet(validation_path)
    raw = pd.read_csv(raw_path, parse_dates=["timestamp"])
    forbidden = set(TARGET_COLUMNS) | {"episode_id", "hours_to_event", "timestamp", "cutoff_at", "thermal_point_id", "component_id", "panel_id"}
    if set(MODEL_FEATURES) & forbidden:
        raise AssertionError("Rótulo ou identidade vazou para as features do baseline.")
    numeric = [column for column in MODEL_FEATURES if column in train.columns]
    transformer = ColumnTransformer([
        ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric),
        ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
    ])
    model = Pipeline([("features", transformer), ("model", LogisticRegression(max_iter=500, class_weight="balanced", random_state=20260703))])
    columns = numeric + CATEGORICAL
    model.fit(train[columns], train.failure_within_24h)
    scores = model.predict_proba(validation[columns])[:, 1]
    baseline = metrics(validation.failure_within_24h, scores)
    rule_scores = np.maximum(
        np.clip((validation.delta_t_c.fillna(0).to_numpy() - 6) / 30, 0, 1),
        np.clip((validation.trend_c_per_hour.fillna(0).to_numpy() + 1) / 10, 0, 1),
    )
    rule = metrics(validation.failure_within_24h, rule_scores)
    correlation_columns = [column for column in MODEL_FEATURES if column in validation.columns] + ["failure_within_24h"]
    numeric_corr = validation[correlation_columns].select_dtypes(include=["number", "bool"]).corr(numeric_only=True)
    target_corr = numeric_corr["failure_within_24h"].drop("failure_within_24h").abs().sort_values(ascending=False)
    output.mkdir(parents=True, exist_ok=True)
    plot_names = plot_scenarios(raw, output / "plots")
    report = {
        "scope": "offline dataset validation only; final test split was not read",
        "syntheticData": True,
        "trainRows": len(train), "validationRows": len(validation),
        "baselineLogisticRegression": baseline, "simpleRuleBaseline": rule,
        "perfectTargetReconstruction": bool(baseline["f1"] >= 0.999 or rule["f1"] >= 0.999),
        "topAbsoluteFeatureCorrelationsWith24hTarget": {key: float(value) for key, value in target_corr.head(12).items()},
        "excludedFromModelFeatures": sorted(forbidden),
        "classDistribution": {"train": train.failure_within_24h.value_counts(normalize=True).sort_index().to_dict(), "validation": validation.failure_within_24h.value_counts(normalize=True).sort_index().to_dict()},
        "plots": plot_names,
    }
    (output / "dataset_validation_report.json").write_text(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    return report

def main() -> None:
    root = repository_root()
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=Path, default=root / "datasets/processed/thermal_training_windows.parquet")
    parser.add_argument("--validation", type=Path, default=root / "datasets/processed/thermal_validation_windows.parquet")
    parser.add_argument("--raw", type=Path, default=root / "datasets/raw/synthetic_thermal_timeseries.csv")
    parser.add_argument("--output", type=Path, default=root / "datasets/reports")
    args = parser.parse_args()
    report = evaluate(args.train.resolve(), args.validation.resolve(), args.raw.resolve(), args.output.resolve())
    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
