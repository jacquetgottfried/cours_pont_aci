"""Calcul générique d'une ligne d'influence par la méthode de Müller-Breslau.

Une seule fonction `compute_influence_line(...)` remplace les 12 notebooks. Elle
réutilise les briques de `calcul_structure.py` (matrice élémentaire, assemblage)
et le constructeur de modèle programmatique de `model_builder.py`.

Principe (méthode matricielle des déplacements) :
  - on insère la libération de Müller-Breslau correspondant à la grandeur cherchée
    (appui libéré pour R, rotule pour M, coupure pour V) ;
  - on applique un chargement unitaire au DDL libéré et on résout K·U = P ;
  - la déformée, normalisée (réciprocité de Maxwell-Betti), EST la ligne d'influence.

Cas particulier — travée simple (2 appuis) : toute libération (réaction, rotule ou
coupure) transforme la structure en **mécanisme à 1 degré de liberté** (matrice K
singulière). La ligne d'influence EST alors le mode cinématique de ce mécanisme : on
l'extrait du noyau de K, orienté pour que la charge de libération y travaille
positivement (cohérent avec la solution de K·U = P quand celle-ci existe). C'est la
forme « déplacement imposé » du principe de Müller-Breslau (cf. 05).
"""

from __future__ import annotations

import os
import sys

import numpy as np

# `calcul_structure.py` est à la racine du projet, un niveau au-dessus de ce package.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from calcul_structure import (  # noqa: E402
    assemblage_matrice_rigidite,
    matrice_elementaire,
    rotation_matrice,
)

from .model_builder import REACTION, SHEAR, build_model  # noqa: E402

_NORM_TOL = 1e-12


def _solve_release(K, P, quantity, target_x):
    """Résout K·U = P, ou renvoie le mode du mécanisme si K est singulière.

    - Structure stable après libération (cas indéterminé / multi-travées) : K est
      régulière, on résout directement `K·U = P`.
    - Structure rendue mécanisme par la libération (travée simple : réaction, rotule ou
      coupure) : K a un noyau de dimension 1. La ligne d'influence EST ce mode du noyau
      (la déformée du mécanisme). On l'oriente de sorte que `P·U > 0` — la charge de
      libération y travaille positivement, exactement comme `K⁻¹·P` quand il existe.
    - Mécanisme à ≥ 2 degrés de liberté : structure réellement instable → erreur.
    """
    n = K.shape[0]
    sv = np.linalg.svd(K, compute_uv=False)
    tol = sv[0] * n * np.finfo(float).eps
    deficiency = int(np.count_nonzero(sv <= tol))
    if deficiency == 0:
        return np.linalg.solve(K, P)
    if deficiency == 1:
        _, _, vt = np.linalg.svd(K)
        mode = vt[-1].copy()  # vecteur du noyau (plus petite valeur singulière)
        if np.dot(P, mode) < 0.0:
            mode = -mode
        return mode
    raise RuntimeError(
        "Structure instable : la libération crée un mécanisme à plusieurs degrés de "
        "liberté (rang de la matrice de rigidité trop faible). "
        f"(quantity={quantity}, target_x={target_x})"
    )


def compute_influence_line(
    spans,
    quantity,
    target_x,
    dx=1.0,
    supports=None,
    E=1.0,
    I=1.0,
    A=1.0,
):
    """Calcule la ligne d'influence d'une poutre continue.

    Paramètres
    ----------
    spans : list[float]      Longueurs des travées (les appuis sont aux extrémités de travée).
    quantity : {'R','M','V'} Réaction, moment fléchissant, ou effort tranchant.
    target_x : float         Abscisse de la grandeur (sur un nœud ; un appui pour 'R').
    dx : float               Discrétisation (longueur d'un élément).
    supports : list[float]   Positions d'appuis explicites (sinon déduites de `spans`).
    E, I, A : float          Propriétés (sans effet sur la forme normalisée ; défaut 1).

    Retour
    ------
    dict avec :
      - x, y           : abscisses et ordonnées de la ligne d'influence (listes).
                         Au point de coupure (V) le x est dédoublé pour montrer le saut.
      - y_nodes        : ordonnées aux nœuds physiques (gauche du saut), longueur n_nodes.
      - normalization  : valeur de normalisation (réaction, ou somme des relâchements).
      - meta           : quantity, target_x, support_positions, n_ddl, n_elements.
    """
    model = build_model(spans, quantity, target_x, dx=dx, supports=supports)

    # Matrice élémentaire (identique pour tous les éléments : même longueur, theta = 0).
    k_local = matrice_elementaire(E, I, A, model.L_elem)
    rot = rotation_matrice(0)
    k_global_elem = rot.T @ k_local @ rot

    n_ddl = model.n_ddl
    K = np.zeros((n_ddl, n_ddl), dtype=float)
    for e in range(model.LM.shape[1]):
        K = assemblage_matrice_rigidite(model.LM, e, K, k_global_elem)

    # Chargement de Müller-Breslau.
    P = np.zeros(n_ddl, dtype=float)
    for dof, sign in zip(model.release_dofs, model.release_signs):
        P[dof] += sign

    # Résolution robuste : régulière si la structure reste stable, sinon mode du
    # mécanisme (travée simple) — cf. _solve_release et l'en-tête du module.
    U = _solve_release(K, P, quantity, target_x)

    # Normalisation (réciprocité de Maxwell-Betti).
    if quantity == REACTION:
        normalization = U[model.release_dofs[0]]
    else:  # MOMENT ou SHEAR : somme des relâchements en valeur absolue
        normalization = sum(abs(U[d]) for d in model.release_dofs)
    if abs(normalization) < _NORM_TOL:
        raise RuntimeError(
            "Normalisation nulle : structure instable ou libération invalide "
            f"(quantity={quantity}, target_x={target_x})."
        )
    LI = U / normalization

    # Reconstruction de l'ordonnée verticale nœud par nœud.
    # Un appui (DDL Uy bloqué = -1) donne une ordonnée nulle : zéro garanti aux appuis.
    x_out, y_out, y_nodes = [], [], []
    for k, x in enumerate(model.x_nodes):
        uy_l, uy_r = model.node_uy[k]
        val_l = LI[uy_l] if uy_l >= 0 else 0.0
        val_r = LI[uy_r] if uy_r >= 0 else 0.0
        y_nodes.append(float(val_l))
        if quantity == SHEAR and k == model.release_node:
            # Coupure : saut vertical -> on dédouble l'abscisse.
            x_out.extend([float(x), float(x)])
            y_out.extend([float(val_l), float(val_r)])
        else:
            x_out.append(float(x))
            y_out.append(float(val_l))

    return {
        "x": x_out,
        "y": y_out,
        "y_nodes": y_nodes,
        "normalization": float(normalization),
        "meta": {
            "quantity": quantity,
            "target_x": float(target_x),
            "support_positions": model.support_positions,
            "n_ddl": n_ddl,
            "n_elements": int(model.LM.shape[1]),
        },
    }
