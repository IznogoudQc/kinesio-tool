# ADR 0022 — Description par zone + suggestions de douleur éditables

**Statut** : Accepté
**Date** : 2026-07-18
**Complète** : [ADR 0021](0021-silhouette-douleur-sante.md) (silhouette de douleur)

## Contexte

Après la silhouette cliquable (ADR 0021), Nicholas a demandé, pour chaque zone marquée : **une description de la
douleur**, et des **suggestions cliquables selon la zone** (comme les puces de la nutrition) pour aller plus
vite — suggestions **éditables** par Marie.

## Décision

**Description par zone** — le stockage passe de `zonesSeverity: { id → sévérité }` à
`zonesDetail: { id → { severity, description? } }` (`src/lib/sante.ts`). Lecture rétro-compatible de l'ancien
format via `normalizeZones`. Aucune migration (JSON dans `questionnaires.data`). Sous la silhouette, une
**liste éditable** des zones marquées : bascule jaune/rouge, description, ✕, et puces de suggestions.

**Bibliothèque de suggestions** — globale (tous clients), éditable, stockée dans les réglages
(`pain.suggestions`), sur le même patron que les listes d'aliments nutrition :
- Défauts dans `src/lib/pain-suggestions.ts`, **regroupés par famille** de zones (dos, genou, épaule…) + un jeu
  **`commun`** montré partout. Chaque région de la silhouette est mappée à une famille (`REGION_FAMILY`).
- `suggestionsForRegion(id, lib)` = suggestions de la famille + commun, dédupliquées.
- IPC `settings:painSuggestions:get|set|default` + préload + service (décision : édition **dans les Réglages**,
  carte `PainSuggestionsCard`). Cliquer une puce **ajoute** la phrase à la description de la zone.

## Conséquences

- **+** Saisie clinique riche et rapide ; suggestions ciblées par zone, personnalisables une fois pour tous.
- **+** Extensible : ajouter une famille ou des phrases = éditer `pain-suggestions.ts` / les réglages, sans migration.
- **−** Les suggestions sont un simple texte appendé (« , ») à la description — pas de structuration fine.
- **−** La bibliothèque est éditée globalement ; pas de suggestions spécifiques par client (par choix).
