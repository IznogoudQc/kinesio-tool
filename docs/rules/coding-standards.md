# Coding standards

## Langues

- **Code** : TypeScript pour tout (Electron main + renderer)
- **Commentaires** : français quand pertinent (logique métier, contexte). Anglais OK pour conventions techniques (TODO, FIXME, etc.)
- **Variables / fonctions** : anglais (convention JS/TS standard)
- **Strings UI utilisateur** : français

## Style TypeScript

- Strict mode activé (`strict: true` dans `tsconfig.json`)
- Pas de `any` — utiliser `unknown` et narrow
- `interface` pour les contrats publics, `type` pour les unions / intersections
- Imports nommés > imports default quand possible
- Pas de `console.log` en prod (ESLint warning)

## React

- Composants fonctionnels uniquement, pas de classes
- Hooks (`useState`, `useEffect`, `useMemo`) — pas de state management externe avant d'en avoir vraiment besoin
- Props typées explicitement avec `interface`
- Un composant = un fichier
- Composants UI réutilisables → `src/components/`
- Pages / écrans complets → `src/pages/`

## Architecture

- **Couche services obligatoire** — jamais d'appel IPC ou DB direct depuis un composant React. Toujours passer par `src/services/*`. Voir [[../decisions/0004-architecture-api-ready]]
- **Validation au passage de frontière** — toute donnée qui traverse renderer ↔ main doit être validée (zod recommandé)
- **Schéma DB Postgres-compatible** — UUIDs (pas autoincrement), `timestamp with timezone`, FK explicites

## Tailwind

- Utility-first, pas de CSS custom sauf si vraiment nécessaire
- Classes longues → extraire en composant React, pas en `@apply` CSS
- Theme dans `tailwind.config.js`

## Git / commits

- Messages en français OK
- Format : `type: courte description` (ex: `feat: ajout liste clients`, `fix: SMTP timeout`, `docs: ADR 0005`)
- Branches par feature : `feat/clients-list`, `fix/smtp-encoding`, etc.
