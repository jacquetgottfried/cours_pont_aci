"""Schémas Pydantic : validation des entrées/sorties de l'API."""

from __future__ import annotations

import os
import sys
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# Racine du projet sur le path pour importer le moteur (bornes véhicule SI/US).
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from engine.vehicle_loads import truck_rear_bounds  # noqa: E402

# Quantités acceptées par l'API.
QUANTITIES = ("R", "M", "V")
# Systèmes d'unités acceptés.
UNIT_SYSTEMS = ("SI", "US")


class InfluenceLineRequest(BaseModel):
    """Paramètres d'une ligne d'influence."""

    spans: List[float] = Field(
        ...,
        min_length=1,
        description="Longueurs des travées (m), p. ex. [15, 10, 15].",
    )
    quantity: str = Field(
        ...,
        description="Grandeur : 'R' (réaction), 'M' (moment), 'V' (effort tranchant).",
    )
    target_x: float = Field(
        ...,
        ge=0,
        description="Abscisse de la grandeur (m). Doit tomber sur un nœud ; "
        "un appui pour 'R'.",
    )
    dx: float = Field(
        1.0,
        gt=0,
        description="Discrétisation : longueur d'un élément (m).",
    )
    supports: Optional[List[float]] = Field(
        None,
        description="Positions d'appuis explicites (m). Sinon déduites des travées.",
    )
    unit_system: str = Field(
        "SI",
        description="Système d'unités : 'SI' (m, kN) ou 'US' (ft, kip). "
        "Le moteur est agnostique ; ce champ pilote véhicules, libellés et unités.",
    )

    @field_validator("quantity")
    @classmethod
    def _check_quantity(cls, v: str) -> str:
        if v not in QUANTITIES:
            raise ValueError(f"quantity doit être dans {QUANTITIES}, reçu {v!r}.")
        return v

    @field_validator("unit_system")
    @classmethod
    def _check_unit_system(cls, v: str) -> str:
        if v not in UNIT_SYSTEMS:
            raise ValueError(
                f"unit_system doit être dans {UNIT_SYSTEMS}, reçu {v!r}."
            )
        return v

    @field_validator("spans")
    @classmethod
    def _check_spans(cls, v: List[float]) -> List[float]:
        if any(s <= 0 for s in v):
            raise ValueError("Toutes les travées doivent être strictement positives.")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "spans": [15, 10, 15],
                    "quantity": "R",
                    "target_x": 0,
                    "dx": 1.0,
                }
            ]
        }
    }


class InfluenceLineMeta(BaseModel):
    quantity: str
    target_x: float
    support_positions: List[float]
    n_ddl: int
    n_elements: int


class InfluenceLineResponse(BaseModel):
    """Ligne d'influence calculée."""

    x: List[float] = Field(..., description="Abscisses (m).")
    y: List[float] = Field(..., description="Ordonnées de la ligne d'influence.")
    y_nodes: List[float] = Field(
        ..., description="Ordonnées aux nœuds physiques (sans dédoublement)."
    )
    normalization: float = Field(
        ..., description="Valeur de normalisation (Maxwell-Betti)."
    )
    meta: InfluenceLineMeta


# --------------------------------------------------------------------------- #
# Charges mobiles HL-93
# --------------------------------------------------------------------------- #
VEHICLES = ("truck", "tandem")


class VehicleEnvelopeRequest(InfluenceLineRequest):
    """Ligne d'influence + véhicule HL-93 à balader dessus."""

    vehicle: str = Field(..., description="'truck' (camion) ou 'tandem'.")
    rear_spacing: Optional[float] = Field(
        None,
        description="Espacement des essieux arrière du camion, dans l'unité du "
        "système (4.3–9.0 m en SI, 14–30 ft en US). Défaut = minimum du système.",
    )
    impact: bool = Field(
        True, description="Appliquer la majoration dynamique IM=33 %."
    )

    @field_validator("vehicle")
    @classmethod
    def _check_vehicle(cls, v: str) -> str:
        if v not in VEHICLES:
            raise ValueError(f"vehicle doit être dans {VEHICLES}, reçu {v!r}.")
        return v

    @model_validator(mode="after")
    def _check_rear_spacing(self) -> "VehicleEnvelopeRequest":
        # Bornes dépendantes du système : validées ici (et non au niveau du champ)
        # car elles changent entre SI (4.3–9.0 m) et US (14–30 ft).
        if self.rear_spacing is not None and self.vehicle == "truck":
            rmin, rmax = truck_rear_bounds(self.unit_system)
            if not (rmin <= self.rear_spacing <= rmax):
                raise ValueError(
                    f"rear_spacing doit être entre {rmin} et {rmax} "
                    f"({self.unit_system}), reçu {self.rear_spacing}."
                )
        return self


class AxlePosition(BaseModel):
    x: float
    load: float


class EnvelopeMax(BaseModel):
    value: float
    lead_pos: float
    axle_positions: List[AxlePosition]


class VehicleEnvelopeResponse(BaseModel):
    """Effet de la charge mobile en fonction de la position de l'essieu de tête."""

    positions: List[float] = Field(..., description="Position de l'essieu de tête (m).")
    effects: List[float] = Field(
        ..., description="Effet résultant (kN ou kN·m selon la grandeur)."
    )
    max: EnvelopeMax = Field(..., description="Effet le plus positif.")
    min: EnvelopeMax = Field(..., description="Effet le plus négatif.")
    governing: EnvelopeMax = Field(
        ..., description="Extremum de plus grande valeur absolue (le plus défavorable)."
    )
    unit: str = Field(..., description="Unité de l'effet : 'kN' ou 'kN·m'.")
