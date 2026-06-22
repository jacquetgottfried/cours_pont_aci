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

An educational structural-engineering project that computes **influence lines** (*lignes d'influence*) for a multi-span continuous beam, plus the effect of **HL-93 moving loads** (AASHTO LRFD), using the **Müller-Breslau method** implemented through the **direct stiffness method** (2D frame finite elements). It is a 3-layer app: a Python/NumPy engine, a FastAPI backend, and a static HTML/JS frontend. All narrative, comments, and docstrings are in **French**.

The five [docs/](docs/) files are the **source of truth** and are `@`-imported at the top of this file — read them before changing behavior. `04_LOGIQUE_METIER.md` (business rules / invariants) and `05_DECISION_REJETEE.md` (rejected approaches) are authoritative: contradict them only after flagging it.

## Commands

- Install deps: `pip install -r requirements.txt`
- Run the API: `uvicorn backend.main:app --reload` (docs at http://127.0.0.1:8000/docs)
- Full app on Windows: `run.bat` (installs deps if needed, starts the API in a new window, opens the frontend)
- Frontend: open [frontend/index.html](frontend/index.html) directly in a browser (no build step; Chart.js loaded from CDN). It calls the API base shown in its form field (default `http://127.0.0.1:8000`).
- All tests: `pytest tests/`
- One test: `pytest tests/test_influence_line.py::test_reactions_somme_egale_un`

## Architecture (the big picture)

Data flow: **frontend form → `POST /influence-line` (or `/vehicle-envelope`) → engine → `{x, y, meta}` JSON → Chart.js**.

- [engine/model_builder.py](engine/model_builder.py) — `build_model(spans, quantity, target_x, dx, supports)` generates node coordinates, DOF numbering, and the `LM` connectivity matrix **programmatically**, and inserts the Müller-Breslau **release** for the requested quantity. This is the structuring fix of the project: the notebooks' hand-written `LM` matrices were buggy and non-parametric (see `05` / D2).
- [engine/influence_line.py](engine/influence_line.py) — `compute_influence_line(...)`, the single generic function that replaces all 12 notebooks. It assembles `K` from `model.LM`, applies the unit release load, solves `K·U = P`, normalizes (Maxwell-Betti), and reconstructs the nodal ordinates.
- [engine/vehicle_loads.py](engine/vehicle_loads.py) — HL-93 truck/tandem catalog, `load_effect`, and `sweep_effect` (slides the vehicle and returns max / min / governing effect).
- [calcul_structure.py](calcul_structure.py) (root) — low-level FE bricks (`matrice_elementaire`, `rotation_matrice`, `assemblage_matrice_rigidite`, …), **reused unmodified** by the engine. [utils.py](utils.py) is only a matrix pretty-printer.
- [backend/main.py](backend/main.py) — thin HTTP adapter over the engine; maps engine `ValueError`/`RuntimeError` → HTTP 400, Pydantic validation → 422. Schemas in [backend/schemas.py](backend/schemas.py).
- `*.ipynb` notebooks — **historical / pedagogical only; do NOT use as the engine.**

### The `LM` matrix (central data structure)

Shape `(6, n_elements)`; `LM[:, e]` lists the 6 global DOF numbers for element `e` in order `[Uxi, Uyi, Thetai, Uxj, Uyj, Thetaj]`. DOFs are **1-indexed; `0` = restrained**. Conventions: `Ux` is always `0` (horizontal beam, no axial); a support's `Uy` is `0` (blocked). The release works by **adding** DOFs at the target node: `R` frees the support's `Uy`; `M` doubles `Theta` (rotule); `V` doubles `Uy` (cut). `model.release_dofs`/`release_signs` carry the unit-load pattern; `model.node_uy` maps each node to its (left, right) vertical DOF so the solver can rebuild `y`.

## Gotchas & invariants

- **Mechanism / singular matrix**: releasing on a 2-support span (single simply-supported span: reaction, hinge or cut) makes the *released* structure a **1-DOF mechanism** → singular `K`. The influence line **is** that kinematic mode: `_solve_release` (in [engine/influence_line.py](engine/influence_line.py)) extracts it from the null space of `K`, oriented so the release load does positive work (`P·U>0`). This is the imposed-displacement form of Müller-Breslau. A **≥2-DOF mechanism** (truly unstable, e.g. no support left) still raises `RuntimeError`.
- **Shear discontinuity**: for `V`, the `x` array is **doubled** at the cut to render the jump; `y_nodes` is the un-doubled per-node array. `vehicle_loads.interp` keeps the worse side at a jump.
- **Validation strategy**: the historical CSVs in `resultats/` are **mostly wrong** (buggy hand `LM`); only `LIVE_resultats.csv` is correct. Tests therefore assert **analytical invariants** (sum of reaction LIs = 1 everywhere; LI = 0 at every support; unit value-jump for `V`; unit slope-jump for `M`) — never the CSVs (see `05` / D4). 65 tests across [tests/](tests/) must stay green (LI invariants, HL-93 loads SI/US, API integration).

## Conventions

- Commit messages use bracketed prefixes: `[ADD]`, `[BUGFIX]`, `[CHANGE]`.
- Notebook naming `LI<quantity><point>`: `LIR*` reaction, `LIM*` moment, `LIV*` shear; A/B/C are supports, E/F interior points.
