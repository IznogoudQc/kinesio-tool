# ADR 0043 — Couverture du bilan imprimée à part, sans bandeaux

**Statut** : Accepté
**Date** : 2026-09-27
**Version** : v0.9.233

## Contexte

Depuis v0.9.233, le PDF du bilan porte des bandeaux de page : un en-tête
(« KINÉSIO CONSEIL » / « Bilan de forme physique ») et un pied (« Nom / Évaluation
du … », « n / N »). Ils viennent de `headerTemplate` / `footerTemplate` de
`printToPDF`, seule voie dans Chromium : les boîtes de marge de CSS Paged Media
(`@top-left`, `counter(pages)`) n'y sont pas appliquées.

Ces gabarits **ignorent sur quelle page ils sont**. Ils ne peuvent pas se taire
en page 1. Sur la couverture refaite (bandeau marine avec le logo et « Kinésio
Conseil »), l'en-tête courant s'imprimait au-dessus du bandeau marine : le nom
apparaissait deux fois, séparé par une bande blanche de 8 mm.

## Options

1. **Laisser l'en-tête sur la couverture.** Rien à faire, mais le doublon se voit
   sur la page que le client regarde en premier.
2. **Alléger le bandeau de couverture** (retirer le nom, le coller au filet).
   Une seule passe, mais la couverture garde une marge blanche en haut et un
   en-tête de document courant, ce qui ne ressemble pas à une couverture.
3. **Deux passes.** Imprimer le document entier avec bandeaux, puis la couverture
   seule sans bandeaux et à fond perdu, et substituer la page 1.

## Décision

**Option 3.** `generateClientReportPdf` imprime deux fois dans la même fenêtre :

- passe 1 : document complet, bandeaux activés ;
- passe 2 : `pageRanges: '1'`, sans bandeaux, avec du CSS injecté
  `@page :first { margin: 0 }` et `.report-cover { height: 297mm }` pour que la
  couverture occupe toute la feuille ;
- `remplacerCouverture` (pdf-lib) retire la page 1 de la passe 1 et y insère celle
  de la passe 2.

La pagination vient de la passe 1 : la page 2 reste « 2 / 16 », la couverture
compte dans le total sans afficher de numéro.

## Conséquences

- **Nouvelle dépendance : `pdf-lib`** (MIT, JavaScript pur, pas de module natif,
  donc rien à recompiler pour Electron). Installée avec `--ignore-scripts` pour ne
  pas relancer la reconstruction de better-sqlite3.
- Une impression de plus par bilan (la page 1 seule, environ une seconde).
- La couverture de la passe 1 est jetée : sa hauteur n'a qu'à ne pas déborder sur
  une deuxième page. Toute la mise en page « pleine feuille » se juge sur la
  passe 2.
- Les trois documents autonomes (nutrition, mesures, journal) ne sont pas
  concernés : ils n'ont pas de couverture séparée, leurs bandeaux restent sur
  chaque page.
