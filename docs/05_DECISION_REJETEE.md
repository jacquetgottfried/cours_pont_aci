<!-- CLAUDE : Décisions d'architecture/approches abandonnées, avec la raison.
     APPEND ONLY. Consulté avant toute proposition d'architecture alternative. -->

# Décisions rejetées

## D1 — Équation des trois moments / méthode des forces (rejeté)
Pour le calcul des lignes d'influence. Moins général que la méthode matricielle des
déplacements (gestion plus lourde des appuis multiples, des coupures et des points
intérieurs) et plus difficile à exposer en une fonction/API unique. On garde
Müller-Breslau + méthode matricielle des déplacements.

## D2 — Wrapper les notebooks existants tels quels (rejeté)
Exposer directement la logique des 12 notebooks via l'API. Rejeté car les matrices `LM`
écrites à la main sont buguées (cf. audit) et non paramétrables. On a refactoré en un
moteur générique générant le `LM` automatiquement.

## D3 — Élément poutre 1D (2 DDL/nœud) (écarté pour l'instant)
Aurait réduit le système d'un facteur ~3 et supprimé la matrice de rotation. Écarté pour
conserver la continuité pédagogique avec la « méthode matricielle générale » (portique 2D,
3 DDL/nœud) des notebooks. Reste une optimisation possible.

## D4 — CSV historiques comme oracle de test (rejeté)
La plupart des CSV de `resultats/` sont faux (LM manuels bugués) : LIRA/LIRB non nuls près
de l'appui C, LIRC discontinuité aberrante (pic 0.28 au lieu de 1.0), LIVF coupure mal
placée. Seul `LIVE_resultats.csv` est correct (témoin). On valide donc sur des propriétés
analytiques exactes (cf. 04 R3), pas sur les CSV.

## Limite assumée — méthode « charge unitaire » et mécanismes
La résolution par charge unitaire exige que la structure libérée reste stable. Libérer
l'unique autre appui (réaction d'une travée simplement appuyée) crée un mécanisme :
matrice singulière, erreur explicite. Gérer ce cas nécessiterait la méthode du
déplacement imposé (condition de Dirichlet) — non implémentée.

## D5 — Convertir numériquement le véhicule HL-93 SI→US (rejeté)
Tentant de ne stocker qu'un jeu (SI) et de convertir (×1/4.4482, ×1/0.3048) pour l'US.
Rejeté : l'AASHTO définit des valeurs US **officielles distinctes** (8/32/32 kip, 14 ft),
pas des conversions. Convertir donnerait 7.87 kip, 14.1 ft… — un véhicule qui n'existe
dans aucun code, et faux pédagogiquement. On stocke les **deux jeux officiels** (cf. 04 R7).

## D6 — Convertir automatiquement la géométrie saisie au changement d'unité (rejeté)
Au toggle SI↔US, convertir les valeurs déjà saisies (15 m → 49.21 ft). Rejeté : casse
l'invariant R4 (chaque appui/point sur un nœud, `dx` divise les positions) — `dx` et les
positions converties ne tombent plus sur la grille → erreurs 400 immédiates après bascule.
Choix retenu : **réinitialiser les champs aux valeurs par défaut** de la nouvelle unité.
(Une conversion explicite avec re-snap sur la grille reste une évolution possible.)

## D7 — Mettre `unit_system` dans `compute_influence_line` (rejeté)
Faire connaître l'unité au moteur. Rejeté : briserait l'agnosticité (04 R6/R7) pour un gain
nul (les ordonnées sortent déjà dans l'unité d'entrée). L'unité reste un concept de bord
(catalogue véhicule, libellés, unité d'effet), géré par `vehicle_loads` / backend / frontend.

## D8 — Seconde analyse EF avec charges d'élément pour DC/DW (rejeté)
Pour les charges réparties permanentes, refaire une analyse EF directe : charges réparties
sur chaque élément → forces d'encastrement → assemblage → résolution → reconstruction du
diagramme M/V. Rejeté : **redondant**. L'effet `w·∫η dx` (cf. 04 R8) est mathématiquement
identique (c'est la définition même de la ligne d'influence) et réutilise
`compute_influence_line` **sans aucun nouveau code EF** (`calcul_structure.py` n'a ni
forces d'encastrement ni reconstruction de diagramme, et n'en a pas besoin). On garde la
philosophie « une fonction générique » : on intègre la LI déjà produite par le moteur.
Rejeté aussi : la **recherche de configuration par force brute** (essayer toutes les
combinaisons de travées chargées). Inutile — le **signe de la ligne d'influence** donne
directement la pire configuration (`∫η⁺` pour le max, `∫η⁻` pour le min).
