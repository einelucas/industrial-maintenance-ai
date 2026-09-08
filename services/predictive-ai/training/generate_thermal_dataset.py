"""Gera séries térmicas sintéticas temporais e o cenário reservado GPMS.

Uso: python -m training.generate_thermal_dataset --output-root ../../datasets
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from training.thermal_dataset_contract import FAILURE_MODES, PERIODS, RAW_COLUMNS, SAMPLE_INTERVAL_MINUTES, SEEDS, contract_manifest, parse_utc, repository_root

COMPONENT_DISTRIBUTION = {
    "CIRCUIT_BREAKER": 12, "CONTACTOR": 10, "THERMAL_RELAY": 21,
    "BUSBAR": 6, "TERMINAL": 6,
}
BASELINE_RISE = {"CIRCUIT_BREAKER": 10.0, "CONTACTOR": 12.0, "THERMAL_RELAY": 11.0, "BUSBAR": 8.0, "TERMINAL": 7.0}
RATED_CURRENT = {"CIRCUIT_BREAKER": 80.0, "CONTACTOR": 50.0, "THERMAL_RELAY": 32.0, "BUSBAR": 300.0, "TERMINAL": 100.0}
FAULTS = tuple(mode for mode in FAILURE_MODES if mode not in {"NONE", "SENSOR_ERROR"})

@dataclass(frozen=True)
class Point:
    code: str
    sector_id: str
    equipment_type: str
    panel_id: str
    component_id: str
    component_type: str
    rated_current: float
    baseline_rise: float
    reference_base: float

@dataclass(frozen=True)
class Episode:
    episode_id: str
    mode: str
    onset: pd.Timestamp
    intervention: pd.Timestamp
    recovery_end: pd.Timestamp
    intensity: float

def point_catalog(prefix: str = "DEV") -> list[Point]:
    types = [kind for kind, count in COMPONENT_DISTRIBUTION.items() for _ in range(count)]
    points: list[Point] = []
    for index, kind in enumerate(types, 1):
        panel_number = (index - 1) // 2 + 1
        sector_number = (panel_number - 1) % 5 + 1
        points.append(Point(
            code=f"{prefix}-TP-{index:03d}", sector_id=f"{prefix}-SEC-{sector_number:02d}",
            equipment_type=("CENTRIFUGE" if kind == "THERMAL_RELAY" else "ELECTRICAL_DISTRIBUTION"),
            panel_id=f"{prefix}-PNL-{panel_number:03d}", component_id=f"{prefix}-CMP-{index:03d}",
            component_type=kind, rated_current=RATED_CURRENT[kind], baseline_rise=BASELINE_RISE[kind],
            reference_base=34.0 + (index % 9),
        ))
    assert len(points) == 55
    return points

def episodes_for(point: Point, timestamps: pd.DatetimeIndex, seed: int, forced_mode: str | None = None) -> list[Episode]:
    rng = random.Random(f"{seed}:{point.code}:episodes")
    modes = [forced_mode] if forced_mode else rng.sample(list(FAULTS) + ["SENSOR_ERROR"], k=3)
    margin = min(10 * 48, max(12, len(timestamps) // 5))
    available_start, available_end = margin, len(timestamps) - margin
    if available_end - available_start < len(modes):
        raise ValueError("Período curto demais para distribuir os episódios.")
    anchors = sorted(rng.sample(range(available_start, available_end), k=len(modes)))
    result = []
    for number, (mode, anchor) in enumerate(zip(modes, anchors, strict=True), 1):
        duration_samples = rng.randint(min(24, margin), max(min(24, margin), margin))
        onset = timestamps[max(0, anchor - duration_samples)]
        intervention = timestamps[anchor]
        result.append(Episode(f"{point.code}-E{number}", mode, onset, intervention, intervention + timedelta(hours=rng.randint(10, 36)), rng.uniform(0.72, 1.25)))
    return result

def _fault_effect(mode: str, progress: float, load: float, panel_effect: float, rng: random.Random) -> tuple[float, float, float]:
    p = min(1.0, max(0.0, progress))
    effects = {
        "LOOSE_CONNECTION": (25 * p**1.7 * (0.4 + load / 100), 0, 0),
        "CONTACT_RESISTANCE": (19 * p**1.45 * (0.55 + load / 120), 0, 0),
        "OVERLOAD": (17 * p * max(0.2, load / 75), 12 * p, 0),
        "PHASE_IMBALANCE": (14 * p, 0, -5 * p),
        "DEGRADED_CONTACT": (16 * p, 0, 0),
        "INSUFFICIENT_VENTILATION": (8 * p + panel_effect, 0, 0),
        "THERMAL_RELAY_DEGRADATION": (15 * p * (1 + 0.15 * math.sin(p * 8 * math.pi)), 0, 0),
        "SENSOR_ERROR": ((rng.uniform(-18, 28) if rng.random() < 0.35 else 0), 0, 0),
    }
    return effects.get(mode, (0, 0, 0))

def generate_series(points: list[Point], start: str, end: str, seed: int, *, plant_id: str, demo: bool = False) -> tuple[pd.DataFrame, dict[str, list[Episode]]]:
    timestamps = pd.date_range(parse_utc(start), parse_utc(end), freq=f"{SAMPLE_INTERVAL_MINUTES}min")
    all_episodes: dict[str, list[Episode]] = {}
    if demo:
        abnormal_codes = {point.code for point in points[:18]} | {"TP-039"}
    else:
        abnormal_codes = {point.code for point in points}
    for index, point in enumerate(points):
        forced = FAULTS[index % len(FAULTS)] if demo and point.code in abnormal_codes else None
        all_episodes[point.code] = episodes_for(point, timestamps, seed, forced) if (not demo or point.code in abnormal_codes) else []

    panel_ventilation: dict[tuple[str, pd.Timestamp], float] = {}
    for point in points:
        for episode in all_episodes[point.code]:
            if episode.mode == "INSUFFICIENT_VENTILATION":
                for timestamp in timestamps[(timestamps >= episode.onset) & (timestamps <= episode.intervention)]:
                    progress = (timestamp - episode.onset).total_seconds() / max(1, (episode.intervention - episode.onset).total_seconds())
                    panel_ventilation[(point.panel_id, timestamp)] = 5.0 * min(1, progress)

    rows: list[dict] = []
    for point_index, point in enumerate(points):
        rng = random.Random(f"{seed}:{point.code}:series")
        temperature = 28.0
        point_episodes = all_episodes[point.code]
        for timestamp in timestamps:
            hour = timestamp.hour + timestamp.minute / 60
            ambient = 26 + 3.1 * math.sin((hour - 8) / 24 * 2 * math.pi) + 0.8 * math.sin(timestamp.dayofyear / 31 * 2 * math.pi) + rng.gauss(0, 0.25)
            running = 6 <= hour < 22 and timestamp.weekday() < 6
            load = (72 + 15 * math.sin((hour - 7) / 16 * math.pi) + rng.gauss(0, 6)) if running else max(0, 5 + rng.gauss(0, 3))
            load = min(112, max(0, load))
            mode, episode_id, progress, hours_to_event = "NONE", None, 0.0, None
            recovering = False
            for episode in point_episodes:
                if episode.onset <= timestamp <= episode.intervention:
                    mode, episode_id = episode.mode, episode.episode_id
                    progress = (timestamp - episode.onset).total_seconds() / max(1, (episode.intervention - episode.onset).total_seconds())
                    hours_to_event = (episode.intervention - timestamp).total_seconds() / 3600
                    break
                if episode.intervention < timestamp <= episode.recovery_end:
                    recovering, episode_id = True, episode.episode_id
                    progress = 1 - (timestamp - episode.intervention).total_seconds() / max(1, (episode.recovery_end - episode.intervention).total_seconds())
                    break
            panel_effect = panel_ventilation.get((point.panel_id, timestamp), 0.0)
            fault_heat, load_boost, reference_shift = _fault_effect(mode, progress, load, panel_effect, rng)
            if recovering:
                fault_heat = 18 * max(0, progress) ** 2
            load = min(125, load + load_boost)
            current = point.rated_current * load / 100 * (1 + rng.gauss(0, 0.018))
            equilibrium = ambient + point.baseline_rise * load / 100 + fault_heat
            temperature += 0.32 * (equilibrium - temperature) + rng.gauss(0, 0.28)
            reference = point.reference_base + 0.05 * (ambient - 26) + reference_shift + rng.gauss(0, 0.18)
            quality = min(0.995, max(0.45, 0.97 + rng.gauss(0, 0.015)))
            communication = "ONLINE"
            if rng.random() < 0.0025:
                communication = "OFFLINE"
            elif rng.random() < 0.012 or mode == "SENSOR_ERROR":
                communication, quality = "DEGRADED", min(quality, 0.62)
            maintenance = any(abs((event.intervention - timestamp).total_seconds()) < 3600 for event in point_episodes)
            future_hours = [(event.intervention - timestamp).total_seconds() / 3600 for event in point_episodes]
            future_hours = [hours for hours in future_hours if hours >= 0]
            min_future = min(future_hours, default=None)
            measurement = None if communication == "OFFLINE" else temperature
            if mode == "SENSOR_ERROR" and measurement is not None:
                measurement += rng.choice([-1, 1]) * rng.uniform(12, 30)
            row = {
                "timestamp": timestamp, "plant_id": plant_id, "sector_id": point.sector_id,
                "equipment_type": point.equipment_type, "panel_id": point.panel_id,
                "component_id": point.component_id, "thermal_point_id": point.code,
                "component_type": point.component_type,
                "temperature_max_c": round(measurement, 3) if measurement is not None else np.nan,
                "temperature_average_c": round(measurement - rng.uniform(0.5, 1.4), 3) if measurement is not None else np.nan,
                "ambient_temperature_c": round(ambient, 3) if measurement is not None else np.nan,
                "reference_temperature_c": round(reference, 3) if measurement is not None else np.nan,
                "delta_t_c": round(measurement - reference, 3) if measurement is not None else np.nan,
                "current_a": round(current, 3) if measurement is not None else np.nan,
                "load_percent": round(load, 3) if measurement is not None else np.nan,
                "emissivity": round(min(0.98, max(0.86, 0.93 + rng.gauss(0, 0.008))), 3) if measurement is not None else np.nan,
                "signal_quality": round(quality, 3) if measurement is not None else np.nan,
                "communication_state": communication,
                "operating_state": "MAINTENANCE" if maintenance else ("RUNNING" if running else "OFF"),
                "failure_mode": mode, "anomaly_active": mode != "NONE",
                "maintenance_required": bool(mode != "NONE" and progress >= 0.65 and mode != "SENSOR_ERROR"),
                "failure_within_24h": bool(min_future is not None and min_future <= 24),
                "failure_within_7d": bool(min_future is not None and min_future <= 168),
                "episode_id": episode_id, "hours_to_event": round(hours_to_event, 3) if hours_to_event is not None else np.nan,
            }
            rows.append(row)
    frame = pd.DataFrame(rows)
    if demo:
        critical_time = timestamps[-13]
        mask = (frame.thermal_point_id == "TP-039") & (frame.timestamp == critical_time)
        frame.loc[mask, ["temperature_max_c", "reference_temperature_c", "delta_t_c", "failure_mode", "anomaly_active", "maintenance_required"]] = [75.6, 40.0, 35.6, "LOOSE_CONNECTION", True, True]
        # A partir da intervenção reservada, queda monotônica até o regime normal.
        post = frame[(frame.thermal_point_id == "TP-039") & (frame.timestamp > critical_time)].index
        for position, idx in enumerate(post, 1):
            target = 75.6 - (75.6 - 41.0) * (1 - math.exp(-3.5 * position / max(1, len(post))))
            reference = 40.0
            frame.loc[idx, ["temperature_max_c", "temperature_average_c", "reference_temperature_c", "delta_t_c", "failure_mode", "anomaly_active", "maintenance_required", "operating_state"]] = [round(target, 3), round(target - 0.9, 3), reference, round(target - reference, 3), "NONE", False, False, "MAINTENANCE" if position == 1 else "RUNNING"]
    return frame, all_episodes

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def write_frame(frame: pd.DataFrame, csv_path: Path, parquet_path: Path | None = None) -> dict[str, str]:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(csv_path, index=False, date_format="%Y-%m-%dT%H:%M:%S.%fZ", lineterminator="\n")
    hashes = {str(csv_path.name): sha256(csv_path)}
    if parquet_path:
        parquet_path.parent.mkdir(parents=True, exist_ok=True)
        frame.to_parquet(parquet_path, index=False, compression="zstd")
        hashes[str(parquet_path.name)] = sha256(parquet_path)
    return hashes

def generate(output_root: Path) -> dict:
    development, episodes = generate_series(point_catalog(), *PERIODS["development"], SEEDS["development"], plant_id="SYNTHETIC-DEV")
    demo_points = [Point(f"TP-{i:03d}", f"DEMO-SEC-{(i - 1) % 5 + 1:02d}", "GPMS_DEMO", f"DEMO-PNL-{(i - 1) // 2 + 1:03d}", f"DEMO-CMP-{i:03d}", kind, RATED_CURRENT[kind], BASELINE_RISE[kind], 40.0 if i == 39 else 34.0 + i % 9) for i, kind in enumerate([kind for kind, count in COMPONENT_DISTRIBUTION.items() for _ in range(count)], 1)]
    demo, demo_episodes = generate_series(demo_points, *PERIODS["demo"], SEEDS["demo_series"], plant_id="SYNTHETIC-DEMO-RESERVED", demo=True)
    hashes = {}
    hashes.update(write_frame(development, output_root / "raw/synthetic_thermal_timeseries.csv"))
    hashes.update(write_frame(demo, output_root / "demo/reserved_plant_scenario.csv", output_root / "demo/reserved_plant_scenario.parquet"))
    critical = demo[(demo.thermal_point_id == "TP-039") & (demo.temperature_max_c == 75.6) & (demo.reference_temperature_c == 40.0) & (demo.delta_t_c == 35.6)]
    manifest = contract_manifest() | {
        "artifacts": hashes,
        "development": {"rows": len(development), "points": development.thermal_point_id.nunique(), "period": PERIODS["development"], "episodes": sum(map(len, episodes.values()))},
        "reservedScenario": {"rows": len(demo), "points": demo.thermal_point_id.nunique(), "period": PERIODS["demo"], "identitySeed": SEEDS["demo_identity"], "seriesSeed": SEEDS["demo_series"], "anomalousPointCount": int(demo.loc[demo.anomaly_active, "thermal_point_id"].nunique()), "criticalRows": len(critical), "excludedFromDevelopment": True},
    }
    manifest_path = output_root / "metadata/synthetic_thermal_generation.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", type=Path, default=repository_root() / "datasets")
    args = parser.parse_args()
    result = generate(args.output_root.resolve())
    print(json.dumps({"status": "generated", "development": result["development"], "reservedScenario": result["reservedScenario"]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
