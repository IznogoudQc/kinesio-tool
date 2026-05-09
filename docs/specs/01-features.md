# Features

État des features du projet. Mis à jour au fur et à mesure.

## ✅ Fait

(rien encore — projet en scaffolding)

## 🚧 En cours (v1)

### Répertoire clients
- CRUD client : nom, courriel, notes libres
- Recherche / filtre par nom

### Envoi de courriels
- Configuration SMTP (Marie-Eve fournit ses credentials de son compte pro)
- Bouton "Envoyer un courriel" depuis la fiche client
- Composition libre (sujet, corps) + pièces jointes locales
- Le bilan PDF est généré ailleurs (Word → Export PDF) et joint manuellement à v1

## 📋 Backlog (post v1, ordre indicatif)

### v2 — Génération de bilans
- Template de bilan de forme physique structuré
- Saisie des données (mensurations, FC, tests physiques)
- Export PDF du bilan depuis l'app
- Historique des bilans par client

### v3 — Conformité Loi 25 renforcée (à activer si migration web prévue)
- Consentement explicite documenté en DB (case à cocher avec date)
- Trace des envois de bilans (qui, quand, quoi — sans le contenu)
- Option de chiffrement PDF par mot de passe
- Politique de conservation/destruction (purge auto après 5 ans d'inactivité)
- Export du dossier complet d'un client (droit d'accès Loi 25)
- Suppression complète d'un dossier (droit à l'effacement)

### v4 — Migration web (si Marie-Eve le veut un jour)
- Backend Node migré du main process Electron vers serveur Node/Hono
- DB SQLite migrée vers Postgres (Supabase)
- Auth Supabase
- Activation de TOUTES les features v4 (devient obligatoire en mode web)

## ❌ Hors scope (volontairement)

- Application mobile
- Multi-utilisateur
- Portail client
- Prise de RDV en ligne
- Facturation
- Intégration calendrier
