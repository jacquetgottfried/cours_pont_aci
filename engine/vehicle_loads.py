"""Charges mobiles HL-93 (AASHTO LRFD) appliquées à une ligne d'influence.

Unités : Système International (longueurs en m, charges en kN, effet en kN ou kN·m
selon la grandeur de la ligne d'influence).

Définitions HL-93 (valeurs SI de l'AASHTO LRFD) :
  - Camion de calcul (design truck) : essieux 35 / 145 / 145 kN.
      espacement avant→1er arrière = 4.3 m ;
      espacement entre les deux essieux arrière variable de 4.3 m à 9.0 m.
  - Tandem de calcul (design tandem) : 2 essieux de 110 kN espacés de 1.2 m.
  - Coefficient de majoration dynamique (impact) IM = 33 % sur camion/tandem.
La charge de voie répartie (9.3 kN/m) n'est PAS incluse ici (choix utilisateur).

L'« effet » d'une charge mobile sur une ligne d'influence est, par définition :
    effet = (1 + IM) · Σ_i  P_i · η(x_i)
où P_i est la charge de l'essieu i et η l'ordonnée de la ligne d'influence à
l'abscisse x_i de cet essieu (interpolation linéaire). Pour une LI de réaction ou
d'effort tranchant, η est sans dimension → effet en kN. Pour une LI de moment,
η a la dimension d'une longueur (m) → effet en kN·m.
"""

from __future__ import annotations

from dataclasses import dataclass

# Coefficient de majoration dynamique (dynamic load allowance), état limite usuel.
IM = 0.33

# Espacement arrière du camion : bornes réglementaires (m).
TRUCK_REAR_MIN = 4.3
TRUCK_REAR_MAX = 9.0

TRUCK = "truck"
TANDEM = "tandem"
VEHICLES = (TRUCK, TANDEM)


@dataclass
class Axle:
    offset: float  # position de l'essieu mesurée depuis l'essieu de tête (m)
    load: float    # charge de l'essieu (kN)


def axle_layout(vehicle: str, rear_spacing: float = TRUCK_REAR_MIN) -> list[Axle]:
    """Disposition des essieux (offset depuis l'essieu de tête, charge) en SI.

    Pour le camion, `rear_spacing` (4.3–9.0 m) est l'écart entre les deux essieux
    arrière de 145 kN.
    """
    if vehicle == TRUCK:
        if not (TRUCK_REAR_MIN - 1e-9 <= rear_spacing <= TRUCK_REAR_MAX + 1e-9):
            raise ValueError(
                f"L'espacement arrière du camion doit être entre "
                f"{TRUCK_REAR_MIN} et {TRUCK_REAR_MAX} m (reçu {rear_spacing})."
            )
        return [
            Axle(0.0, 35.0),
            Axle(4.3, 145.0),
            Axle(4.3 + rear_spacing, 145.0),
        ]
    if vehicle == TANDEM:
        return [Axle(0.0, 110.0), Axle(1.2, 110.0)]
    raise ValueError(f"Véhicule inconnu : {vehicle!r} (attendu {VEHICLES}).")


def vehicle_catalog() -> dict:
    """Catalogue HL-93 exposé au frontend (source unique de vérité)."""
    return {
        "im": IM,
        "truck": {
            "label": "Camion de calcul (HL-93)",
            "axles": [
                {"offset": 0.0, "load": 35.0},
                {"offset": 4.3, "load": 145.0},
                {"offset": 8.6, "load": 145.0},
            ],
            "rear_spacing": {
                "min": TRUCK_REAR_MIN,
                "max": TRUCK_REAR_MAX,
                "default": TRUCK_REAR_MIN,
            },
        },
        "tandem": {
            "label": "Tandem de calcul (HL-93)",
            "axles": [
                {"offset": 0.0, "load": 110.0},
                {"offset": 1.2, "load": 110.0},
            ],
            "rear_spacing": None,
        },
    }


