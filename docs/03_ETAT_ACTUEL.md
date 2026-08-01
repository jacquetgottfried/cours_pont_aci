<!-- CLAUDE : Snapshot court de l'état du projet. Maximum 30 lignes.
     Remplacer le contenu à chaque /ce — ce n'est pas un journal, c'est un état présent.
     Doit répondre à : "Si je reprends demain, où est-ce que j'en suis ?"
     Ne pas y mettre : historique, décisions, routes API. -->

# État actuel

**Calcul en Python (stable, 157 TU) ; front React/TS (19 tests Vitest).**

## Couche calcul (Python — engine/ + backend FastAPI, CORS ouvert)
- `compute_influence_line` (agnostique ; travée simple = mode cinématique du noyau de K)
  + `vehicle_loads` (HL-93) + `distributed_loads` (DC/DW) + `deck` (bande équiv. AASHTO).
- `deck` : 4 sections fixes + **étude d'une section CHOISIE** (`deck_section_study`,
  cf. 04 R10) : M ET V à `target_x`, bande E inférée, cas 1/2/3 voies COMPLETS (roues +
  Mu par cas). Barrière/glissière = **paires symétriques aux deux rives** (R9 amendé,
  `edge_point_loads`) ; charges permanentes optionnelles pour l'étude.

## Front React `web/` (PRINCIPAL) — présentation pure, zéro calcul TS
- **Onglet Poutre** : sous-onglets *HL-93* (éditeur Konva, LI live, position critique,
  V avant/après coupure) et *DC/DW* (damier, zones ombrées, enveloppes M et V).
- **Onglet Tablier** : `/deck-design` live (coupe + tableaux AASHTO fixes) + panneau
  **« Étude d'une section »** : repère glissable ↔ champ x (snap dx), 1/2/3 voies,
  « Calculer » → 2 LI (M et V) + tableau permanentes/vif/Mu-Vu par voies. La coupe
  matérialise barrières/glissières aux DEUX rives et les **roues du cas choisi**
  (bascule « Roues M / Roues V », le placement critique diffère entre grandeurs).

## Legacy & limites
- `frontend/` (vanilla + Chart.js) + notebooks `legacy/` : référence jusqu'à parité React.
- Charge de voie répartie (9.3 kN/m) non incluse (choix) ; mécanisme ≥2 DDL = erreur.
- Reste à porter en React : enveloppe HL-93 (Plotly), exports CSV.

## Lancer
- `run.bat` (backend `:8000` + front `:5173`) ; `pytest tests/` (157) ; `npm run test` (19).
