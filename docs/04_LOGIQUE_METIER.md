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
- **Effort tranchant à la coupure (validé)** : la LI de V est discontinue à la section. Le
  cisaillement **avant** (gauche, négatif = `min`) et **après** (droite, positif = `max`)
  la coupure sont **deux efforts de calcul distincts** ; on rend les deux (le front les
  affiche séparément). `governing` = le plus grand en valeur absolue.

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
  (`E_longueur` = E/12 ft en US, E/1000 m en SI).
- **Charge roulante multi-voies (1 / 2 / 3 voies chargées) — validé** : on construit un
  **train de roues** où chaque voie chargée apporte 2 roues (gage 1.8 m / 6 ft) et où les
  voies sont à entraxe `LANE_WIDTH` (3.6 m / 12 ft). On **balaye** ce train (`sweep_effect`)
  et on retient le max (section positive), le min (section négative) ou le pire (tranchant).
  Le **facteur de présence multiple (MPF) est ÉDITABLE par nombre de voies** (défauts AASHTO
  1.20 / 1.00 / 0.85) ; on rend l'effet détaillé pour 1/2/3 voies (transparence) et le
  **gouvernant** = plus grand `|M_LL|` (`M_LL = MPF · M_bande / E`). Train rigide = simplif.
  pédagogique (cf. 05).
- **Charges permanentes** (toujours présentes = chargement complet `full`, cf. R8) :
  - **DC/DW répartis** (poids dalle, revêtement) : `w·∫η` aux sections, `w·L²/2` au
    porte-à-faux ;
  - **Charges ponctuelles DC** *barrière* et *glissière* (charges linéiques le long du pont
    → ponctuelles sur la bande transversale) : appliquées en **PAIRE SYMÉTRIQUE aux deux
    rives** (`x` mesuré depuis CHAQUE bord, cf. `edge_point_loads` — validé : un pont
    porte ses équipements de bord des deux côtés ; une seule charge si `x` tombe au
    centre). Effet `Σ P·η(x)` en section (réutilise `interp`, cumul par nom),
    `Σ P·X` (statique) au porte-à-faux — la charge miroir de l'autre rive n'y contribue
    pas. Détaillées séparément (`M_DC_dist`, `M_DC_barrier`, `M_DC_rail`).
  - Le **pattern loading η⁺/η⁻** reste RÉSERVÉ à la charge roulante (R8) ; les permanentes
    ne sont jamais alternées.
- **Effort tranchant (V) au longeron intérieur — validé** : section sur LI de V au droit du
  même longeron intérieur que le moment négatif. Faute de formule de bande AASHTO en
  cisaillement, on réutilise la **largeur de bande négative** comme dénominateur (choix
  pédagogique, cf. 05) ; unité par largeur = force/longueur (kN/m | kip/ft). Saut de valeur
  unitaire de la LI (invariant R3) conservé.
- **Combinaison Strength I à facteurs ÉDITABLES** : `Mu = γ_DC·M_DC + γ_DW·M_DW + γ_LL·(M_LL+IM)`,
  défauts γ = 1.25 / 1.50 / 1.75 (l'utilisateur peut les modifier). Pour la section
  tranchant, `Mu` désigne l'effort tranchant factorisé `Vu`.
- **Agnosticité préservée** (R6) : `deck.py` est un module de bord ; `compute_influence_line`
  n'est jamais appelé avec `unit_system`. Invariants de validation : porte-à-faux
  `M = P·X·(1+IM)` exact ; charge ponctuelle `P·η` / `P·X` ; symétrie M⁻ ; linéarité en w et
  en P ; `M_LL = MPF·M_bande/E` par voie ; saut unitaire de V ; `Mu = Σ γ·M`.

## R10 — Étude d'une section transversale CHOISIE par l'utilisateur (tablier) — validé
- Extension pédagogique de R9 (`deck_section_study` / `POST /deck-section-study`) :
  l'étudiant choisit la section `target_x` (nœud de la grille dx, hors extrémités) et
  obtient le MOMENT et L'EFFORT TRANCHANT à cette section EN UN APPEL (2 LI).
- **Inférence du type de bande E** (l'AASHTO ne définit E que pour M⁺/M⁻/porte-à-faux) :
  `V` → bande NÉGATIVE (cohérent D14) ; `M` au droit d'un longeron (tol 1e-9) → bande
  NÉGATIVE ; `M` ailleurs (baie OU porte-à-faux) → bande POSITIVE. Le type utilisé
  (`strip_kind`) est renvoyé et affiché. La bande « overhang » n'est PAS applicable à une
  section arbitraire (X y est une grandeur par charge, pas par section, cf. 05 D16).
- **Extrême retenu par cas de voies : `governing` SIGNÉ** (pour M et V). Le signe
  enseigne : en glissant la section de la mi-baie (M>0) vers un longeron (M<0),
  l'étudiant voit le basculement. Cohérent avec la section tranchant de `deck_design`.
- **Cas 1/2/3 voies COMPLETS** : chaque cas porte ses roues au placement critique
  (`wheels`, propre à chaque grandeur : la position critique de M diffère de celle de V)
  et sa combinaison `Mu_n = γ_DC·M_DC + γ_DW·M_DW + γ_LL·M_LL_n` (M_DC/M_DW ne dépendent
  pas du nombre de voies). Tout est calculé en Python (jamais en TS). Le sélecteur 1/2/3
  voies du front est une SÉLECTION DE VUE sur les cas déjà calculés (pas de recalcul).
- **Roues sur la coupe transversale — validé** : la coupe matérialise les roues du cas
  de voies sélectionné (flèches + charges), avec une bascule explicite « Roues M /
  Roues V » car le placement critique DIFFÈRE entre les deux grandeurs (révision de
  05 D16-a à la demande utilisateur : l'ambiguïté est levée par la bascule, pas en
  masquant les roues).
- **Charges permanentes OPTIONNELLES** pour l'étude (`w_dc = w_dw = 0` accepté : question
  « effet des véhicules seuls » légitime, `Mu = γ_LL·M_LL`) ; `/deck-design` garde son
  validateur « au moins une charge permanente » (un dimensionnement sans poids propre n'a
  pas de sens).
- **Section sur le porte-à-faux ou au longeron de rive** : mécanisme à 1 DDL → géré par
  le mode cinématique (cf. 05) ; la LI de M sur console vérifie `η(x)=0` pour `x` côté
  appuis (invariant). Le dimensionnement RÉEL du porte-à-faux reste la statique (R9/D9).
- **Invariants de validation** (tests `test_deck_study.py`) : l'étude à `girders[1]`
  REPRODUIT les sections négative et tranchant de `deck_design` ; à mi-baie, la section
  positive ; `M_LL = MPF·M_strip/E` par cas ; `Mu` par cas ; roues du cas gouvernant =
  roues de la vue d'IL.
