<!-- CLAUDE : Ce fichier est la référence des routes, méthodes HTTP, payloads et réponses.
     Mettre à jour à chaque création ou modification d'endpoint validée.
     Format attendu : METHOD /route — description — payload — réponse type.
     Ne pas y mettre : logique métier, état d'avancement, décisions rejetées. -->

# Contrat API

Base : `http://127.0.0.1:8000` · Documentation interactive : `/docs`.

## GET /health — sonde de disponibilité
- Payload : aucun.
- Réponse 200 : `{"status": "ok"}`

Routes : `GET /health`, `POST /influence-line`, `GET /vehicles`, `POST /vehicle-envelope`,
`POST /distributed-effect`, `POST /distributed-envelope`.

## POST /influence-line — calcule une ligne d'influence
- Payload (JSON) :
  ```json
  {
    "spans": [15, 10, 15],     // longueurs de travées, >0, requis
    "quantity": "R",            // "R" | "M" | "V", requis
    "target_x": 0,              // abscisse de la grandeur, sur un nœud ; appui si "R"
    "dx": 1.0,                  // discrétisation, >0, défaut 1.0
    "supports": [0, 15, 25, 40],// optionnel ; sinon déduits des travées
    "unit_system": "SI"         // "SI" (m, kN) | "US" (ft, kip), défaut "SI"
  }
  ```
- Note : le moteur est **agnostique aux unités** ; `unit_system` n'agit pas sur le
  calcul de la LI (cf. 04 R6), mais pilote les véhicules, libellés et unités d'effet.
  Les longueurs sont à exprimer dans l'unité du système (m en SI, ft en US).
- Réponse 200 :
  ```json
  {
    "x": [...],            // abscisses (m) ; dédoublées au point de coupure pour "V"
    "y": [...],            // ordonnées de la LI
    "y_nodes": [...],      // ordonnées aux nœuds physiques (sans dédoublement)
    "normalization": 333.33,
    "meta": {
      "quantity": "R", "target_x": 0.0,
      "support_positions": [0,15,25,40], "n_ddl": 79, "n_elements": 40
    }
  }
  ```
- Erreurs :
  - `400` — erreur métier (réaction hors appui, point hors nœud, dx non multiple,
    structure instable/mécanisme). `detail` contient le message.
  - `422` — validation Pydantic (quantité invalide, travée ≤ 0, champ manquant).

## GET /vehicles — catalogue HL-93 (AASHTO LRFD)
- Query : `unit_system` = `"SI"` (défaut) | `"US"`. Sélectionne le jeu de valeurs
  AASHTO **officiel** (pas une conversion) et les unités.
- Réponse 200 : essieux et espacements (source unique de vérité pour le frontend),
  + `unit_system`, `force_unit`, `length_unit`.
  ```json
  // GET /vehicles?unit_system=SI
  {
    "unit_system":"SI", "im":0.33, "force_unit":"kN", "length_unit":"m",
    "truck":  {"label":"Camion de calcul (HL-93)",
               "axles":[{"offset":0.0,"load":35.0},{"offset":4.3,"load":145.0},
                        {"offset":8.6,"load":145.0}],
               "rear_spacing":{"min":4.3,"max":9.0,"default":4.3}},
    "tandem": {"label":"Tandem de calcul (HL-93)",
               "axles":[{"offset":0.0,"load":110.0},{"offset":1.2,"load":110.0}],
               "rear_spacing":null}
  }
  // GET /vehicles?unit_system=US  → force_unit "kip", length_unit "ft",
  //   camion 8/32/32 kip (offsets 0/14/28), arrière {min:14, max:30, default:14},
  //   tandem 2×25 kip (offsets 0/4.0).
  ```
- Erreur : `400` si `unit_system` inconnu.

## POST /vehicle-envelope — balaye un véhicule HL-93 sur la ligne d'influence
- Payload (JSON) : champs de `/influence-line` (dont `unit_system`) + :
  ```json
  {
    "vehicle": "truck",      // "truck" | "tandem", requis
    "rear_spacing": 4.3,     // espacement arrière camion, optionnel ; bornes selon
                             //   le système (4.3–9.0 m en SI, 14–30 ft en US) ;
                             //   défaut = min du système (4.3 m / 14 ft)
    "impact": true           // majoration dynamique IM=33 %, défaut true
  }
  ```
