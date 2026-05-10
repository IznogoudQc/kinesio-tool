# Features

État des features du projet. Mis à jour au fur et à mesure.

## ✅ Fait (v0.1.0 → v0.1.3)

### v0.1.0 — Scaffolding initial
- Stack Electron + React + TypeScript + Vite + Tailwind + Drizzle + SQLite opérationnelle
- Architecture API-ready (services layer)
- Page Clients minimal (liste + formulaire CRUD basique)
- Build NSIS Windows fonctionnel

### v0.1.1 → v0.1.2 — Auto-update
- electron-updater + electron-log + GitHub Releases
- GitHub Action de build/publish automatisé sur tag
- Affichage de la version dans la sidebar + toast de mise à jour

### v0.1.3 — Branding
- Logo "Kinésio Outils" intégré dans la sidebar (PNG fond marine)
- Icône `.ico` multi-tailles pour app + installeur + raccourci
- App reconnaissable visuellement chez Marie-Eve

## ✅ Fait (v0.1.4)

### UX shell complète
- Logo agrandi dans la sidebar
- Sidebar collapsible (mode étendu / compact via hamburger)
- Header style Cronometer : pictogramme + texte + hamburger sur une ligne, mode compact = juste hamburger
- Coin supérieur droit arrondi
- Préférence sidebar persistée en localStorage

### Dashboard par client
- Routing `/clients/:id/dashboard` avec tabs (Dashboard, Bilans, Mesures, Notes, Historique)
- Architecture UI prête, contenu en placeholder pour les futures versions

### CRUD clients complet
- Création (existait), lecture, **édition** (nouveau), **suppression** (nouveau)
- Modal d'édition avec validation
- Dialog de confirmation avant suppression

## ✅ Fait (v0.1.5 — Paramètres + Envoi email)

### Page Paramètres
- Nouveau menu "Paramètres" en bas de la sidebar (icône `Settings` lucide)
- Sections :
  - **Profil** : nom de Marie-Eve, signature email
  - **Configuration SMTP** : host, port, user, password, secure (TLS)
  - **Template d'email** : sujet + corps avec variables `{{client_name}}`, `{{date}}`, etc.
- Stockage :
  - Settings non sensibles dans SQLite (table `settings` clé/valeur)
  - Mot de passe SMTP dans le keychain OS via `keytar` (jamais en clair dans la DB)
- Bouton "Tester la connexion SMTP" pour valider la config

### Envoi de courriel depuis le Dashboard
- Bouton "Envoyer le bilan par courriel" sur la page Dashboard d'un client
- Génère un PDF du dashboard du client via `webContents.printToPDF()`
- Compose l'email avec le template configuré (variables substituées)
- Envoi via SMTP de Marie-Eve (config dans Paramètres)
- Toast de confirmation après envoi

## ✅ Fait (v0.1.6 — Importation de bilans depuis .docx)

### Objectif : remplacer le logiciel actuel de Marie-Eve
Marie-Eve utilise présentement un logiciel tiers (CPAFLA-CSEP) qui génère des bilans en `.docx`. On veut
importer ses bilans existants (.docx) dans Kinésio Outils → reconstitue son historique. La saisie manuelle
+ catégorisation CPAFLA suit en v0.1.8.

### Schéma DB
- Table `bilans` : id (UUID), client_id (FK → clients, ON DELETE cascade), date (ISO 8601), data (JSON blob
  des valeurs extraites), source (`import_docx` | `manuel`), created_at. Migration `0002_lively_amazoness.sql`.
- Architecture flexible pour cette phase ; on normalisera en plusieurs tables plus tard avec les normes CPAFLA.

### Parsing .docx — `electron/lib/bilan-parser.ts`
- Librairie `mammoth` (`extractRawText`), puis regexes sur le texte brut.
- Patterns ► du logiciel CPAFLA (ex. `Pourcentage de Gras ► 30,2 %`), nombres au format français (virgule décimale).
- Champs extraits : date du bilan, anthropo (taille, poids, IMC, tours taille/hanche, plis triceps/biceps/sous-scap/iliaque/mollet/cuisse, % gras), aérobie (VO2max, type de test, FC repos, PA systolique/diastolique), musculo (push-ups, redressements, saut vertical, puissance jambes, flexion tronc, endurance dos), indices (santé du dos, musculo global, global, composition).
- Historique : le tableau de comparaison du document est lu (ancré sur `Indice de masse corporelle`) → un bilan par date antérieure (IMC, % gras, tour de taille, plis, hanche).

### Service + IPC (API-ready)
- `electron/ipc/bilans.ts` : `bilans:pick-docx` (dialog natif, filtre `.docx`), `bilans:parse-docx` (parse un buffer, ne sauvegarde rien), `bilans:create`, `bilans:update`, `bilans:list`, `bilans:get-by-id`. Validation zod sur tous les payloads.
- `src/services/bilans.ts` : `pickDocxFile`, `import_docx(clientId, fileBuffer)`, `create`, `update`, `list`, `getById`.

### UI — onglet "Bilans" du client
- Bouton **« Importer un bilan (.docx) »** (gold) + **« Saisie manuelle »** (désactivé, v0.1.8). Liste en table (date, score global, source, « Voir »). Empty state « Aucun bilan enregistré pour ce client ».
- Flow d'import : dialog natif → parser → modal de preview avec formulaire éditable groupé (Anthropo / Aérobie / Musculo / Indices) ; checkbox par bilan historique détecté (cochée par défaut) → « Sauvegarder ».
- Vue d'un bilan : route `/clients/:id/bilans/:bilanId`, formulaire lecture seule + bouton « Modifier » (réutilise le même formulaire). Pas encore de catégorisation CPAFLA.

