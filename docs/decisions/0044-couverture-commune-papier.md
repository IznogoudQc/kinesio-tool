# ADR 0044 — Couverture commune, sur papier seulement pour les documents autonomes

**Statut** : Accepté
**Date** : 2026-09-27
**Version** : v0.9.234

> Prolonge [[0043-couverture-bilan-deux-passes]], qui ne visait que le bilan.

## Contexte

Le bilan a sa couverture depuis v0.9.233. Le plan nutrition et le suivi des
mesures devaient recevoir la même, factorisée dans `src/components/DocumentCover`
et partagée entre le bundle de l'app et le bundle autonome. Le journal
alimentaire n'en a pas : c'est une grille d'une page.

Ces deux documents sont aussi des pages web. Ils s'ouvrent sur un hero plein
écran (fond marine, forêt, 65 svh), responsive et retravaillé pour la lecture à
l'écran en v0.9.231. Or la couverture est pensée pour une feuille A4 : unités en
mm et en pt, grille à deux colonnes, titres de 40 pt.

## Options

- **(a) Couverture à l'impression seulement.** Le hero reste à l'écran ; la
  couverture est `.ed-print-only`, le hero `.ed-no-print`.
- **(b) La couverture remplace le hero partout.** Une seule présentation.

## Décision

**(a).** Le rendu a tranché ; les deux options ont été regardées dans Chrome :

- en 1440 px, la couverture s'étirait sur toute la largeur, comme une feuille
  agrandie : grille aux colonnes très espacées, texte petit ;
- sur téléphone (390 px), elle cassait : « Kinésio Conseil » et « Votre plan » sur
  deux lignes, repères coupés mot par mot, « % de gras » coupé ;
- sur le plan nutrition, elle répétait l'objectif : la carte « 12 % de gras » était
  suivie de la section « Cap sur 12 % de gras ».

## Mise en œuvre

- `DocumentCover` porte ses polices (`document-cover.css` : Fraunces et Inter,
  les mêmes que le rapport). Les documents autonomes ne chargent pas `print.css`,
  et leur couverture retombait sinon sur Georgia et une police système.
- La page de couverture est `.doc-cover-page` : 296 mm à l'impression, à fond
  perdu grâce à `@page :first { margin: 0 }`. Cette règle est posée dans chacun
  des deux documents, pas dans `editorial.css`, que le journal partage.
- Dans l'app, `htmlFileToPdf` applique à ces documents les deux passes du bilan :
  la page 1 est réimprimée sans bandeaux, puis substituée. La règle des 18 mm de
  la première passe est **retirée** (`removeInsertedCSS`) avant la seconde : la
  surcharger par `@page :first { margin: 0 !important }` ne suffisait pas.
- Un client qui imprime le HTML depuis son navigateur obtient la même
  couverture, à fond perdu, sans bandeaux (ceux-ci n'existent que dans le PDF de
  l'app).

## Conséquences

- Chaque document autonome pèse environ 220 ko de plus (1,53 → 1,75 Mo) : les
  polices (environ 155 ko en base64) et le filigrane (environ 60 ko). Le poids
  touche aussi le journal et le bilan interactif, qui partagent le gabarit sans
  afficher la couverture.
- Deux présentations d'un même document coexistent, l'une pour l'écran et
  l'autre pour le papier. Toute évolution de l'ouverture doit être vérifiée des
  deux côtés.
