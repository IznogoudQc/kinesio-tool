# 0030 — Score « Santé et condition physique globale » : structure reconstituée (calibration en cours)

- **Statut** : accepté — **provisoire**, à réviser
- **Date** : 2026-07-27
- **Contexte** : scores composites / parité avec le logiciel d'origine
- **Complète** : ADR 0028 (dos + musculo), 0029 (norme unique)

## Contexte

Marie a fourni la formule du logiciel d'origine :

```
AverageRatings([Questionnaire combiné]×1, [Composition corporelle]×1,
               [Pression artérielle systolique]×1, [METS max]×1,
               [Indice de santé du dos]×1, [Aptitudes musculosquelettiques]×1, [166]×1)
```

Deux enseignements décisifs :

1. **Ce sont les cotes entières 0-4 qui sont moyennées**, pas les scores décimaux. C'est ce
   qui bloquait toutes les tentatives précédentes : le logiciel fait la moyenne de 4 et 4,
   pas de 3,6 et 3,7.
2. La **pression artérielle systolique** est une composante à part entière — l'app ne
   l'incluait pas du tout.

Comme ailleurs dans le protocole, seules les composantes **réellement mesurées** comptent.

## Décision

`computeBilan.overall` devient la moyenne des **cotes 0-4** des composantes mesurées :
composition, aptitude aérobie (METS max), PA systolique, indice du dos, aptitude
musculosquelettique — toutes ×1. `overallDetail` expose le calcul pour l'affichage.

Le **questionnaire combiné** et le test **[166]** sont exclus : Marie ne les utilise pas
(confirmé le 2026-07-27).

### Barème PA systolique — PROVISOIRE

`systolicRatingLegacy` (`clinical.ts`) : **< 120 mmHg → 4, sinon 0**.

Déduit par rétro-calcul sur 4 bilans réels — 112 → 4, 113 → 4, 122 → 0, 129 → 0 — c'est la
règle la plus simple compatible avec ces quatre points, et 120 est la borne clinique standard
de la PA optimale.

**Ce qu'on ignore** : la frontière exacte entre 113 et 122, et l'existence de cotes
intermédiaires (1, 2, 3). Un barème à 5 niveaux est plus vraisemblable qu'un tout-ou-rien.

## Validation

| Bilan | Cotes | Calcul | Ancien logiciel |
|---|---|---|---|
| Nick 2026-06 | comp 4, aéro 4, PA 4, dos 4, musculo 4 | 20/20 → **4,0** | 4,0 ✓ |
| Nick 2025-09 | comp 0, aéro 4, PA 0, dos 3, musculo 4 | 11/20 → **2,2** | 2,2 ✓ |
| Nick 2011-08 | comp 2, aéro 4, PA 0, dos 2, musculo 3 | 11/20 → **2,2** | 2,2 ✓ |
| Nick 2025-12 / 2026-01 / 2026-02 | comp 2, dos 2 | 4/8 → **2,0** | 2,0 ✓ |
| Sab 2026-06 | comp 0, aéro 2, PA 4, dos 2, musculo 2 | 10/20 → **2,0** | 2,0 ✓ |

## Le cas non résolu

**Sabrina, 12 janvier 2026 — global 1,5.** Cotes lues : composition 0, aérobie 0, dos 1,
musculo 2 (somme 3), PA 117.

Une moyenne de cotes entières sur *n* composantes ne peut valoir 1,5 que si `1,5 × n` est
entier, donc **n doit être pair**. Or on compte 5 composantes mesurées → **arithmétiquement
impossible**, quelle que soit la cote attribuée à la PA.

Il faut donc 4 ou 6 composantes notées. Ni le questionnaire ni un score de risque coronarien
n'apparaissent dans son rapport. Une composante nous échappe encore.

## Conséquences

- Le score global **change** pour tous les bilans existants. C'est voulu : l'ancien calcul
  (moyenne des scores décimaux de 4 composantes, sans la PA) donnait 2,5 au lieu de 2,2 et
  faisait basculer la **catégorie** (« Très bien » au lieu de « Bien ») dans la moitié des cas.
- La carte du dashboard affiche un **avertissement de calibration** tant que le barème PA
  n'est pas confirmé.
- **À faire** : obtenir la table de classification des tests « Pression artérielle systolique »
  et « METS max » depuis la fenêtre Propriétés du logiciel d'origine, puis identifier la
  composante manquante du bilan de janvier.
