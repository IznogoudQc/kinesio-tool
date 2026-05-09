# ADR 0004 — Architecture interne API-ready

**Statut** : Accepté
**Date** : 2026-05-09

## Contexte

L'app v1 est 100 % locale (cf. [[0003-strategie-loi25-minimisation]]). Mais Marie-Eve pourrait un jour vouloir :
- Un portail client web
- Une consultation de son répertoire depuis un autre appareil
- Une intégration avec un service tiers

Si l'architecture du jour 1 mélange UI et accès DB direct, la migration vers une architecture client-serveur sera une **réécriture**. Si dès le jour 1 on adopte une architecture client-serveur **simulée** (où le client appelle des "endpoints" qui s'exécutent localement dans Electron), la migration devient un **swap de couche**.

## Décision

Forcer dès le jour 1 une **séparation stricte entre couche présentation (renderer React) et couche services (logique métier)**, avec une frontière claire :

```
┌──────────────────────────────────────────────────┐
│  Renderer React (src/)                           │
│                                                  │
│  Composants ───► src/services/clients.ts         │
│                       │                          │
│                       ▼                          │
│              window.api.clients.create(data)     │
│                       │                          │
└───────────────────────┼──────────────────────────┘
                        │   (frontière API)
┌───────────────────────┼──────────────────────────┐
│  Main process (electron/)                        │
│                       ▼                          │
│              electron/ipc/clients.ts             │
│                       │                          │
│                       ▼                          │
│              Drizzle + SQLite                    │
└──────────────────────────────────────────────────┘
```

### Règles concrètes

1. **Aucun composant React n'accède directement à la DB ou à `window.api`**. Tout passe par `src/services/*`
2. **Chaque service expose des méthodes async** qui ressemblent à des appels API (`list()`, `create(data)`, `update(id, data)`, `delete(id)`)
3. **Aujourd'hui** : `src/services/clients.ts` appelle `window.api.clients.create()` exposé par le preload
4. **Le jour de la migration web** : `src/services/clients.ts` appelle `fetch('/api/clients', {...})` — **un seul fichier change**

### Schéma DB Postgres-compatible dès le jour 1

- IDs en UUID (pas autoincrement) — `crypto.randomUUID()` côté insert
- Timestamps : `timestamp with timezone` (Drizzle gère ça nativement, fonctionne en SQLite via TEXT ISO 8601)
- FK explicites (`references()` Drizzle)
- Pas de types SQLite-spécifiques

### Validation aux frontières

Toute donnée qui traverse la frontière renderer ↔ main est validée avec **zod** côté main process. Ces schémas zod seront réutilisés tels quels comme schémas de validation API le jour de la migration web.

## Conséquences

**Positives** :
- Migration web future = changer `src/services/*` (1 ligne par méthode) + déplacer `electron/ipc/*` vers des routes Hono/Express
- Code plus testable (les services peuvent être mockés)
- Architecture lisible et standard

**Négatives** :
- Légère sur-ingénierie pour la v1 — accepté, le coût est faible et le bénéfice futur grand
- Une couche d'abstraction de plus à comprendre pour un dev qui rejoindrait le projet — accepté, c'est documenté

## Alternatives considérées

- **Accès DB direct depuis le renderer (via preload exposant Drizzle)** — rejeté, casse complètement la possibilité de migration web sans réécriture
- **Pas d'IPC, tout faire dans le renderer avec sql.js** — rejeté, mauvaise sécurité Electron, et tout le code DB serait à jeter pour le web
