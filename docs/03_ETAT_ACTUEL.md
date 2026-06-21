<!-- CLAUDE : Snapshot court de l'état du projet. Maximum 30 lignes.
     Remplacer le contenu à chaque /ce — ce n'est pas un journal, c'est un état présent.
     Doit répondre à : "Si je reprends demain, où est-ce que j'en suis ?"
     Ne pas y mettre : historique, décisions, routes API. -->

# État actuel

Branche : `refactor/ui-support`. **Poutre longitudinale + Tablier (dalle), UI à 2 onglets.**

## Fait
- Moteur `engine/` : `compute_influence_line` (agnostique) + `vehicle_loads` (HL-93) +
  `distributed_loads` (DC/DW : `effet=w·∫η`, enveloppes M & V) + `deck` (dalle).
- **Tablier (dalle)** — `deck.py`, méthode de la **bande équivalente** AASHTO : poutre
  transversale sur les longerons. 3 sections : positif (mi-baie, IL), négatif (longeron
  intérieur, IL), porte-à-faux (**statique**, car l'IL de l'appui de rive = mécanisme).
  `m_LL = MPF·M_bande/E` (E US in / SI mm) ; DC/DW + combinaison `Mu = γ·M` à facteurs
  **éditables**. Roue = essieu HL-93/2. SI+US. Cf. 04 R9 / 05 D9-D10.
- Backend FastAPI : + `GET /deck-catalog`, `POST /deck-design` (en plus de l'existant).
- Frontend : **UI refonte à onglets** « Poutre longitudinale » | « Tablier » (bascule
  SI/US partagée, 2 colonnes entrées|sorties). Onglet dalle : tableau des moments (3
  sections × DC/DW/LL+IM/E/Mu) + 2 IL transversales (roues placées, zones DC/DW ombrées).
- **120 TU au vert** (92 + 28 : dalle moteur + API) ; audit qualité OK.

## Validé numériquement
- LI : somme réactions=1 ; saut V unitaire ; saut de pente M ; zéros aux appuis.
- Charges réparties : `∫η⁺+∫η⁻=∫η` ; mi-travée travée simple = `w·L²/8` ; live-JS == moteur.
- Dalle : porte-à-faux `M=P·X·(1+IM)` exact ; symétrie M⁻ ; E AASHTO US/SI ; `Mu=Σγ·M` ;
  échantillon US (M⁻≈-30.9, M⁺≈+24.6, porte-à-faux≈47.9 ; E 78.8/72/67.5 in).

## Limites connues
- Charge de voie répartie (9.3 kN/m) non incluse (choix). Mécanisme (réaction travée
  simple, IL appui de rive du porte-à-faux) → erreur explicite / traité par statique.
- **Dette** : équivalence live-JS = moteur couverte (réparties) ; pas pour le véhicule HL-93.

## Lancer
- `run.bat` (ou `uvicorn backend.main:app --reload` + ouvrir `frontend/index.html`)
- `pytest tests/`
