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
  vehicle_loads.py    # charges mobiles HL-93 (AASHTO LRFD, SI/US) : effet, balayage, max, IM
  distributed_loads.py# charges réparties DC/DW : effet = w·∫η, enveloppes M et V
  deck.py             # dalle de tablier : bande équivalente AASHTO (poutre transversale)
backend/
  schemas.py          # modèles Pydantic (validation entrées/sorties)
  main.py             # app FastAPI : /influence-line, /vehicle-envelope, /distributed-*, /deck-*
frontend/
  index.html, app.js, style.css   # UI à 2 onglets : « Poutre longitudinale » | « Tablier »
tests/
  test_influence_line.py, test_vehicle_loads.py, test_distributed_loads.py, test_deck.py, ...
*.ipynb               # notebooks historiques (pédagogie) — NE PLUS utiliser comme moteur
resultats/            # CSV historiques (majoritairement faux, voir 05) ; LIVE = témoin correct
```

## Patterns clés
- **Le `LM` n'est plus écrit à la main** : il est généré par `model_builder` à partir de
  (travées, dx, quantité, position). C'est la correction structurante du projet.
- Le moteur réutilise `calcul_structure.py` sans le modifier.
- Le backend est un simple adaptateur HTTP au-dessus de `compute_influence_line`.
- Flux de données : formulaire → `POST /influence-line` (JSON) → moteur → `{x, y, meta}` → Chart.js.
- **Modules de bord** (`vehicle_loads`, `deck`) : ils connaissent `unit_system` (catalogue
  AASHTO, formules de bande) ; le cœur `compute_influence_line` reste agnostique (cf. 04 R6/D7).
- **La dalle réutilise le même moteur** : c'est une poutre continue TRANSVERSALE (appuis =
  longerons, extrémités libres = porte-à-faux). `deck.py` appelle `compute_influence_line`
  avec des `supports` aux positions de longerons, puis applique la largeur de bande E.
- **UI à onglets** : « Poutre longitudinale » (LI, HL-93, DC/DW) et « Tablier (dalle) »
  (bande équivalente). Bascule SI/US partagée. Deux colonnes : entrées | sorties.
