"""Dimensionnement de la dalle de tablier par la méthode de la bande équivalente.

La dalle porte TRANSVERSALEMENT sur les longerons longitudinaux : c'est une poutre
continue transversale dont les appuis sont les longerons et dont les extrémités libres
sont les porte-à-faux. On réutilise donc EXACTEMENT le moteur de ligne d'influence
(`compute_influence_line`) avec des `supports` aux positions de longerons.

La « largeur de bande équivalente » E (AASHTO LRFD Table 4.6.2.1.3-1) convertit le
moment des roues sur la bande en moment par unité de largeur de dalle :
    m_LL = MPF · M_bande / E_longueur      (kN·m/m en SI, kip·ft/ft en US)

Trois sections de calcul :
  - **Moment positif** : à mi-baie intérieure (ligne d'influence + balayage des roues) ;
  - **Moment négatif** : au droit d'un longeron INTÉRIEUR (jamais l'extérieur : la rotule
    à l'appui de rive ferait « battre » le porte-à-faux → matrice singulière) ;
  - **Porte-à-faux** : traité par STATIQUE (console isostatique) — `M = ΣP·X·(1+IM)` pour
    les roues, `w·L²/2` pour les charges permanentes — sans ligne d'influence.

Combinaison Strength I à facteurs ÉDITABLES :
    Mu = γ_DC·M_DC + γ_DW·M_DW + γ_LL·(M_LL+IM)   (défauts 1.25 / 1.50 / 1.75).

Module de BORD (comme `vehicle_loads`) : il connaît `unit_system` (formule de bande
réglementaire + roue HL-93 dérivée par système). Le cœur `compute_influence_line` reste
agnostique aux unités (cf. doc 04 R6/D7) : on ne lui passe jamais `unit_system`.
"""

from __future__ import annotations

from .distributed_loads import distributed_effect
from .influence_line import compute_influence_line
from .vehicle_loads import HL93, IM, Axle, _system, effect_unit, sweep_effect

# Constantes de roue de calcul par système (valeurs réglementaires, jamais converties).
# gage = écartement transversal des roues d'un essieu ; edge_offset = recul de la roue
# par rapport au bord de dalle (1 ft / 0.3 m, AASHTO).
WHEEL = {
    "SI": {"gage": 1.8, "edge_offset": 0.3},
    "US": {"gage": 6.0, "edge_offset": 1.0},
}

_KINDS = ("positive", "negative", "overhang")


def deck_geometry(n_girders, spacing, overhang, dx):
    """Construit la poutre transversale de la dalle (appuis = longerons).

    total = 2·overhang + (n_girders-1)·spacing ; longerons à overhang + i·spacing.
    Le pas `dx` doit diviser la grille (sinon `compute_influence_line` lèvera → 400).
    """
    if n_girders < 2:
        raise ValueError("n_girders doit être ≥ 2.")
    if spacing <= 0:
        raise ValueError("spacing (entraxe des longerons) doit être > 0.")
    if overhang < 0:
        raise ValueError("overhang (porte-à-faux) doit être ≥ 0.")
    if dx <= 0:
        raise ValueError("dx doit être > 0.")
    total = 2.0 * overhang + (n_girders - 1) * spacing
    girders = [overhang + i * spacing for i in range(n_girders)]
    return {
        "total": total,
        "girders": girders,
        "overhang": float(overhang),
        "spacing": float(spacing),
        "n_girders": int(n_girders),
        "dx": float(dx),
    }


def strip_width(kind, s_or_x, unit_system):
    """Largeur de bande équivalente E (AASHTO LRFD Table 4.6.2.1.3-1).

    `kind` ∈ {'positive', 'negative', 'overhang'} ; `s_or_x` est l'entraxe S (positif /
    négatif) ou la distance X de la charge à l'appui (porte-à-faux), dans l'unité du
    système. Renvoie la valeur RÉGLEMENTAIRE BRUTE : en POUCES (US), en MILLIMÈTRES (SI).
    """
    if kind not in _KINDS:
        raise ValueError(f"kind doit être dans {_KINDS}, reçu {kind!r}.")
    _system(unit_system)  # valide le système (lève sinon)
    if unit_system == "US":  # S, X en ft -> E en pouces
        if kind == "positive":
            return 26.0 + 6.6 * s_or_x
        if kind == "negative":
            return 48.0 + 3.0 * s_or_x
        return 45.0 + 10.0 * s_or_x  # overhang
    # SI : S, X en m -> mm pour la formule, E en mm
    v = s_or_x * 1000.0
    if kind == "positive":
        return 660.0 + 0.55 * v
    if kind == "negative":
        return 1220.0 + 0.25 * v
    return 1140.0 + 0.833 * v  # overhang


