"""Dimensionnement de la dalle de tablier par la méthode de la bande équivalente.

La dalle porte TRANSVERSALEMENT sur les longerons longitudinaux : c'est une poutre
continue transversale dont les appuis sont les longerons et dont les extrémités libres
sont les porte-à-faux. On réutilise donc EXACTEMENT le moteur de ligne d'influence
(`compute_influence_line`) avec des `supports` aux positions de longerons.

La « largeur de bande équivalente » E (AASHTO LRFD Table 4.6.2.1.3-1) convertit le
moment des roues sur la bande en moment par unité de largeur de dalle :
    m_LL = MPF · M_bande / E_longueur      (kN·m/m en SI, kip·ft/ft en US)

Quatre sections de calcul :
  - **Moment positif** : à mi-baie intérieure (ligne d'influence + balayage des roues) ;
  - **Moment négatif** : au droit d'un longeron INTÉRIEUR (jamais l'extérieur : la rotule
    à l'appui de rive ferait « battre » le porte-à-faux → matrice singulière) ;
  - **Effort tranchant** : au droit du même longeron intérieur (LI de V). Faute de formule
    de bande AASHTO en cisaillement, on réutilise la largeur de bande NÉGATIVE comme
    dénominateur (choix pédagogique, cf. doc 05) ; unité kN/m | kip/ft par largeur ;
  - **Porte-à-faux** : traité par STATIQUE (console isostatique) — `M = ΣP·X·(1+IM)` pour
    les roues, `w·L²/2` pour les charges réparties — sans ligne d'influence.

Charges prises en compte :
  - **DC/DW répartis** (poids dalle, revêtement) : effet `w·∫η`, en chargement COMPLET
    (`full`) — charges permanentes toujours présentes (cf. doc 04 R8) ;
  - **Charges ponctuelles permanentes** (barrière, glissière), DC : appliquées en PAIRE
    SYMÉTRIQUE aux deux rives (`x` de chaque bord, cf. `edge_point_loads`) ; effet `P·η`
    en section (réutilise `interp`), `P·X` au porte-à-faux (la charge miroir n'y
    contribue pas). Détaillées séparément (transparence) ;
  - **Charge roulante** : cas 1 / 2 / 3 voies chargées (train de roues à entraxe de voie
    `LANE_WIDTH`, balayé par `sweep_effect`), avec facteurs de présence multiple (MPF)
    ÉDITABLES (défauts 1.20 / 1.00 / 0.85). On retient l'effet positif, négatif ou
    gouvernant selon la section. Le pattern loading η⁺/η⁻ reste réservé au live.

Combinaison Strength I à facteurs ÉDITABLES :
    Mu = γ_DC·M_DC + γ_DW·M_DW + γ_LL·(M_LL+IM)   (défauts 1.25 / 1.50 / 1.75).

Module de BORD (comme `vehicle_loads`) : il connaît `unit_system` (formule de bande
réglementaire + roue HL-93 dérivée par système). Le cœur `compute_influence_line` reste
agnostique aux unités (cf. doc 04 R6/D7) : on ne lui passe jamais `unit_system`.
"""

from __future__ import annotations

from .distributed_loads import distributed_effect
from .influence_line import compute_influence_line
from .vehicle_loads import HL93, IM, Axle, _system, effect_unit, interp, sweep_effect

# Constantes de roue de calcul par système (valeurs réglementaires, jamais converties).
# gage = écartement transversal des roues d'un essieu ; edge_offset = recul de la roue
# par rapport au bord de dalle (1 ft / 0.3 m, AASHTO).
WHEEL = {
    "SI": {"gage": 1.8, "edge_offset": 0.3},
    "US": {"gage": 6.0, "edge_offset": 1.0},
}

# Largeur de voie de calcul AASHTO (entraxe transversal des essieux d'un train de voies).
LANE_WIDTH = {"SI": 3.6, "US": 12.0}

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


def shear_unit_per_width(unit_system):
    """Unité d'un effort tranchant par unité de largeur : kN/m (SI) ou kip/ft (US)."""
    s = _system(unit_system)
    return f"{s['force_unit']}/{s['length_unit']}"


