"""Charges réparties permanentes (DC poids propre, DW revêtement) sur une ligne d'influence.

Réutilise EXACTEMENT le moteur de ligne d'influence (Müller-Breslau) : aucun nouveau
code éléments finis. L'effet d'une charge répartie d'intensité `w` sur une grandeur de
ligne d'influence d'ordonnée `η(x)` est, par définition :

    effet = w · ∫ η(x) dx   (sur la longueur chargée)

Deux usages, tous deux fournis :
  - **Charge permanente (toute la poutre)** : on intègre `η` sur toute la poutre.
    Numériquement IDENTIQUE à une analyse EF chargée sur toutes les travées : c'est
    donc le résultat correct d'une vraie charge permanente DC/DW.
  - **Chargement alterné (enveloppe défavorable)** : pour maximiser on ne charge que là
    où `η > 0` → `max = w·∫η⁺` ; pour minimiser, là où `η < 0` → `min = w·∫η⁻`.
    La ligne d'influence donne ELLE-MÊME la pire configuration (chargement de travées
    alternées classique) : pas de recherche par force brute. On renvoie aussi les
    **zones chargées** (intervalles de `x` du signe voulu) pour les afficher.

Unités : le module est AGNOSTIQUE (cf. doc 04 R6/D7). `w` est un simple nombre ; l'unité
d'effet est dérivée à part par `vehicle_loads.effect_unit` (force pour R/V — `η` sans
dimension ; force × longueur pour M — `η` a la dimension d'une longueur).

DC et DW ne sont PAS factorisés ici (pas de coefficient 1.25/1.50…) : on renvoie l'effet
de chacun et leur somme. La charge de voie répartie (9.3 kN/m) reste hors périmètre.
"""

from __future__ import annotations

from .influence_line import compute_influence_line

# Tolérance : largeur de segment dédoublé (saut d'effort tranchant) et aire négligeable.
_TOL = 1e-9


def _seg_signed(x0, y0, x1, y1, sign):
    """Aire (signée) et zone du sous-segment où `sign·η ≥ 0`, sur [x0, x1].

    `sign` vaut +1 (partie positive) ou -1 (partie négative). Si le segment change de
    signe, on coupe au passage par zéro (racine de l'interpolation linéaire) et on ne
    retient que le sous-triangle du bon côté. Retourne (aire, zone) ; `zone` est None
    si le segment ne contribue pas du côté demandé.
    """
    dxs = x1 - x0
    s0, s1 = sign * y0, sign * y1
    if s0 >= 0 and s1 >= 0:  # tout le segment est du bon côté
        area = 0.5 * (y0 + y1) * dxs
        return area, ([x0, x1] if abs(area) > _TOL else None)
    if s0 <= 0 and s1 <= 0:  # rien du bon côté
        return 0.0, None
    # à cheval : on coupe au passage par zéro
    xr = x0 - y0 * dxs / (y1 - y0)
    if s0 > 0:  # bon côté = [x0, xr]
        return 0.5 * y0 * (xr - x0), [x0, xr]
    return 0.5 * y1 * (x1 - xr), [xr, x1]  # bon côté = [xr, x1]


def _merge_zones(zones):
    """Fusionne les intervalles jointifs (issus de segments consécutifs)."""
    if not zones:
        return []
    merged = [list(zones[0])]
    for z in zones[1:]:
        if abs(z[0] - merged[-1][1]) <= _TOL:
            merged[-1][1] = z[1]
        else:
            merged.append(list(z))
    return [[float(a), float(b)] for a, b in merged]


def integrate_il(x, y, sign=0):
    """Intègre la ligne d'influence affine par morceaux : `∫η dx` et zones chargées.

    - `sign = 0`  : `∫η dx` sur toute la poutre (charge permanente) ; `zones = [[x0, xL]]`.
    - `sign = +1` : `∫η⁺ dx` (parties positives) avec les intervalles chargés.
    - `sign = -1` : `∫η⁻ dx` (parties négatives, valeur ≤ 0) avec les intervalles chargés.

    Les segments dédoublés au point de coupure d'un effort tranchant (x[i] == x[i+1])
    sont IGNORÉS — comme dans `vehicle_loads.interp` — pour ne pas compter le saut.
    Garanties : `∫η⁺ + ∫η⁻ == ∫η` et `∫η⁺ ≥ ∫η ≥ ∫η⁻`.
    """
    total = 0.0
    zones = []
    for i in range(len(x) - 1):
        x0, x1 = x[i], x[i + 1]
        dxs = x1 - x0
        if dxs <= _TOL:
            continue  # segment dégénéré (le saut d'effort tranchant lui-même)
        y0, y1 = y[i], y[i + 1]
        if sign == 0:
            total += 0.5 * (y0 + y1) * dxs
            continue
        area, zone = _seg_signed(x0, y0, x1, y1, sign)
        total += area
        if zone is not None:
            zones.append(zone)
    if sign == 0:
        return total, [[float(x[0]), float(x[-1])]]
    return total, _merge_zones(zones)


def _component(w_dc, w_dw, integral, zones):
    """Effets DC, DW et somme pour une intégrale donnée (effet linéaire en `w`)."""
    return {
        "dc": w_dc * integral,
        "dw": w_dw * integral,
        "total": (w_dc + w_dw) * integral,
        "zones": zones,
    }


