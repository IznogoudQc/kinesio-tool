# ADR 0002 — Stack Electron + React + Drizzle + SQLite

**Statut** : Accepté
**Date** : 2026-05-09

## Contexte

L'app locale doit être :
- Distribuable comme exécutable desktop (Windows en priorité, Marie-Eve est sous Windows)
- Facile à maintenir par un solo dev
- **Conçue pour faciliter une migration web future** (cf. [[0004-architecture-api-ready]])
- Légalement légère (cf. [[0003-strategie-loi25-minimisation]])

## Décision

Stack retenue :

| Couche | Choix | Rationale |
|---|---|---|
| Desktop shell | **Electron** | JS partout, pas de Rust à apprendre, backend Node se transposera direct en serveur web le jour de la migration |
| UI | **React 19 + TypeScript** | Cohérence avec le site vitrine, écosystème massif, type safety |
| Bundler | **Vite** | Rapide, hot-reload, idem site vitrine |
| Styling | **Tailwind 4** | Idem site vitrine, pas de CSS custom à maintenir |
| ORM | **Drizzle** | Léger, type-safe, **supporte SQLite ET Postgres avec le même code** (clé pour migration future) |
| DB | **SQLite (better-sqlite3)** | Embarqué, zéro config, fichier unique facile à backup |
| Email | **nodemailer** | Standard de facto Node pour SMTP |
| Build | **electron-builder** | Standard pour packager Electron |

## Conséquences

**Positives** :
- Une seule langue (TypeScript) pour tout le code applicatif
- Migration web future = swap Drizzle SQLite → Drizzle Postgres + déplacer le main process Electron en serveur Hono/Express
- Réutilisation des compétences acquises sur le site vitrine

**Négatives** :
- Electron lourd (~200 Mo de binaire packagé) — accepté, le PC de Marie-Eve a largement la capacité
- Conso RAM ~150-300 Mo en idle — accepté
- Nécessite vigilance sécurité Electron (`nodeIntegration: false`, `contextIsolation: true`) — documenté dans [[../rules/security]]

## Alternatives considérées

- **Tauri (Rust)** — rejeté, courbe d'apprentissage Rust + le code Rust ne se réutilise pas pour une éventuelle API web (faut tout réécrire en Node de toute façon)
- **Python + PyQt + SQLite** — rejeté, déconnecté du reste de la stack du projet, plus dur à migrer vers le web
- **PWA installable + IndexedDB** — rejeté, dépend du navigateur, expérience desktop dégradée, IndexedDB pénible à requêter
- **.NET + WPF** — rejeté, pas dans les compétences du dev, lock-in Windows
