"""Charges mobiles HL-93 (AASHTO LRFD) appliquées à une ligne d'influence.

Deux systèmes d'unités sont supportés via le paramètre `unit_system` :
  - "SI" : longueurs en m, charges en kN, effet en kN ou kN·m.
  - "US" : longueurs en ft, charges en kip, effet en kip ou kip·ft.

IMPORTANT — l'AASHTO LRFD définit le HL-93 dans les DEUX systèmes avec des valeurs
réglementaires DISTINCTES (pas de simples conversions arrondies). On stocke donc les
deux jeux officiels dans `HL93` ; on ne convertit JAMAIS numériquement un véhicule.
  - Camion de calcul (design truck) :
      SI  : essieux 35 / 145 / 145 kN ; tête→1er arrière = 4.3 m ; arrière 4.3→9.0 m.
      US  : essieux 8 / 32 / 32 kip   ; tête→1er arrière = 14 ft  ; arrière 14→30 ft.
  - Tandem de calcul (design tandem) :
      SI  : 2 essieux de 110 kN espacés de 1.2 m.
      US  : 2 essieux de 25 kip espacés de 4.0 ft.
  - Coefficient de majoration dynamique (impact) IM = 33 % (sans dimension, commun).
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

# Coefficient de majoration dynamique (dynamic load allowance), commun SI/US.
IM = 0.33

TRUCK = "truck"
TANDEM = "tandem"
VEHICLES = (TRUCK, TANDEM)

SI = "SI"
US = "US"
UNIT_SYSTEMS = (SI, US)

# Jeux de valeurs HL-93 OFFICIELS de l'AASHTO LRFD, par système d'unités.
# Ce sont des valeurs réglementaires distinctes : on ne les convertit jamais.
HL93 = {
    SI: {
        "length_unit": "m",
        "force_unit": "kN",
        "truck": {
            "loads": (35.0, 145.0, 145.0),  # essieux tête, arrière 1, arrière 2
            "front_rear": 4.3,              # tête -> 1er essieu arrière (m)
            "rear_min": 4.3,                # arrière variable, min (m)
            "rear_max": 9.0,                # arrière variable, max (m)
        },
        "tandem": {"loads": (110.0, 110.0), "spacing": 1.2},
    },
    US: {
        "length_unit": "ft",
        "force_unit": "kip",
        "truck": {
            "loads": (8.0, 32.0, 32.0),
            "front_rear": 14.0,             # ft
            "rear_min": 14.0,               # ft
            "rear_max": 30.0,               # ft
        },
        "tandem": {"loads": (25.0, 25.0), "spacing": 4.0},
    },
}

# Bornes SI conservées pour compatibilité (anciens imports). Source : HL93[SI].
TRUCK_REAR_MIN = HL93[SI]["truck"]["rear_min"]
TRUCK_REAR_MAX = HL93[SI]["truck"]["rear_max"]


def _system(unit_system):
    """Renvoie le bloc de constantes HL-93 du système demandé (ou lève)."""
    if unit_system not in HL93:
        raise ValueError(
            f"Système d'unités inconnu : {unit_system!r} (attendu {UNIT_SYSTEMS})."
        )
    return HL93[unit_system]


def truck_rear_bounds(unit_system=SI):
    """Bornes (min, max) de l'espacement arrière du camion pour ce système."""
    t = _system(unit_system)["truck"]
    return t["rear_min"], t["rear_max"]


def effect_unit(unit_system, quantity):
    """Unité de l'effet d'une charge mobile selon (système, grandeur).

    - réaction (R) / effort tranchant (V) : force seule (η sans dimension).
    - moment (M) : force × longueur (η a la dimension d'une longueur).
    """
    s = _system(unit_system)
    fu, lu = s["force_unit"], s["length_unit"]
    return f"{fu}·{lu}" if quantity == "M" else fu


@dataclass
class Axle:
    offset: float  # position de l'essieu mesurée depuis l'essieu de tête (m)
    load: float    # charge de l'essieu (kN)


