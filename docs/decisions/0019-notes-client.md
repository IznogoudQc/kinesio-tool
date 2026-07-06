# ADR 0019 — Onglet Notes : journal de notes cliniques par client

**Statut** : Accepté
**Date** : 2026-07-05

## Contexte

L'onglet « Notes » d'un client était un placeholder. Marie veut un endroit pour écrire des notes sur son client (notes de
séance, observations, suivi).

## Décision

Un **journal de notes datées**, **privé** (jamais dans le rapport envoyé au client) — décidé avec Nicholas.

- **Stockage** : nouvelle table `client_notes` (`id`, `client_id` FK cascade, `date`, `content`, `created_at`,
  `updated_at`), migration Drizzle `0012`. Pas une simple colonne texte : on garde l'**historique** entrée par entrée.
- **IPC** `electron/ipc/notes.ts` : `notes:list|create|update|delete` (zod, date non future, contenu 1–10000 car.).
  Préload + `window.api.notes` + service `src/services/notes.ts` (architecture API-ready, ADR 0002).
- **UI** `src/pages/client/tabs/NotesTab.tsx` : formulaire (date + texte) en haut = ajout/édition, liste antéchronologique
  en dessous (Modifier / Supprimer, confirmation). Garde « note non enregistrée » via `useBlocker` (cf. ADR 0017) pour ne
  pas perdre une note en rédaction.

## Conséquences

- **+** Suivi clinique par séance, avec historique ; réutilise les patrons existants (mesures CRUD, data router blocker).
- **+** Privé par construction : aucune exposition au rapport (le « mot du kinésiologue » du rapport reste séparé, issu des
  notes du bilan). Pas de risque de fuite d'une note interne.
- **−** Pas de recherche / filtre / pièces jointes pour l'instant (journal texte simple) — évolutions possibles.
- **−** Notes en clair dans la base SQLite locale (comme le reste des données) — cohérent avec le modèle 100 % local.
