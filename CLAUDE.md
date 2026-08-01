# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## What this is

An educational structural-engineering project (AASHTO LRFD bridge course) that computes
**influence lines** (*lignes d'influence*) for a multi-span continuous beam by the
**Müller-Breslau method**, implemented through the **direct stiffness method** (2D frame finite
elements), then applies them to **HL-93 moving loads**, **DC/DW distributed dead loads**, and
**deck-slab design** (AASHTO equivalent strip method). Three layers: Python/NumPy engine → FastAPI
backend → React/TS frontend. All narrative, comments, docstrings and UI text are in **French**.

The five [docs/](docs/) files are the **source of truth** and are `@`-imported above — read them
before changing behavior. `04_LOGIQUE_METIER.md` (business rules `R1`–`R10`) and
`05_DECISION_REJETEE.md` (rejected approaches `D1`–`D16`) are authoritative: contradict them only
after flagging it.

## Commands

Engine / backend (Python):
- Install deps: `pip install -r requirements.txt` (a `.venv/` is present; `run.bat` prefers it)
- Run the API: `uvicorn backend.main:app --reload` — interactive docs at http://127.0.0.1:8000/docs
- All tests: `pytest tests/` (**157 tests**)
- One file / one test: `pytest tests/test_deck_study.py` ·
  `pytest tests/test_influence_line.py::test_reactions_somme_egale_un`
- By keyword: `pytest tests/ -k porte_a_faux`

Frontend `web/` (React + TS + Vite — the **current, main** UI):
- `cd web && npm install && npm run dev` → http://127.0.0.1:5173
- Checks: `npm run typecheck` (`tsc -b`) · `npm run lint` (oxlint) · `npm run test`
  (Vitest, **19 tests**) · `npm run build`
- One Vitest file: `npm run test -- src/lib/units.test.ts`
- API base URL: `VITE_API_BASE` (default `http://127.0.0.1:8000`); CORS is fully open on the backend

Whole app on Windows: `run.bat` — installs Python and npm deps if missing, then starts the backend
(`:8000`) and the Vite dev server (`:5173`) in two new windows.

## Architecture (the big picture)

Data flow: **React component → React Query hook → `web/src/api/*` fetch → FastAPI route → engine
function → JSON (`{x, y, y_nodes, meta}` or deck sections) → Recharts (curves) + Konva (editors)**.

Calculation layer (Python) — pure calc, no HTTP anywhere in it:
- [calcul_structure.py](calcul_structure.py) (root) — low-level FE bricks (`matrice_elementaire`,
  `rotation_matrice`, `assemblage_matrice_rigidite`, …), **reused unmodified** by the engine.
  [utils.py](utils.py) is only a matrix pretty-printer.
- [engine/model_builder.py](engine/model_builder.py) — `build_model(spans, quantity, target_x, dx,
  supports)` generates node coordinates, DOF numbering and the `LM` connectivity matrix
  **programmatically**, and inserts the Müller-Breslau **release** for the requested quantity. This
  is the structuring fix of the project: the notebooks' hand-written `LM` matrices were buggy and
  non-parametric (see `05`/D2).
- [engine/influence_line.py](engine/influence_line.py) — `compute_influence_line(...)`, the single
  generic function that replaced all 12 notebooks. Assembles `K` from `model.LM`, applies the unit
  release load, solves through `_solve_release`, normalizes (Maxwell-Betti), and reconstructs the
  nodal ordinates.
- [engine/vehicle_loads.py](engine/vehicle_loads.py) — HL-93 truck/tandem catalog (both official SI
  **and** US value sets), `interp`, `load_effect`, `sweep_effect` (slides the vehicle → max / min /
  governing effect), `effect_unit`.
- [engine/distributed_loads.py](engine/distributed_loads.py) — DC/DW dead loads as `effet = w·∫η dx`
  (`integrate_il`, `distributed_effect`, `distributed_envelope`). **No new FE code**: the sign of η
  itself gives the worst pattern loading (`04` R8, `05` D8).
- [engine/deck.py](engine/deck.py) — the deck slab is a **transverse** continuous beam supported by
  the girders, so it calls `compute_influence_line` again: `deck_design` (4 fixed sections) and
  `deck_section_study` (user-chosen `target_x`, M **and** V in one call), plus AASHTO
  `strip_width`/`strip_length`, the derived design wheel, the multi-lane wheel train, and
  `edge_point_loads`.
- [backend/main.py](backend/main.py) — thin HTTP adapter, 9 routes: `/health`, `/influence-line`,
  `/vehicles`, `/vehicle-envelope`, `/distributed-effect`, `/distributed-envelope`,
  `/deck-catalog`, `/deck-design`, `/deck-section-study`. Maps engine `ValueError`/`RuntimeError`
  → HTTP 400, Pydantic validation → 422. Schemas in [backend/schemas.py](backend/schemas.py); the
  full payload/response contract lives in `docs/02_CONTRAT_API.md`.

Presentation layer [web/src/](web/src/) — **zero calculation in TypeScript** (`05`/D11):
- `api/` is the **only** place that talks to the network (`client.ts` fetch helpers + `types.ts`
  typed contract + `beam.ts` / `deck.ts`). Components never `fetch`.
- `features/beam/` = tab « Poutre longitudinale » (shared geometry + *HL-93* and *DC/DW*
  sub-tabs); `features/deck/` = tab « Tablier » (live `/deck-design` + « Étude d'une section »
  panel). `use*.ts` hooks isolate React Query from rendering: live inputs use `useQuery`, the
  study's « Calculer » button uses `useMutation` (deliberate, `05`/D16-d).
- `lib/` holds pure helpers only (unit labels, valid targets) — never engineering formulas.
  `@/` is aliased to `web/src/`.

Historical — do **not** use as the engine: [legacy/](legacy/) (the 13 notebooks, moved out of the
root), [resultats/](resultats/) (CSVs), [frontend/](frontend/) (old vanilla + Chart.js UI, kept as a
porting reference until the React app reaches parity — HL-93 envelope chart and CSV exports are
still unported).

### The `LM` matrix (central data structure)

Shape `(6, n_elements)`; `LM[:, e]` lists the 6 global DOF numbers for element `e` in order
`[Uxi, Uyi, Thetai, Uxj, Uyj, Thetaj]`. DOFs are **1-indexed; `0` = restrained**. Conventions: `Ux`
is always `0` (horizontal beam, no axial); a support's `Uy` is `0` (blocked). The release works by
**adding** DOFs at the target node: `R` frees the support's `Uy`; `M` doubles `Theta` (rotule); `V`
doubles `Uy` (cut). `model.release_dofs`/`release_signs` carry the unit-load pattern;
`model.node_uy` maps each node to its (left, right) vertical DOF so the solver can rebuild `y`.

## Gotchas & invariants

- **`tests/` is listed in `.gitignore` and is NOT tracked by git**: the 157 tests exist only in the
  working tree. Don't assume a fresh clone has them, and don't "fix" this by committing them
  without asking.
- **No `conftest.py`**: each test file — like `backend/main.py` and `engine/influence_line.py` —
  bootstraps `sys.path` with the project root itself. New test files must repeat that idiom.
- **Mechanism / singular matrix**: releasing on a 2-support span (single simply-supported span:
  reaction, hinge or cut) makes the *released* structure a **1-DOF mechanism** → singular `K`. The
  influence line **is** that kinematic mode: `_solve_release` (in
  [engine/influence_line.py](engine/influence_line.py)) extracts it from the null space of `K`,
  oriented so the release load does positive work (`P·U>0`). This is the imposed-displacement form
  of Müller-Breslau. A **≥2-DOF mechanism** (truly unstable, e.g. no support left) still raises
  `RuntimeError`.
- **Shear discontinuity**: for `V`, the `x` array is **doubled** at the cut to render the jump;
  `y_nodes` is the un-doubled per-node array. `vehicle_loads.interp` keeps the worse side at a jump,
  and `distributed_loads` ignores the zero-length doubled segment when integrating.
- **Units stay at the edges**: `compute_influence_line` is never given `unit_system` (`04` R6,
  `05` D7/D10). Only `vehicle_loads`, `deck`, the backend and the frontend know SI/US. The HL-93
  data are the two **official** AASHTO sets — never numerically converted (`05` D5), and the
  geometry fields are reset (not converted) when the user toggles units (`05` D6).
- **Overhang is statics, not an influence line**: a hinge at the edge girder would free the
  cantilever → mechanism. Use `M = ΣP·X·(1+IM)` and `w·L²/2` (`04` R9, `05` D9). Negative-moment
  and shear sections therefore sit on the first **interior** girder.
- **Deck shear has no AASHTO strip formula**: the negative strip width is reused as the denominator
  — an explicit pedagogical choice (`05` D14). Barrier/rail point loads apply as a **symmetric pair
  at both edges** (`04` R9, `edge_point_loads`), and dead loads are never pattern-loaded (`05` D13).
- **Validation strategy**: the historical CSVs in `resultats/` are **mostly wrong** (buggy hand
  `LM`); only `LIVE_resultats.csv` is correct. Tests therefore assert **analytical invariants**
  (sum of reaction LIs = 1 everywhere; LI = 0 at every support; unit value-jump for `V`; unit
  slope-jump for `M`; `w·L²/8` at midspan of a simple span; `M_LL = MPF·M_strip/E`; `Mu = Σγ·M`) —
  never the CSVs (see `05`/D4). The 157 pytest tests across [tests/](tests/) (LI invariants, HL-93
  SI/US, distributed loads, deck, deck study, API integration) plus the 19 Vitest tests must stay
  green.

## Conventions

- Commit messages use bracketed prefixes: `[ADD]`, `[BUGFIX]`, `[CHANGE]`.
- Notebook naming `LI<quantity><point>`: `LIR*` reaction, `LIM*` moment, `LIV*` shear; A/B/C are
  supports, E/F interior points.
- Cite the rule you rely on the way the existing modules do: `R1`–`R10` for business rules (04),
  `D1`–`D16` for rejected options (05), in code comments, docstrings and docs.
