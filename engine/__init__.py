"""Moteur générique de calcul de lignes d'influence (Müller-Breslau / méthode matricielle).

Remplace les 12 notebooks à `LM` écrit à la main par une construction programmatique
du modèle. Réutilise les briques bas niveau de `calcul_structure.py` sans les modifier.
"""

from .influence_line import compute_influence_line
from .model_builder import build_model, BeamModel
from .vehicle_loads import (
    axle_layout,
    effect_unit,
    load_effect,
    sweep_effect,
    truck_rear_bounds,
    vehicle_catalog,
    HL93,
    IM,
    UNIT_SYSTEMS,
)

__all__ = [
    "compute_influence_line",
    "build_model",
    "BeamModel",
    "axle_layout",
    "effect_unit",
    "load_effect",
    "sweep_effect",
    "truck_rear_bounds",
    "vehicle_catalog",
    "HL93",
    "IM",
    "UNIT_SYSTEMS",
]
