<!-- CLAUDE : Snapshot court de l'état du projet. Maximum 30 lignes.
     Remplacer le contenu à chaque /ce — ce n'est pas un journal, c'est un état présent.
     Doit répondre à : "Si je reprends demain, où est-ce que j'en suis ?"
     Ne pas y mettre : historique, décisions, routes API. -->

# État actuel

**Calcul en Python (stable, 134 TU) ; front React/TS (14 tests Vitest).**

## Couche calcul (Python — engine/ + backend FastAPI, CORS ouvert)
- `compute_influence_line` (agnostique ; travée simple = mode cinématique du noyau de K)
  + `vehicle_loads` (HL-93) + `distributed_loads` (DC/DW) + `deck` (bande équiv. AASHTO).
- `deck` étendu : 4 sections (positif, négatif, **effort tranchant** au longeron intérieur,
  porte-à-faux) ; DC/DW répartis **+ barrière/glissière ponctuelles** (décomposées) ;
  charge roulante **1/2/3 voies** (MPF éditables 1.20/1.00/0.85).

## Front React `web/` (PRINCIPAL) — présentation pure, zéro calcul TS
- **Onglet Poutre** (géométrie partagée + sous-onglets) : *Charge mobile HL-93* (éditeur
  Konva, LI live, position critique, V avant/après coupure) ; *DC/DW* (damier, zones
  ombrées, 2 enveloppes M et V, M⁻ aux appuis ◆ / M⁺ en travée ▲).
- **Onglet Tablier** : `/deck-design` live ; coupe Konva (roues + barrière/glissière),
  tableaux moments + effort tranchant + décomposition M_DC + effet par voies (MPF
  transparents), 3 LI transversales (positif/négatif/tranchant).

## Legacy & limites
- `frontend/` (vanilla + Chart.js) + notebooks `legacy/` : référence jusqu'à parité React.
- Charge de voie répartie (9.3 kN/m) non incluse (choix) ; mécanisme ≥2 DDL = erreur.
- Reste à porter en React : enveloppe HL-93 (Plotly), exports CSV.

## Lancer
- `run.bat` (backend `:8000` + front `:5173`) ; `pytest tests/` (134) ; `npm run test` (14).