def strip_length(strip_width_raw, unit_system):
    """Convertit la largeur de bande brute (in/mm) en longueur du système (ft/m).

    C'est le dénominateur de `m_LL = MPF · M_bande / E_longueur`.
    """
    _system(unit_system)
    return strip_width_raw / 12.0 if unit_system == "US" else strip_width_raw / 1000.0


def design_wheel(unit_system):
    """Roue de calcul du tablier, dérivée du camion HL-93 (essieu arrière / 2).

    16 kip (US), 72.5 kN (SI) — DÉRIVÉE de chaque jeu officiel, jamais convertie d'un
    système à l'autre (cf. doc 04 R7 / décision D5). Renvoie aussi le gage, le recul au
    bord, IM et les unités (clés de bord pour le frontend, comme `vehicle_catalog`).
    """
    s = _system(unit_system)
    w = WHEEL[unit_system]
    return {
        "P": HL93[unit_system]["truck"]["loads"][2] / 2.0,
        "gage": w["gage"],
        "edge_offset": w["edge_offset"],
        "im": IM,
        "force_unit": s["force_unit"],
        "length_unit": s["length_unit"],
    }


def effect_unit_per_width(unit_system):
    """Unité d'un moment par unité de largeur : kN·m/m (SI) ou kip·ft/ft (US)."""
    s = _system(unit_system)
    return f"{s['force_unit']}·{s['length_unit']}/{s['length_unit']}"


def overhang_live_moment(geom, wheel, impact=True):
    """Moment de charge vive au droit du longeron de rive, par STATIQUE (console).

    La roue de rive est placée à `edge_offset` du bord ; X = distance à l'appui de rive.
    Si la 2ᵉ roue de l'essieu (à `gage`) tombe encore sur le porte-à-faux, elle compte.
    M = (1+IM)·Σ P·X_i (IM appliqué si `impact`). Renvoie aussi X de la roue de rive.
    """
    girder0 = geom["girders"][0]
    p = wheel["P"]
    x_edge = wheel["edge_offset"]  # abscisse de la roue de rive (depuis le bord x=0)
    wheels = []
    for x_load in (x_edge, x_edge + wheel["gage"]):
        if x_load < girder0 - 1e-9:  # roue effectivement sur le porte-à-faux
            lever = girder0 - x_load
            wheels.append({"x": x_load, "X": lever, "P": p})
    factor = (1.0 + IM) if impact else 1.0
    moment = factor * sum(d["P"] * d["X"] for d in wheels)
    x_gov = girder0 - x_edge  # bras de levier de la roue de rive
    return {"M": moment, "X": x_gov, "wheels": wheels, "im": IM if impact else 0.0}


def overhang_dead_moment(geom, w_dc, w_dw):
    """Moment de charge permanente au droit du longeron de rive (console : w·L²/2)."""
    lc = geom["overhang"]
    half = lc * lc / 2.0
    return {
        "dc": w_dc * half,
        "dw": w_dw * half,
        "total": (w_dc + w_dw) * half,
        "L_cant": lc,
    }


