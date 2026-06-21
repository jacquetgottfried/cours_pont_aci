<!-- CLAUDE : Snapshot court de l'état du projet. Maximum 30 lignes.
     Remplacer le contenu à chaque /ce — ce n'est pas un journal, c'est un état présent.
     Doit répondre à : "Si je reprends demain, où est-ce que j'en suis ?"
     Ne pas y mettre : historique, décisions, routes API. -->

# État actuel

Branche : `refactor/ui-support`. **App 3 couches + HL-93 + charges réparties DC/DW + SI/US.**

## Fait
- Moteur `engine/` : `compute_influence_line(...)` (LM auto, agnostique aux unités)
  + `vehicle_loads.py` (HL-93) + `distributed_loads.py` (DC/DW : `effet = w·∫η`).
- **Charges réparties DC/DW** : `integrate_il` (∫η, ∫η⁺, ∫η⁻ + zones), `distributed_effect`
  (full/max/min décomposé DC/DW), `distributed_envelope` (balayage des sections → moment
  max mi-travée/appui, effort tranchant max). Non factorisé ; le signe de la LI donne la
  pire config (pas de force brute). Cf. 04 R8 / 05 D8.
- **Bi-unités SI/US** : deux jeux AASHTO officiels, aucune conversion numérique.
- Backend FastAPI : `/health`, `/influence-line`, `/vehicles?unit_system`,
  `/vehicle-envelope`, `/distributed-effect`, `/distributed-envelope`. Unité d'effet
  dérivée (kN/kip, kN·m/kip·ft) ; discrimination 422 (validation) vs 400 (métier).
- Frontend : toggle **SI/US** ; libellés via l'API ; panneau véhicule (flèches, balayage
  max ▲/min ◆) ; **panneau charge répartie** (DC/DW, effet live, ombrage des zones
  chargées, enveloppe avec points mi-travée ▲ / appui ◆) ; export CSV avec unité.
- **89 TU au vert** (65 + 24 : charges réparties moteur + API) ; audit qualité passé.

## Validé numériquement
- LI : somme réactions=1 ; saut V unitaire ; saut de pente M ; zéros aux appuis.
- Charges mobiles : effet essieu unique = P·η·1.33 (SI/US) ; pipeline US exact.
- Charges réparties : `∫η⁺+∫η⁻=∫η` ; moment mi-travée travée simple = `w·L²/8` ;
  intégrale exacte == référence numérique fine ; équivalence live-JS == moteur (diff 0).

## Limites connues
- Charge de voie répartie (9.3 kN/m) non incluse (choix). Réaction travée simple =
  mécanisme → erreur explicite.
- **Dette** : équivalence live-JS = moteur vérifiée pour les charges réparties ; reste à
  couvrir pour l'effet véhicule HL-93.

## Lancer
- `run.bat` (ou `uvicorn backend.main:app --reload` + ouvrir `frontend/index.html`)
- `pytest tests/`
