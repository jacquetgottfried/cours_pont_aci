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


# --------------------------------------------------------------------------- #
# Charges réparties permanentes DC (poids propre) / DW (revêtement)
# --------------------------------------------------------------------------- #
class DistributedEffectRequest(InfluenceLineRequest):
    """Ligne d'influence + charges réparties DC/DW à intégrer dessus.

    DC et DW ne sont PAS factorisés (pas de coefficient 1.25/1.50…) : l'API renvoie
    l'effet de chacun et leur somme. Pour l'enveloppe (`/distributed-envelope`), le
    champ `target_x` est ignoré (le balayage parcourt toutes les sections).
    """

    w_dc: float = Field(
        0.0,
        ge=0,
        description="Intensité DC (poids propre), unité du système (kN/m | kip/ft).",
    )
    w_dw: float = Field(
        0.0,
        ge=0,
        description="Intensité DW (revêtement), unité du système (kN/m | kip/ft).",
    )

    @model_validator(mode="after")
    def _check_loads(self) -> "DistributedEffectRequest":
        if self.w_dc <= 0 and self.w_dw <= 0:
            raise ValueError(
                "Au moins une des charges w_dc / w_dw doit être strictement positive."
            )
        return self


class DistributedComponent(BaseModel):
    """Effet d'une configuration de charge, décomposé DC / DW / somme."""

    dc: float = Field(..., description="Effet de la charge DC seule.")
    dw: float = Field(..., description="Effet de la charge DW seule.")
    total: float = Field(..., description="Effet de DC + DW.")
    zones: List[List[float]] = Field(
        ..., description="Intervalles chargés [[x0, x1], …] (toute la poutre si 'full')."
    )


class DistributedEffectResponse(BaseModel):
    """Effet des charges réparties DC/DW sur une ligne d'influence donnée."""

    full: DistributedComponent = Field(
        ..., description="Toute la poutre chargée (charge permanente)."
    )
    max: DistributedComponent = Field(
        ..., description="Chargement alterné des zones η>0 (effet le plus positif)."
    )
    min: DistributedComponent = Field(
        ..., description="Chargement alterné des zones η<0 (effet le plus négatif)."
    )
    governing: DistributedComponent = Field(
        ..., description="De max/min, le plus grand en valeur absolue."
    )
    w_dc: float
    w_dw: float
    unit: str = Field(..., description="Unité : 'kN'/'kip' ou 'kN·m'/'kip·ft'.")


class DistributedPoint(BaseModel):
    position: float
    value: float


class DistributedGoverning(BaseModel):
    value: float
    position: float
    zones: List[List[float]]
    sign: int = Field(..., description="+1 (effet positif) ou -1 (effet négatif).")


class DistributedEnvelopeResponse(BaseModel):
    """Ligne d'enveloppe d'une charge répartie DC/DW le long de la poutre."""

    positions: List[float] = Field(..., description="Abscisse de la section étudiée.")
    max: List[float] = Field(..., description="Effet total DC+DW, chargement alterné +.")
    min: List[float] = Field(..., description="Effet total DC+DW, chargement alterné -.")
    full: List[float] = Field(..., description="Effet total DC+DW, toute la poutre.")
    governing: DistributedGoverning = Field(
        ..., description="Section et effet les plus défavorables."
    )
    midspan_points: List[DistributedPoint] = Field(
        ..., description="Max positif par travée (moment max à mi-travée)."
    )
    support_points: List[DistributedPoint] = Field(
        ..., description="Min négatif au droit des appuis intérieurs (moment sur appui)."
    )
    quantity: str
    w_dc: float
    w_dw: float
    unit: str = Field(..., description="Unité de l'effet.")


# --------------------------------------------------------------------------- #
# Dalle de tablier — méthode de la bande équivalente (AASHTO)
# --------------------------------------------------------------------------- #
class DeckDesignRequest(BaseModel):
    """Paramètres du dimensionnement de la dalle (poutre transversale + bande)."""

    n_girders: int = Field(6, ge=2, description="Nombre de longerons (appuis).")
    spacing: float = Field(..., gt=0, description="Entraxe des longerons S (m | ft).")
    overhang: float = Field(..., ge=0, description="Largeur du porte-à-faux (m | ft).")
    dx: float = Field(..., gt=0, description="Discrétisation transversale (m | ft).")
    w_dc: float = Field(
        0.0, ge=0, description="Charge permanente dalle DC (kN/m | kip/ft)."
    )
    w_dw: float = Field(
        0.0, ge=0, description="Charge de revêtement DW (kN/m | kip/ft)."
    )
    gamma_dc: float = Field(1.25, gt=0, description="Facteur de charge DC.")
    gamma_dw: float = Field(1.50, gt=0, description="Facteur de charge DW.")
    gamma_ll: float = Field(1.75, gt=0, description="Facteur de charge LL+IM.")
    mpf1: float = Field(1.20, gt=0, description="Présence multiple, 1 voie chargée.")
    mpf2: float = Field(1.00, gt=0, description="Présence multiple, 2 voies chargées.")
    mpf3: float = Field(0.85, gt=0, description="Présence multiple, 3 voies chargées.")
    p_barrier: float = Field(
        0.0, ge=0, description="Charge ponctuelle barrière DC (kN | kip)."
    )
    x_barrier: float = Field(
        0.0, ge=0, description="Position transversale de la barrière (m | ft)."
    )
    p_rail: float = Field(
        0.0, ge=0, description="Charge ponctuelle glissière DC (kN | kip)."
    )
    x_rail: float = Field(
        0.0, ge=0, description="Position transversale de la glissière (m | ft)."
    )
    impact: bool = Field(True, description="Majoration dynamique IM=33 %.")
    unit_system: str = Field(
        "SI", description="Système d'unités : 'SI' (m, kN) ou 'US' (ft, kip)."
    )

    @field_validator("unit_system")
    @classmethod
    def _check_unit_system(cls, v: str) -> str:
        if v not in UNIT_SYSTEMS:
            raise ValueError(
                f"unit_system doit être dans {UNIT_SYSTEMS}, reçu {v!r}."
            )
        return v

    @model_validator(mode="after")
    def _check_loads(self) -> "DeckDesignRequest":
        if self.w_dc <= 0 and self.w_dw <= 0:
            raise ValueError(
                "Au moins une des charges w_dc / w_dw doit être strictement positive."
            )
        return self