# ----------------------------------------------------------------------------------
# Charges ponctuelles permanentes (barrière, glissière) — DC
# ----------------------------------------------------------------------------------
def point_load_effect(li_x, li_y, loads):
    """Effet de charges ponctuelles permanentes sur une LI : `effet = Σ P·η(x)`.

    `loads` : liste de {"name", "P", "x"} (P en force, x abscisse transversale). Renvoie
    {name: Σ P·η(x)} + "total" — les effets sont CUMULÉS par nom (une paire symétrique
    de barrières partage le nom "barrier"). Effet par unité de largeur (bande unitaire),
    homogène à M_DC réparti. Réutilise `interp` (roue hors bande -> ordonnée d'extrémité).
    """
    out = {"total": 0.0}
    for ld in loads:
        e = ld["P"] * interp(li_x, li_y, ld["x"])
        out[ld["name"]] = out.get(ld["name"], 0.0) + e
        out["total"] += e
    return out


def edge_point_loads(geom, p_barrier, x_barrier, p_rail, x_rail):
    """Charges ponctuelles de bord SYMÉTRIQUES (barrière, glissière) — DC.

    Un pont porte ses équipements de bord aux DEUX rives : chaque charge d'intensité P
    est appliquée à `x` du bord GAUCHE et, en miroir, à `total - x` du même bord (rive
    droite). Une seule charge si les deux positions coïncident (centre). Les effets sont
    ensuite CUMULÉS par nom ('barrier', 'rail') par `point_load_effect` /
    `overhang_point_moment` — au porte-à-faux, la charge miroir ne contribue pas.
    """
    total = geom["total"]
    loads = []
    for name, p, x in (("barrier", p_barrier, x_barrier), ("rail", p_rail, x_rail)):
        loads.append({"name": name, "P": p, "x": x})
        x_mirror = total - x
        if abs(x_mirror - x) > 1e-9:
            loads.append({"name": name, "P": p, "x": x_mirror})
    return loads


def overhang_point_moment(geom, loads):
    """Moment statique des charges ponctuelles permanentes sur le porte-à-faux (`P·X`).

    Seules les charges effectivement sur le porte-à-faux (x < longeron de rive) comptent
    (la charge miroir de l'autre rive n'y contribue pas). Effets CUMULÉS par nom.
    Renvoie {name: Σ P·X} + "total".
    """
    girder0 = geom["girders"][0]
    out = {"total": 0.0}
    for ld in loads:
        lever = girder0 - ld["x"]
        e = ld["P"] * lever if lever > 1e-9 else 0.0
        out[ld["name"]] = out.get(ld["name"], 0.0) + e
        out["total"] += e
    return out


# ----------------------------------------------------------------------------------
# Charge roulante multi-voies (1 / 2 / 3 voies chargées)
# ----------------------------------------------------------------------------------
def lane_train(wheel, n_lanes, unit_system):
    """Train de roues transversal pour `n_lanes` voies chargées.

    Chaque voie apporte 2 roues espacées du `gage` ; les voies sont à entraxe
    `LANE_WIDTH`. Le balayage `sweep_effect` optimise ensuite le positionnement absolu
    du train sur la bande (roues hors bande ignorées nativement). Simplification
    pédagogique : train rigide de voies à entraxe constant (cf. doc 05).
    """
    lw = LANE_WIDTH[unit_system]
    gage = wheel["gage"]
    p = wheel["P"]
    axles = []
    for k in range(n_lanes):
        base = k * lw
        axles.append(Axle(base, p))
        axles.append(Axle(base + gage, p))
    return axles


