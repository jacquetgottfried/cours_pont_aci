<!-- CLAUDE : Ce fichier est la référence des routes, méthodes HTTP, payloads et réponses.
     Mettre à jour à chaque création ou modification d'endpoint validée.
     Format attendu : METHOD /route — description — payload — réponse type.
     Ne pas y mettre : logique métier, état d'avancement, décisions rejetées. -->

# Contrat API

Base : `http://127.0.0.1:8000` · Documentation interactive : `/docs`.

## GET /health — sonde de disponibilité
- Payload : aucun.
- Réponse 200 : `{"status": "ok"}`

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
