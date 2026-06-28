# web/ — Frontend React (couche présentation)

Interface pédagogique interactive (M1 génie civil). **Ne contient aucun calcul** : toute la
mécanique vit dans le moteur Python (`../engine`) exposé par FastAPI (`../backend`). Cette app
est une **couche présentation typée** qui appelle l'API.

## Stack
Vite · React · TypeScript (strict) · Tailwind v4 · shadcn/ui · TanStack Query · Recharts
(courbes) · React Konva (éditeur de poutre). Plotly viendra pour les diagrammes d'efforts.

## Lancer (dev)
```
# 1. backend (depuis la racine du projet)
uvicorn backend.main:app --reload          # :8000

# 2. frontend (ici)
npm install
npm run dev                                 # :5173
```
`VITE_API_BASE` (fichier `.env`) pointe l'API ; défaut `http://127.0.0.1:8000`.

## Scripts
- `npm run dev` — serveur de dev
- `npm run build` — build de production (`dist/`)
- `npm run typecheck` — `tsc -b`
- `npm run lint` — oxlint
- `npm run test` — Vitest

## Organisation (séparation calcul / présentation)
```
src/
  api/        contrat typé + fetch (SEUL endroit réseau) — types.ts, client.ts, beam.ts
  lib/        helpers purs (units.ts) — pas de réseau, pas de JSX
  components/ui/   primitives shadcn/ui
  features/beam/   tranche Poutre :
    useBeam.ts            hooks React Query (fetch only)
    BeamControls.tsx      saisies (shadcn)
    BeamEditor.tsx        Konva : section glissable + convoi
    InfluenceLineChart.tsx Recharts : η(x)
    BeamPage.tsx          orchestre l'état d'UI, délègue le calcul à l'API
```
Règle : aucun calcul dans un composant ; aucun affichage dans `api/` ou `lib/`.

## État
- **Onglet Poutre** : glisser la section → la ligne d'influence se met à jour
  (Müller-Breslau) ; bouton « Position critique » → place le convoi HL-93 au pire endroit
  (`/vehicle-envelope`). La section ne se pose que sur des cibles valides (appui pour R,
  nœud intérieur pour M/V).
- **Onglet Tablier** (`features/deck/`) : méthode de la bande équivalente (`/deck-design`) ;
  coupe transversale Konva, tableau des 3 sections, 2 LI transversales (positif/négatif).
- Incréments suivants : enveloppes M/V (Plotly), DC/DW poutre, exports.
