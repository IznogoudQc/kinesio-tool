# ADR 0042 — Mesures gardées en base, retirées de l'affichage

**Statut** : Accepté
**Date** : 2026-09-18
**Version** : v0.9.220

> Numérotation : la spec demandait « 0021 ». Ce numéro est pris depuis juillet
> ([[0021-silhouette-douleur-sante]]). Les ADR se numérotent dans l'ordre où elles
> sont prises, donc 0042.

## Contexte

Le formulaire de saisie des mesures ne propose que **cinq** circonférences :
taille, hanche, biceps fléchi, cuisse, épaules et pec ([[../../src/lib/mesure-fields]]).
Sept colonnes de `mesures_circonferences` ne lui correspondent plus — elles
viennent du schéma d'origine et d'imports `.doc` anciens.

Trois d'entre elles posent un problème particulier, parce qu'elles ont une
**jumelle encore active** :

| Colonne | Jumelle active | Ce que le document affichait |
|---|---|---|
| `bicepsD` | `bicepsG` | « Biceps fléchi » **et** « Biceps fléchi (droit) » |
| `cuisseD` | `cuisseG` | « Cuisse » **et** « Cuisse (droite) » |
| `poitrine` | `epaule` | « Poitrine » à côté d'« Épaules et pec » |

Côte à côte, les deux premières laissent croire à une mesure gauche/droite. Or la
colonne « de gauche » est celle que Marie saisit et **n'a pas de côté** (voir
[[0041-backup-onedrive-quotidien]] pour le contexte de cette asymétrie), et celle
de droite ne bouge plus depuis l'import. D'où la question qui a déclenché cette
ADR : « pourquoi une Poitrine à 132 cm en juillet 2026, on ne l'a jamais
reprise ? »

Le document client affirmait l'inverse de cette décision, avec son propre
argument : « un document qui les tairait perdrait des mesures que le client a bel
et bien passées ». C'est vrai — mais afficher une valeur figée à côté de mesures
vivantes, sans rien dire, en fait une mesure d'aujourd'hui. Et Marie ne peut rien
en faire.

## Décision

**Les colonnes restent en base, les trois mesures disparaissent de l'affichage.**

Une liste unique, `src/lib/mesures-legacy-fields.ts`, lue par
`groupesDeMesures()` — donc le filtre s'applique d'un coup aux encadrés, aux
courbes, à l'explorateur interactif et au tableau « Toutes vos prises ». Pas de
filtre à répéter dans chaque vue, donc pas de vue qui puisse l'oublier.

Le Dashboard n'avait rien à changer : ses pastilles de métrique (`METRICS_DEFS`)
et son panneau « Voir toutes les mesures détaillées » (`ALL_CIRC`) ne listaient
déjà que les cinq mesures actives.

**Aucune migration.** Les colonnes ne sont pas supprimées, les données ne sont pas
effacées, et l'export `.kinesio` continue de les transporter — la validation
permissive de `client-bundle.ts` en dépend, et un vieux fichier doit rester
importable. Un test vérifie que les trois colonnes sont toujours dans le schéma.

### Les quatre autres restent affichées

`cou`, `abdomen`, `molletG`, `molletD` ne sont pas au formulaire non plus, mais
n'ont **pas de jumelle active** : rien à confondre, juste des mesures qu'on ne
reprend plus. Elles restent visibles pour les clients qui en ont. À revoir si
elles se mettent à gêner — il suffira d'ajouter la clé à la liste.

## Alternatives rejetées

**`DROP COLUMN`.** Casserait la relecture des `.kinesio` anciens, et effacerait
des mesures que le client a réellement passées. Irréversible pour un gain
purement cosmétique.

**Afficher avec un badge « historique — non remis à jour ».** Ajoute du bruit
dans un document remis au client, pour une information dont il ne peut rien
faire. Et le badge devrait être répété sur chaque encadré, chaque point de
courbe, chaque ligne de tableau.

**Filtrer dans chaque vue.** Le filtre aurait été écrit trois ou quatre fois, et
la quatrième vue ajoutée plus tard l'aurait oublié. Un seul point d'entrée dans
le module pur.

## Réactivation

Retirer la clé de `LEGACY_CIRC_FIELDS` **et** rajouter le champ à
`MESURE_FIELDS`. Les points historiques reviennent d'eux-mêmes dans les encadrés,
les courbes et le tableau : rien n'a été effacé. Les deux gestes vont ensemble —
réactiver l'affichage sans réactiver la saisie ramènerait exactement le problème
que cette ADR corrige.
