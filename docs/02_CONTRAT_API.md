<!-- CLAUDE : Ce fichier est la référence des routes, méthodes HTTP, payloads et réponses.
     Mettre à jour à chaque création ou modification d'endpoint validée.
     Format attendu : METHOD /route — description — payload — réponse type.
     Ne pas y mettre : logique métier, état d'avancement, décisions rejetées. -->

# Contrat API

Base : `http://127.0.0.1:8000` · Documentation interactive : `/docs`.

## GET /health — sonde de disponibilité
- Payload : aucun.
- Réponse 200 : `{"status": "ok"}`

Routes : `GET /health`, `POST /influence-line`, `GET /vehicles`, `POST /vehicle-envelope`.

## POST /influence-line — calcule une ligne d'influence
- Payload (JSON) :
  ```json
  {
    "spans": [15, 10, 15],     // longueurs de travées (m), >0, requis
    "quantity": "R",            // "R" | "M" | "V", requis
    "target_x": 0,              // abscisse de la grandeur (m), sur un nœud ; appui si "R"
    "dx": 1.0,                  // discrétisation (m), >0, défaut 1.0
    "supports": [0, 15, 25, 40] // optionnel ; sinon déduits des travées
  }
  ```
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

## GET /vehicles — catalogue HL-93 (AASHTO LRFD, SI)
- Payload : aucun.
- Réponse 200 : essieux et espacements (source unique de vérité pour le frontend).
  ```json
  {
    "im": 0.33,
    "truck":  {"label":"Camion de calcul (HL-93)",
               "axles":[{"offset":0.0,"load":35.0},{"offset":4.3,"load":145.0},
                        {"offset":8.6,"load":145.0}],
               "rear_spacing":{"min":4.3,"max":9.0,"default":4.3}},
    "tandem": {"label":"Tandem de calcul (HL-93)",
               "axles":[{"offset":0.0,"load":110.0},{"offset":1.2,"load":110.0}],
               "rear_spacing":null}
  }
  ```

## POST /vehicle-envelope — balaye un véhicule HL-93 sur la ligne d'influence
- Payload (JSON) : champs de `/influence-line` + :
  ```json
  {
    "vehicle": "truck",      // "truck" | "tandem", requis
    "rear_spacing": 4.3,     // espacement arrière camion (m), 4.3–9.0, défaut 4.3
    "impact": true           // majoration dynamique IM=33 %, défaut true
  }
  ```
- Réponse 200 :
  ```json
  {
    "positions": [...],   // abscisse de l'essieu de tête (m)
    "effects": [...],     // effet résultant à chaque position
    "max": {"value": 407.68, "lead_pos": 15.70,
            "axle_positions": [{"x":15.7,"load":35.0}, ...]},
    "unit": "kN·m"        // "kN" (R, V) ou "kN·m" (M)
  }
  ```
- Erreurs : `400` (idem métier), `422` (véhicule invalide, rear_spacing hors 4.3–9.0).
