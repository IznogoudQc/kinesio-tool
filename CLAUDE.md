# CLAUDE.md

Ce fichier guide Claude pour le projet **Kinésio Outils** — application locale pour Marie-Eve. À lire en premier à chaque session.

## Contexte projet

Application desktop locale qui aide Marie-Eve (kinésiologue) à être plus efficace dans son travail quotidien. **Tout est local sur son PC** — pas de cloud, pas de portail client, pas de partage.

Projet jumeau : `kinesio-website_v2` (site vitrine public, séparé). Voir `docs/decisions/0001-decoupage-site-vs-tool.md` pour le rationale du découpage.

## Vault de documentation

Toute la documentation du projet vit dans `docs/`. C'est aussi un **vault Obsidian** ouvrable directement (liens `[[wiki]]` supportés).

Lire dans cet ordre pour comprendre le projet :

1. `docs/index.md` — vue d'ensemble + statut courant
2. `docs/specs/00-vision.md` — pourquoi cet outil existe
3. `docs/specs/01-features.md` — ce qui est fait, ce qui reste
4. `docs/architecture/overview.md` — stack et schéma système
5. `docs/decisions/` — les choix techniques et leur justification

## Règles de travail

- Ne pas modifier `docs/decisions/` sans en discuter (chaque ADR est immuable une fois acceptée)
- Tout nouveau choix structurel → créer une ADR (`docs/decisions/NNNN-titre.md`)
- Les notes du jour vont dans `docs/daily-notes/YYYY-MM-DD.md`
- Suivre `docs/rules/coding-standards.md` pour le style de code
- **Architecture API-ready** : jamais d'appel DB direct depuis un composant React. Toujours passer par `src/services/`. Voir `docs/decisions/0002-architecture-api-ready.md`

## Stack

- **Desktop shell** : Electron (main process en Node.js)
- **Renderer** : React 19 + TypeScript + Vite + Tailwind 4
- **DB locale** : SQLite via Drizzle ORM (schéma Postgres-compatible pour migration web future)
- **Email** : nodemailer avec SMTP fourni par l'utilisatrice (son compte pro)
- **Build / packaging** : electron-builder

## Commandes essentielles

- Run dev : `npm run dev` (lance Vite + Electron en hot-reload)
- Build : `npm run build`
- Package distribuable : `npm run dist`
- Lint : `npm run lint`
- DB : `npm run db:generate` (générer migrations) / `npm run db:migrate` (appliquer)

## Conventions de path

- Code Electron main process → `electron/`
- Code React renderer → `src/`
- Couche services métier (API-ready) → `src/services/`
- Schéma DB et migrations Drizzle → `db/`
- Composants UI réutilisables → `src/components/`
- Pages / écrans → `src/pages/`
