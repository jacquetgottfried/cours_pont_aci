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
