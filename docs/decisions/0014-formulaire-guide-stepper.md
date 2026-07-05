# ADR 0014 — Mode « guidé » (stepper) pour la saisie manuelle de bilan

**Statut** : Accepté
**Date** : 2026-07-04

## Contexte

Le formulaire de saisie manuelle (`CreateBilanModal` → `BilanForm`) présente ~40 champs répartis en 6 sections sur une seule page scrollable. Efficace pour une saisie rapide quand Marie-Eve connaît le formulaire, mais intimidant pour une saisie complète ou occasionnelle. On veut une alternative « une section à la fois » **sans** dégrader le mode rapide existant.

## Options

### A. Réécrire le formulaire en assistant multi-étapes — rejeté
Trop invasif, duplication du rendu des champs, risque de régression sur l'import et la vue détail (qui réutilisent `BilanForm`).

### B. Filtrage opt-in de `BilanForm` + stepper dans le modal ← retenu
`BilanForm` gagne une prop optionnelle `visibleSectionIds?: string[]`. Absente → toutes les sections (comportement **strictement inchangé**). Fournie → ne rend que ces sections. Le stepper vit dans `CreateBilanModal` et pilote la visibilité.

## Décision (option B)

### `BilanForm`
- Nouvelle prop `visibleSectionIds?: string[]` : filtre `BILAN_FIELD_GROUPS` au rendu. Aucune autre logique touchée (calculs, synthèse, percentiles inchangés).
- Le mode guidé passe aussi `collapsible={false}` → la section visible est entièrement dépliée (pas de double niveau de repli).

### `CreateBilanModal`
- État `mode: 'scroll' | 'guided'` (**défaut `'scroll'`** — zéro régression) + `stepIndex`. Bascule via deux boutons « Tout afficher » / « Guidé » dans l'en-tête.
- En mode guidé : `StepperHeader` (barre de progression « Étape N / M — Titre » + %), boutons « Précédent » / « Section suivante », dernière section → « Vérifier & enregistrer ». L'ordre des étapes = l'ordre de `BILAN_FIELD_GROUPS`.
- La synthèse temps réel (`showSynthesis`, sticky) reste visible dans les deux modes.

### Garde-fou « champs importants manquants » (les deux modes)
- `src/pages/client/bilan-required-fields.ts` : `IMPORTANT_BILAN_FIELDS` (taille, poids, tour de taille, VO2max, PA sys/dia, push-ups, redressements) + `missingImportantFields(data)` (pur, testé).
- Avant la sauvegarde, si des champs importants manquent → `MissingFieldsDialog` (non bloquant) : « Compléter » / « Enregistrer quand même ». `0` compte comme renseigné ; `NaN`/`''` comme manquant.
- Réutilise le style des modaux existants (`PrefillModal`).

## Conséquences

- Mode rapide = exactement l'ancien comportement (aucune `visibleSectionIds` passée).
- Le garde-fou s'applique **aussi** en mode scroll (utile même pour la saisie rapide) — jamais bloquant, cohérent avec le principe « Marie-Eve reste maître » (cf. validation de plausibilité v0.1.38).
- `CreateBilanModal` reste propriétaire de `data` ; `BilanForm` reste contrôlé.

## Si on revient en arrière

- Retirer la prop `visibleSectionIds` de `BilanForm` (et le filtre au rendu).
- Retirer l'état `mode`/`stepIndex`/`pendingMissing` + `StepperHeader`/`MissingFieldsDialog` de `CreateBilanModal`.
- Supprimer `bilan-required-fields.ts` + son test.
