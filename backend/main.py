"""API FastAPI : calcul de lignes d'influence de poutre continue.

Lancement :
    uvicorn backend.main:app --reload
Documentation interactive : http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import os
import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Racine du projet sur le path pour importer le moteur.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from engine import (  # noqa: E402
    axle_layout,
    compute_influence_line,
    effect_unit,
    sweep_effect,
    vehicle_catalog,
)

from .schemas import (  # noqa: E402
    InfluenceLineRequest,
    InfluenceLineResponse,
    VehicleEnvelopeRequest,
    VehicleEnvelopeResponse,
)

app = FastAPI(
    title="Lignes d'influence — poutre continue",
    description=(
        "Calcul de lignes d'influence (réaction, moment, effort tranchant) par la "
        "méthode de Müller-Breslau et la méthode matricielle des déplacements."
    ),
    version="1.0.0",
)

# CORS ouvert pour le frontend local (page statique).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/influence-line", response_model=InfluenceLineResponse)
def influence_line(req: InfluenceLineRequest):
    """Calcule la ligne d'influence demandée.

    Erreurs métier (appui invalide, point hors nœud, structure instable) renvoyées
    en HTTP 400.
    """
    try:
        result = compute_influence_line(
            spans=req.spans,
            quantity=req.quantity,
            target_x=req.target_x,
            dx=req.dx,
            supports=req.supports,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@app.get("/vehicles")
def vehicles(unit_system: str = "SI"):
    """Catalogue HL-93 (essieux, charges, espacements) — source unique de vérité.

    `unit_system` ("SI" | "US") sélectionne le jeu de valeurs AASHTO officiel et
    les unités (kN/m vs kip/ft).
    """
    try:
        return vehicle_catalog(unit_system)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/vehicle-envelope", response_model=VehicleEnvelopeResponse)
def vehicle_envelope(req: VehicleEnvelopeRequest):
    """Balade le véhicule HL-93 sur la poutre et renvoie l'effet vs position + max.

    L'effet est en kN (réaction, effort tranchant) ou kN·m (moment).
    """
    try:
        li = compute_influence_line(
            spans=req.spans,
            quantity=req.quantity,
            target_x=req.target_x,
            dx=req.dx,
            supports=req.supports,
        )
        axles = axle_layout(
            req.vehicle,
            rear_spacing=req.rear_spacing,
            unit_system=req.unit_system,
        )
        env = sweep_effect(li["x"], li["y"], axles, impact=req.impact)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    env["unit"] = effect_unit(req.unit_system, req.quantity)
    return env
