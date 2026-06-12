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
