<!-- CLAUDE : Snapshot court de l'état du projet. Maximum 30 lignes.
     Remplacer le contenu à chaque /ce — ce n'est pas un journal, c'est un état présent.
     Doit répondre à : "Si je reprends demain, où est-ce que j'en suis ?"
     Ne pas y mettre : historique, décisions, routes API. -->

# État actuel

Branche : `LIRA_discret_n40`. **Application backend + frontend opérationnelle, validée par l'utilisateur.**

## Fait (3 couches en place et fonctionnelles)
- Moteur `engine/` : `compute_influence_line(spans, quantity, target_x, dx, supports)`.
  `LM` généré automatiquement (plus de saisie manuelle). Réutilise `calcul_structure.py`.
- Backend FastAPI `backend/` : `POST /influence-line`, `GET /health`. Démarre via uvicorn.
- Frontend statique `frontend/` : formulaire + graphe Chart.js + export CSV.
- 22 TU `tests/` au vert ; audit test-controller passé (aucun test truqué).
- `requirements.txt` + docs (01→05) + README à jour.

## Validé numériquement
- Somme des LI de réaction = 1 partout ; LI de réaction = 1 à son appui, 0 ailleurs.
- Effort tranchant : saut de valeur unitaire ; Moment : saut de pente unitaire ; zéros aux appuis.
- Le moteur reproduit `LIVE_resultats.csv` à 1e-14 (et corrige LIRA/LIRB/LIRC/LIVF, faux).

## Limites connues
- Méthode « charge unitaire » : structure libérée doit rester stable (≥2 appuis pour R).
  Réaction d'une travée simple = mécanisme → erreur explicite.

## Lancer
- `pip install -r requirements.txt`
- `uvicorn backend.main:app --reload` puis ouvrir `frontend/index.html`
- `pytest tests/`

## Pistes (non engagées)
- Régénérer les CSV de `resultats/` avec le moteur correct.
- Élément poutre 1D (2 DDL/nœud) ; méthode du déplacement imposé pour gérer les mécanismes.
- Reformater les docstrings > 79 caractères (E501) si lint strict souhaité.
