"""Moteur générique de calcul de lignes d'influence (Müller-Breslau / méthode matricielle).

Remplace les 12 notebooks à `LM` écrit à la main par une construction programmatique
du modèle. Réutilise les briques bas niveau de `calcul_structure.py` sans les modifier.
"""

from .influence_line import compute_influence_line
from .model_builder import build_model, BeamModel
from .distributed_loads import (
    distributed_effect,
    distributed_envelope,
    integrate_il,
)
from .deck import (
    deck_design,
    deck_geometry,
    deck_section_study,
    design_wheel,
    edge_point_loads,
    effect_unit_per_width,
    infer_strip_kind,
    overhang_dead_moment,
    overhang_live_moment,
    strip_length,
    strip_width,
)
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
    "distributed_effect",
    "distributed_envelope",
    "integrate_il",
    "deck_design",
    "deck_geometry",
    "deck_section_study",
    "design_wheel",
    "edge_point_loads",
    "effect_unit_per_width",
    "infer_strip_kind",
    "overhang_dead_moment",
    "overhang_live_moment",
    "strip_length",
    "strip_width",
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
