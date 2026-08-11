"""Treina e compara Logistic Regression, Random Forest e Gradient Boosting.

Uso:
    python -m training.train

Não escolhe arbitrariamente o "melhor" modelo por accuracy isolada (ver
seção 6 do escopo). O critério de seleção usado aqui é F1-score na classe
positiva (falha), com ROC-AUC como critério de desempate — ambos reportados
junto de precision/recall/confusion matrix em compare_models.py.

Salva o vencedor em models/model.joblib e o metadata em models/metadata.json.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_sample_weight

from training.evaluate import evaluate_model

DATASET_PATH = Path(__file__).resolve().parents[3] / "datasets" / "raw" / "synthetic_equipment_failures.csv"
MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

FEATURE_COLUMNS = [
    "air_temperature",
    "process_temperature",
    "temperature",
    "rotational_speed",
    "rpm",
    "torque",
    "tool_wear",
    "vibration",
    "pressure",
    "current",
    "operating_hours",
]
TARGET_COLUMN = "failure"


def load_dataset() -> pd.DataFrame:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset não encontrado em {DATASET_PATH}. "
            "Rode primeiro: python -m training.prepare_dataset"
        )
    return pd.read_csv(DATASET_PATH)


def main() -> None:
    df = load_dataset()
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    candidates = {
        "logistic_regression": LogisticRegression(max_iter=5000, class_weight="balanced"),
        "random_forest": RandomForestClassifier(
            n_estimators=200, max_depth=8, random_state=42, class_weight="balanced"
        ),
        "gradient_boosting": GradientBoostingClassifier(random_state=42),
    }

    # GradientBoostingClassifier não aceita `class_weight` (ao contrário de
    # LogisticRegression/RandomForestClassifier) — o desbalanceamento de
    # classes (~3,4% de falhas, AI4I 2020) é compensado equivalentemente via
    # `sample_weight` no fit, para tratar os 3 candidatos de forma consistente.
    balanced_sample_weight = compute_sample_weight("balanced", y_train)

    results = {}
    for name, model in candidates.items():
        if name == "gradient_boosting":
            model.fit(X_train, y_train, sample_weight=balanced_sample_weight)
        else:
            model.fit(X_train, y_train)
        metrics = evaluate_model(model, X_test, y_test)
        results[name] = {"model": model, "metrics": metrics}
        print(f"\n== {name} ==")
        for metric_name, value in metrics.items():
            if metric_name != "confusion_matrix":
                print(f"  {metric_name}: {value:.4f}")
        print(f"  confusion_matrix: {metrics['confusion_matrix']}")

    # Critério de seleção: F1-score (desempate por ROC-AUC). Accuracy isolada
    # nunca é usada como critério (seção 6 do escopo).
    best_name = max(
        results,
        key=lambda name: (results[name]["metrics"]["f1_score"], results[name]["metrics"]["roc_auc"]),
    )
    best = results[best_name]

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / "model.joblib"
    joblib.dump(best["model"], model_path)

    metadata = {
        "modelVersion": datetime.now(timezone.utc).strftime("%Y%m%d.%H%M%S"),
        "algorithm": best_name,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "dataset": str(DATASET_PATH.relative_to(DATASET_PATH.parents[3])),
        "features": FEATURE_COLUMNS,
        "metrics": {k: v for k, v in best["metrics"].items() if k != "confusion_matrix"},
        "confusionMatrix": best["metrics"]["confusion_matrix"],
    }
    (MODELS_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False))

    print(f"\nModelo vencedor: {best_name}")
    print(f"Salvo em: {model_path}")


if __name__ == "__main__":
    main()
