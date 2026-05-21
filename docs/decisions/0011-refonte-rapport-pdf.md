# ADR 0011 — Refonte éditoriale du rapport PDF client

**Statut** : Accepté
**Date** : 2026-05-15

## Contexte

Le rapport PDF généré par `reports.generatePdf` (route React `/report/:id`, capturée par `webContents.printToPDF`) était hérité du format de l'ancien logiciel de Marie-Eve : une succession de tableaux denses (profil, dernier bilan champ par champ, quelques graphes, historique). Lisible par un technicien, mais peu parlant pour **le client**, qui veut surtout voir : « est-ce que je progresse ? ».

L'objectif : transformer ce document en un livrable éditorial qui **valorise la progression** — inspiré des rapports santé modernes (Apple Health, bilans kiné premium).

## Options

### A. Conserver le format tableau CPAFLA standard
- Avantage : familier, compact.
- Inconvénient : aucune différenciation, pas de récit de progression, peu engageant. **Rejeté.**

### B. Refonte éditoriale en 6 sections, orientée client ← retenu
1. Couverture (avatar, nom, score global en anneau)
2. Votre parcours (métrique héros, frise des bilans, tableau avant/après)
3. Synthèse 1 page (4 cards de catégorie composite)
4. Graphiques de progression (2 pages, 4 graphes chacune)
5. Pages détaillées par métrique (barème ACSM + objectif niveau suivant)
6. Forces & axes de progression (+ mot du kinésiologue)

Chaque section est forcée sur sa propre page A4 (`break-after: page`).

## Décisions d'implémentation

### Polices — bundlées localement (pas de CDN)
L'app est **locale** : le PDF peut être généré sans connexion. Un `@import` Google Fonts échouerait alors silencieusement et le PDF retomberait sur une serif système. Les polices **Fraunces** (titres) et **Inter** (corps) sont donc téléchargées en `.woff2` (sous-ensemble latin, fichiers variables) dans `src/assets/fonts/` et déclarées en `@font-face` local dans `src/print.css`. ReportPage attend `document.fonts.ready` avant de poser `window.__REPORT_READY__`.

### Format de page — A4
`printToPDF` passe de `Letter` à `A4`. Chaque `<ReportSection>` fait `210mm` de large, `min-height: 293mm`, `box-sizing: border-box` — une section = une page, sans débordement ni page blanche parasite.

### Réutilisation
Les scores composites viennent de `computeSynthesis` (`lib/norms/scoring`). La catégorisation par métrique réutilise `getCategorization` / `getNormPercentiles` / `getPercentile` / `getNextCategoryTarget` + `BILAN_TO_TEST_KEY`. Le composant `CategoryRangeBar` (variante compacte) est réutilisé dans les pages détaillées.

### Recommandations — génériques, pas d'IA
La section 6 affiche des recommandations courtes **codées en dur** par métrique. Le bloc IA optionnel envisagé (`ai:generate`) n'est **pas** branché : il ajouterait de la latence et un point de défaillance réseau à la génération PDF, alors que le rapport doit rester 100 % déterministe et hors-ligne. À reconsidérer si Marie-Eve le demande.

## Conséquences

- Le rapport passe de ~3 pages denses à ~9 pages aérées — plus long, mais bien plus impactant visuellement.
- La frise et le tableau avant/après nécessitent ≥ 2 bilans ; à 1 seul bilan, la section Parcours affiche un message « Premier bilan ».
- Le format est figé en A4 portrait, palette imprimable (pas de fond marine plein).

## Hors-scope (v0.1.37+)

- Mode « rapport minimal » pour usage interne de Marie-Eve (sans couverture ni pages parcours).
- Recommandations IA personnalisées.
- Multi-langues, personnalisation des couleurs par client.

## Si on revient en arrière

- Restaurer `ReportPage.tsx` à sa version v0.1.35 (rapport tableau).
- Remettre `printToPDF` en `pageSize: 'Letter'`.
- Supprimer `src/print.css` et `src/assets/fonts/`.