def live_lane_cases(li_x, li_y, wheel, mpf_list, unit_system, which, e_length, impact):
    """Effet de charge roulante pour 1 / 2 / 3 voies chargées (MPF éditables).

    `which` ∈ {'positive', 'negative', 'governing'} : retient le max, le min, ou le pire
    de max/min du balayage. `mpf_list = [mpf1, mpf2, mpf3]`. Renvoie
    {cases: [{n_lanes, mpf, M_strip, M_LL, wheels}], governing: <cas dominant>,
    wheels: [...]}. Chaque cas porte SES roues au placement critique ; le top-level
    `wheels` reste celui du cas gouvernant (plus grand |M_LL|, MPF appliqué).
    """
    cases = []
    gov = None
    gov_wheels = []
    for n in (1, 2, 3):
        axles = lane_train(wheel, n, unit_system)
        env = sweep_effect(li_x, li_y, axles, impact=impact)
        if which == "positive":
            pick = env["max"]
        elif which == "negative":
            pick = env["min"]
        else:  # governing : pire de max / min
            pick = env["governing"]
        m_strip = pick["value"]
        mpf = mpf_list[n - 1]
        m_ll = mpf * m_strip / e_length
        case = {
            "n_lanes": n,
            "mpf": mpf,
            "M_strip": m_strip,
            "M_LL": m_ll,
            "wheels": pick["axle_positions"],
        }
        cases.append(case)
        if gov is None or abs(m_ll) > abs(gov["M_LL"]):
            gov = case
            gov_wheels = pick["axle_positions"]
    return {"cases": cases, "governing": gov, "wheels": gov_wheels}


# ----------------------------------------------------------------------------------
# Statique du porte-à-faux (console)
# ----------------------------------------------------------------------------------
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
    """Moment de charge répartie permanente au droit du longeron de rive (console : w·L²/2)."""
    lc = geom["overhang"]
    half = lc * lc / 2.0
    return {
        "dc": w_dc * half,
        "dw": w_dw * half,
        "total": (w_dc + w_dw) * half,
        "L_cant": lc,
    }


