# ADR 0033 — Score global : formule confirmée par l'ancien logiciel

- **Statut** : acceptée
- **Date** : 2026-07-28
- **Remplace la reconstitution de** : [[0030-score-global-structure-reconstituee]]

## La formule

Nicholas a fourni la capture de la fenêtre Propriétés du test « Santé et
condition physique globale ». Formule **identique pour les hommes et les
femmes** :

```
AverageRatings([Questionnaire combiné]*1, [Composition corporelle]*1,
  [Pression artérielle systolique]*1, [METS max]*1, [Indice de santé du dos]*1,
  [Aptitudes musculosquelettiques]*1, [166]*1)
```

Sept composantes, **toutes pondérées ×1**. `AverageRatings` = moyenne des cotes
entières 0-4, **des composantes mesurées seulement**.

## Ce que ça confirme

Tout ce qui avait été reconstitué par rétro-calcul dans l'ADR 0030 :

- moyenne de **cotes entières**, pas de scores décimaux ;
- **poids égaux** ;
- les composantes **non mesurées sont exclues**, pas comptées 0 ;
- la **PA systolique** fait bien partie du calcul.

Notre `aerobic` correspond à leur « METS max » : le METS n'étant que le
VO2max ÷ 3,5, la cote est la même.

## Ce que ça résout

**Le bilan de Sabrina du 12 janvier 2026** (global 1,5), inexpliqué depuis
l'ADR 0030. La 6ᵉ composante est le **Questionnaire combiné**.

| | |
|---|---|
| Cotes connues | composition 0, METS max 0, dos 1, musculo 2, PA (117) 4 → somme 7 |
| Sans questionnaire | 7 ÷ 5 = **1,4** ✗ |
| Questionnaire coté 2 | 9 ÷ 6 = **1,5** ✓ |

C'est la seule cote de questionnaire qui donne 1,5 (0→1,2 · 1→1,3 · 3→1,7 ·
4→1,8). L'argument de parité tient : une moyenne de cotes entières ne peut
valoir 1,5 qu'avec un nombre pair de composantes, car 1,5 × 5 = 7,5 n'est pas un
entier atteignable par une somme d'entiers.

## Ce qu'on implémente : cinq composantes sur sept

- **[166]** — Marie ne l'utilise pas (confirmé par Nicholas).
- **[Questionnaire combiné]** — Marie ne le fait pas à chaque fois ; décision de
  Nicholas de ne pas en tenir compte pour l'instant.

Les cinq autres sont implémentées et reproduisent l'ancien logiciel sur tous les
bilans où le questionnaire n'a pas été rempli (4 sur 4 vérifiés).

## Ce qui reste ouvert

Le **barème de la PA systolique**. La règle provisoire « < 120 → 4, sinon 0 »
passe sur tous les bilans vérifiés. Une échelle à 5 niveaux calquée sur la barre
« Optimale / Normale / Pré-hypertension / Hypertension 1 / Hypertension 2 » a été
testée par recherche exhaustive et **écartée** : les seuls jeux de seuils
compatibles avec les quatre points connus tiennent dans une fenêtre de 9 mmHg,
soit des zones d'environ 1 mmHg. Voir les tests de `cpafla-parite.test.ts`.

Reste donc à obtenir la table de classification du test « Pression artérielle
systolique » depuis la même fenêtre Propriétés.
