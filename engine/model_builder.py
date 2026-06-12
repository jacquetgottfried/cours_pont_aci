"""Construction programmatique du modèle éléments finis d'une poutre continue.

Génère automatiquement les coordonnées des nœuds, la numérotation des degrés de
liberté (DDL) et la matrice de connectivité `LM` (6 x n_elements) attendue par
`calcul_structure.assemblage_matrice_rigidite`.

Conventions (identiques aux notebooks) :
  - élément de portique 2D, 3 DDL par nœud : [Ux, Uy, Theta] ;
  - Ux est toujours bloqué (0) : poutre horizontale, pas d'effort axial ;
  - DDL numérotés à partir de 1 ; 0 = DDL bloqué (appui ou Ux) ;
  - LM[:, e] = [Uxi, Uyi, Thetai, Uxj, Uyj, Thetaj] pour l'élément e (nœud i -> nœud j).

Le « release » de Müller-Breslau (libération d'appui, rotule, coupure d'effort
tranchant) est inséré ici, automatiquement, à partir de (quantity, target_x).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

# Tolérance pour décider qu'une abscisse « tombe » sur un nœud.
_TOL = 1e-9

# Quantités supportées.
REACTION = "R"
MOMENT = "M"
SHEAR = "V"
_QUANTITIES = (REACTION, MOMENT, SHEAR)


@dataclass
class BeamModel:
    """Modèle assemblé prêt à résoudre.

    Attributs principaux consommés par `compute_influence_line` :
      - x_nodes        : abscisses des nœuds physiques (longueur n_nodes)
      - LM             : connectivité (6, n_elements), DDL 1-indexés (0 = bloqué)
      - n_ddl          : nombre de DDL libres
      - L_elem         : longueur d'un élément (dx)
      - release_dofs   : DDL (0-indexés) où appliquer le chargement Müller-Breslau
      - release_signs  : signes associés à `release_dofs`
      - quantity, target_x, support_positions : métadonnées
      - node_uy        : pour chaque nœud, (dof_gauche, dof_droite) du DDL vertical
                         (0-indexés, -1 si bloqué). Identiques sauf au nœud coupé (V).
    """

    x_nodes: np.ndarray
    LM: np.ndarray
    n_ddl: int
    L_elem: float
    release_dofs: list[int]
    release_signs: list[float]
    quantity: str
    target_x: float
    support_positions: list[float]
    node_uy: list[tuple[int, int]] = field(default_factory=list)
    release_node: int | None = None


def _build_nodes(spans, dx):
    """Génère les abscisses des nœuds et les positions d'appuis.

    spans : liste des longueurs de travées (>0).
    dx    : longueur d'un élément ; chaque appui doit tomber sur un nœud.
    """
    spans = [float(s) for s in spans]
    if not spans or any(s <= 0 for s in spans):
        raise ValueError("`spans` doit être une liste de longueurs strictement positives.")
    if dx <= 0:
        raise ValueError("`dx` doit être strictement positif.")

    L = sum(spans)
    n_elements = round(L / dx)
    if abs(n_elements * dx - L) > 1e-6:
        raise ValueError(f"La longueur totale {L} n'est pas un multiple de dx={dx}.")

    x_nodes = np.arange(n_elements + 1) * dx

    # Positions d'appuis = sommes cumulées des travées (A au début, puis chaque fin de travée).
    support_positions = [0.0]
    acc = 0.0
    for s in spans:
        acc += s
        support_positions.append(acc)

    # Chaque appui doit coïncider avec un nœud.
    for sp in support_positions:
        if not _is_on_node(sp, dx, L):
            raise ValueError(f"L'appui en x={sp} ne tombe pas sur un nœud (dx={dx}).")

    return x_nodes, support_positions, n_elements


def _is_on_node(x, dx, L):
    if x < -_TOL or x > L + _TOL:
        return False
    k = x / dx
    return abs(k - round(k)) < 1e-6


def _node_index(x, dx):
    return int(round(x / dx))


def build_model(spans, quantity, target_x, dx=1.0, supports=None):
    """Construit le `BeamModel` pour une ligne d'influence donnée.

    Paramètres
    ----------
    spans : list[float]
        Longueurs des travées. Les appuis sont placés aux extrémités de chaque travée
        (A à x=0, puis fin de chaque travée) — sauf si `supports` est fourni.
    quantity : {'R', 'M', 'V'}
        Réaction d'appui, moment fléchissant, ou effort tranchant.
    target_x : float
        Abscisse de la grandeur étudiée. Doit tomber sur un nœud. Pour 'R', doit être un appui.
    dx : float
        Longueur d'un élément (discrétisation).
    supports : list[float] | None
        Positions d'appuis explicites (override). Doivent tomber sur des nœuds.
    """
    if quantity not in _QUANTITIES:
        raise ValueError(f"quantity doit être l'une de {_QUANTITIES}, reçu {quantity!r}.")

    x_nodes, default_supports, n_elements = _build_nodes(spans, dx)
    L = float(x_nodes[-1])
    n_nodes = n_elements + 1

    support_positions = (
        [float(s) for s in supports] if supports is not None else default_supports
    )
    for sp in support_positions:
        if not _is_on_node(sp, dx, L):
            raise ValueError(f"L'appui en x={sp} ne tombe pas sur un nœud (dx={dx}).")

    if not _is_on_node(target_x, dx, L):
        raise ValueError(f"target_x={target_x} ne tombe pas sur un nœud (dx={dx}).")
    target_node = _node_index(target_x, dx)
    support_nodes = {_node_index(sp, dx) for sp in support_positions}

    if quantity == REACTION and target_node not in support_nodes:
        raise ValueError("Une réaction ne peut être calculée que sur un appui.")
    if quantity in (MOMENT, SHEAR) and (target_node == 0 or target_node == n_nodes - 1):
        raise ValueError("Moment/effort tranchant ne peuvent être calculés aux extrémités libres.")

    # --- Type de libération au nœud cible ---
    reaction_release = quantity == REACTION
    moment_release = quantity == MOMENT
    shear_release = quantity == SHEAR

    # --- Numérotation des DDL (1-indexés ; 0 = bloqué) ---
    # Pour chaque nœud on stocke les DDL vus depuis la gauche et depuis la droite.
    uy_left = [0] * n_nodes
    uy_right = [0] * n_nodes
    th_left = [0] * n_nodes
    th_right = [0] * n_nodes

    counter = 1
    for k in range(n_nodes):
        is_support = k in support_nodes

        # --- DDL vertical Uy ---
        if shear_release and k == target_node:
            uy_left[k] = counter
            counter += 1
            uy_right[k] = counter
            counter += 1
        else:
            if is_support and not (reaction_release and k == target_node):
                uy = 0  # appui : déplacement vertical bloqué
            else:
                uy = counter
                counter += 1
            uy_left[k] = uy_right[k] = uy

        # --- DDL rotation Theta ---
        if moment_release and k == target_node:
            th_left[k] = counter
            counter += 1
            th_right[k] = counter
            counter += 1
        else:
            th = counter
            counter += 1
            th_left[k] = th_right[k] = th

    n_ddl = counter - 1

    # --- Matrice de connectivité LM ---
    # Élément e relie le nœud e (côté droit) au nœud e+1 (côté gauche).
    LM = np.zeros((6, n_elements), dtype=int)
    for e in range(n_elements):
        i, j = e, e + 1
        LM[:, e] = [0, uy_right[i], th_right[i], 0, uy_left[j], th_left[j]]

    # --- Chargement Müller-Breslau (DDL 0-indexés) ---
    if reaction_release:
        dof = uy_left[target_node] - 1  # = uy_right, appui libéré
        release_dofs = [dof]
        release_signs = [1.0]
    elif moment_release:
        release_dofs = [th_left[target_node] - 1, th_right[target_node] - 1]
        release_signs = [1.0, -1.0]
    else:  # shear
        release_dofs = [uy_left[target_node] - 1, uy_right[target_node] - 1]
        release_signs = [-1.0, 1.0]

    node_uy = [(uy_left[k] - 1, uy_right[k] - 1) for k in range(n_nodes)]

    return BeamModel(
        x_nodes=x_nodes,
        LM=LM,
        n_ddl=n_ddl,
        L_elem=float(dx),
        release_dofs=release_dofs,
        release_signs=release_signs,
        quantity=quantity,
        target_x=float(target_x),
        support_positions=support_positions,
        node_uy=node_uy,
        release_node=target_node,
    )
