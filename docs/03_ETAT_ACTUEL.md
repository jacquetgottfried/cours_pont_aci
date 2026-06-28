<!-- CLAUDE : Snapshot court de l'état du projet. Maximum 30 lignes.
     Remplacer le contenu à chaque /ce — ce n'est pas un journal, c'est un état présent.
     Doit répondre à : "Si je reprends demain, où est-ce que j'en suis ?"
     Ne pas y mettre : historique, décisions, routes API. -->

# État actuel

**Calcul en Python (stable) ; front en migration React/TS.**

## Couche calcul (Python — inchangée, 123 TU verts)
- `engine/` : `compute_influence_line` (agnostique ; travée simple = mode cinématique du
  noyau de K) + `vehicle_loads` (HL-93) + `distributed_loads` (DC/DW) + `deck` (dalle,
  bande équivalente AASHTO). Backend FastAPI : toutes les routes + CORS ouvert.

## Front React `web/` (PRINCIPAL désormais)
- Vite + TS strict, Tailwind + shadcn/ui, TanStack Query, Recharts, React Konva.
  **Présentation pure** : appelle l'API, zéro calcul en TS. **12 tests Vitest**.
- **Onglet Poutre** : éditeur Konva (section glissable, snap appui pour R / nœud pour M/V)
  → LI live (Recharts) → « Position critique » (`/vehicle-envelope`).
- **Onglet Tablier** : `/deck-design` live ; coupe transversale Konva, tableau 3 sections
  (M_DC/M_DW/M_LL+IM/E/Mu), 2 LI transversales (positif/négatif).

## Legacy (référence)
- `frontend/` (vanilla + Chart.js) : couvre tout (poutre, HL-93, DC/DW, enveloppes M/V,
  tablier) — conservé jusqu'à parité React. Notebooks pédagogiques dans `legacy/`.

## Limites connues
- Charge de voie répartie (9.3 kN/m) non incluse (choix). Mécanisme ≥2 DDL = erreur.
- Reste à porter en React : enveloppes M/V (Plotly), DC/DW poutre, exports CSV.

## Lancer
- `run.bat` (backend `:8000` + front React `:5173`)
- Tests : `pytest tests/` (123) ; `cd web && npm run test` (12)
