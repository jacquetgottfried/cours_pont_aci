"""Schémas Pydantic : validation des entrées/sorties de l'API."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

# Quantités acceptées par l'API.
QUANTITIES = ("R", "M", "V")


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

    @field_validator("quantity")
    @classmethod
    def _check_quantity(cls, v: str) -> str:
        if v not in QUANTITIES:
            raise ValueError(f"quantity doit être dans {QUANTITIES}, reçu {v!r}.")
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
    rear_spacing: float = Field(
        4.3,
        ge=4.3,
        le=9.0,
        description="Espacement des essieux arrière du camion (m), 4.3–9.0.",
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
    max: EnvelopeMax
    unit: str = Field(..., description="Unité de l'effet : 'kN' ou 'kN·m'.")
