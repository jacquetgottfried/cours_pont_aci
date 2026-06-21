<!-- CLAUDE : Ce fichier contient les vérités absolues du domaine métier, validées par l'utilisateur.
     APPEND ONLY — ne jamais supprimer une règle, seulement la marquer [OBSOLETE] si nécessaire.
     Si une modification de code contredit une règle ici, alerter avant d'agir.
     Ne pas y mettre : routes, état d'avancement, décisions techniques. -->

# Règles métier

## R1 — Principe de Müller-Breslau (libérations par grandeur)
La ligne d'influence d'une grandeur est la déformée de la structure quand on libère la
liaison associée et qu'on impose un déplacement unitaire (réalisé ici par charge unitaire
+ normalisation, réciprocité de Maxwell-Betti). Libérations :
- **Réaction (R)** : on libère le déplacement vertical de l'appui. Charge unitaire au DDL libéré.
- **Moment (M)** : rotule au point (rotation dédoublée), couple unitaire `P[θg]=+1, P[θd]=-1`.
- **Effort tranchant (V)** : coupure au point (déplacement vertical dédoublé), `P[uyg]=-1, P[uyd]=+1`.

## R2 — Normalisation
- R : LI = U / U[ddl_libéré].
- M, V : LI = U / (|U[gauche]| + |U[droite]|).

## R3 — Propriétés exactes (invariants de validation)
- Une LI s'annule à TOUS les appuis (sauf l'appui propre d'une LI de réaction, qui vaut 1).
- Somme des LI de réaction de tous les appuis = 1 en tout point (équilibre vertical).
- LI d'effort tranchant : saut de **valeur** unitaire au point étudié.
- LI de moment : saut de **pente** unitaire au point étudié ; déformée continue (pas de saut vertical).