class DeckGeometry(BaseModel):
    total: float
    girders: List[float]
    overhang: float
    spacing: float
    n_girders: int
    dx: float


class DeckWheel(BaseModel):
    P: float
    gage: float
    edge_offset: float
    im: float


class DeckFactors(BaseModel):
    gamma_dc: float
    gamma_dw: float
    gamma_ll: float
    mpf1: float
    mpf2: float
    mpf3: float


class DeckLaneCase(BaseModel):
    """Effet de charge roulante pour un nombre de voies chargées donné."""

    n_lanes: int
    mpf: float = Field(..., description="Facteur de présence multiple appliqué.")
    M_strip: float = Field(..., description="Effet de la bande (roues, avec IM).")
    M_LL: float = Field(..., description="Effet par unité de largeur (MPF·M_strip/E).")


class DeckSection(BaseModel):
    """Effets d'une section sur ligne d'influence (moment +/- ou effort tranchant)."""

    M_DC: float = Field(..., description="DC total (réparti + barrière + glissière).")
    M_DC_dist: float = Field(..., description="DC réparti (poids dalle), part w·∫η.")
    M_DC_barrier: float = Field(..., description="DC barrière (charge ponctuelle).")
    M_DC_rail: float = Field(..., description="DC glissière (charge ponctuelle).")
    M_DW: float
    M_LL: float = Field(..., description="Effet de charge vive gouvernant par largeur.")
    M_strip: float = Field(..., description="Effet de la bande gouvernant (roues, IM).")
    live_lanes: List[DeckLaneCase] = Field(
        ..., description="Détail par nombre de voies (transparence des MPF)."
    )
    E: float = Field(..., description="Largeur de bande brute (in en US, mm en SI).")
    E_length: float = Field(..., description="Largeur de bande en unité système (ft|m).")
    Mu: float = Field(..., description="Combinaison Strength I (γ·M ou γ·V).")
    target_x: float


class DeckOverhangWheel(BaseModel):
    x: float
    X: float
    P: float


class DeckOverhangSection(BaseModel):
    """Moments du porte-à-faux (console, statique)."""

    M_DC: float
    M_DC_dist: float = Field(..., description="DC réparti console (w·L²/2).")
    M_DC_barrier: float = Field(..., description="DC barrière (P·X statique).")
    M_DC_rail: float = Field(..., description="DC glissière (P·X statique).")
    M_DW: float
    M_LL: float
    M_strip: float
    E: float
    E_length: float
    Mu: float
    X: float = Field(..., description="Bras de levier de la roue de rive.")
    wheels: List[DeckOverhangWheel]


class DeckSections(BaseModel):
    positive: DeckSection
    negative: DeckSection
    shear: DeckSection
    overhang: DeckOverhangSection


class DeckILView(BaseModel):
    """Ligne d'influence transversale pour l'affichage (avec roues et zones DC/DW)."""

    x: List[float]
    y: List[float]
    target_x: float
    support_positions: List[float]
    wheels: List[AxlePosition]
    dead_zones: List[List[float]]


class DeckILViews(BaseModel):
    positive: DeckILView
    negative: DeckILView
    shear: DeckILView


class DeckDesignResponse(BaseModel):
    """Résultat du dimensionnement de la dalle (4 sections + IL transversales)."""

    geometry: DeckGeometry
    wheel: DeckWheel
    factors: DeckFactors
    sections: DeckSections
    influence_lines: DeckILViews
    unit_effort: str = Field(..., description="Unité de moment (kN·m | kip·ft).")
    unit_line: str = Field(
        ..., description="Unité de moment par largeur (kN·m/m | kip·ft/ft)."
    )
    unit_shear: str = Field(..., description="Unité d'effort tranchant (kN | kip).")
    unit_shear_line: str = Field(
        ..., description="Unité d'effort tranchant par largeur (kN/m | kip/ft)."
    )
