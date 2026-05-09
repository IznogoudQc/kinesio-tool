# Architecture — Overview

## Vue d'ensemble

Application desktop Electron en deux processus :

```
┌─────────────────────────────────────────────────────────┐
│                   Electron App                          │
│                                                         │
│  ┌─────────────────┐         ┌──────────────────────┐   │
│  │  Main process   │  IPC    │   Renderer process   │   │
│  │  (Node.js)      │◄───────►│   (Chromium + React) │   │
│  │                 │         │                      │   │
│  │  - DB access    │         │   - UI (React 19)    │   │
│  │  - SMTP send    │         │   - Tailwind 4       │   │
│  │  - File system  │         │   - Services layer   │   │
│  └─────────────────┘         └──────────────────────┘   │
│         │                                               │
│         ▼                                               │
│  ┌─────────────────┐                                    │
│  │  SQLite local   │                                    │
│  │  (Drizzle ORM)  │                                    │
│  └─────────────────┘                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
                   PC de Marie-Eve
                   (data/kinesio.db)
```

## Stack

| Couche | Tech |
|---|---|
| Desktop shell | Electron |
| UI | React 19 + TypeScript |
| Bundler | Vite |
| Styling | Tailwind 4 |
| ORM | Drizzle |
| DB | SQLite (`better-sqlite3`) |
| Email | nodemailer |
| Build | electron-builder |

## Structure des dossiers

```
kinesio-tool/
├── electron/              # Main process (Node)
│   ├── main.ts            # Entry point Electron
│   ├── preload.ts         # Bridge contextIsolation
│   └── ipc/               # Handlers IPC par domaine
│       ├── clients.ts
│       └── email.ts
├── src/                   # Renderer (React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/        # UI réutilisable
│   ├── pages/             # Écrans
│   └── services/          # Couche API-ready (cf. ADR 0004)
│       ├── clients.ts
│       └── email.ts
├── db/
│   ├── schema.ts          # Schéma Drizzle (Postgres-compat)
│   ├── client.ts          # Connexion SQLite
│   └── migrations/        # Migrations générées par Drizzle
├── docs/                  # Vault Obsidian (ce dossier)
└── package.json
```

## Flux d'une action utilisateur (exemple : créer un client)

1. **UI React** — clic sur "Nouveau client", remplit le formulaire, clic "Enregistrer"
2. **Service `src/services/clients.ts`** — appelle `window.api.clients.create(data)` (exposé par le preload)
3. **IPC `electron/ipc/clients.ts`** — reçoit l'appel, valide, appelle Drizzle
4. **Drizzle + SQLite** — INSERT en local
5. **Retour** — confirmation remonte via IPC, l'UI se rafraîchit

> Note: l'étape 3 est ce qui sera remplacé lors d'une migration web. Le service de l'étape 2 reste identique, il pointera juste vers `fetch('/api/clients')` au lieu de `window.api`. Voir [[../decisions/0004-architecture-api-ready]].

## Sécurité

- **Pas de `nodeIntegration` dans le renderer** — communication uniquement via preload + IPC contextIsolation
- **Validation côté main process** — les données venant du renderer sont toujours validées avant d'atteindre la DB (zod ou équivalent)
- **Voir [[../rules/security]]** pour les règles complètes