## R4 — Hypothèses du modèle
- Poutre horizontale, flexion pure : Ux toujours bloqué (pas d'effort axial pertinent).
- Élément portique 2D, 3 DDL/nœud `[Ux, Uy, Theta]`.
- E, I, A uniformes ; sans effet sur la forme normalisée de la LI (défaut = 1).
- Chaque appui et chaque point étudié doit coïncider avec un nœud (`dx` divise les positions).

## R5 — Charges mobiles HL-93 (AASHTO LRFD, unités SI)
- **Camion de calcul** : essieux 35 / 145 / 145 kN ; espacement avant→1er arrière
  = 4.3 m ; espacement entre les deux essieux arrière variable de 4.3 m à 9.0 m
  (choisi pour maximiser l'effet ; 4.3 m gouverne souvent le moment positif).
- **Tandem** : 2 essieux de 110 kN espacés de 1.2 m.
- **Majoration dynamique (impact)** : IM = 33 % appliquée au camion/tandem (facteur 1.33).
- **Charge de voie répartie (9.3 kN/m) : non incluse** (choix projet, état actuel).
- **Effet d'une charge mobile** sur une ligne d'influence : `effet = (1+IM)·Σ P_i·η(x_i)`,
  où η est l'ordonnée de la LI interpolée à l'abscisse de l'essieu i.
  - LI de réaction / effort tranchant : η sans dimension → effet en **kN**.
  - LI de moment : η a la dimension d'une longueur → effet en **kN·m**.
  - Essieux hors de la poutre : non comptabilisés.
  - À l'aplomb d'une coupure (LI de V discontinue) : on retient le côté défavorable.
- **Balayage** : on promène le véhicule sur toute la poutre. On retient l'effet le plus
  positif (`max`) ET le plus négatif (`min`) — une poutre continue présente les deux
  (ex. soulèvement d'appui). Le cas `governing` est le plus grand en valeur absolue.

## R6 — Unités
- Le moteur est **adimensionnel/agnostique** : on lui passe la géométrie dans une unité
  de longueur (m en SI) et il renvoie les ordonnées dans cette même unité. Seule la
  **longueur** a un effet réel sur une ligne d'influence pure ; la force (kN) n'intervient
  qu'avec les charges mobiles (R5).

## R7 — Bascule d'unités SI / US (AASHTO LRFD) — validé
- L'AASHTO LRFD définit le HL-93 dans les **deux systèmes** avec des valeurs
  RÉGLEMENTAIRES DISTINCTES (pas des conversions arrondies) :
  - **US (customary)** : camion 8 / 32 / 32 kip ; tête→1er arrière = 14 ft ;
    arrière variable 14→30 ft. Tandem : 2 essieux de 25 kip espacés de 4.0 ft.
  - **SI** : valeurs de R5 (35/145/145 kN, 4.3 m, 4.3→9.0 m ; tandem 110 kN, 1.2 m).
  - IM = 33 % est **sans dimension, identique** dans les deux systèmes.
- **On ne convertit JAMAIS numériquement** un véhicule HL-93 : on stocke les deux jeux
  officiels (`engine.vehicle_loads.HL93`). Convertir le SI donnerait 7.87 kip ≠ 8 kip,
  donc un véhicule inexistant dans les deux codes (faux pédagogiquement).
- **Cohérence des unités** : une seule unité traverse tout le pipeline d'un calcul.
  Effet en force seule (R, V) ou force×longueur (M) → kN/kN·m (SI), kip/kip·ft (US).
- **Agnosticité préservée** (R6) : `unit_system` ne rentre PAS dans le moteur ; il pilote
  uniquement le catalogue véhicule, les bornes `rear_spacing`, les libellés et l'unité
  d'effet. Les invariants R3 (sans dimension) valent à l'identique dans les deux systèmes.

## R8 — Charges réparties permanentes DC / DW (AASHTO) — validé
- **DC** = poids propre (structure) ; **DW** = revêtement (wearing surface). Ce sont des
  charges réparties **permanentes** (kN/m en SI, kip/ft en US).
- **Effet d'une charge répartie** d'intensité `w` sur une ligne d'influence `η(x)` :
  `effet = w·∫η dx` (sur la longueur chargée). On réutilise le moteur de LI ; **aucun
  nouveau code éléments finis** (cf. 05 D8).
- **Charge permanente (toute la poutre, `full`)** : on intègre `η` sur toute la poutre.
  C'est numériquement **identique** à une analyse EF chargée sur toutes les travées →
  résultat correct d'une vraie charge permanente.
- **Chargement alterné (enveloppe défavorable)** : pour maximiser on ne charge que là où
  `η>0` → `max = w·∫η⁺` ; pour minimiser, là où `η<0` → `min = w·∫η⁻`. **La ligne
  d'influence donne ELLE-MÊME la pire configuration** (travées alternées) : pas de
  recherche par force brute. Les **zones chargées** sont les intervalles de signe de `η`.
- **Ligne d'enveloppe** : on balaie la section étudiée sur les nœuds. Sur poutre continue,
  le **moment max à mi-travée** (positif) et le **moment max sur appui** (négatif, souvent
  gouvernant) ressortent directement ; idem pour l'**effort tranchant max**.
- **Unités** (suivent R5/R6) : force seule pour R/V (`η` sans dimension), force×longueur
  pour M (`η` a la dimension d'une longueur). `unit_system` ne rentre pas dans le moteur.
- **DC et DW non factorisés** : pas de coefficient (1.25/1.50…) ; on rend l'effet de
  chacun et leur somme. La charge de voie répartie (9.3 kN/m) reste hors périmètre.
- **Invariants exacts** (validation) : `∫η⁺ + ∫η⁻ = ∫η` et `∫η⁺ ≥ ∫η ≥ ∫η⁻` ; moment à
  mi-travée d'une travée simple sous charge uniforme = `w·L²/8` ; les segments dédoublés
  au point de coupure (saut de V) sont ignorés dans l'intégration.

## R9 — Dalle de tablier : méthode de la bande équivalente (AASHTO) — validé
- La dalle est une **poutre continue TRANSVERSALE** portant sur les longerons (= appuis),
  extrémités libres = porte-à-faux. On réutilise `compute_influence_line` avec des
  `supports` aux positions de longerons : `total = 2·overhang + (N-1)·S`.
- **Trois sections de calcul** :
  - **Moment positif** : à mi-baie intérieure (ligne d'influence + balayage des roues) ;
  - **Moment négatif** : au droit d'un longeron **INTÉRIEUR** (jamais l'appui de rive :
    la rotule à l'appui extérieur fait « battre » le porte-à-faux → matrice singulière,
    cf. limite mécanisme) ;
  - **Porte-à-faux** : par **STATIQUE** (console isostatique), sans ligne d'influence :
    `M_LL = (1+IM)·Σ P·X`, `M_DC/DW = w·L²/2`. C'est aussi la pratique AASHTO.
- **Roue de calcul** = essieu arrière HL-93 / 2 (16 kip US, 72.5 kN SI), **dérivée** de
  chaque jeu officiel, jamais convertie d'un système à l'autre (cf. R7/D5). Gage
  transversal 6 ft / 1.8 m ; roue de rive à 1 ft / 0.3 m du bord ; IM = 33 %.
- **Largeur de bande équivalente E** (AASHTO LRFD Table 4.6.2.1.3-1) :
  - US (E en pouces, S/X en ft) : positif `26+6.6S`, négatif `48+3.0S`, porte-à-faux `45+10X`.
  - SI (E en mm, S/X en mm) : positif `660+0.55S`, négatif `1220+0.25S`, porte-à-faux `1140+0.833X`.
- **Moment de calcul par unité de largeur** : `m_LL = MPF · M_bande / E_longueur`
  (`E_longueur` = E/12 ft en US, E/1000 m en SI). `MPF` = facteur de présence multiple
  (défaut 1.20, une voie chargée).
- **Charge permanente** : DC (poids propre dalle) et DW (revêtement) intégrés sur la bande
  transversale (`w·∫η` aux sections + ; `w·L²/2` au porte-à-faux).
- **Combinaison Strength I à facteurs ÉDITABLES** : `Mu = γ_DC·M_DC + γ_DW·M_DW + γ_LL·(M_LL+IM)`,
  défauts γ = 1.25 / 1.50 / 1.75 (l'utilisateur peut les modifier).
- **Agnosticité préservée** (R6) : `deck.py` est un module de bord ; `compute_influence_line`
  n'est jamais appelé avec `unit_system`. Invariants de validation : porte-à-faux
  `M = P·X·(1+IM)` exact ; symétrie M⁻ ; linéarité en w ; `Mu = Σ γ·M`.
