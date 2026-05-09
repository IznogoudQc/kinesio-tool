# Règles de sécurité

L'app manipule des **données personnelles potentiellement sensibles** (coordonnées de clients, bilans de forme physique). Ces règles s'appliquent à tout code qui touche ces données.

## Principes généraux

1. **100 % local** — aucun appel réseau pour partager des données client. Le seul appel sortant autorisé est SMTP vers le compte pro de Marie-Eve.
2. **Pas de télémétrie** — pas de Sentry, pas d'analytics, pas de logs envoyés ailleurs que sur la machine.
3. **Pas de logs verbeux des données client** — un log "client créé" est OK, un log qui dump l'objet client complet n'est pas OK.

## Electron — sécurité du shell

- `nodeIntegration: false` (obligatoire)
- `contextIsolation: true` (obligatoire)
- `sandbox: true` pour le renderer
- Communication renderer ↔ main UNIQUEMENT via `contextBridge` + IPC
- Pas de `eval()`, pas de `Function()` dynamique
- `webSecurity: true`
- CSP strict sur le HTML chargé

## Base de données

- Fichier SQLite stocké dans le dossier user data d'Electron (`app.getPath('userData')`), jamais dans le dossier de l'app
- Le fichier DB doit être backup-able par Marie-Eve (export/import depuis le menu)
- **Chiffrement at-rest** — pas obligatoire en v1 (on compte sur BitLocker/FileVault niveau OS), mais une issue est ouverte pour SQLCipher en cas de besoin

## SMTP

- Credentials SMTP de Marie-Eve stockés dans le keychain OS (via `keytar` ou équivalent), JAMAIS dans la DB ni dans un fichier de config en clair
- TLS obligatoire (`secure: true`) — pas de fallback en clair
- Validation explicite du certificat serveur

## Validation

- Toute entrée IPC est validée côté main process avant traitement (zod)
- Toute pièce jointe email est :
  - Limitée en taille (< 25 Mo)
  - Validée comme étant un fichier réel sur le disque
  - Pas de `..` dans les chemins (path traversal)

## Ce qu'on NE fait PAS en v1

(documenté pour qu'on s'en souvienne quand on activera la conformité Loi 25 renforcée — voir [[../specs/01-features#v3]])

- Trace des envois en DB
- Consentement explicite documenté
- Chiffrement des PDFs envoyés
- Politique de purge automatique