def axle_layout(
    vehicle: str,
    rear_spacing: float | None = None,
    unit_system: str = SI,
) -> list[Axle]:
    """Disposition des essieux (offset depuis l'essieu de tête, charge).

    Les valeurs (charges, espacements) sont celles du système `unit_system`
    ("SI" en kN/m, "US" en kip/ft). Pour le camion, `rear_spacing` est l'écart
    entre les deux essieux arrière lourds ; `None` => minimum réglementaire du
    système (4.3 m en SI, 14 ft en US).
    """
    s = _system(unit_system)
    if vehicle == TRUCK:
        t = s["truck"]
        if rear_spacing is None:
            rear_spacing = t["rear_min"]
        rmin, rmax = t["rear_min"], t["rear_max"]
        if not (rmin - 1e-9 <= rear_spacing <= rmax + 1e-9):
            raise ValueError(
                f"L'espacement arrière du camion doit être entre "
                f"{rmin} et {rmax} {s['length_unit']} (reçu {rear_spacing})."
            )
        l0, l1, l2 = t["loads"]
        fr = t["front_rear"]
        return [Axle(0.0, l0), Axle(fr, l1), Axle(fr + rear_spacing, l2)]
    if vehicle == TANDEM:
        t = s["tandem"]
        l0, l1 = t["loads"]
        return [Axle(0.0, l0), Axle(t["spacing"], l1)]
    raise ValueError(f"Véhicule inconnu : {vehicle!r} (attendu {VEHICLES}).")


def vehicle_catalog(unit_system: str = SI) -> dict:
    """Catalogue HL-93 exposé au frontend (source unique de vérité).

    Renvoie aussi `unit_system`, `force_unit` et `length_unit` pour que le
    frontend affiche les libellés sans jamais coder d'unité en dur.
    """
    s = _system(unit_system)
    t, tdm = s["truck"], s["tandem"]
    fr, rmin, rmax = t["front_rear"], t["rear_min"], t["rear_max"]
    return {
        "unit_system": unit_system,
        "im": IM,
        "force_unit": s["force_unit"],
        "length_unit": s["length_unit"],
        "truck": {
            "label": "Camion de calcul (HL-93)",
            "axles": [
                {"offset": 0.0, "load": t["loads"][0]},
                {"offset": fr, "load": t["loads"][1]},
                {"offset": fr + rmin, "load": t["loads"][2]},
            ],
            "rear_spacing": {"min": rmin, "max": rmax, "default": rmin},
        },
        "tandem": {
            "label": "Tandem de calcul (HL-93)",
            "axles": [
                {"offset": 0.0, "load": tdm["loads"][0]},
                {"offset": tdm["spacing"], "load": tdm["loads"][1]},
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


def _pack_extreme(x, axles, positions, effects, i):
    """Décrit l'effet à l'indice i : valeur, position de tête, essieux sur la poutre."""
    L = x[-1]
    lead = positions[i]
    axle_positions = [
        {"x": lead + ax.offset, "load": ax.load}
        for ax in axles
        if -1e-9 <= lead + ax.offset <= L + 1e-9
    ]
    return {
        "value": effects[i],
        "lead_pos": lead,
        "axle_positions": axle_positions,
    }


def sweep_effect(
    x: list[float],
    y: list[float],
    axles: list[Axle],
    impact: bool = True,
    n_grid: int = 400,
) -> dict:
    """Balaye le véhicule sur toute la poutre et calcule l'effet à chaque position.

    Retourne {positions, effects, max, min, governing} où :
      - max       : effet le plus POSITIF rencontré ;
      - min       : effet le plus NÉGATIF rencontré ;
      - governing : celui des deux de plus grande valeur absolue (le plus défavorable).
    Chacun est {value, lead_pos, axle_positions}. `positions`/`lead_pos` désignent
    l'abscisse de l'essieu de tête.
    """
    positions = _candidate_positions(x, axles, n_grid)
    effects = [load_effect(x, y, p, axles, impact=impact) for p in positions]

    i_pos = max(range(len(effects)), key=lambda i: effects[i])
    i_neg = min(range(len(effects)), key=lambda i: effects[i])
    e_max = _pack_extreme(x, axles, positions, effects, i_pos)
    e_min = _pack_extreme(x, axles, positions, effects, i_neg)
    governing = e_max if abs(e_max["value"]) >= abs(e_min["value"]) else e_min

    return {
        "positions": positions,
        "effects": effects,
        "max": e_max,
        "min": e_min,
        "governing": governing,
    }