def distributed_effect(x, y, w_dc, w_dw):
    """Effet des charges réparties DC/DW sur la ligne d'influence `(x, y)`.

    Retourne {full, max, min, governing, w_dc, w_dw} où chacun de full/max/min est
    {dc, dw, total, zones} :
      - full : toute la poutre chargée (charge permanente) ;
      - max  : chargement alterné des zones où `η > 0` (effet le plus positif) ;
      - min  : chargement alterné des zones où `η < 0` (effet le plus négatif) ;
      - governing : celui de max/min de plus grande valeur absolue.
    L'effet étant linéaire en `w`, DC, DW et la somme partagent la même intégrale et
    les mêmes zones.
    """
    int_pos, zones_pos = integrate_il(x, y, +1)
    int_neg, zones_neg = integrate_il(x, y, -1)
    int_full, zones_full = integrate_il(x, y, 0)

    full = _component(w_dc, w_dw, int_full, zones_full)
    e_max = _component(w_dc, w_dw, int_pos, zones_pos)
    e_min = _component(w_dc, w_dw, int_neg, zones_neg)
    governing = e_max if abs(e_max["total"]) >= abs(e_min["total"]) else e_min

    return {
        "full": full,
        "max": e_max,
        "min": e_min,
        "governing": governing,
        "w_dc": w_dc,
        "w_dw": w_dw,
    }


def distributed_envelope(spans, quantity, w_dc, w_dw, dx=1.0, supports=None):
    """Ligne d'enveloppe d'une charge répartie DC/DW le long de la poutre.

    On balaie la section étudiée sur tous les nœuds ; à chaque section on calcule la
    ligne d'influence de `quantity` puis on intègre. Le signe de la LI donne directement
    le pire chargement alterné (pas de recherche de configuration).

    Retourne {positions, max, min, full, governing, midspan_points, support_points,
    quantity, w_dc, w_dw} :
      - max/min/full : effet total (DC+DW) à chaque section (chargement alterné +/- et
        permanent) ;
      - governing : extremum de plus grande valeur absolue {value, position, zones, sign} ;
      - midspan_points : max positif par travée (moment max à mi-travée) ;
      - support_points : min négatif au droit de chaque appui intérieur (moment max sur appui).
    Les sections où la libération est un mécanisme (ex. réaction de travée simple) sont
    silencieusement ignorées : l'éligibilité reste gérée par `model_builder`.
    """
    L = float(sum(float(s) for s in spans))
    n_elements = round(L / dx)
    w = w_dc + w_dw

    positions, max_eff, min_eff, full_eff = [], [], [], []
    zones_max, zones_min = [], []
    support_positions = None

    for i in range(n_elements + 1):
        target_x = i * dx
        try:
            li = compute_influence_line(
                spans, quantity, target_x, dx=dx, supports=supports
            )
        except (ValueError, RuntimeError):
            continue  # section non éligible (extrémité libre, mécanisme…)
        int_pos, zones_pos = integrate_il(li["x"], li["y"], +1)
        int_neg, zones_neg = integrate_il(li["x"], li["y"], -1)
        int_full, _ = integrate_il(li["x"], li["y"], 0)
        positions.append(float(target_x))
        max_eff.append(w * int_pos)
        min_eff.append(w * int_neg)
        full_eff.append(w * int_full)
        zones_max.append(zones_pos)
        zones_min.append(zones_neg)
        if support_positions is None:
            support_positions = li["meta"]["support_positions"]

    if not positions:
        raise ValueError(
            f"Aucune section valide pour l'enveloppe (quantity={quantity!r}, dx={dx})."
        )

    # Gouvernant : plus grande valeur absolue parmi tous les max (positifs) et min (négatifs).
    i_pos = max(range(len(positions)), key=lambda k: max_eff[k])
    i_neg = min(range(len(positions)), key=lambda k: min_eff[k])
    if abs(max_eff[i_pos]) >= abs(min_eff[i_neg]):
        governing = {
            "value": max_eff[i_pos],
            "position": positions[i_pos],
            "zones": zones_max[i_pos],
            "sign": 1,
        }
    else:
        governing = {
            "value": min_eff[i_neg],
            "position": positions[i_neg],
            "zones": zones_min[i_neg],
            "sign": -1,
        }

    # Points caractéristiques : max positif par travée, min négatif sur appui intérieur.
    midspan_points = []
    for a, b in zip(support_positions[:-1], support_positions[1:]):
        idxs = [k for k, p in enumerate(positions) if a - _TOL < p < b + _TOL]
        if not idxs:
            continue
        k_best = max(idxs, key=lambda k: max_eff[k])
        midspan_points.append(
            {"position": positions[k_best], "value": max_eff[k_best]}
        )

    pos_index = {round(p, 9): k for k, p in enumerate(positions)}
    support_points = []
    for s in support_positions[1:-1]:  # appuis intérieurs uniquement
        k = pos_index.get(round(s, 9))
        if k is not None:
            support_points.append({"position": positions[k], "value": min_eff[k]})

    return {
        "positions": positions,
        "max": max_eff,
        "min": min_eff,
        "full": full_eff,
        "governing": governing,
        "midspan_points": midspan_points,
        "support_points": support_points,
        "quantity": quantity,
        "w_dc": w_dc,
        "w_dw": w_dw,
    }
