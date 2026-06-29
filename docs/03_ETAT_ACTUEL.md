<!-- CLAUDE : Snapshot court de l'état du projet. Maximum 30 lignes.
     Remplacer le contenu à chaque /ce — ce n'est pas un journal, c'est un état présent.
     Doit répondre à : "Si je reprends demain, où est-ce que j'en suis ?"
     Ne pas y mettre : historique, décisions, routes API. -->

# État actuel

**Calcul en Python (stable) ; front en migration React/TS.**

## Couche calcul (Python — stable, 134 TU verts)
- `engine/` : `compute_influence_line` (agnostique ; travée simple = mode cinématique du
  noyau de K) + `vehicle_loads` (HL-93) + `distributed_loads` (DC/DW) + `deck` (dalle,
  bande équivalente AASHTO). Backend FastAPI : toutes les routes + CORS ouvert.
- `deck` étendu : 4 sections (positif, négatif, **effort tranchant** au longeron intérieur,
  porte-à-faux) ; charges permanentes DC/DW réparties **+ barrière/glissière ponctuelles**
  (décomposées) ; charge roulante **1/2/3 voies** (MPF éditables 1.20/1.00/0.85).

## Front React `web/` (PRINCIPAL désormais)
- Vite + TS strict, Tailwind + shadcn/ui, TanStack Query, Recharts, React Konva.
  **Présentation pure** : appelle l'API, zéro calcul en TS. **14 tests Vitest**.
- **Onglet Poutre** (géométrie partagée + sous-onglets) :
  - *Charge mobile HL-93* : éditeur Konva (section glissable, snap appui/nœud) → LI live →
    « Position critique » (`/vehicle-envelope`) ; pour V, efforts avant/après coupure.
  - *Charges permanentes DC/DW* : chargement alterné (damier) — zones chargées ombrées sur
    la LI (`/distributed-effect`) + 2 lignes d'enveloppe M et V (`/distributed-envelope`)
    avec M⁻ max aux appuis ◆ et M⁺ max en travée ▲.
- **Onglet Tablier** : `/deck-design` live ; coupe transversale Konva (roues + charges
  ponctuelles barrière/glissière), tableaux moments + effort tranchant + décomposition M_DC
  + effet par voies (MPF transparents), 3 LI transversales (positif/négatif/tranchant).

## Legacy (référence)
- `frontend/` (vanilla + Chart.js) : couvre tout (poutre, HL-93, DC/DW, enveloppes M/V,
  tablier) — conservé jusqu'à parité React. Notebooks pédagogiques dans `legacy/`.

## Limites connues
- Charge de voie répartie (9.3 kN/m) non incluse (choix). Mécanisme ≥2 DDL = erreur.
- Reste à porter en React : enveloppe HL-93 (Mmax/Mmin/Vmax/Vmin, Plotly), exports CSV.

## Lancer
- `run.bat` (backend `:8000` + front React `:5173`)
- Tests : `pytest tests/` (134) ; `cd web && npm run test` (14)
