## Context Engineering — lire en priorité

@docs/01_ARCHITECTURE.md
@docs/02_CONTRAT_API.md
@docs/03_ETAT_ACTUEL.md
@docs/04_LOGIQUE_METIER.md
@docs/05_DECISION_REJETEE.md

## Règle principale
Si une modification contredit 04_LOGIQUE_METIER, signale-le avant d'agir.
Le fichier 05 est consulté avant toute proposition d'architecture alternative.

## Fin de session — Actualiser les docs
Quand l'utilisateur tape ou demande une mise à jour des docs, tu dois :
1. Lire le travail effectué dans cette session
2. Mettre à jour 03_ETAT_ACTUEL.md (état courant uniquement, max 30 lignes)
3. Appender dans 02_CONTRAT_API.md si une route a changé
4. Appender dans 04_LOGIQUE_METIER.md si une règle métier a été validée
5. Appender dans 05_DECISION_REJETEE.md si une approche a été abandonnée
6. Confirmer les fichiers modifiés

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An educational structural-engineering project that computes **influence lines** (*lignes d'influence*) for a multi-span continuous beam (supports A, B, C) using the **Müller-Breslau method**, implemented through the **direct stiffness method** (2D frame finite elements). All narrative and comments are in French.

## Running

There is no build, test, or lint tooling, and no dependency manifest. The code runs as Jupyter notebooks importing a small local Python module.

- Dependencies (install manually): `numpy`, `matplotlib` (and stdlib `math`).
- Each notebook is self-contained: open it and run all cells top to bottom. The last cell writes results to `./resultats/<NAME>_resultats.csv` via `np.savetxt`.
- Notebooks start with `from calcul_structure import *`, so edits to [calcul_structure.py](calcul_structure.py) require restarting the kernel (or re-running the import cell) to take effect.

## Core library

[calcul_structure.py](calcul_structure.py) is the entire FE engine. Key pieces:

- `matrice_elementaire(E, I, A, L)` — 6×6 elementary stiffness matrix of a 2D frame element (axial + Euler-Bernoulli bending), DOF order per node `[Ux, Uy, Theta]`.
- `rotation_matrice(theta)` — element-to-global rotation; `theta=0` for the horizontal beams used throughout.
- `assemblage_matrice_rigidite(LM, element, K_global, mat_elem_global)` — adds one element's contribution into the global stiffness matrix using the `LM` connectivity map.
- `assemblage_vecteur_nodal(...)` / `obtention_du_deplacement_local(...)` — assemble the global nodal force vector and extract local element displacements.

The **`LM` matrix is the central data structure**: shape `(6, n_elements)`, where `LM[:, e]` lists the 6 global DOF numbers (1-indexed; `0` = restrained/no DOF) for element `e` in the order `[Uxi, Uyi, Thetai, Uxj, Uyj, Thetaj]`. Assembly and displacement extraction both key off it.

[utils.py](utils.py) is only a pretty-printer for matrices.

## Influence-line notebooks

One notebook per influence line. Naming convention `LI<quantity><point>`:

- `LIR*` — support **R**eaction (A, B, C)
- `LIM*` — bending **M**oment (B, C, E, F)
- `LIV*` — shear (effort tranchant, **V**) (B, C, E, F)
- Points: A/B/C are supports; E/F are interior points (F = midspan of span AB).

Standard workflow inside each notebook: define node coordinates `XY` → build elementary stiffness + rotation → assemble `K_global` → set a **unit nodal load** vector `P_global` at the DOF of interest (this is the Müller-Breslau application) → solve `U = np.linalg.solve(K_global, P_global)` → map the vertical displacements into the influence-line array `LI` → plot → save CSV.

The beam is **discretized into 40 unit-length elements** with dimensionless properties `E = I = A = L = 1`; the resulting deflected shape *is* the influence line. When editing a notebook, the hand-written `LM` assignments, the `K_global`/`P_global` sizes, and the index slices that copy `LI` into the plotted `y` array must all stay consistent with the node/DOF numbering — these are the usual source of bugs.

## Application notebooks

- [application.ipynb](application.ipynb) — worked example of the stiffness method on a small frame with **real** material/section values (`E=2e8`, etc.), showing both explicit block assembly and the `LM`-based assembly.
- [application_poutre_continue_discretise.ipynb](application_poutre_continue_discretise.ipynb) — the full discretized continuous-beam application.

## Conventions

- Commit messages use bracketed prefixes: `[ADD]`, `[BUGFIX]`, `[CHANGE]`.
- Output CSVs live in `resultats/`; figures referenced by [README.md](README.md) live in `images/`.
