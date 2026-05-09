# ADR 0005 — Stratégie de distribution et mises à jour

**Statut** : Accepté
**Date** : 2026-05-09

## Contexte

L'app Kinésio Outils est livrée à une seule utilisatrice (Marie-Eve), sur son PC Windows. Le développeur (Nicholas) va publier des mises à jour régulières au fur et à mesure que l'outil évolue. Il faut un mécanisme qui :

1. Permette à Marie-Eve de **recevoir les mises à jour sans friction** (idéalement 1 clic)
2. Soit **gratuit ou très peu coûteux** (single-user app, pas de revenus)
3. Soit **fiable** — pas de risque de casser sa DB locale lors d'une mise à jour
4. Reste **simple à maintenir** pour un solo dev

## Options considérées

### A. Distribution manuelle (OneDrive / lien)
- Builder localement, uploader le `.exe` sur OneDrive, envoyer le lien à Marie-Eve par texto
- Elle réinstalle par-dessus, sa DB SQLite (dans `%APPDATA%/kinesio-outils/`) reste intacte
- ✅ Zéro setup, zéro coût
- ❌ Friction côté Marie-Eve à chaque mise à jour (~2 min)
- ❌ Risque qu'elle oublie d'installer une version critique

### B. electron-updater + GitHub Releases (retenu)
- Repo **public** sur GitHub (`IznogoudQc/kinesio-tool`)
- GitHub Action déclenchée sur tag `v*` qui build et crée une Release avec les artifacts (`.exe` + `latest.yml`)
- L'app installée chez Marie-Eve check GitHub Releases au lancement, télécharge en background, propose "Mise à jour prête → Redémarrer"
- ✅ Friction Marie-Eve : 1 clic
- ✅ Gratuit (GitHub Releases illimité)
- ✅ Workflow dev : `npm version patch` + `git push --tags` → release publiée automatiquement
- ✅ Pas besoin de PAT embarqué dans l'app (releases publiques accessibles sans auth)
- ❌ Setup initial (~1h)
- ❌ Sans code signing, SmartScreen peut afficher un warning sur certains updates (à valider en pratique)
- ⚠️ Code source visible publiquement — accepté car aucune valeur commerciale ni sensible (les données client sont dans `%APPDATA%`, pas dans le code)

### C. electron-updater + Cloudflare R2 / S3
- Même mécanisme que B, mais hébergement custom
- ✅ Plus de contrôle sur la distribution
- ❌ ~5 $/an, plus complexe, gain marginal vs GitHub
- Pertinent seulement si on ne veut pas de repo GitHub OU si on veut distribuer publiquement sans exposer le code

### D. Custom updater maison
- Endpoint qui retourne la dernière version, l'app télécharge si différent
- ❌ Réinventer la roue, electron-updater fait déjà tout

## Décision

**Option B retenue** : `electron-updater` + GitHub Releases (repo **public**) + GitHub Action de build automatisé.

### Pourquoi public plutôt que privé

Avec un repo privé, l'app de Marie-Eve aurait besoin d'un Personal Access Token (PAT) embarqué dans le binaire pour fetch les releases. Un PAT embarqué est extractible par décompilation, ce qui pose un risque de sécurité disproportionné par rapport au bénéfice (cacher du code de scaffolding standard).

Le code de l'app n'a aucune valeur commerciale (c'est un Electron + React + SQLite générique), aucune logique propriétaire, et **aucune donnée client n'y vit** — toutes les données sont dans `%APPDATA%/kinesio-outils/` sur le PC de Marie-Eve. Rendre le repo public ne crée donc aucun risque réel, mais simplifie radicalement la chaîne de distribution.

Si un jour la base de code contient de la propriété intellectuelle qu'on veut protéger, on pourra basculer en privé via une nouvelle ADR (avec migration vers une stratégie de PAT minimal ou un repo séparé public-binaries-only).

### Architecture du workflow de release

```
1. Dev local
   ├── modifie code
   ├── npm version patch    (bump 0.1.0 → 0.1.1, crée git tag v0.1.1)
   └── git push --tags

2. GitHub Action (release.yml)
   ├── trigger: push tag v*
   ├── runner: windows-latest
   ├── steps:
   │   ├── checkout
   │   ├── setup-node
   │   ├── npm install
   │   ├── npm run dist
   │   └── electron-builder --publish always
   └── créé GitHub Release avec .exe + latest.yml

3. App de Marie-Eve (au lancement)
   ├── autoUpdater.checkForUpdates()
   ├── détecte v0.1.1 disponible
   ├── télécharge en background
   ├── notification: "Mise à jour prête"
   └── elle clique → app redémarre avec nouvelle version
```

### Code signing : non fait pour l'instant

Pas de cert Authenticode acheté en v1 (~150-300 $/an). Conséquence :
- Premier install : SmartScreen affiche un warning rouge ("Windows protected your PC"). Marie-Eve doit cliquer "More info → Run anyway". À documenter dans le manuel utilisateur.
- Auto-updates via electron-updater devraient passer sans warning (le binaire est extrait et lancé par le wrapper signé Electron, pas re-vérifié par SmartScreen). **À valider en pratique au premier cycle de release.**
- Si SmartScreen pose problème en auto-update, on achètera un cert (réviser cette ADR à ce moment).

### Intégrité de la DB lors d'une mise à jour

La DB SQLite vit dans `app.getPath('userData')` (`%APPDATA%/kinesio-outils/kinesio.db` sur Windows), JAMAIS dans le dossier d'install de l'app. electron-updater ne touche que les binaires, pas le userData. **Garantie : aucune mise à jour ne peut détruire les données de Marie-Eve.**

Si on ajoute des migrations Drizzle dans une nouvelle version, l'app appliquera automatiquement les migrations en attente au démarrage post-update (Drizzle gère via `migrate()` au boot).

## Conséquences

**Positives** :
- Marie-Eve reçoit les updates avec 1 clic
- Workflow dev super simple (1 commande pour publier)
- Aucune infra à maintenir (GitHub gère tout)
- Coût : 0 $

**Négatives** :
- Setup initial nécessite : repo GitHub + PAT (si besoin) + GitHub Action + config electron-builder
- Premier install reste affecté par SmartScreen (acceptable, on guide Marie-Eve une fois)
- Si on change d'avis et veut héberger ailleurs, faut migrer la `latest.yml` URL — pas trivial mais pas bloquant

## Suivi

Au premier cycle de release réel (v0.1.1) : valider que SmartScreen ne se déclenche pas sur les auto-updates. Si oui, ouvrir une nouvelle ADR pour décider du code signing.
