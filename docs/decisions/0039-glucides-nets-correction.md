# 0039 — Correction de l'ADR 0038 : les fibres ne se rajoutent pas aux glucides nets

- **Statut** : acceptée
- **Date** : 2026-08-02
- **Version** : v0.9.114
- **Corrige** : [[0038-glucides-nets]]

## Ce qui était faux

L'ADR 0038 affirmait que « les glucides **totaux** restent calculables et sont
affichés en contexte (`nets + fibres`) ». L'app affichait effectivement, sous le
bloc Macros :

> Ici : 147 g nets + 28 g de fibres = 175 g de glucides totaux.

C'est un raisonnement invalide, relevé par Nicholas : *« on peut pas dire que
c'est le total des glucides de ta journée + les fibres »*.

## Pourquoi

Les deux nombres ne sont pas de même nature.

- Les **glucides nets** se calculent **par aliment** : les glucides de cet
  aliment moins ses fibres, tels qu'inscrits sur son étiquette.
- La **cible de fibres** est dérivée des **calories** (14 g / 1000 kcal). Ce
  n'est pas la somme des fibres réellement contenues dans les aliments qui
  fournissent les glucides nets de la journée.

Additionner les deux mélange une **cible** et une **observation**. Le « total »
obtenu ne correspond à aucun repas réel : rien ne garantit que les aliments
choisis apportent exactement 28 g de fibres, et s'ils en apportaient 40, les
glucides nets ne bougeraient pas pour autant.

Ce sont deux cibles **indépendantes** : tant de glucides nets, tant de fibres.

## Décision

- La fonction `totalCarbsG()` est **supprimée**, pas corrigée : il n'existe pas
  de « glucides totaux » calculables à l'échelle d'une journée à partir de nos
  données.
- La ligne d'exemple est retirée de l'onglet, remplacée par un rappel explicite
  que la cible de fibres est une cible à part.
- `NET_CARBS_EXPLANATION` dit maintenant que le calcul se fait **par aliment**.
- Un test garde le module : il échoue si un helper `totalCarbs*` réapparaît, et
  vérifie que l'explication mentionne bien « par aliment ».

## Ce qui reste vrai de l'ADR 0038

Tout le reste. Le chiffre saisi est le glucide net, les fibres comptent 0 kcal,
l'énergie reste `P×4 + net×4 + L×9`, et **aucune valeur client n'a changé**.
Le raisonnement sur la circularité (fibres ← calories ← glucides ← fibres) tient
toujours — il est même renforcé : les fibres ne sont pas une composante des
glucides ici, mais une cible parallèle.

## Leçon

L'erreur n'était pas dans le calcul mais dans le **sens** donné à deux nombres
qui se ressemblent. Une valeur dérivée d'une règle (`14 g / 1000 kcal`) et une
valeur mesurée sur un aliment ne s'additionnent pas, même quand l'unité est la
même. Voir aussi [[0036-source-table-aerobie-corrigee]] : même famille d'erreur,
attribuer à un nombre une provenance qu'il n'a pas.
