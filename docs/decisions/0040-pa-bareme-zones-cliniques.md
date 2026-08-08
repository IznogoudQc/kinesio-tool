# 0040 — La cote de PA systolique suit les zones cliniques, pas le rétro-calcul

**Statut** : acceptée · **Date** : 2026-08-07 · **Version** : v0.9.145

Corrige la section « Barème PA systolique — PROVISOIRE » de
[[0030-score-global-structure-reconstituee]], qui l'annonçait explicitement comme
à remplacer « dès que Marie fournit la table de classification ».

## Contexte

La cote 0-4 de la pression artérielle systolique — une des cinq composantes du
score global — reposait sur un **rétro-calcul** : `< 120 mmHg → 4, sinon 0`.

Elle n'avait jamais été lue nulle part. Elle avait été *déduite* de quatre bilans
réels (112 → 4, 113 → 4, 122 → 0, 129 → 0), en cherchant la règle la plus simple
qui reproduise les scores globaux imprimés par l'ancien logiciel. C'était le
dernier point 🔴 du projet.

Une piste évidente avait été explorée puis écartée : coter sur les cinq zones
cliniques déjà affichées au client (120/130/140/160). Elle donne 3 à une tension
de 122, là où le rétro-calcul impose 0. Une recherche exhaustive sur tous les
découpages à cinq niveaux ne laissait que des solutions confinées dans une
fenêtre de ~8 mmHg — cliniquement absurde. La conclusion, consignée dans
`cpafla-parite.test.ts`, était : « ne pas les retenter ».

## Ce qui a changé

Nicholas a fourni une **capture de l'écran d'affichage de l'ancien logiciel**
(2026-08-07). Elle montre :

- les cinq zones systoliques aux bornes **120 / 130 / 140 / 160** ;
- les cinq zones diastoliques aux bornes **75 / 80 / 90 / 100** ;
- **aucune distinction homme/femme ni par âge**.

C'est une observation directe du logiciel de référence, pas une inférence. Elle
prime sur un rétro-calcul.

## Décision

**La cote suit les cinq zones.**

| Systolique | Zone | Cote |
|---|---|---|
| < 120 | Optimale | 4 |
| 120-129 | Normale | 3 |
| 130-139 | Pré-hypertension | 2 |
| 140-159 | Hypertension 1 | 1 |
| ≥ 160 | Hypertension 2 | 0 |

`systolicRatingLegacy` devient `systolicRating` — le nom disait « héritée », elle
ne l'est plus.

Les bornes **diastoliques** passent de 80/85/90/100 à **75/80/90/100**. Ce
n'était pas l'objet de la demande : le décalage a été trouvé sur la même capture.
Deux zones sur cinq étaient fausses, sur un écran remis au client.

## Conséquence assumée

Les zones ne reproduisent pas deux rapports de l'ancien logiciel :

| Bilan | PA | Ancien logiciel | Désormais |
|---|---|---|---|
| Nick 2025-09 | 122 | 2,2 | **2,8** |
| Nick 2011-08 | 129 | 2,2 | **2,8** |

Nicholas a tranché : la cohérence avec les zones publiées — et avec ce que le
client voit sur sa propre barre — prime sur la reproduction de ces deux scores.

Les deux lectures sont incompatibles ; l'une des deux devait céder. Il reste
possible que l'ancien logiciel applique une règle différente pour la cote et pour
l'affichage, mais rien ne le documente, et sa propre fenêtre montre les zones.

**L'écart n'est pas effacé.** `cpafla-parite.test.ts` le garde chiffré, avec la
consigne de ne pas le « corriger » : une parité abandonnée sciemment ressemble,
six mois plus tard, à une régression.

Aucune donnée n'a été modifiée — les scores sont recalculés à l'affichage, jamais
stockés. Revenir en arrière suffirait à retrouver les anciennes valeurs.

## Ce que ça ferme

Points **1** et **3** de `docs/a-valider-avec-marie.md`. Il ne reste plus de 🔴 :
tout ce qui entre dans une note remise à un client est désormais confirmé.
