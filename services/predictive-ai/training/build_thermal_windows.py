"""Constrói features temporais leakage-safe e splits por tempo + painel."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from collections import deque
from pathlib import Path

import numpy as np
import pandas as pd

from training.thermal_dataset_contract import FEATURE_COLUMNS, FEATURE_VERSION, MAX_TIME_ABOVE_GAP_MINUTES, MIN_BASELINE_SAMPLES, PERIODS, SEEDS, repository_root

ATTENTION_DELTA_C = 10.0
MAX_HISTORY = 1000

def _mean(values: list[float]) -> float:
    return float(np.mean(values)) if values else np.nan

def _std(values: list[float]) -> float:
    return float(np.std(values, ddof=1)) if len(values) >= 2 else np.nan

def _window(history: deque[dict], cutoff: pd.Timestamp, minutes: int, field: str, op: str) -> tuple[float, int]:
    values = [row[field] for row in history if row["timestamp"] > cutoff - pd.Timedelta(minutes=minutes) and pd.notna(row[field])]
    if not values:
        return np.nan, 0
    return (float(np.mean(values)) if op == "mean" else float(np.max(values))), len(values)

def _trend(history: deque[dict], cutoff: pd.Timestamp) -> tuple[float, int]:
    rows = [row for row in history if row["timestamp"] > cutoff - pd.Timedelta(minutes=60) and pd.notna(row["temperature_max_c"])]
    if len(rows) < 2:
        return np.nan, len(rows)
    x = np.array([(row["timestamp"] - cutoff).total_seconds() / 60 for row in rows], dtype=float)
    y = np.array([row["temperature_max_c"] for row in rows], dtype=float)
    return float(np.polyfit(x, y, 1)[0] * 60), len(rows)

def _persistence(history: deque[dict], cutoff: pd.Timestamp) -> tuple[float, int]:
    day = [row for row in history if row["timestamp"] > cutoff - pd.Timedelta(hours=24) and pd.notna(row["delta_t_c"])]
    minutes = 0.0
    for index, row in enumerate(day):
        if row["delta_t_c"] <= ATTENTION_DELTA_C:
            continue
        end = day[index + 1]["timestamp"] if index + 1 < len(day) else cutoff
        minutes += min(MAX_TIME_ABOVE_GAP_MINUTES, max(0, (end - row["timestamp"]).total_seconds() / 60))
    consecutive = 0
    for row in reversed(history):
        if pd.isna(row["delta_t_c"]) or row["delta_t_c"] <= ATTENTION_DELTA_C:
            break
        consecutive += 1
    return round(minutes, 1), consecutive

def build_features(raw: pd.DataFrame) -> pd.DataFrame:
    outputs: list[pd.DataFrame] = []
    # OFFLINE representa ausência de leitura no banco, não uma linha com zeros.
    available = raw[raw.temperature_max_c.notna()].sort_values(["thermal_point_id", "timestamp"])
    for _, group in available.groupby("thermal_point_id", sort=True):
        frame = group.copy().set_index("timestamp", drop=False)
        temp = frame.temperature_max_c
        for label, minutes in (("5m", 5), ("15m", 15), ("60m", 60)):
            rolling = temp.rolling(f"{minutes}min", closed="right")
            frame[f"mean_{label}_c"] = rolling.mean()
            frame[f"mean_{label}_sample_count"] = rolling.count().astype(int)
        frame["max_1h_c"] = temp.rolling("60min", closed="right").max()
        frame["max_6h_c"] = temp.rolling("360min", closed="right").max()
        frame["max_24h_c"] = temp.rolling("1440min", closed="right").max()

        x = pd.Series((frame.index - frame.index[0]).total_seconds() / 3600, index=frame.index)
        window = "60min"
        n = temp.rolling(window, closed="right").count()
        sx = x.rolling(window, closed="right").sum()
        sy = temp.rolling(window, closed="right").sum()
        sxx = (x * x).rolling(window, closed="right").sum()
        sxy = (x * temp).rolling(window, closed="right").sum()
        denominator = n * sxx - sx * sx
        frame["trend_c_per_hour"] = ((n * sxy - sx * sy) / denominator).where((n >= 2) & (denominator.abs() > 1e-12))
        frame["trend_sample_count"] = n.astype(int)

        above = frame.delta_t_c > ATTENTION_DELTA_C
        duration_to_next = frame.index.to_series().shift(-1).sub(frame.index.to_series()).dt.total_seconds().div(60).clip(lower=0, upper=MAX_TIME_ABOVE_GAP_MINUTES)
        contribution = duration_to_next.fillna(0).where(above, 0)
        frame["minutes_above_limit"] = contribution.rolling("1440min", closed="left").sum().fillna(0).round(1)
        blocks = (~above).cumsum()
        frame["consecutive_anomalies"] = above.astype(int).groupby(blocks).cumsum().astype(int)
        frame["minutes_since_last_valid_reading"] = frame.index.to_series().diff().dt.total_seconds().div(60)

        prior_temp = temp.shift(1)
        baseline = prior_temp.rolling(MAX_HISTORY, min_periods=1)
        frame["baseline_mean_c"] = baseline.mean()
        frame["baseline_stddev_c"] = baseline.std(ddof=1)
        frame["baseline_sample_count"] = baseline.count().fillna(0).astype(int)
        frame["baseline_sufficient"] = frame.baseline_sample_count >= MIN_BASELINE_SAMPLES
        frame["average_load_percent"] = frame.load_percent.shift(1).rolling(MAX_HISTORY, min_periods=1).mean()
        frame["average_current_a"] = frame.current_a.shift(1).rolling(MAX_HISTORY, min_periods=1).mean()
        frame["total_history_sample_count"] = np.minimum(np.arange(len(frame)), MAX_HISTORY)
        frame["aggregated_signal_quality"] = frame.signal_quality.rolling("60min", closed="right").mean()
        frame["feature_version"] = FEATURE_VERSION
        frame["cutoff_at"] = frame.timestamp
        outputs.append(frame.reset_index(drop=True))
    result = pd.concat(outputs, ignore_index=True)
    return result[(result.baseline_sufficient) & (result.trend_sample_count >= 2)].reset_index(drop=True)

def panel_split(raw: pd.DataFrame) -> dict[str, list[str]]:
    panels = sorted(raw.panel_id.unique())
    random.Random(SEEDS["split"]).shuffle(panels)
    train_end = math.ceil(len(panels) * 0.64)
    validation_end = train_end + math.ceil(len(panels) * 0.18)
    return {"train": sorted(panels[:train_end]), "validation": sorted(panels[train_end:validation_end]), "test": sorted(panels[validation_end:])}

def sha256(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest

def build(raw_path: Path, output_dir: Path, metadata_path: Path) -> dict:
    raw = pd.read_csv(raw_path, parse_dates=["timestamp"])
    if raw.thermal_point_id.nunique() != 55:
        raise ValueError("Dataset de desenvolvimento deve conter exatamente 55 pontos.")
    features = build_features(raw)
    groups = panel_split(raw)
    output_dir.mkdir(parents=True, exist_ok=True)
    artifacts, summaries = {}, {}
    for split in ("train", "validation", "test"):
        start, end = map(pd.Timestamp, PERIODS[split])
        part = features[(features.panel_id.isin(groups[split])) & (features.timestamp >= start) & (features.timestamp <= end)].copy()
        if part.empty:
            raise ValueError(f"Split {split} ficou vazio.")
        path = output_dir / f"thermal_{split}ing_windows.parquet" if split == "train" else output_dir / f"thermal_{split}_windows.parquet"
        part.to_parquet(path, index=False, compression="zstd")
        artifacts[path.name] = sha256(path)
        summaries[split] = {"rows": len(part), "points": part.thermal_point_id.nunique(), "panels": part.panel_id.nunique(), "period": PERIODS[split], "targetDistribution": {target: {str(key).lower(): int(value) for key, value in part[target].value_counts().sort_index().items()} for target in ("failure_within_24h", "failure_within_7d", "maintenance_required")}}
    if set(groups["train"]) & set(groups["validation"]) or set(groups["train"]) & set(groups["test"]) or set(groups["validation"]) & set(groups["test"]):
        raise AssertionError("Vazamento de painel entre splits.")
    manifest = json.loads(metadata_path.read_text(encoding="utf-8"))
    manifest["splits"] = {"strategy": "chronological boundaries plus mutually exclusive panel groups", "panelGroups": groups, "summaries": summaries, "finalTestPolicy": "Never used for feature/model selection.", "artifacts": artifacts}
    metadata_path.write_text(json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest["splits"]

def main() -> None:
    root = repository_root()
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, default=root / "datasets/raw/synthetic_thermal_timeseries.csv")
    parser.add_argument("--output-dir", type=Path, default=root / "datasets/processed")
    parser.add_argument("--metadata", type=Path, default=root / "datasets/metadata/synthetic_thermal_generation.json")
    args = parser.parse_args()
    print(json.dumps(build(args.raw.resolve(), args.output_dir.resolve(), args.metadata.resolve()), ensure_ascii=False))

if __name__ == "__main__":
    main()
