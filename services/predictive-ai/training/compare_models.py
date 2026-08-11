"""Exibe de forma legível as métricas do modelo atualmente salvo em models/metadata.json.

Uso:
    python -m training.compare_models

Para comparar candidatos lado a lado antes de escolher, rode training/train.py,
que já imprime as métricas de todos os algoritmos testados nesta execução.
"""

import json
from pathlib import Path

METADATA_PATH = Path(__file__).resolve().parents[1] / "models" / "metadata.json"


def main() -> None:
    if not METADATA_PATH.exists():
        print("Nenhum modelo treinado ainda. Rode: python -m training.train")
        return

    metadata = json.loads(METADATA_PATH.read_text())

    print(f"Algoritmo:      {metadata['algorithm']}")
    print(f"Versão:         {metadata['modelVersion']}")
    print(f"Treinado em:    {metadata['trainedAt']}")
    print(f"Dataset:        {metadata['dataset']}")
    print(f"Features:       {', '.join(metadata['features'])}")
    print("Métricas:")
    for name, value in metadata["metrics"].items():
        print(f"  {name}: {value:.4f}")
    print(f"Confusion matrix: {metadata['confusionMatrix']}")


if __name__ == "__main__":
    main()