# ----------------------------------------------------------------------------------
# Section sur ligne d'influence (moment positif / négatif, effort tranchant)
# ----------------------------------------------------------------------------------
def _il_section(
    geom,
    target_x,
    quantity,
    which,
    strip_kind,
    wheel,
    mpf_list,
    w_dc,
    w_dw,
    point_loads,
    unit_system,
    impact,
):
    """Calcule une section sur ligne d'influence (moment +/- ou effort tranchant).

    `quantity` ∈ {'M', 'V'} ; `which` ∈ {'positive', 'negative', 'governing'} pour le
    balayage live ; `strip_kind` ∈ {'positive', 'negative'} = type de bande pour E.
    Combine : DC/DW répartis (full), charges ponctuelles DC (barrière/glissière), et la
    charge roulante 1/2/3 voies. Renvoie (section, vue d'IL pour le frontend).
    """
    li = compute_influence_line(
        [geom["total"]], quantity, target_x, dx=geom["dx"], supports=geom["girders"]
    )
    e_raw = strip_width(strip_kind, geom["spacing"], unit_system)
    e_length = strip_length(e_raw, unit_system)
    live = live_lane_cases(
        li["x"], li["y"], wheel, mpf_list, unit_system, which, e_length, impact
    )
    dead = distributed_effect(li["x"], li["y"], w_dc, w_dw)["full"]
    pts = point_load_effect(li["x"], li["y"], point_loads)
    il_view = {
        "x": li["x"],
        "y": li["y"],
        "target_x": float(target_x),
        "support_positions": li["meta"]["support_positions"],
        "wheels": live["wheels"],
        "dead_zones": dead["zones"],
    }
    section = {
        "M_DC": dead["dc"] + pts["total"],
        "M_DC_dist": dead["dc"],
        "M_DC_barrier": pts.get("barrier", 0.0),
        "M_DC_rail": pts.get("rail", 0.0),
        "M_DW": dead["dw"],
        "M_LL": live["governing"]["M_LL"],
        "M_strip": live["governing"]["M_strip"],
        "live_lanes": live["cases"],
        "E": e_raw,
        "E_length": e_length,
        "target_x": float(target_x),
    }
    return section, il_view


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
    mpf1=1.20,
    mpf2=1.00,
    mpf3=0.85,
    p_barrier=0.0,
    x_barrier=0.0,
    p_rail=0.0,
    x_rail=0.0,
    impact=True,
):
    """Dimensionne la dalle : moments/effort tranchant DC, DW, LL+IM et combinaison Mu.

    Sections : positif (mi-baie intérieure), négatif (longeron intérieur), effort
    tranchant (même longeron), porte-à-faux (statique). Réutilise `compute_influence_line`
    + `sweep_effect` + `distributed_effect` + `interp`. `gamma_*`, les trois MPF
    (1/2/3 voies) et les charges ponctuelles barrière/glissière sont éditables. Renvoie
    un dict structuré + les IL transversales.
    """
    geom = deck_geometry(n_girders, spacing, overhang, dx)
    wheel = design_wheel(unit_system)
    mpf_list = [mpf1, mpf2, mpf3]
    girders = geom["girders"]
    point_loads = edge_point_loads(geom, p_barrier, x_barrier, p_rail, x_rail)

    def factored(m_dc, m_dw, m_ll):
        return gamma_dc * m_dc + gamma_dw * m_dw + gamma_ll * m_ll

    # --- Positif : mi-baie intérieure (entre longerons 1 et 2, 0-indexés) ---
    bay_mid = girders[1] + spacing / 2.0
    pos, il_pos = _il_section(
        geom, bay_mid, "M", "positive", "positive",
        wheel, mpf_list, w_dc, w_dw, point_loads, unit_system, impact,
    )
    pos["Mu"] = factored(pos["M_DC"], pos["M_DW"], pos["M_LL"])

    # --- Négatif : au droit d'un longeron INTÉRIEUR (jamais le longeron de rive) ---
    neg, il_neg = _il_section(
        geom, girders[1], "M", "negative", "negative",
        wheel, mpf_list, w_dc, w_dw, point_loads, unit_system, impact,
    )
    neg["Mu"] = factored(neg["M_DC"], neg["M_DW"], neg["M_LL"])

    # --- Effort tranchant : même longeron intérieur (LI de V ; bande négative pour E) ---
    shear, il_shear = _il_section(
        geom, girders[1], "V", "governing", "negative",
        wheel, mpf_list, w_dc, w_dw, point_loads, unit_system, impact,
    )
    shear["Mu"] = factored(shear["M_DC"], shear["M_DW"], shear["M_LL"])

    # --- Porte-à-faux : statique (console), sans ligne d'influence ---
    oh_live = overhang_live_moment(geom, wheel, impact)
    oh_dead = overhang_dead_moment(geom, w_dc, w_dw)
    oh_pts = overhang_point_moment(geom, point_loads)
    e_oh = strip_width("overhang", oh_live["X"], unit_system)
    e_oh_len = strip_length(e_oh, unit_system)
    m_ll_oh = mpf1 * oh_live["M"] / e_oh_len  # essieu unique = 1 voie -> mpf1
    m_dc_oh = oh_dead["dc"] + oh_pts["total"]
    overhang_section = {
        "M_DC": m_dc_oh,
        "M_DC_dist": oh_dead["dc"],
        "M_DC_barrier": oh_pts.get("barrier", 0.0),
        "M_DC_rail": oh_pts.get("rail", 0.0),
        "M_DW": oh_dead["dw"],
        "M_LL": m_ll_oh,
        "M_strip": oh_live["M"],
        "E": e_oh,
        "E_length": e_oh_len,
        "X": oh_live["X"],
        "wheels": oh_live["wheels"],
    }
    overhang_section["Mu"] = factored(m_dc_oh, oh_dead["dw"], m_ll_oh)

    return {
        "geometry": geom,
        "wheel": {k: wheel[k] for k in ("P", "gage", "edge_offset", "im")},
        "factors": {
            "gamma_dc": gamma_dc,
            "gamma_dw": gamma_dw,
            "gamma_ll": gamma_ll,
            "mpf1": mpf1,
            "mpf2": mpf2,
            "mpf3": mpf3,
        },
        "sections": {
            "positive": pos,
            "negative": neg,
            "shear": shear,
            "overhang": overhang_section,
        },
        "influence_lines": {
            "positive": il_pos,
            "negative": il_neg,
            "shear": il_shear,
        },
        "unit_effort": effect_unit(unit_system, "M"),
        "unit_line": effect_unit_per_width(unit_system),
        "unit_shear": effect_unit(unit_system, "V"),
        "unit_shear_line": shear_unit_per_width(unit_system),
    }