## ✅ Fait (v0.1.7 — Dashboard du client avec graphiques de progression)

### Objectif : rendre l'historique de bilans lisible d'un coup d'œil
Une fois les bilans importés (v0.1.6), le dashboard du client affiche les statistiques clés et la progression dans le temps.

### Service
- `src/services/bilans.ts` étendu : `getBilansForClient(clientId)` (alias de `list`, du plus récent au plus ancien) et `getBilanStats(clientId)` → `{ latest, previous, count, firstDate }` (le bilan précédent sert aux comparaisons ▲▼).
- `src/lib/bilan-comparison.ts` : `compareValue(latest, previous, lowerIsBetter)` → `{ delta, percent, isImprovement, arrow }`, `compareField(key, latest, previous)` et la table `LOWER_IS_BETTER` (% gras, tours, IMC, FC, PA, plis, poids → baisse = amélioration).

### Dashboard — `src/pages/client/tabs/DashboardTab.tsx`
Trois états :
- **0 bilan** : empty state propre, grosse icône, « Aucun bilan enregistré pour [client] », CTA gold « Importer un bilan (.docx) » → onglet Bilans.
- **1 bilan** : 4 hero stats (VO2max, IMC, % gras, score global / date), carte « Dernier bilan complet » (formulaire `BilanForm` en lecture seule, sections anthropo/aérobie/musculo/indices), message « Importez d'autres bilans pour voir la progression ».
- **2+ bilans** : hero stats avec comparaison ▲▼ vs bilan précédent (▲ vert si amélioration / ▼ rouge sinon, sens géré par champ) + **4 graphiques `recharts`** : VO2max (line), composition (poids en barres + % gras en ligne sur axe secondaire), force & endurance (push-ups + redressements + endurance dos en lignes), mesures corporelles (tour de taille + tour de hanche en lignes) ; axes en français (« sept 2025 »), tooltips au hover, palette marine/gold/cream ; section « Tableau de progression » (tous les bilans : date, VO2max, IMC, % gras, tour de taille, score).
- Header : nom du client + date du dernier bilan + bouton « Envoyer ce dashboard » (réutilise `SendBilanModal`, désactivé si SMTP non configuré ; masqué en mode `print=1`).
- `useMemo` sur les données de graphiques (`chrono`, `chartData`).

### Dépendance ajoutée
- `recharts` (pur JS, compatible React 19) — graphiques.

## 🔮 Prochain (v0.1.8 — Saisie manuelle + catégorisation CPAFLA)

- **Catégorisation CPAFLA** : encodage des tables de référence dans `src/lib/normes-cpafla.ts` ; classement automatique « À améliorer / Acceptable / Bien / Très bien / Excellent » selon âge et sexe, affiché dans la vue d'un bilan et sur le dashboard.
- Formulaire de saisie manuelle de bilan (sans passer par .docx) — active le bouton « Saisie manuelle ».
- Source des tables : à confirmer avec Marie-Eve (manuel CPAFLA, captures du logiciel actuel, ou normes publiques).

### Édition / suppression d'un client
- Bouton « Modifier » dans le header de la fiche client → modal pré-rempli (nom + courriel)
- Bouton « Supprimer » rouge discret → dialog de confirmation, suppression dure en SQLite
- Toast éphémère « [Nom] a été supprimé » après retour à la liste
- Soft-delete repoussé à v0.5 (Loi 25 renforcée)

## 📋 Backlog (post v1, ordre indicatif)

### v0.2 — Répertoire clients complet
- Recherche / filtre par nom
- Champ notes libres
- Tri (alphabétique, date d'ajout)

### v0.3 — Envoi de courriels
- Configuration SMTP (Marie-Eve fournit ses credentials de son compte pro)
- Bouton "Envoyer un courriel" depuis la fiche client
- Composition libre (sujet, corps) + pièces jointes locales
- Le bilan PDF est généré ailleurs (Word → Export PDF) et joint manuellement à v1

## 📋 Backlog (post v1, ordre indicatif)

### v0.4 — Génération de bilans
- Template de bilan de forme physique structuré
- Saisie des données (mensurations, FC, tests physiques)
- Export PDF du bilan depuis l'app
- Historique des bilans par client

### v0.5 — Conformité Loi 25 renforcée (à activer si migration web prévue)
- Consentement explicite documenté en DB (case à cocher avec date)
- Trace des envois de bilans (qui, quand, quoi — sans le contenu)
- Option de chiffrement PDF par mot de passe
- Politique de conservation/destruction (purge auto après 5 ans d'inactivité)
- Export du dossier complet d'un client (droit d'accès Loi 25)
- Suppression complète d'un dossier (droit à l'effacement)

### v1.0 — Migration web (si Marie-Eve le veut un jour)
- Backend Node migré du main process Electron vers serveur Node/Hono
- DB SQLite migrée vers Postgres (Supabase)
- Auth Supabase
- Activation de TOUTES les features v0.5 (devient obligatoire en mode web)

## ❌ Hors scope (volontairement)

- Application mobile
- Multi-utilisateur
- Portail client
- Prise de RDV en ligne
- Facturation
- Intégration calendrier