def _il_section(geom, target_x, wheel, w_dc, w_dw, which, unit_system, impact):
    """Calcule une section sur ligne d'influence (positif ou négatif).

    `which` ∈ {'positive', 'negative'} : on retient le max (positif) ou le min (négatif)
    du balayage des roues. Renvoie le dict de section + la vue d'IL pour le frontend.
    """
    li = compute_influence_line(
        [geom["total"]], "M", target_x, dx=geom["dx"], supports=geom["girders"]
    )
    axles = [Axle(0.0, wheel["P"]), Axle(wheel["gage"], wheel["P"])]
    env = sweep_effect(li["x"], li["y"], axles, impact=impact)
    m_strip = env["max"]["value"] if which == "positive" else env["min"]["value"]
    e_raw = strip_width(which, geom["spacing"], unit_system)
    m_ll = wheel["mpf"] * m_strip / strip_length(e_raw, unit_system)
    dead = distributed_effect(li["x"], li["y"], w_dc, w_dw)["full"]
    il_view = {
        "x": li["x"],
        "y": li["y"],
        "target_x": float(target_x),
        "support_positions": li["meta"]["support_positions"],
        "wheels": env["governing"]["axle_positions"],
        "dead_zones": dead["zones"],
    }
    return {
        "M_DC": dead["dc"],
        "M_DW": dead["dw"],
        "M_LL": m_ll,
        "M_strip": m_strip,
        "E": e_raw,
        "E_length": strip_length(e_raw, unit_system),
        "target_x": float(target_x),
    }, il_view


def deck_design(
    n_girders,
    spacing,
    overhang,
    dx,
    w_dc,
    w_dw,
    unit_system,
    gamma_dc=1.25,
    gamma_dw=1.50,
    gamma_ll=1.75,
    mpf=1.20,
    impact=True,
):
    """Dimensionne la dalle : moments DC, DW, LL+IM et combinaison Mu, par section.

    Sections : positif (mi-baie intérieure), négatif (longeron intérieur), porte-à-faux
    (statique). Réutilise `compute_influence_line` + `sweep_effect` + `distributed_effect`.
    `gamma_*` et `mpf` sont éditables. Renvoie un dict structuré + les IL transversales.
    """
    geom = deck_geometry(n_girders, spacing, overhang, dx)
    wheel = design_wheel(unit_system)
    wheel["mpf"] = mpf
    girders = geom["girders"]

    def factored(m_dc, m_dw, m_ll):
        return gamma_dc * m_dc + gamma_dw * m_dw + gamma_ll * m_ll

    # --- Positif : mi-baie intérieure (entre longerons 1 et 2, 0-indexés) ---
    bay_mid = girders[1] + spacing / 2.0
    pos, il_pos = _il_section(
        geom, bay_mid, wheel, w_dc, w_dw, "positive", unit_system, impact
    )
    pos["Mu"] = factored(pos["M_DC"], pos["M_DW"], pos["M_LL"])

    # --- Négatif : au droit d'un longeron INTÉRIEUR (jamais le longeron de rive) ---
    neg, il_neg = _il_section(
        geom, girders[1], wheel, w_dc, w_dw, "negative", unit_system, impact
    )
    neg["Mu"] = factored(neg["M_DC"], neg["M_DW"], neg["M_LL"])

    # --- Porte-à-faux : statique (console), sans ligne d'influence ---
    oh_live = overhang_live_moment(geom, wheel, impact)
    oh_dead = overhang_dead_moment(geom, w_dc, w_dw)
    e_oh = strip_width("overhang", oh_live["X"], unit_system)
    m_ll_oh = mpf * oh_live["M"] / strip_length(e_oh, unit_system)
    overhang_section = {
        "M_DC": oh_dead["dc"],
        "M_DW": oh_dead["dw"],
        "M_LL": m_ll_oh,
        "M_strip": oh_live["M"],
        "E": e_oh,
        "E_length": strip_length(e_oh, unit_system),
        "X": oh_live["X"],
        "wheels": oh_live["wheels"],
    }
    overhang_section["Mu"] = factored(
        overhang_section["M_DC"], overhang_section["M_DW"], overhang_section["M_LL"]
    )

    return {
        "geometry": geom,
        "wheel": {k: wheel[k] for k in ("P", "gage", "edge_offset", "im")},
        "factors": {
            "gamma_dc": gamma_dc,
            "gamma_dw": gamma_dw,
            "gamma_ll": gamma_ll,
            "mpf": mpf,
        },
        "sections": {
            "positive": pos,
            "negative": neg,
            "overhang": overhang_section,
        },
        "influence_lines": {"positive": il_pos, "negative": il_neg},
        "unit_effort": effect_unit(unit_system, "M"),
        "unit_line": effect_unit_per_width(unit_system),
    }
