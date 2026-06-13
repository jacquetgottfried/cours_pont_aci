<!-- CLAUDE : Ce fichier décrit la structure stable du projet (dossiers, stack, patterns).
     Ne modifier que si une décision d'architecture est actée et validée par l'utilisateur.
     Ne pas y mettre : routes API, règles métier, état d'avancement. -->

# Architecture

Application de calcul de **lignes d'influence** d'une poutre continue, en 3 couches.

## Stack
- **Moteur** : Python + NumPy (méthode des éléments finis, portique 2D, 3 DDL/nœud).
- **Backend** : FastAPI + Pydantic + Uvicorn.
- **Frontend** : HTML/CSS/JS statique + Chart.js (CDN, sans build).
- **Tests** : pytest.

## Arborescence
```
calcul_structure.py   # briques FE bas niveau (matrice élémentaire, assemblage) — réutilisé tel quel
engine/
  model_builder.py    # construit XY, numérotation DDL et LM PROGRAMMATIQUEMENT (+ releases Müller-Breslau)
  influence_line.py   # compute_influence_line(...) : fonction générique unique
  vehicle_loads.py    # charges mobiles HL-93 (AASHTO LRFD, SI) : effet, balayage, max, IM
backend/
  schemas.py          # modèles Pydantic (validation entrées/sorties)
  main.py             # app FastAPI : POST /influence-line, GET /health
frontend/
  index.html, app.js, style.css
tests/
  test_influence_line.py
*.ipynb               # notebooks historiques (pédagogie) — NE PLUS utiliser comme moteur
resultats/            # CSV historiques (majoritairement faux, voir 05) ; LIVE = témoin correct
```

## Patterns clés
- **Le `LM` n'est plus écrit à la main** : il est généré par `model_builder` à partir de
  (travées, dx, quantité, position). C'est la correction structurante du projet.
- Le moteur réutilise `calcul_structure.py` sans le modifier.
- Le backend est un simple adaptateur HTTP au-dessus de `compute_influence_line`.
- Flux de données : formulaire → `POST /influence-line` (JSON) → moteur → `{x, y, meta}` → Chart.js.
