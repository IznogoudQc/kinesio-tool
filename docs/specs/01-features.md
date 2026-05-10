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

## ✅ Fait (v0.1.8 — Onglet Mesures : circonférences + plis cutanés / % gras)

### Objectif : suivi anthropométrique régulier entre les bilans complets
Marie-Eve prend des mesures (circonférences, plis cutanés) plus souvent qu'elle ne fait un bilan complet. L'onglet Mesures
permet de les saisir, de calculer le % de gras automatiquement et d'en suivre l'évolution.

### Schéma DB
- Table `clients` étendue : `birthdate` (ISO date, nullable — pour calculer l'âge) et `sex` (`'F' | 'M' | null` — silhouette + coefficients du calcul).
- Table `mesures_circonferences` : `id` (UUID), `client_id` (FK → clients, ON DELETE cascade), `date` (ISO), 12 circonférences en cm (`cou`, `epaule`, `biceps_g/d`, `poitrine`, `taille`, `abdomen`, `hanche`, `cuisse_g/d`, `mollet_g/d`, toutes `real` nullables), `notes`, `created_at`. _(v0.1.11 : `epaule_g`/`epaule_d` fusionnées en une seule mesure `epaule` — migration `0007_round_living_tribunal.sql`, moyenne G+D des données existantes.)_
- Table `mesures_plis_cutanes` : `id` (UUID), `client_id` (FK cascade), `date` (ISO), 4 plis en mm (`triceps`, `biceps`, `sousscapulaire`, `iliaque`) + valeurs calculées figées (`somme_4_plis`, `densite_corporelle`, `pourcentage_gras_siri`, `pourcentage_gras_brozek`, `age_au_calcul`, `sexe_au_calcul`), `notes`, `created_at`. Migration `0003_bouncy_whirlwind.sql`.

### Calcul du % de gras — `src/lib/body-fat-calculator.ts`
- Densité corporelle via les équations **Durnin & Womersley (1974)** sur la somme des 4 plis (coefficients par sexe et tranche d'âge), puis conversion densité → % gras avec **Siri (1961)** et **Brožek (1963)**. `calculateAge(birthdate)` pour l'âge révolu. Utilisé côté main (stockage des valeurs calculées) et côté renderer (aperçu en temps réel).

### Service + IPC (API-ready)
- `electron/ipc/mesures.ts` : `mesures:circ:{list,create,update,delete}` et `mesures:plis:{list,create,update,delete}`. Validation **zod** sur tous les payloads. Le calcul des plis se fait côté main (récupère `birthdate`/`sex` du client, refuse si absents) et stocke les valeurs figées.
- `src/services/mesures.ts` : `mesuresService.circonferences.*` et `mesuresService.plis.*`. Types `MesureCirconferences` / `MesurePlisCutanes` / `CirconferencesInput` / `PlisInput` dans `env.d.ts`.

### UI — onglet « Mesures »
- 2 sous-onglets internes : **Circonférences** et **Plis cutanés**.
- **Circonférences** : grille CSS 7 lignes × 3 colonnes — ligne 1 = card **Poids** pleine largeur ; colonne centrale (lignes 2-7) = silhouette `body-male.png` / `body-female.png` selon le sexe (message « complétez le profil » si `sex` est `null`) ou la photo full-body du client ; colonnes 1 & 3 (lignes 2-7) = les 12 circonférences réparties gauche/droite (Cou·Épaule, Biceps G·D, Poitrine·Taille, Abdomen·Hanche, Cuisse G·D, Mollet G·D). Bouton « Enregistrer » → nouvelle entrée à la date du jour ; historique en table (date, taille, hanche, % de variation de la taille vs la précédente, actions Voir / Modifier / Supprimer).
- **Plis cutanés** : si `birthdate` ou `sex` manquent → message + bouton « Compléter le profil » (`?edit=1`). Sinon : 4 cards de saisie (mm), aperçu en temps réel (somme des 4 plis, densité, **% gras Siri** en gros chiffre gold, % gras Brozek discret, catégorie en placeholder pour v0.1.9), bouton « Enregistrer », historique en table.
- Formulaire d'édition du client (`ClientDetailLayout`) : ajout des champs **date de naissance** (`input type=date`) et **sexe** (radio F/M), avec ouverture directe via `?edit=1`.

### Dashboard — `DashboardTab.tsx`
- Carte « Mesures actuelles » (tour de taille, tour de hanche, biceps moy. G/D, cuisse moy. G/D + date de la dernière prise, indicateurs ▲▼ vs la prise précédente — baisse = amélioration pour taille/hanche).
- Carte « % de gras corporel » (dernier calcul Siri en gold + Brozek + somme des plis + ▲▼).
- Si ≥ 2 entrées : graphiques `recharts` d'évolution (tour de taille / hanche, % de gras Siri).

## ✅ Fait (v0.1.9 — Rapport PDF + envoi au client + export/import `.kinesio`)

### Objectif : produire un livrable client + se donner un format de sauvegarde/test
Marie-Eve veut un document propre à remettre au client (et l'envoyer par courriel sans manipuler Word), et on
veut pouvoir transporter un dossier de test (Nicholas Jean) d'un PC à l'autre.

### Génération du rapport PDF
- Route React dédiée `/report/:id` (`src/pages/ReportPage.tsx`) — layout autonome (pas de sidebar / header de
  l'app), **pensé pour l'impression** : fond blanc, texte marine, accents gold-dark (économie d'encre), `@page` Letter
  marge 14 mm, `break-inside: avoid` sur les sections. Sections : en-tête (logo Kinésio Outils + « Bilan de
  progression » + nom du client + date du rapport), Profil (nom, courriel, date de naissance, sexe — si renseignés),
  Dernier bilan (tableaux par groupe Anthropo / Aérobie / Musculo / Indices, champs vides masqués), Évolution dans le
  temps (graphiques `recharts` : VO2max, composition poids/% gras, mesures corporelles, % gras Siri — affichés dès 2
  points de données), Historique des bilans (table compacte : date, VO2max, IMC, % gras, tour de taille, score global,
  source), pied de page (« Rapport généré par Kinésio Outils — Marie-Eve … » + date).
- `electron/lib/report-generator.ts` : `generateClientReportPdf(clientId)` ouvre une `BrowserWindow` cachée sur
  `#/report/:id`, attend le drapeau `window.__REPORT_READY__` (posé par ReportPage après mise en page des graphiques),
  appelle `webContents.printToPDF({ printBackground: true, pageSize: 'Letter', margins: { marginType: 'none' } })` puis
  écrit `Bilan-Nom-Prenom-AAAA-MM-JJ.pdf` dans `app.getPath('temp')`. Aussi : `loadClientBundle(clientId)` (client +
  bilans + mesures, partagé avec l'export `.kinesio`).

### Envoi au client par courriel
- L'IPC d'envoi (`reports:send-email`) génère le rapport, l'attache, l'envoie via le SMTP des Paramètres puis supprime
  le fichier temp (`try/finally`). Remplace l'ancien `electron/ipc/email.ts` (PDF du dashboard) — `SendBilanModal`
  passe maintenant par `reportsService`.

### Boutons sur le Dashboard du client
- En haut à droite : **« Générer le rapport PDF »** (génère + ouvre le PDF avec l'app par défaut via `shell.openPath` —
  pour vérifier avant d'envoyer) et **« Envoyer au client »** (ouvre `SendBilanModal` : sujet + corps pré-remplis avec
  le template des Paramètres, pièce jointe automatique ; désactivé si SMTP non configuré).

### Export / import `.kinesio` (test / backup)
- Menu **« … »** dans le header de la fiche client → **« Exporter en JSON (.kinesio) »** : `dialog.showSaveDialog`
  (nom par défaut `Nom-Prenom-export-AAAA-MM-JJ.kinesio`), écrit un JSON `{ version, exportedAt, client, bilans,
  mesures_circonferences, mesures_plis_cutanes }`.
- Bouton **« Importer »** en haut de la liste des clients → `dialog.showOpenDialog` (`.kinesio` / `.json`), valide le
  fichier (zod), recrée le client + ses bilans + ses mesures (nouveaux UUID). Si un client a déjà ce courriel → dialog
  « Fusionner » (ajoute au dossier existant, bilans aux mêmes dates ignorés) ou « Créer un doublon ».

### Service + IPC (API-ready)
- `electron/ipc/reports.ts` : `reports:generate-pdf`, `reports:open-path`, `reports:send-email`, `reports:export-json`,
  `reports:pick-import-file`, `reports:import-json` — validation **zod** sur tous les payloads.
- `src/services/reports.ts` : `generatePdfForClient`, `openPdf`, `sendReportByEmail`, `exportClientToJson`,
  `pickImportFile`, `importClientFromJson`.

## ✅ Fait (v0.1.11 — Préférences d'unités par client + champ Poids)

### Objectif : s'adapter aux habitudes de mesure (métrique vs impérial)
Certains clients/contextes raisonnent en pouces et en livres. On stocke **toujours** en métrique (cm, kg) — la
conversion se fait uniquement à l'affichage et à la saisie, jamais au stockage (évite les arrondis cumulatifs et les
bugs de migration). Les plis cutanés restent en mm partout.

### Schéma DB — migration `0006_previous_brother_voodoo.sql`
- Table `clients` étendue : `unit_length` (`'cm' | 'in'`, défaut `'cm'`, NOT NULL) et `unit_weight`
  (`'kg' | 'lb'`, défaut `'kg'`, NOT NULL) — préférences d'unités du client.
- Table `mesures_circonferences` étendue : `poids_kg` (`real`, nullable) — **toujours stocké en kg**.

### Helpers de conversion — `src/lib/units.ts`
- `cmToIn` / `inToCm`, `kgToLb` / `lbToKg`.
- `formatLength(cm, unit)` / `formatWeight(kg, unit)` → chaîne `fr-CA` à 1 décimale (`'—'` si `null`).
- `cmToLengthInput` / `kgToWeightInput` → valeur numérique à pré-remplir dans un champ (valeur exacte en
  métrique, arrondie à 0,1 en impérial).
- `lengthInputToCm` / `weightInputToKg` → conversion saisie utilisateur → stockage métrique.
- `lengthUnitLabel` / `weightUnitLabel` → libellés courts (`cm` / `po`, `kg` / `lb`).
- Tests : `src/lib/units.test.ts` (`node --test src/lib/units.test.ts`) — aller-retour 220 lb / 38 po → stocké en kg/cm → réaffiché à 0,1 près.

### UI — formulaire d'édition du client (`ClientDetailLayout`)
- Deux radio-groupes sous la date de naissance / sexe : **Unité de longueur** (cm / po) et **Unité de poids**
  (kg / lb). Sauvegarde → met à jour `unitLength` / `unitWeight`.

### UI — onglet Mesures > Circonférences
- Nouvelle card **« Poids »** en haut du formulaire (avant les circonférences), unité = préférence du client.
- Toutes les cards de circonférences affichent l'unité préférée (`cm` ou `po`) ; conversion à la saisie
  (l'utilisateur tape en po/lb → on stocke en cm/kg) et à l'édition (on relit le métrique → on réaffiche en po/lb).
- Précision d'affichage : longueurs et poids à 1 décimale ; plis cutanés inchangés (mm).
- Historique « Mesures précédentes » : colonne **Poids** ajoutée, en-têtes Taille/Hanche avec l'unité du client.
  Modal « Voir le détail » : ligne Poids + valeurs converties.

### Service + IPC + export `.kinesio`
- `clients:update` accepte `unitLength` / `unitWeight` ; `mesures:circ:{create,update}` acceptent `poidsKg` (en kg).
  Le fichier `.kinesio` transporte aussi ces champs (rétrocompatible : absents → défauts métriques à l'import).

## 🔮 Prochain (v0.1.10 — Saisie manuelle + catégorisation CPAFLA)

- **Catégorisation CPAFLA** : encodage des tables de référence dans `src/lib/normes-cpafla.ts` ; classement automatique « À améliorer / Acceptable / Bien / Très bien / Excellent » selon âge et sexe — pour les bilans **et** pour le % de gras des plis cutanés (remplace le placeholder « catégorie » de l'onglet Mesures).
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
