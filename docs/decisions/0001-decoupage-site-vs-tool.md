# ADR 0001 — Découpage site vitrine vs app locale en deux projets

**Statut** : Accepté
**Date** : 2026-05-09

## Contexte

Le projet Kinésio Conseil a deux besoins distincts :
1. **Site vitrine public** — présence en ligne, contenu marketing, contact, éditable via Decap CMS
2. **Outil de gestion interne** — répertoire clients, envoi de bilans, usage exclusif de Marie-Eve

Initialement on avait considéré tout regrouper dans le même projet (`kinesio-website_v2`) avec Supabase comme backend partagé. Cette approche aurait engendré des obligations Loi 25 lourdes dès le jour 1 (cf. [[0003-strategie-loi25-minimisation]]).

## Décision

Séparer en **deux projets indépendants** :

| Projet | Rôle | Tech | Hébergement | Loi 25 |
|---|---|---|---|---|
| `kinesio-website_v2` | Site vitrine public | React + Vite + Decap | Cloudflare Pages | Quasi nul (pas de collecte) |
| `kinesio-tool` | App de gestion interne | Electron + React + SQLite | Local PC Marie-Eve | Minimal (cf. ADR 0003) |

Les deux projets ne partagent aucune dépendance, aucun build, aucun déploiement.

## Conséquences

**Positives** :
- Risque légal séparé — un bug dans le site vitrine ne peut pas exposer des données client
- Cycles de release indépendants — le site peut être mis à jour quotidiennement, l'app trimestriellement
- Stack technique adaptée à chaque besoin (statique pour le site, desktop pour l'app)
- Loi 25 : minimisation maximale (cf. ADR 0003)

**Négatives** :
- Duplication possible de certains assets visuels (logo, charte) — accepté, faible coût
- Si un jour on veut un portail client lié au site, il faudra repenser l'architecture — accepté, problème futur si Marie-Eve l'exprime un jour

## Alternatives considérées

- **Monorepo avec workspaces npm** — rejeté, complexité non justifiée pour un solo dev avec deux livrables si différents
- **Un seul projet avec Supabase** — rejeté, multiplie par 10 les obligations Loi 25 sans bénéfice immédiat
