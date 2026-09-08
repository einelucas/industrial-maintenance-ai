"""Executa geração -> janelas -> validação offline -> manifesto final."""

from __future__ import annotations

from training.build_thermal_windows import build
from training.evaluate_thermal_models import evaluate
from training.generate_thermal_dataset import generate
from training.thermal_dataset_contract import repository_root
from training.validate_thermal_dataset import validate

def main() -> None:
    root = repository_root() / "datasets"
    generate(root)
    build(root / "raw/synthetic_thermal_timeseries.csv", root / "processed", root / "metadata/synthetic_thermal_generation.json")
    evaluate(root / "processed/thermal_training_windows.parquet", root / "processed/thermal_validation_windows.parquet", root / "raw/synthetic_thermal_timeseries.csv", root / "reports")
    result = validate(root)
    print(f"Etapa 7: {result['result']} · {result['checks']} verificações · manifesto {result['manifestSha256']}")

if __name__ == "__main__":
    main()
