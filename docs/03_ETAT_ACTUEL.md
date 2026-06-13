<!-- CLAUDE : Snapshot court de l'état du projet. Maximum 30 lignes.
     Remplacer le contenu à chaque /ce — ce n'est pas un journal, c'est un état présent.
     Doit répondre à : "Si je reprends demain, où est-ce que j'en suis ?"
     Ne pas y mettre : historique, décisions, routes API. -->

# État actuel

Branche : `refactor/ui-support`. **App 3 couches + charges mobiles HL-93 opérationnelles.**

## Fait
- Moteur `engine/` : `compute_influence_line(...)` (LM auto) + `vehicle_loads.py`
  (charges mobiles HL-93 SI : effet, balayage, max, impact IM=33 %).
- Backend FastAPI : `POST /influence-line`, `GET /health`, `GET /vehicles`,
  `POST /vehicle-envelope`. Testé sous uvicorn.
- Frontend statique : formulaire + graphe Chart.js + export CSV ; panneau véhicule
  (camion/tandem, espacement arrière réglable 4.3–9.0 m, impact, curseur de position
  avec **flèches d'essieux** et effet live, **balayage auto** → effet max + graphe).
- 41 TU au vert (22 LI + 19 charges mobiles) ; audits qualité passés.
- `run.bat` : lance backend + ouvre le frontend. `requirements.txt` + docs à jour.

## Validé numériquement
- LI : somme réactions=1 ; saut V unitaire ; saut de pente M unitaire ; zéros aux appuis.
- Charges : effet essieu unique = P·η·1.33 ; math JS (live) = moteur Python (écart 0).
- Bug corrigé : balayage sur LI d'effort tranchant (côté défavorable de la coupure).

## Limites connues
- Charge de voie répartie (9.3 kN/m) non incluse (choix). Pas d'enveloppe combinée
  camion+voie. Réaction d'une travée simple = mécanisme → erreur explicite.
- US (ft/kip) non implémenté : seul le SI est actif.

## Lancer
- `run.bat`  (ou `uvicorn backend.main:app --reload` + ouvrir `frontend/index.html`)
- `pytest tests/`
