## Ligne d'Influence
Nous présentons le calcul de la ligne d'influence utilisant la méthode du Muller Breslaut.
Le calcul matriciel des déplacements est utilisé.

## Application (moteur + API + interface web)

Le calcul est désormais disponible comme **moteur générique paramétrable**, exposé par une
**API** et une **interface web** légère (les notebooks restent à but pédagogique).

### Installation
```bash
pip install -r requirements.txt
```

### Utilisation directe (Python)
```python
from engine import compute_influence_line
res = compute_influence_line(spans=[15, 10, 15], quantity="R", target_x=0, dx=1.0)
# res["x"], res["y"], res["y_nodes"], res["normalization"], res["meta"]
```
`quantity` : `"R"` (réaction), `"M"` (moment), `"V"` (effort tranchant). `target_x` doit
tomber sur un nœud (et être un appui pour `"R"`).

### Backend
```bash
uvicorn backend.main:app --reload
```
Documentation interactive : http://127.0.0.1:8000/docs · endpoint `POST /influence-line`.

### Frontend
Ouvrir `frontend/index.html` dans un navigateur (ou `python -m http.server` depuis
`frontend/`), saisir la poutre et la grandeur, puis tracer la ligne d'influence.

Sous Windows, `run.bat` (à la racine) installe les dépendances au besoin, démarre le
backend et ouvre le frontend automatiquement.

### Charges mobiles HL-93 (AASHTO LRFD, SI)
Une fois la ligne d'influence tracée, on peut balader un **véhicule de référence** :
- **camion de calcul** (35 / 145 / 145 kN, espacement arrière réglable 4,3–9,0 m) ou
  **tandem** (110 / 110 kN à 1,2 m), avec **majoration dynamique IM = 33 %** ;
- les essieux sont **matérialisés par des flèches** à leur position AASHTO exacte ;
- un curseur déplace le véhicule avec l'**effet résultant en direct** (kN ou kN·m) ;
- le **balayage automatique** trouve la position la plus défavorable (effet maximal).

### Tests
```bash
pytest tests/
```

> ⚠️ Les CSV de `resultats/` issus des anciens notebooks sont en partie **erronés** (matrices
> `LM` saisies à la main). Le moteur générique corrige ces erreurs ; seul `LIVE` était correct.

---


Les notes de calcul sont visible dans : 
- LIRA détaille le calcul de la ligne d'influence pour la réaction d'appui A. Voir fichier [LIRA.ipynb](LIRA.ipynb): 

![alt text](./images/image.png)


- LIRB, ligne d'influence Réaction d'appui B, dans le fichier [LIRB.ipynb](LIRB.ipynb) :

![alt text](./images/image-4.png)

- LIRC, ligne d'influence Reaction d'appui. Voir fichier [LIRC.ipynb](LIRC.ipynb) :

![alt text](./images/image-5.png)

- LIMB détaille le calcul de la ligne
 d'influence pour le moment à l'appui B. Voir fichier [LIMB.ipynb](LIMB.ipynb):

 ![alt text](./images/image-1.png)

- LIMC, ligne d'influence du moment sur appui C. Voir fichier [LIMC.ipynb](LIMC.ipynb) :

 ![alt text](./images/image-2.png)

- LIME détaille le calcul de la ligne d'influence pour le moment interne en E. Voir fichier [LIME.ipynb](LIME.ipynb):

![alt text](./images/image-3.png)

- LIMF ligne d'influence moment en F, (milieu du seguement de poutre AB). Voir fichier [LIMF](LIMF.ipynb):

![alt text](./images/image_resikq.png)

- LIVE détaille le calcul de la ligne d'influence pour l'éffort tranchant en E. Voir fichier [LIVE](LIVE.ipynb):

![alt text](./images/image-8.png)

- LIVF, ligne d'influence effort tranchant au point F (milieu de la portion de poutre (AB)). Voir fichier [LIVF](LIVF.ipynb):

![alt text](./images/image-6.png)



Les resultats des lignes d'influence sont à consulter dans le dosser ./resultat