- Réponse 200 :
  ```json
  {
    "positions": [...],   // abscisse de l'essieu de tête (m)
    "effects": [...],     // effet résultant à chaque position
    "max":       {"value": 407.68,  "lead_pos": 15.70, "axle_positions": [...]},
    "min":       {"value": -264.97, "lead_pos": 2.40,  "axle_positions": [...]},
    "governing": {"value": 407.68,  "lead_pos": 15.70, "axle_positions": [...]},
    "unit": "kN·m"        // selon (système, grandeur) : kN | kN·m (SI), kip | kip·ft (US)
  }
  ```
  `max` = effet le plus positif, `min` = le plus négatif, `governing` = le plus grand
  en valeur absolue (cas le plus défavorable). `axle_positions` = [{x, load}] des
  essieux sur la poutre à cette position.
- Erreurs : `400` (idem métier), `422` (véhicule ou `unit_system` invalide,
  `rear_spacing` hors bornes **du système** : 4.3–9.0 en SI, 14–30 en US).

## POST /distributed-effect — charges réparties DC/DW sur une ligne d'influence
- Effet d'une charge répartie sur une LI : `effet = w·∫η dx` (cf. 04 R8). Réutilise le
  moteur de LI ; DC et DW **non factorisés** (somme rendue à part).
- Payload (JSON) : champs de `/influence-line` (dont `unit_system`) + :
  ```json
  {
    "w_dc": 10.0,   // intensité DC poids propre (kN/m | kip/ft), ≥0
    "w_dw": 3.0     // intensité DW revêtement (kN/m | kip/ft), ≥0
  }
  ```
  Au moins une des deux charges doit être > 0.
- Réponse 200 : chaque configuration porte `{dc, dw, total, zones}` :
  ```json
  {
    "full":      {"dc": ..., "dw": ..., "total": ..., "zones": [[0, L]]},
    "max":       {"dc": ..., "dw": ..., "total": ..., "zones": [[x0,x1], ...]},
    "min":       {"dc": ..., "dw": ..., "total": ..., "zones": [[x0,x1], ...]},
    "governing": {"dc": ..., "dw": ..., "total": ..., "zones": [...]},
    "w_dc": 10.0, "w_dw": 3.0, "unit": "kN·m"
  }
  ```
  `full` = toute la poutre chargée (charge permanente). `max` = chargement alterné des
  zones `η>0` (`w·∫η⁺`), `min` = zones `η<0` (`w·∫η⁻`). `zones` = intervalles chargés.
  `unit` : kN | kN·m (SI), kip | kip·ft (US) selon la grandeur.
- Erreurs : `400` (métier : point hors nœud, mécanisme), `422` (deux charges nulles,
  charge négative, `quantity`/`unit_system` invalides).

## POST /distributed-envelope — ligne d'enveloppe d'une charge répartie DC/DW
- Balaye la section étudiée sur tous les nœuds. `target_x` est **ignoré**.
- Payload (JSON) : identique à `/distributed-effect` (`w_dc`, `w_dw`).
- Réponse 200 :
  ```json
  {
    "positions": [...],   // abscisse de la section
    "max":  [...],        // effet total (DC+DW) chargement alterné +, par section
    "min":  [...],        // effet total chargement alterné -, par section
    "full": [...],        // effet total toute la poutre, par section
    "governing": {"value": ..., "position": ..., "zones": [...], "sign": -1},
    "midspan_points": [{"position": ..., "value": ...}],  // max positif par travée
    "support_points": [{"position": ..., "value": ...}],  // min négatif sur appui
    "quantity": "M", "w_dc": 10.0, "w_dw": 3.0, "unit": "kN·m"
  }
  ```
  `midspan_points` = moment max à mi-travée ; `support_points` = moment max sur appui
  intérieur (poutre continue : souvent gouvernant). `sign` = +1 / -1 du gouvernant.
- Erreurs : `400` (métier), `422` (idem `/distributed-effect`).
