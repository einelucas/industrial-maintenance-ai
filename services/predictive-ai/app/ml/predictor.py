"""Compatibilidade de import: o DemoPredictor foi removido na Etapa 8.

Toda inferência operacional usa exclusivamente ``ThermalMlPredictor``.
"""

from app.ml.thermal_predictor import ThermalMlPredictor

__all__ = ["ThermalMlPredictor"]