# ----------------------------------------------------------------------------------
# Étude d'une section choisie par l'utilisateur (M et V à target_x)
# ----------------------------------------------------------------------------------
def infer_strip_kind(geom, target_x, quantity, tol=1e-9):
    """Type de bande E pour une section CHOISIE par l'utilisateur (extension de R9).

    L'AASHTO ne définit E que pour les moments positif/négatif (et le porte-à-faux,
    dont X est une grandeur par charge, pas par section). Règle retenue :
    - `V` → bande NÉGATIVE (pas de formule de bande en cisaillement, cf. doc 05 D14) ;
    - `M` au droit d'un longeron (tolérance `tol`) → bande NÉGATIVE ;
    - `M` ailleurs (baie ou porte-à-faux) → bande POSITIVE.
    """
    if quantity == "V":
        return "negative"
    if any(abs(target_x - g) <= tol for g in geom["girders"]):
        return "negative"
    return "positive"


def deck_section_study(
    n_girders,
    spacing,
    overhang,
    dx,
    target_x,
    w_dc,
    w_dw,
    unit_system,
    gamma_dc=1.25,
    gamma_dw=1.50,
    gamma_ll=1.75,
    mpf1=1.20,
    mpf2=1.00,
    mpf3=0.85,
    p_barrier=0.0,
    x_barrier=0.0,
    p_rail=0.0,
    x_rail=0.0,
    impact=True,
):
    """Étude pédagogique d'une section transversale choisie : M ET V à `target_x`.

    Pour chacune des deux grandeurs, calcule la ligne d'influence, l'effet des charges
    permanentes (DC réparti + barrière/glissière, DW — chargement complet), et la charge
    roulante pour 1/2/3 voies chargées avec, PAR CAS : les roues à leur placement
    critique et la combinaison Strength I (`Mu_n = γ_DC·M_DC + γ_DW·M_DW + γ_LL·M_LL_n`,
    M_DC/M_DW indépendants du nombre de voies). L'extrême retenu par cas est le
    `governing` SIGNÉ (le signe enseigne : M>0 en baie, M<0 au longeron). Le type de
    bande E est inféré par `infer_strip_kind` et renvoyé (`strip_kind`).

    Contrairement à `deck_design`, les charges permanentes peuvent être toutes nulles
    (étude « véhicules seuls »). Les erreurs moteur (target hors nœud, extrémité libre,
    mécanisme ≥ 2 DDL) remontent en ValueError/RuntimeError (→ 400 côté API).
    """
    geom = deck_geometry(n_girders, spacing, overhang, dx)
    wheel = design_wheel(unit_system)
    mpf_list = [mpf1, mpf2, mpf3]
    point_loads = edge_point_loads(geom, p_barrier, x_barrier, p_rail, x_rail)

    def factored(m_dc, m_dw, m_ll):
        return gamma_dc * m_dc + gamma_dw * m_dw + gamma_ll * m_ll

    sections = {}
    il_views = {}
    for key, quantity in (("moment", "M"), ("shear", "V")):
        strip_kind = infer_strip_kind(geom, target_x, quantity)
        section, il = _il_section(
            geom, target_x, quantity, "governing", strip_kind,
            wheel, mpf_list, w_dc, w_dw, point_loads, unit_system, impact,
        )
        section["strip_kind"] = strip_kind
        section["Mu"] = factored(section["M_DC"], section["M_DW"], section["M_LL"])
        for case in section["live_lanes"]:
            case["Mu"] = factored(section["M_DC"], section["M_DW"], case["M_LL"])
        sections[key] = section
        il_views[key] = il

    return {
        "geometry": geom,
        "wheel": {k: wheel[k] for k in ("P", "gage", "edge_offset", "im")},
        "factors": {
            "gamma_dc": gamma_dc,
            "gamma_dw": gamma_dw,
            "gamma_ll": gamma_ll,
            "mpf1": mpf1,
            "mpf2": mpf2,
            "mpf3": mpf3,
        },
        "target_x": float(target_x),
        "moment": sections["moment"],
        "shear": sections["shear"],
        "influence_lines": il_views,
        "unit_effort": effect_unit(unit_system, "M"),
        "unit_line": effect_unit_per_width(unit_system),
        "unit_shear": effect_unit(unit_system, "V"),
        "unit_shear_line": shear_unit_per_width(unit_system),
    }
