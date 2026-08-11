from typing import Any

from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def evaluate_model(model: Any, X_test, y_test) -> dict:
    """Calcula precision, recall, F1, ROC-AUC e matriz de confusão.

    Accuracy é deliberadamente omitida como critério de seleção (ver seção 6
    do escopo) — pode ser calculada à parte se necessário para relatório,
    mas nunca deve guiar a escolha do modelo isoladamente.
    """
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    return {
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1_score": f1_score(y_test, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_test, y_proba),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }
