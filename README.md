# Kinésio Outils

Application desktop locale pour Marie-Eve (kinésiologue). Aide à la gestion des clients et à l'envoi de bilans de forme physique.

**100 % local** — toutes les données restent sur le PC. Voir [`docs/decisions/0003-strategie-loi25-minimisation.md`](docs/decisions/0003-strategie-loi25-minimisation.md) pour la stratégie de conformité Loi 25.

## Stack

Electron + React 19 + TypeScript + Vite + Tailwind 4 + Drizzle ORM + SQLite

## Démarrage

```bash
npm install
npm run dev
```

## Documentation

Tout est dans [`docs/`](docs/) (vault Obsidian). Commencer par [`docs/index.md`](docs/index.md).

## Workflow de release

1. `npm version patch`        # bump 0.1.0 → 0.1.1, crée tag v0.1.1 localement
2. `git push --follow-tags`   # déclenche la GitHub Action
3. Vérifier sur https://github.com/IznogoudQc/kinesio-tool/actions (~5 min)
4. Une fois la release publiée sur https://github.com/IznogoudQc/kinesio-tool/releases,
   l'app installée chez Marie-Eve la détectera à son prochain lancement.

## Projet jumeau

Site vitrine public : [`kinesio-website_v2`](../kinesio-website_v2)