def interp(x: list[float], y: list[float], q: float) -> float:
    """Interpolation linéaire de l'ordonnée de la LI à l'abscisse q.

    `x` est croissant et peut contenir un point dédoublé (saut d'effort tranchant).
    En dehors de [x0, x_last], on renvoie la valeur de l'extrémité. À l'aplomb exact
    d'un saut, on retient la valeur de plus grande amplitude (côté défavorable).
    """
    n = len(x)
    if q <= x[0]:
        return y[0]
    if q >= x[-1]:
        return y[-1]
    candidates = []
    for i in range(n - 1):
        x0, x1 = x[i], x[i + 1]
        if x1 == x0:
            continue  # segment dégénéré (le saut lui-même)
        if x0 <= q <= x1:
            t = (q - x0) / (x1 - x0)
            candidates.append(y[i] + t * (y[i + 1] - y[i]))
    if not candidates:
        return 0.0
    # à l'aplomb d'un saut, plusieurs segments contiennent q : côté défavorable.
    return max(candidates, key=abs)


def load_effect(
    x: list[float],
    y: list[float],
    lead_pos: float,
    axles: list[Axle],
    impact: bool = True,
) -> float:
    """Effet de la charge mobile pour une position `lead_pos` de l'essieu de tête.

    Les essieux hors de la poutre ne contribuent pas.
    """
    L = x[-1]
    total = 0.0
    for ax in axles:
        pos = lead_pos + ax.offset
        if pos < -1e-9 or pos > L + 1e-9:
            continue
        total += ax.load * interp(x, y, pos)
    if impact:
        total *= 1.0 + IM
    return total


def _candidate_positions(x, axles, n_grid):
    """Positions d'essieu de tête à évaluer : grille régulière + points anguleux.

    Entre deux ruptures (positions où un essieu coïncide avec un nœud de la LI),
    l'effet est linéaire en `lead_pos` : son extremum est donc atteint à une rupture.
    Mais la LI d'effort tranchant est DISCONTINUE à la coupure : à cette rupture
    l'effet saute. On évalue donc chaque rupture ET ses deux côtés (± epsilon) pour
    capter le côté défavorable du saut. Une grille régulière complète pour le tracé.
    """
    L = x[-1]
    last = max(ax.offset for ax in axles)
    start, stop = -last, L
    step = (stop - start) / max(n_grid - 1, 1)
    grid = [start + i * step for i in range(n_grid)]
    eps = 1e-6
    breakpoints = []
    for xn in x:
        for ax in axles:
            p = xn - ax.offset
            breakpoints.extend([p, p - eps, p + eps])
    breakpoints = [p for p in breakpoints if start - 1e-9 <= p <= stop + 1e-9]
    positions = sorted(set(round(p, 9) for p in grid + breakpoints))
    return positions


def sweep_effect(
    x: list[float],
    y: list[float],
    axles: list[Axle],
    impact: bool = True,
    n_grid: int = 400,
) -> dict:
    """Balaye le véhicule sur toute la poutre et calcule l'effet à chaque position.

    Retourne {positions, effects, max:{value, lead_pos, axle_positions}}.
    `positions` et `lead_pos` désignent l'abscisse de l'essieu de tête.
    """
    L = x[-1]
    positions = _candidate_positions(x, axles, n_grid)
    effects = [load_effect(x, y, p, axles, impact=impact) for p in positions]

    # extremum en valeur absolue (position la plus défavorable).
    i_max = max(range(len(effects)), key=lambda i: abs(effects[i]))
    lead = positions[i_max]
    axle_positions = [
        {"x": lead + ax.offset, "load": ax.load}
        for ax in axles
        if -1e-9 <= lead + ax.offset <= L + 1e-9
    ]
    return {
        "positions": positions,
        "effects": effects,
        "max": {
            "value": effects[i_max],
            "lead_pos": lead,
            "axle_positions": axle_positions,
        },
    }
