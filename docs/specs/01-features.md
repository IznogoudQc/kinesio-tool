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

## ✅ Fait (v0.1.15 — Catégorisation pluggable des résultats de tests)

### Objectif : situer chaque valeur sur l'échelle « À améliorer → Excellent »
Marie-Eve veut, sous chaque résultat de test, voir la catégorie correspondante selon l'âge et le sexe du client.
L'architecture est pluggable : on supporte plusieurs jeux de tables (ACSM par défaut, CPAFLA à venir).

### Architecture — `src/lib/norms/`
- `types.ts` : `Category` (5 valeurs : `A_AMELIORER`, `ACCEPTABLE`, `BIEN`, `TRES_BIEN`, `EXCELLENT`), `CATEGORY_LABELS` (FR), `CATEGORY_COLORS` (Tailwind), `TestKey`, `NormsType`, `NormRange` (plage âge + sexe + 4 seuils + flag `lowerIsBetter` pour les tests inversés comme % gras / IMC / tour de taille).
- `acsm.ts` : tables **ACSM 11e éd. (2021)** encodées pour VO2max, % gras, push-ups, redressements assis partiels, sit-and-reach (flexion tronc) — par tranches d'âge 20-29 → 70+ × sexe F/M. IMC (catégories OMS, agnostiques âge/sexe) et tour de taille (seuils Santé Canada). Endurance des extenseurs du dos = test de Sorensen (hors ACSM, sources cliniques). Saut vertical et puissance des jambes : `null` (pas de table ACSM retenue).
- `cpafla.ts` : placeholder, retourne `null` partout — à compléter dans une future version.
- `index.ts` : API publique `getCategorization(test, value, age, sex, norms = 'acsm')` + helper `computeAge(birthdate, refDate?)`.
- `bilan-keys.ts` : mapping entre les clés du modèle `BilanData` (`vo2max`, `pourcentage_gras`, etc.) et les `TestKey`.

### Settings — clé `categorization_norms`
- Stockée dans la table `settings` (clé/valeur, pas de migration). Valeurs : `'acsm'` (défaut) | `'cpafla'`. Validation `zod`.
- IPC `settings:norms:get` / `settings:norms:set`, exposés via `window.api.settings.{get,set}CategorizationNorms()`.

### UI — Paramètres
- Nouvelle section « Normes de catégorisation » (icône `Gauge`) avec deux radio-buttons :
  - **ACSM** (American College of Sports Medicine, 11e éd.) — actif.
  - **CPAFLA (à venir)** — affiche un message info « Les tables CPAFLA seront ajoutées dans une future version. ACSM est utilisé en attendant ».

### Intégration Dashboard + BilanDetail
- Dashboard : hero stat cards (VO2max, IMC, % gras) affichent la catégorie sous la valeur avec couleur (`text-red-500` → `text-green-700 font-semibold`). « Dernier bilan complet » (un seul bilan) : chaque champ catégorisable du `BilanForm` affiche sa catégorie.
- BilanDetailTab : la vue en lecture seule passe la fonction `categorize` au `BilanForm` ; le sous-titre indique la norme active. Le message obsolète « catégorisation CPAFLA en v0.1.7 » est remplacé.
- `BilanForm` accepte une prop optionnelle `categorize?: (key, value) => Category | null`, n'affichée qu'en `readOnly`.

### Composant partagé — `src/components/CategoryBadge.tsx`
Affiche une catégorie avec sa couleur ou un tiret en gris quand `null` (donnée manquante / hors barème / test non couvert).

### Tests — `src/lib/norms/norms.test.ts`
- Nicholas (H, 35 ans) : VO2max 49 → `TRES_BIEN` (≥47 et <53 selon ACSM H 30-39).
- Sabrina (F, 35 ans) : VO2max 49 → `EXCELLENT` (≥45 selon ACSM F 30-39, barre plus basse).
- Couvre `computeAge`, logique `lowerIsBetter` (% gras, IMC, tour de taille), CPAFLA → `null`, valeurs manquantes, tests hors barème (saut vertical, puissance jambes).

## ✅ Fait (v0.1.16 — Saisie manuelle de bilan + auto-calculs + synthèse temps réel)

### Objectif : Marie-Eve saisit un bilan complet sans .docx
Activation du bouton « Saisie manuelle » désactivé depuis v0.1.6. Le formulaire couvre toutes les sections d'un bilan, calcule en temps réel l'IMC / MET / FC max prédite / % gras Durnin-Womersley, et affiche 5 + 1 cards de synthèse (Composition / % Gras / Aérobie / Dos / Musculo / Score global) catégorisées dès que les valeurs sont saisies.

### Modèle de données — `BilanData` étendu (JSON, pas de migration)
Nouveaux champs persistés dans `bilan.data` :
- **Aérobie** : `met_equivalent` (calculé), `fc_max_predite` (calculée).
- **Récupération post-effort** : `recup_{1,3,5}min_{pa_sys,pa_dia,fc}` (9 champs).
- **Notes** : `notes` (texte libre, saisie manuelle uniquement).

Le schéma `zod` côté IPC (`electron/ipc/bilans.ts`) accepte les nouveaux champs ; pareil pour le type côté parser (`electron/lib/bilan-parser.ts`).

### Auto-calculs — `src/lib/norms/calc.ts` + `scoring.ts`
- `computeBmi(taille, poids)` : poids ÷ (taille / 100)².
- `computeMet(vo2max)` : VO2max ÷ 3.5.
- `computeFcMaxPredite(age)` : Tanaka (208 − 0.7 × âge) — plus précis que Karvonen pour les adultes.
- `% gras` : Durnin-Womersley (existait déjà via `body-fat-calculator.ts`) appliqué dès que les 4 plis + âge + sexe sont disponibles.
- `categoryToScore` / `scoreToCategory` : conversion 5 catégories ↔ score 0-5 (bornes 1.5 / 2.5 / 3.5 / 4.5).
- `computeSynthesis(data, profile)` : 6 scores composites (composition, % gras, aérobie, dos, musculo, global). Le score global est la moyenne 25/25/25/25 de composition / aérobie / dos / musculo.

### UI — `CreateBilanModal` + refactor `BilanForm`
- **`CreateBilanModal.tsx`** : modal plein-écran ouvert depuis l'onglet Bilans. Seule la date est requise (préremplie à aujourd'hui). À la sauvegarde, `deriveBilanFields` injecte les auto-calculs dans `bilan.data` avant l'IPC. `source: 'manuel'`.
- **`BilanForm.tsx`** :
  - Nouveaux types de champs : `select` (test aérobie), `textarea` (notes), `computed` (read-only avec hint, jamais éditable).
  - Sections **collapsibles** (chevrons) en mode édition : Anthropométrie, Aptitude aérobie, Récupération post-effort, Musculosquelettique, Indices (importés), Notes.
  - Cards de synthèse en haut (prop `showSynthesis`) — mises à jour en temps réel à chaque keystroke.
  - Les auto-calculs s'affichent dans des inputs grisés avec hint explicatif (« VO2max ÷ 3.5 », « Tanaka : 208 − 0.7 × âge »).
- **`BilanSynthesisCards.tsx`** : composant partagé (5 cards en grille + 1 card score global mise en valeur en gold).

### Test aérobie — select
5 options : Tapis Roulant de Bruce, Test d'Astrand, Cooper 12 min, Test de Léger, Autre.

### Dashboard — `DashboardTab.tsx`
- Nouvelle **card « Score santé et condition physique globale »** sous les hero stats (fond gold, score 0-5 + catégorie colorée).
- Nouveau **« Évolution des indices »** (table 2+ bilans) : Composition / % Gras / Aérobie / Dos / Musculo / Global par date, scores 0-5 colorés selon la catégorie.

### Vérifs
- Tests : `node --test src/lib/norms/scoring.test.ts` → 9/9 pass (BMI Nicholas 176/99.8 → 32, MET 14, FC max 35y → 183.5, barème 1-5, bornes). `norms.test.ts` + `units.test.ts` toujours verts.
- `tsc --noEmit` web + node : clean.
- `npm run build` + `npm run dev` : OK.

## ✅ Fait (v0.1.17 — Calcul VO2max protocolaire (Bruce / Cooper / Léger))

### Objectif : saisir le paramètre brut du test, pas le VO2max
Marie-Eve note la durée tenue sur le tapis (ou la distance Cooper, ou le palier Léger). L'app calcule le VO2max via la formule du protocole, le réutilise pour le MET, la catégorisation et la synthèse. Plus de calcul mental ni de table papier.

### Module — `src/lib/vo2max-calculator.ts`
- `bruceTreadmillVo2max({ durationSeconds, sex })` — Foster/Pollock 1984 (hommes : polynôme de degré 3) / Kline-like 1982 (femmes : linéaire). T en minutes décimales.
- `cooperVo2max(distanceMeters)` — Cooper 1968 : `(d − 504.9) / 44.73`.
- `legerVo2max(palier, age)` — Léger 1988 : `31.025 + 3.238·P − 3.248·A + 0.1536·P·A` (formule littérale du brief — fonctionne pour les enfants/ados ; pour adultes Marie-Eve restera sur Cooper ou Bruce).
- `BRUCE_STAGES` (7 paliers de 3 min : vitesse, pente, MET estimé) + `bruceStageFor(seconds)`.
- Helpers `parseMmSs("12:30")` / `formatMmSs(750)`.

### UI — `AerobicSection.tsx` (nouveau)
Section custom branchée dans `BilanForm` à la place du grid générique pour le groupe `aerobie`.
- **Sélecteur de protocole** (4 options) : Tapis Roulant de Bruce, Test de Cooper (12 min), Test de Léger (navette 20 m), Autre / VO2max connu directement.
- **Inputs adaptés** selon le protocole :
  - Bruce → champ texte `mm:ss` (parsé sur blur/Enter) + stage atteint affiché en read-only (« Stage 5 — 8 km/h à 18% (~16 MET) ») + table dépliable des 7 paliers.
  - Cooper → distance en mètres.
  - Léger → palier 1-21 (avertit si la date de naissance manque).
  - Manual → input VO2max libre (comme avant la refonte).
- **VO2max** : recalculé en live à chaque changement, affiché en read-only avec hint (« Calculé via Foster/Pollock / Cooper / Léger 1988 »). En mode manual, redevient un input éditable.
- **MET équivalent** : VO2max ÷ 3.5, read-only.
- **FC repos** (saisie), **FC max prédite** Tanaka (auto), **PA systolique / diastolique** (saisies).
- Bruce : avertit si le sexe du client n'est pas renseigné.

### Stockage — JSON, pas de migration
Nouveaux champs dans `BilanData` :
- `aerobie_test_type` : `'bruce' | 'cooper' | 'leger' | 'manual'` (pilote l'UI à la réouverture).
- `bruce_duration_sec` : durée totale Bruce (secondes).
- `cooper_distance_m` : distance Cooper (mètres).
- `leger_palier` : palier Léger (1-21).
- `vo2max` continue d'être la valeur canonique — recalculée au save par `deriveBilanFields` quand un protocole est sélectionné et que les paramètres bruts + profil sont disponibles. À la ré-ouverture d'un bilan existant, le VO2max est recalculé live à partir des paramètres pour rester cohérent si la formule change.
- Schéma `zod` IPC + type parser mis à jour.

### Vérifs
- `node --test src/lib/vo2max-calculator.test.ts` → 14/14 pass.
  - Bruce H 12 min → 42.4 (Foster/Pollock littéral — le « ~49 » du brief venait d'une autre équation, voir daily note).
  - Bruce F 8 min → 31.14 (Kline-like exact).
  - Bruce Nicholas 12:30 H → 44.6 (le « ~49 » du bilan réel correspond à Bruce-FRIEND, à intégrer plus tard si besoin).
  - Cooper 2400 m → 42 ✅.
  - Léger palier 8, 10 ans → 36.7 (correction du cas du brief — la formule littérale donne −3.65 à 30 ans).
  - `bruceStageFor(12:30)` → stage 5 ✅, `parseMmSs / formatMmSs` aller-retour ✅.
- Suite complète `node --test ...` → 41/41 pass.
- `tsc --noEmit` web + node : clean ; `npm run build` OK (2292 modules).

## ✅ Fait (v0.1.18 — Puissance des jambes auto-calculée (Sayers))

### Objectif : matcher exactement la valeur du logiciel actuel de Marie-Eve
Plus de saisie manuelle de la puissance — Marie-Eve entre le saut vertical et l'app calcule via Sayers (1999). Pour les bilans déjà importés depuis .docx, la valeur officielle est préservée.

### Module — extension `src/lib/vo2max-calculator.ts`
```ts
sayersLegPower(verticalJumpCm, bodyWeightKg) → Watts (entier, arrondi)
  P = 60.7 × saut + 45.3 × poids − 2055
```
Source : Sayers SP et al., Med Sci Sports Exerc 1999. Standard ACSM / SCPE.

### UI — section musculo de `BilanForm`
- Champ « Puissance des jambes » passé en `type: 'computed'` (gris, non éditable) avec hint « Sayers : 60.7 × saut + 45.3 × poids − 2055 ».
- Calcul déclenché en temps réel dès que **saut vertical** + **poids** (de la section Anthropométrie) sont saisis.
- Si l'un des deux manque → affichage `—`.

### Stockage — JSON, pas de migration
- `puissance_calculated_auto?: boolean` ajouté à `BilanData` :
  - `true` : valeur calculée par l'app (saisie manuelle, recalculée au save).
  - `false` : valeur importée du .docx — **on préserve, on ne recalcule jamais**.
  - `undefined` + valeur présente : ancien bilan → on préserve.
  - `undefined` + valeur absente : on calcule au prochain save si saut + poids sont disponibles.
- Le parser `electron/lib/bilan-parser.ts` marque automatiquement `puissance_calculated_auto: false` sur les valeurs extraites du .docx.
- Schéma `zod` IPC + type parser mis à jour.

### Vérifs
- `node --test src/lib/vo2max-calculator.test.ts` → 17/17 pass (3 nouveaux tests Sayers).
  - Cas Nicholas (saut 48 cm, poids 99.8 kg) → **5380 W** ✅ (matche son bilan exactement).
  - Saut 60 cm, poids 80 kg → 5211 W.
  - Données manquantes → `null`.
- Suite complète → 44/44 pass.
- `tsc` web + node clean ; `npm run build` OK ; `npm run dev` démarre sans erreur app.

## ✅ Fait (v0.1.19 — Auto-calculs complets + UX polish du formulaire)

### Objectif : feedback temps réel + scores composites consolidés
Une fonction unique `computeBilan` calcule TOUT (anthropo, aérobie, musculo, composites). La synthèse devient **sticky** en haut du formulaire pour voir l'impact des saisies. Marie-Eve peut pré-remplir un nouveau bilan à partir des valeurs structurelles du précédent.

### Module central — `src/lib/bilan-computed.ts`
Une fonction `computeBilan(raw, profile)` qui retourne `BilanComputed` :
- **Anthropo** : `imc`, `poidsOptimalMaxKg` (25 × taille²), `ratioTailleHanche`, `pourcentageGrasDurnin` (4 plis Durnin-Womersley).
- **Aérobie** : `vo2max` (dispatch Bruce/Cooper/Léger/manual), `metEquivalent`, `fcMaxPredite` (Tanaka), `fcZones` (z60 → z90 par tranches de 5%).
- **Musculo** : `puissanceJambesW` (Sayers), avec respect du flag `puissance_calculated_auto: false`.
- **Composites** (échelle 0.5-4.5 style CSEP) :
  - `composition` (IMC + % gras + tour de taille)
  - `bodyFat` (% gras)
  - `aerobic` (VO2max)
  - `backHealth` (flexion + endurance dos + situps)
  - `musculoGlobal` (6 tests musculo)
  - `overall` (moyenne pondérée 25/25/25/25 — composition/aérobie/dos/musculo)
- Helper `mergeComputedIntoBilan(raw, computed)` injecte les valeurs au save.

### Échelle des scores
`CATEGORY_TO_SCORE` aligné CSEP : 0.5 / 1.5 / 2.5 / 3.5 / 4.5. `scoreToCategory` re-bornée à 1.0 / 2.0 / 3.0 / 4.0.

### UX — Sticky synthesis + gauges + ▲▼
- Cards de synthèse wrappées dans un conteneur **sticky top-0** (modal de saisie manuelle) : visibles pendant tout le scroll du formulaire.
- Chaque card : gros chiffre centré (text-3xl bold), jauge **5 points** ●●●○○ (remplis selon score arrondi), pill catégorie, indicateur **▲ vert / ▼ rouge / = stable** vs bilan précédent (calculé via `previousData` prop).
- Si aucune valeur n'est calculable : placeholder « Saisissez taille + poids + VO2max pour voir la synthèse se calculer ».

### Section headers enrichis (`BilanForm`)
- Compteur de complétion `(N / M champs)` à droite du titre — exclut les champs `computed`.
- ✓ vert quand 100 % des champs utilisateur sont remplis.
- « Indices (importés) » → renommé « **Indices (calculés)** » : tous les champs en `type: 'computed'` (toujours read-only) avec hint vers les cards de synthèse.

### Pré-remplissage depuis bilan précédent
- Bannière sous le titre de `CreateBilanModal` : « ↑ Pré-remplir avec les valeurs du bilan du DATE » + nombre de valeurs disponibles.
- Clic → modal de confirmation avec checkboxes par champ + aperçu de la valeur. Pré-cochés par défaut : 12 champs structurels (taille, plis, tours, FC repos, PA repos). Non pré-cochés : performance (poids, VO2max, push-ups, sit-ups, saut, flexion, endurance).
- Bouton « Pré-remplir (N) » → applique les valeurs sélectionnées et ferme le modal.

### Animation
Cards et inputs computed : `transition-all duration-300` sur les valeurs (effet doux à chaque keystroke).

### Tests — `src/lib/bilan-computed.test.ts`
14 assertions sur le cas **Nicholas Jean** (H 48 ans) :
- IMC 32.2 ✅
- Poids optimal max 77.4 kg
- Ratio T/H 0.9
- % gras Durnin 30.2
- VO2max Bruce 13:33 → 49.0 ✅
- MET 14 ✅
- FC max Tanaka 174 ✅
- FC zones (z60 = 104, z90 = 157)
- Puissance Sayers 5380 W ✅
- Aérobie TRES_BIEN, Composition A_AMELIORER
- Score global 1.5-3 (composition + aérobie présents)
- Edge cases (profil incomplet, bilan vide) → `null` propre

Suite complète **58/58 tests pass**. `tsc` web + node clean (avec `allowImportingTsExtensions: true` + `noEmit: true` ajoutés à `tsconfig.web.json`). `npm run build` OK ; `npm run dev` démarre sans erreur app.

## ✅ Fait (v0.1.20 — Percentiles ACSM complets + comparaison vs population)

### Objectif : situer le client dans la population, pas juste l'étiqueter
Au lieu d'un simple « Très bien », Marie-Eve peut dire « 88e percentile · +40 % vs moyenne H 40-49 ». L'architecture passe sur des percentiles P10/P25/P50/P75/P90 (alignée ACSM 11e éd. et future CPAFLA). Les catégories restent — dérivées des cutoffs. Décision documentée dans [[decisions/0006-percentiles-vs-categories]].

### Refactor — `NormRange` porte des percentiles
`thresholds: { aAmeliorer / acceptable / bien / tresBien }` remplacés par `percentiles: { p10, p25, p50, p75, p90 }`. Catégorie dérivée :
- `< P10` → A_AMELIORER
- `P10 ≤ x < P25` → ACCEPTABLE
- `P25 ≤ x < P50` → BIEN
- `P50 ≤ x < P75` → TRES_BIEN
- `≥ P75` → EXCELLENT

Pour `lowerIsBetter` : valeurs en ordre décroissant + inversion des comparaisons.

### Migration ACSM
Migration mécanique des tables existantes (`aAmeliorer→p10`, …, `tresBien→p75`, `p90 = 2·p75 - p50`). 3 entrées **recalibrées** sur les valeurs ACSM 11e éd. publiées pour Nicholas Jean (48 ans) :
- VO2max H 40-49 : `pct(23, 30, 35, 43, 50)`
- % gras M 40-49 : `pct(35, 30, 25, 20, 14)` (lowerIsBetter)
- Push-ups M 40-49 : `pct(9, 12, 16, 22, 28)`

### Nouvelle API — `src/lib/norms/index.ts`
- `getCategorization(test, value, age, sex, norms)` (inchangée — backend percentile)
- `getPercentile(test, value, age, sex, norms)` → interpolation linéaire 0-100 (clampée, gère lowerIsBetter)
- `getPopulationAverage(test, age, sex, norms)` → P50
- `getDeltaVsAverage(test, value, age, sex, norms)` → `{ deltaPct, isBetter }` (gère lowerIsBetter)

### UI — `<PercentileIndicator>`
Composant partagé qui affiche sous chaque valeur catégorisée :
- `Xe percentile · +Y % vs moyenne H 45-54` avec couleur verte/rouge selon `isBetter`
- Mini-barre horizontale 0-100 avec marqueur P50 (trait gris) et position du client (pastille colorée)
- Tooltip natif : « 88e percentile : 88 % des hommes 40-49 ans ont un résultat inférieur au vôtre. Moyenne population (P50) ≈ 35. Source : ACSM Guidelines 11e édition. »

Intégration :
- **`BilanForm`** : `<PercentileIndicator>` sous chaque champ catégorisé (saisie ET lecture seule).
- **`AerobicSection`** : sous le VO2max calculé.
- **`DashboardTab`** hero stats : VO2max, IMC, % gras — variante `marine` adaptée au fond foncé.

### Tests
- `node --test src/lib/norms/norms.test.ts` ajoute 8 tests percentile/delta :
  - VO2max 49 H 48y → ~88e percentile, +40 % ✅
  - exact P50 → 50 ✅
  - <P10 → 0-10, >P90 → 90-100 ✅
  - % gras 30.2 M 48y → ~25e percentile, -20.8 % (moins bon, lowerIsBetter inversé) ✅
  - push-ups 28 M 48y → ~90e percentile ✅
- `bilan-computed.test.ts` mis à jour : Nicholas aerobic.category passe de TRES_BIEN → **EXCELLENT** (cohérent avec la calibration ACSM 11e éd.).
- Suite complète : **66/66 tests pass**.

### Vérifs
- `tsc -p tsconfig.web.json --noEmit` ✅ ; `tsc -p tsconfig.node.json --noEmit` ✅.
- `npm run build` OK (2294 modules) ; `npm run lint` aucune nouvelle erreur ; `npm run dev` démarre sans erreur app.

## ✅ Fait (v0.1.21 — Dashboard refondu, style apps santé modernes)

### Objectif : un dashboard à la Whoop / Oura / Strava
La hiérarchie visuelle met le **score global** en avant (donut hero), accompagné des **5 composites** en mini-cards. Une rangée de **4 StatCardXL** avec sparklines montre les indicateurs clés (VO2max, IMC, % gras, tour de taille). Split 8/4 colonnes : à gauche progression chronologique avec toggle de métrique + radar musculo ; à droite mesures corporelles + zones d'entraînement. En bas, panneau **Forces / À travailler** et historique des bilans en table cliquable.

### Composants neufs — `src/pages/client/dashboard/`
- **`ScoreDonut`** : SVG circulaire (stroke-dasharray), score 0-5 au centre en `text-5xl`, couleur de l'arc selon la catégorie, delta vs précédent affiché en dessous.
- **`StatCardXL`** : grand chiffre `text-5xl` + percentile + delta vs moyenne + **sparkline Recharts** (8 derniers bilans, sans axes, mini-courbe gold). Hover effect (`shadow-md`, `-translate-y-0.5`).
- **`CompositeMiniCard`** : 5 mini-cards autour du donut. Gros chiffre, jauge ●●●○○, pill catégorie, delta ▲▼.
- **`ProgressionChart`** : LineChart Recharts avec **toggle** entre 4 métriques (VO2max, % gras, IMC, score global). Ligne pointillée grise pour la **moyenne population (P50)** — comparaison continue.
- **`MusculoRadar`** : RadarChart 6 axes (push-ups, sit-ups, saut vertical, puissance, flexion, endurance dos) sur échelle 0-100 (percentiles). Deux séries : bilan courant (marine plein) + précédent (gold pointillé).
- **`TrainingZones`** : 5 zones FC (Échauffement → VO2max) avec dégradé vert → rouge, bornes calculées depuis `computeBilan.fcZones`. Hint Tanaka sous le titre.
- **`StrengthsAndWeaknesses`** : 2 panneaux (Forces en vert + À travailler en amber) qui listent les tests dont la catégorie est respectivement {TRES_BIEN, EXCELLENT} et {ACCEPTABLE, A_AMELIORER}.
- **`BilansHistoryTable`** : table compacte clickable (hover bg, navigate vers la fiche du bilan).

### Layout (12 colonnes, responsive)
- Header (avatar XL + nom + âge + sexe + email + actions Générer PDF / Envoyer)
- Hero (donut score global · 4 cols / 5 composites · 8 cols)
- 4 StatCardXL en grid 2/4
- Split 8/4 : ProgressionChart + MusculoRadar à gauche / Mesures + TrainingZones à droite
- StrengthsAndWeaknesses
- BilansHistoryTable

### Cas particuliers
- **0 bilan** : empty state avec gros avatar + CTA gold « Commencer ».
- **1 seul bilan** : skip ProgressionChart ; garde radar/mesures/zones/forces-faiblesses + bandeau gold « Importez un 2e bilan pour la progression ».
- **Données partielles** : `—` proprement, jauges grisées, message inactif si âge/sexe manquent (radar / TrainingZones).
- **Print mode** (`?print=1`) : masque les actions et le toast.

### Style
- Cards : `bg-white` (ou `gradient-to-br from-white to-cream/30` pour les StatsXL) avec `shadow-sm hover:shadow-md`, `border border-cream-dark/30`, `rounded-xl`, `p-5`.
- Couleurs : marine pour chiffres, gold pour accents/CTA, cohérent avec le reste de l'app.
- Animations : `transition-all duration-200`, hover lift `-translate-y-0.5`. Pas de framer-motion (overkill pour le scope).
- Sparklines Recharts (`isAnimationActive: false` pour réactivité immédiate).

### Vérifs
- `tsc` web + node clean.
- `npm run build` OK (2294 modules, +90 kB pour les nouveaux composants).
- `npm run lint` : aucune nouvelle erreur ni warning sur le code écrit.
- `npm run dev` démarre sans erreur app.
- Suite tests : **66/66 pass** inchangé (refactor UI pur).

## ✅ Fait (v0.1.22 — Mesures refondues : deltas + risque OMS + pré-remplissage)

### Objectif : la prise de mesures devient un outil de suivi (pas juste un formulaire)
Sous chaque champ de circonférence + poids + plis cutanés, Marie-Eve voit immédiatement le delta vs la dernière mesure. Pour tour de taille et tour de hanche (+ ratio T/H calculé), une barre OMS 3 segments montre le niveau de risque cardio-métabolique. Un encart en haut permet de pré-remplir le formulaire depuis la dernière mesure en 2 clics.

### Composant — `src/lib/norms/who.ts`
Nouveau module avec les seuils OMS pour le risque cardio-métabolique, séparés des tables ACSM de fitness :
- **Tour de taille** : H Faible < 94, Élevé 94-102, Très élevé ≥ 102. F : 80 / 88.
- **Ratio T/H** : H Sain < 0.90, Modéré 0.90-1.00, Élevé > 1.00. F : 0.80 / 0.85.
- API : `getWaistRisk(value, sex)`, `getRatioRisk(value, sex)`, `calculateRiskBarPosition(value, thresholds)`.
- Sources : WHO 2008 + Santé Canada.

### Composants UI
- **`<MeasureDelta>`** (`src/components/MeasureDelta.tsx`) : « ▲ −2 cm (−1.9 %) · depuis 10 sept 2025 ». Couleur verte/rouge selon le sens de la perf (`lowerIsBetter` inverse), gris stable, prop `theme: 'light' | 'dark'` pour s'adapter aux cards marine.
- **`<WaistRiskBar>`** (`src/components/WaistRiskBar.tsx`) : 3 segments vert/jaune/rouge avec marqueur ▲ et label « Élevé · OMS ». Tooltip natif « OMS — Tour de taille et risque métabolique (WHO 2008) ».

### Intégration dans `MesuresTab.tsx`
- **`MeasureField`** enrichi : nouvelles props optionnelles `previousValue`, `previousDate`, `lowerIsBetter`, `extra` (slot pour la barre OMS). Tous les champs affichent automatiquement le delta. Tour taille/hanche affichent en plus une `<WaistRiskBar>` sous la valeur.
- **Ratio T/H** : nouvelle card calculée dès que taille + hanche sont saisies. Delta + barre OMS ratio.
- **Pré-remplissage circonférences** : bannière gold cliquable au-dessus du formulaire (si non en mode édition ET qu'une mesure précédente existe). Clic → modal `<CircPrefillModal>` : checkboxes par circonférence + poids (préremplis), toggle « Écraser les champs déjà saisis » (off par défaut), bouton « Pré-remplir (N) ».
- **Pré-remplissage plis cutanés** : même mécanique avec `<PlisPrefillModal>` pour les 4 plis.
- **« Mesure précédente »** définie contextuellement : si on édite la ligne i, précédent = list[i+1] ; si on crée → list[0] (la plus récente sauvegardée).

### Logique `lowerIsBetter`
Configurée par champ :
- **Circonférences** : taille, hanche, abdomen → `lowerIsBetter: true` (baisse = bien).
- **Poids** : `lowerIsBetter: true`.
- **Plis cutanés** : tous `lowerIsBetter: true`.
- **Autres** (cou, épaule, biceps, poitrine, cuisse, mollet) : muscle/morpho neutres → flèches noires + couleur du delta brut.

### Reporté en v0.1.23
**Partie D — Silhouette interactive** (toggle Avatar/Silhouette, SVG cliquable avec zones par body part, hover bidirectionnel). Choix de scope volontaire (~3h de risque visuel sur les positions SVG des body parts). Le composant `<Silhouette>` actuel reste tel quel (avatar full-body si dispo, sinon body-male/female).

### Vérifs
- `node --test src/lib/norms/who.test.ts` → **19/19 pass** (cas H/F sur waist + ratio, classifications, positions barre, NaN).
- Suite complète : **97/97 tests pass** (norms 23 + scoring 11 + vo2max 17 + bilan-computed 14 + units 5 + CategoryRangeBar 10 + who 19, divers).
- `tsc -p tsconfig.web.json --noEmit` ✅ ; `tsc -p tsconfig.node.json --noEmit` ✅.
- `npm run build` OK (2295 modules) ; `npm run lint` : aucune nouvelle issue ; `npm run dev` démarre sans erreur app.

## ✅ Fait (v0.1.31 — Branchement API Anthropic réel pour les conseils IA)

### Objectif : connecter la fonctionnalité Conseils IA architectée en v0.1.30 à une vraie API Claude
La v0.1.30 livrait toute l'architecture + UI (toggle, sélection, FAB, modal payload preview, modal résultat, copier en markdown) avec une réponse mockée. Cette version connecte l'API Anthropic en vrai. Décision détaillée dans [[decisions/0008-branchement-api-anthropic]].

### IPC — `electron/ipc/ai.ts`
5 handlers :
- `ai:has-api-key` / `ai:set-api-key` / `ai:remove-api-key` — clé dans keytar (trousseau OS), même pattern que SMTP.
- `ai:test-connection` — ping avec Haiku 4.5 + `max_tokens: 10`, valide la clé sans coûter cher.
- `ai:generate(payload)` — appel Sonnet 4.6 avec prompt système + payload anonymisé, parse le JSON, valide via zod (`AdviceSchema`), retourne `{ ok, advice?, error?, code? }`.

### Service renderer — `src/services/aiAdvice.ts`
Mock supprimé, remplacé par les appels IPC réels. Type `AIAdviceError` exposé avec `code: AIErrorCode` pour gestion contextuelle côté UI.

### UI — `AIProviderCard` refactorée
- Header « Conseils IA — Anthropic Claude » (radio provider retiré).
- Lien `console.anthropic.com` pour obtenir une clé.
- Au mount : `hasApiKey()` → si oui, badge vert « Clé configurée » + bouton « Remplacer la clé ». Sinon, formulaire de saisie visible.
- Input `password` avec placeholder `sk-ant-…`, bouton « Enregistrer » (actif si non vide).
- Bouton « Tester la connexion » → toast vert/rouge avec message clair.
- Bouton « Supprimer la clé » (rouge discret) → modal de confirmation.
- Bandeau « en cours de développement » retiré.

### UI — `AIAdvicePanel` : modal NO_API_KEY
Si `generate()` rejette avec `code: 'NO_API_KEY'` → modal dédié « Aucune clé API Anthropic configurée. Allez dans Réglages → Conseils IA pour en ajouter une. » + bouton « Ouvrir les réglages » qui navigate vers `/settings`.

### Préload + types
`window.api.ai.{hasApiKey, setApiKey, removeApiKey, testConnection, generate}` exposés via contextBridge. Typage dans `src/env.d.ts`.

### Loi 25
Le payload envoyé à Anthropic reste anonyme par construction (sexe + âge entier + valeurs/catégories/percentiles). Aucun nom/courriel/notes. Validation explicite dans l'ADR 0008.

### Vérifs
- `tsc` web + node clean
- `npm run build` OK (2305 modules, +20 kB pour l'IPC AI)
- `npm run lint` baseline 17 préexistantes inchangée
- Suite tests : **97/97 pass**
- Version `package.json` : 0.1.14 → 0.1.31

## ✅ Fait (v0.1.32 — Mode « Synthèse » dans le sélecteur de bilan)

### Objectif : éviter à Marie-Eve de naviguer bilan par bilan pour reconstituer l'état le plus à jour
Les bilans .docx historiques sont **partiels** par nature : un bilan a souvent VO2max + push-ups mais pas de plis ; un autre a tour de taille + IMC mais pas de musculo. La nouvelle pill « Synthèse » construit un bilan virtuel champ par champ avec la valeur la plus récente non-null. Décision documentée dans [[decisions/0009-mode-synthese-bilans]].

### Module — `src/lib/synthesisBilan.ts`
- `buildSynthesisBilan(bilans)` → `{ data, latestContributionDate, fieldOriginDates, fieldCounts }`. Pour chaque champ, conserve la valeur la plus récente non-null/undefined/empty. Retourne aussi la date la plus récente parmi les contributeurs (pour le badge MAJ) et un mapping field → date d'origine (futurs tooltips).
- `buildPreviousSynthesisBilan(bilans)` → `{ data }`. Pour chaque champ, conserve la 2e valeur non-null la plus récente — sert aux flèches ▲▼ champ par champ.
- Valeurs `0` numériques sont valides (ex: `pushups: 0` n'est pas filtré).
- 7 tests unitaires.

### UI — `BilanSelectorPills`
- Pill spécial **Synthèse** en tête, icône `Sparkles`, gradient marine + bordure gold ring quand actif, fond `bg-gold/5` quand inactif.
- Signature changée : `selectedId: string | null` (null = mode synthèse). `onSelect` reçoit `null` pour basculer en synthèse.
- Nouvelle prop `synthesisLatestDate` pour afficher la date MAJ dans le sous-titre du pill.

### Routing & défaut
- Sentinel `?bilan=synthesis` dans l'URL.
- **Nouveau défaut** : si aucun param, mode synthèse (plus pertinent que le bilan le plus récent pour une consultation rapide).
- Bouton « Revenir au bilan récent » du bandeau d'avertissement renommé « Revenir à la synthèse ».

### Intégration DashboardTab
- 2 nouveaux `useMemo` : `synthesisResult` et `previousSynthesisResult`.
- `activeBilan` retourne un bilan virtuel avec `id: 'synthesis'` quand en mode synthèse.
- `previousActiveBilan` retourne un bilan virtuel avec `id: 'synthesis-previous'`.
- `isViewingOlder` désactivé en mode synthèse (la synthèse n'est pas un « bilan ancien »).
- Header du dashboard affiche `🔬 Synthèse — dernières valeurs disponibles · mise à jour DATE · N bilans agrégés` quand actif.

### Vérifs
- `tsc` web + node clean
- `npm run build` OK (2306 modules)
- `npm run lint` baseline 17 préexistantes inchangée
- Suite tests : **104/104 pass** (97 + 7 nouveaux pour synthesis)
- Version `package.json` : 0.1.31 → 0.1.32

## ✅ Fait (v0.1.77 — Retrait de l'onglet Historique)

L'onglet « Historique » n'était qu'un placeholder jamais défini (doublon des historiques déjà présents dans Bilans /
Mesures / Notes). Retiré : entrée `TABS`, route, et composant `PlaceholderTab` (devenu inutile) supprimés.
Version : 0.1.76 → 0.1.77.

## ✅ Fait (v0.1.83 — Célébrer les victoires (Dashboard))

Quand un client progresse, le Dashboard le souligne (uniquement l'app — jamais le PDF) :

- **Bannière « Belle progression ! »** au-dessus du bilan, listant jusqu'à 5 victoires détectées :
  montée de catégorie d'un domaine (ex. *Composition : Bien → Très bien*), **score global en hausse**,
  **record personnel** sur une métrique (VO2max, pompes, redressements, saut, % gras, IMC, tour de taille —
  meilleure valeur stricte de l'historique), **objectif de composition atteint**.
- **Petite pluie de confettis** à l'ouverture quand il y a au moins une victoire — une seule fois par bilan
  et par session (pas de répétition en naviguant), sans dépendance externe (canvas), et **désactivée si
  `prefers-reduced-motion`**.
- Détection pure et testée (`src/lib/dashboard-wins.ts`, 5 tests). Version : 0.1.82 → 0.1.83.

## ✅ Fait (v0.1.82 — Animations douces du Dashboard)

Touches d'animation pour rendre le Dashboard plus vivant (uniquement l'app interactive — le PDF reste statique) :

- **Anneau de score** qui se remplit + **chiffre du score global** qui compte de 0 (`ScoreDonut`).
- **Grands chiffres** des hero stats (VO2max, IMC…) et **scores composites** qui comptent de 0 (`StatCardXL`,
  `CompositeMiniCard`) — hook réutilisable `useCountUp` (easeOutCubic, s'anime aussi au changement de bilan).
- **Apparition en cascade** (fondu + légère montée) des sections du Dashboard (`.dash-rise`, délais échelonnés).
- Respecte `prefers-reduced-motion` (tout devient instantané). Version : 0.1.81 → 0.1.82.

## 🐛 Corrigé (v0.1.81 — PDF : score composition ≠ Dashboard (suite))

Après v0.1.79, il restait un écart sur « Composition » (Dashboard 3.0 vs PDF 2.7) tirant le global (4.2 vs 4.1). Cause :
le Dashboard score via `computeBilan` (qui **recalcule l'IMC** depuis taille+poids), le PDF via `computeSynthesis` (IMC
**stocké**) — sur une synthèse mêlant taille/poids/IMC de bilans différents, l'IMC diffère → catégorie → composition.
Correctif : le rapport utilise désormais **`computeBilan` partout** (couverture, composites, sections, frise) — exactement
la même fonction que le Dashboard, sur les mêmes données. `computeSynthesis` n'est plus utilisé dans le rapport.
Version : 0.1.80 → 0.1.81.

## ✅ Fait (v0.1.80 — PDF : pas de silhouette générique sans photo)

Sur la couverture du rapport, la silhouette générique (homme/femme) était affichée en repli quand le client n'avait pas
de photo. Désormais : **sans vraie photo, on n'affiche rien** (ni cercle ni silhouette) — le nom remonte proprement. Le
cercle photo n'apparaît que si un avatar réel existe. Imports `body-male/female` retirés. Version : 0.1.79 → 0.1.80.

## 🐛 Corrigé (v0.1.79 — Score global du PDF ≠ Dashboard)

Le score global (et les composites) du rapport PDF ne correspondait pas au Dashboard. **Deux causes** :

1. **Définition de « Composition » divergente** : `computeSynthesis` (PDF) = IMC + tour de taille, alors que
   `computeBilan` (Dashboard) = IMC + **% gras** + tour de taille. → `computeSynthesis.composition` aligné (ajout de
   `pourcentage_gras`). Les deux fonctions donnent maintenant des scores identiques. Carte « Composition » du rapport
   montre les 3 sous-tests.
2. **Données différentes** : le PDF calculait sur le dernier bilan seul (`bilans[0]`), le Dashboard sur la **Synthèse**
   (dernière valeur non-null de chaque champ, tous bilans). → le rapport construit désormais le même bilan synthèse
   (`buildSynthesisBilan`) comme donnée courante ; la progression (frise, avant/après) reste sur les vrais bilans.

Résultat : le score et les composites du PDF correspondent au Dashboard. Version : 0.1.78 → 0.1.79.

## ✅ Fait (v0.1.78 — Exporter les barèmes (PDF) + nom par défaut corrigé)

- **Exporter les barèmes** : bouton dans Paramètres → Normes de catégorisation. Génère un PDF de référence (barèmes de
  catégorisation par âge/sexe, seuils cliniques, risque OMS, formules, composites, nutrition, sources) via la route
  autonome `/baremes` (`BaremesPage`) + `printToPDF` (report-generator `generateBaremesPdf`). Les tableaux sont lus depuis
  `ACSM_TABLES` (exporté d'`acsm.ts`) → **toujours synchro avec le code**. IPC `reports:generate-baremes` + service.
- **Nom par défaut** : `DEFAULT_PROFILE` corrigé de « Marie-Eve Bélanger » (placeholder) → « Marie-Eve Riendeau ».

Version : 0.1.77 → 0.1.78.

## 🐛 Corrigé (v0.1.76 — Onglet Notes cliquable)

L'onglet Notes (v0.1.75) était fonctionnel mais son bouton dans la barre d'onglets restait `enabled: false` (grisé,
non cliquable) — reliquat du placeholder. Passé à `enabled: true` dans `ClientDetailLayout`. Version : 0.1.75 → 0.1.76.

## ✅ Fait (v0.1.75 — Onglet Notes : journal clinique par client)

L'onglet Notes (placeholder) devient un vrai **journal de notes datées**, **privé** (jamais dans le rapport). Voir
`docs/decisions/0019`. Table `client_notes` (migration `0012`), IPC `notes:*` + service, UI `NotesTab` : formulaire
(date + texte) pour ajouter/modifier, liste antéchronologique avec Modifier/Supprimer, garde « note non enregistrée »
(`useBlocker`). Version : 0.1.74 → 0.1.75.

## ✅ Fait (v0.1.74 — Conseils IA : analyse « forces & à travailler » en 1 clic)

Le Mode conseils IA ne demande plus de **cocher des métriques**. Un bouton **« Analyser avec l'IA »** (à côté du bloc
« Forces & à travailler » du Dashboard) envoie **tout le bilan** (métriques + catégories + percentiles, toujours anonyme)
et l'IA renvoie : une **synthèse**, les **forces** (avec le pourquoi), les points **à travailler** (avec une **piste**
concrète chacun) et des **avertissements** cliniques. Voir `docs/decisions/0018`.

- Collecte auto : `src/lib/ai-metrics.ts`. Nouveau schéma + prompt IPC (`electron/ipc/ai.ts`). Sortie `AIAdvice` réécrite.
- Retiré : toggle « Mode conseils IA », bandeau, FAB, sélection multi-métriques. Les pistes = activité physique (champ du
  kinésiologue) ; nutrition détaillée → référée à un(e) nutritionniste.
- Code désormais mort (`AIAdviceContext`, `MetricSelectable`) à nettoyer séparément.

Version : 0.1.73 → 0.1.74.

## ✅ Fait (v0.1.73 — Dashboard : parité avec le rapport)

Le Dashboard « Bilan complet » reçoit ce qu'on a construit pour le rapport :

- **Âge en forme** : carte « XX ans » (VO2max → âge physiologique via `fitness-age.ts`) avec l'écart à l'âge réel.
- **Carte Objectif** (si module nutrition activé) : livres à perdre (double unité), cible % de gras, poids visé, échéance,
  et les 4 repères de macros. Réutilise `nutrition.ts` + le rythme effectif déduit des calories manuelles.
- **Trajectoire projetée** : la courbe « % gras » de « Progression dans le temps » se prolonge en pointillé jusqu'à la
  cible, à l'échéance.
- **Poids en double unité** : lb + kg (helper `dualWeight`) dans la carte Objectif.

Helpers `dualWeight` / `estimatedGoalDate` extraits dans `src/lib/objectif-format.ts` (partagés rapport ↔ dashboard).
Version : 0.1.72 → 0.1.73.

## ✅ Fait (v0.1.72 — Mesures : avertissement « modifications non enregistrées »)

Complément à v0.1.71 : quand on **quitte** l'onglet Mesures (autre onglet, retour, autre client) avec une saisie non
enregistrée, un dialogue **« Modifications non enregistrées »** propose de rester ou de quitter sans enregistrer. Voir
`docs/decisions/0017`. A nécessité de migrer le routeur vers un **data router** (`createHashRouter` + `RouterProvider`)
pour activer `useBlocker` — migration contenue à `App.tsx`, tous les autres composants restent compatibles. Le « dirty »
= nouvelle saisie non enregistrée (pas en mode édition). Ne couvre pas la fermeture de l'app (choix assumé, Electron).
Version : 0.1.71 → 0.1.72.

## 🐛 Corrigé (v0.1.71 — Mesures : saisie perdue au changement de sous-onglet)

Basculer entre **Circonférences** et **Plis cutanés** sans enregistrer effaçait la saisie en cours : `MesuresTab` montait
un seul panneau à la fois, donc l'autre était démonté (état local du formulaire réinitialisé). Correctif : les **deux
panneaux restent montés**, l'inactif est simplement masqué (`hidden`) → React conserve l'état et la saisie survit au
changement d'onglet (dans les deux sens). Version : 0.1.70 → 0.1.71.

## ✅ Fait (v0.1.70 — « Nouveau client » : barre de boutons fixe)

Cohérence avec v0.1.69 : la vue « Nouveau client » (page pleine, déjà défilable via `<main overflow-auto>`) reçoit une
**barre de boutons collée en bas** (`sticky bottom-0`) — Enregistrer/Annuler restent visibles même sur petit écran.
Version : 0.1.69 → 0.1.70.

## 🐛 Corrigé (v0.1.69 — Modale « Modifier le client » : boutons inaccessibles)

Avec tous les champs nutrition ajoutés, la fenêtre « Modifier le client » dépassait la hauteur de l'écran et les boutons
« Annuler / Enregistrer » (tout en bas) devenaient **hors de vue** → impossible d'enregistrer. Correctif : la modale a
maintenant un **corps défilable** (`max-h-[92vh]`, `overflow-y-auto`) et une **barre de boutons fixe en bas** (toujours
visible). Version : 0.1.68 → 0.1.69.

## ✅ Fait (v0.1.68 — Échéance déduite des calories manuelles)

Quand les calories sont fixées manuellement, l'échéance estimée est désormais **déduite du déficit réel** (TDEE − calories
manuelles) au lieu de suivre le rythme choisi : `weeklyLossFromDeficit(dailyDeficit) = déficit × 7 ÷ 7700`. L'échéance,
le rythme affiché et la trajectoire deviennent cohérents avec les calories choisies. Si les calories ne créent aucun
déficit (≥ TDEE), aucune perte n'est projetée (note explicite, pas de trajectoire). En mode automatique, rien ne change.
Version : 0.1.67 → 0.1.68.

## ✅ Fait (v0.1.67 — Poids en double unité + calories manuelles)

Deux ajustements demandés par Marie :

- **Poids en double unité** : partout où un poids apparaît dans le rapport, on affiche l'unité préférée du client **et
  l'autre entre parenthèses** (helper `dualWeight`, ex. « 199 lb (90 kg) »). Couvre l'encadré objectif (perte, poids visé),
  « Poids optimal max », et le **graphique « Poids »** (converti + retitré « Poids (lb) » selon l'unité). `weightUnit`
  circule via `shared` jusqu'aux sections.
- **Calories manuelles ou automatiques** : dans la formule des macros, choix **Automatique** (calcul métabolisme − déficit,
  comme avant) ou **Manuel** (Marie fixe les kcal). Colonne `nutrition_target_kcal` (migration `0011`, `null` = auto).
  `estimateMacros` accepte `targetKcalOverride`.

Version : 0.1.66 → 0.1.67.

## ✅ Fait (v0.1.66 — Formule des macros visible et modifiable par client)

La formule des macros était figée dans le code. Marie peut désormais la **voir et la changer** (dossier client →
Modifier → section nutrition). Voir `docs/decisions/0015` (mise à jour). Nouvelle formule :

- **Protéines** = _n_ g par **livre de masse maigre** (défaut **1**) — au lieu de 2 g/kg de poids-cible.
- **Lipides** = plafond de _m_ g (défaut **60**) — au lieu de 25 % des calories.
- **Glucides** = le reste des calories cibles.

Les deux nombres (protéines/lb, plafond lipides) sont éditables et affichés en clair. Colonnes
`nutrition_protein_per_lb_lean` + `nutrition_fat_max_g` (migration `0010`, défauts si vides). `estimateMacros` prend la
masse maigre (`bodyFatGoal.leanKg`) + les 2 paramètres. Cas Nicholas : masse maigre 153 lb → 154 g prot, 60 g lip,
~289 g gluc. Version : 0.1.65 → 0.1.66.

## ✅ Fait (v0.1.65 — Graphique saut/puissance : double axe Y)

Le graphique « Saut vertical & puissance » superposait deux séries d'échelles incompatibles sur un seul axe Y : la
puissance (~5000 W) écrasait le saut (~48 cm) à plat sur le zéro — évolution du saut invisible. Correctif : option
`dualAxis` sur les graphiques doubles → **un axe Y par série** (saut à gauche en doré, puissance à droite en marine,
chacun avec sa propre échelle et sa couleur). Le graphique « Pompes & redressements » (mêmes unités) garde un axe unique.
Version : 0.1.64 → 0.1.65.

## ✅ Fait (v0.1.64 — Vue d'ensemble : fin de la page blanche)

La Vue d'ensemble (Section 1) laissait une grande zone blanche : titre + intro sur la page 1, puis tout le contenu
(objectif, trajectoire, scores…) poussé sur la page 2. Cause : le conteneur était un **flex column**, qui se fragmente
mal à l'impression (Chromium le pousse en entier sur la page suivante). Correctif : passage en **flux bloc** via la classe
`.report-stack` (`> * + * { margin-top: 9mm }` dans `print.css`) — le contenu se coupe naturellement entre les pages et
remplit la page 1 (titre + objectif + trajectoire ensemble). Aucun changement visuel autre que la pagination.
Version : 0.1.63 → 0.1.64.

## ✅ Fait (v0.1.63 — « Âge en forme » + trajectoire projetée)

Deux repères visuels ajoutés au rapport (voir `docs/decisions/0016-age-en-forme-et-trajectoire.md`).

- **Âge en forme** (`src/lib/fitness-age.ts`, 7 tests) : le VO2max traduit en âge physiologique via une courbe de
  référence VO2max→âge **dédiée, lissée, monotone** (PAS les tables de catégorisation, non monotones car recalibrées).
  Bannière en Vue d'ensemble avec l'écart à l'âge réel (« 28 ans de moins que votre âge réel »). Masqué si pas de VO2max.
- **Trajectoire projetée** (`WeightProjectionChart`) : dans l'encadré « Votre objectif », courbe de poids réelle (pleine)
  prolongée en pointillé jusqu'au poids-cible, à l'échéance estimée. Affiché seulement si le module objectif est actif et
  qu'il reste du poids à perdre. Poids dans l'unité du client.

Version : 0.1.62 → 0.1.63.

## ✅ Fait (v0.1.62 — Rythme de perte paramétrable + échéance estimée)

Le module nutrition (v0.1.61) gagne un **rythme de perte** choisi par client (Lent 0,25 · Modéré 0,5 · Soutenu 0,75 ·
Rapide 1,0 kg/sem), qui pilote **deux choses à la fois** :

- **L'échéance estimée** dans le rapport : « Au rythme de X/sem : environ N semaines (~M mois) · échéance estimée
  <mois année> » (date = bilan + N×7 jours, en composantes locales).
- **Le déficit calorique des macros** : 1 kg de gras ≈ 7700 kcal → déficit/jour = rythme × 1100, appliqué au TDEE
  (jamais sous le BMR). Les macros deviennent cohérentes avec le rythme choisi.

Colonne `nutrition_rate_kg_per_week` (migration `0009`), sélecteur dans le dossier client (défaut Modéré). Moteur :
`dailyDeficitForRate`, `weeksToGoal`, `estimateMacros({ dailyDeficitKcal })` (6 tests de plus). Version : 0.1.61 → 0.1.62.

## ✅ Fait (v0.1.61 — Objectif chiffré & module nutrition, opt-in par client)

Extension de l'objectif texte (v0.1.60) vers un **objectif chiffré** activable par client. Voir
`docs/decisions/0015-objectif-chiffre-nutrition.md`.

- **Config par client** (dossier → Modifier) : case « Objectif chiffré & nutrition » + % de gras visé + niveau d'activité.
  3 nouvelles colonnes `clients` (`nutrition_enabled`, `nutrition_target_body_fat`, `nutrition_activity_level`),
  migration Drizzle `0008`. Désactivé par défaut.
- **Moteur pur** `src/lib/nutrition.ts` (12 tests) : `bodyFatGoal` (livres à perdre, masse maigre préservée),
  `mifflinBmr`, `estimateMacros` (TDEE − 20 %, protéines 2 g/kg cible, lipides 25 %, glucides = reste).
- **Rapport** : l'encadré « Votre objectif » affiche, si activé, « % actuel → cible », les livres à perdre + poids visé
  (unité du client), et 4 repères nutritionnels (calories/protéines/glucides/lipides).
- **Champ de pratique** : macros affichées **avec avertissement** (« estimation générale — consultez un(e)
  nutritionniste »), car la planification alimentaire relève de l'OPDQ, pas du kinésiologue.

Version : 0.1.60 → 0.1.61.

## ✅ Fait (v0.1.60 — Section « Objectif du client »)

Nouveau champ `objectif` (texte libre, dans les mots du client) saisi au bilan, à côté des observations. Il apparaît en
**encadré « Votre objectif »** en tête de la Section 1 (Vue d'ensemble) du rapport — bandeau doré, citation en italique —
juste avant les scores, pour leur donner du sens (un score se lit différemment selon ce que le client visait).

- **Portée : par bilan** (comme `notes`) → l'objectif peut évoluer d'un bilan à l'autre ; le rapport lit celui du bilan
  le plus récent. **Aucune migration** (stocké dans le JSON `data`).
- Saisie : groupe « Objectif, notes et observations » du formulaire (textarea + hint d'exemple). Rendu conditionnel dans
  le rapport (masqué si vide). Validation IPC `z.string().max(2000).optional()`.

Fichiers : `src/env.d.ts` (type), `electron/ipc/bilans.ts` (schéma), `src/pages/client/bilanFields.ts` +
`BilanForm.tsx` (saisie + hint textarea), `src/pages/ReportPage.tsx` (encadré). Version : 0.1.59 → 0.1.60.

## ✅ Fait (v0.1.59 — Espace constant avant « Ce que ça veut dire »)

Le bloc d'interprétation « Ce que ça veut dire pour vous » n'avait **aucune marge haute propre** : il dépendait uniquement
du `marginBottom` de la dernière carte-graphique au-dessus. Quand il suivait directement le tableau/`bottomExtra` (section
sans graphique) ou après une coupure de page (où la marge basse est absorbée par la pagination), l'espace tombait à ~0 →
le bloc paraissait **collé** au graphique. Correctif : `marginTop: 12mm` explicite sur le bloc d'interprétation. Les marges
verticales fusionnant (max, pas somme), l'espace reste ~12 mm après un graphique et est **garanti** même sans graphique.
Version : 0.1.58 → 0.1.59.

## ✅ Fait (v0.1.58 — Avant / après : toutes les métriques)

Le tableau « Avant / après » (vue d'ensemble) était limité aux **6 premières** métriques (`.slice(0, 6)`) ET n'affichait
que celles présentes dans les **deux** bilans — d'où l'absence des pompes (8ᵉ dans l'ordre) et d'autres. Désormais il
liste **toutes** les métriques renseignées dans le bilan **actuel** ; si la valeur de départ manque (bilan initial
partiel), la colonne « avant » et l'évolution affichent « — ». Version : 0.1.57 → 0.1.58.

## ✅ Fait (v0.1.57 — Bug barre de couleur : marqueur dans le bon segment)

Marie-Eve : « des fois la barre ne fonctionne pas » — la pastille dit « Bien » mais le marqueur ▲ est dans
« Acceptable ». **Vrai bug** dans `calculatePosition` : le marqueur était placé sur une échelle de **percentiles**
(P10→10 %, P25→25 %, P50→50 %, P75→75 %) alors que les **segments** de la barre sont à intervalles égaux
(20/40/60/80 %). Les deux échelles ne coïncidaient pas → marqueur dans le mauvais segment (écart max sur les
métriques `lowerIsBetter` : tour de taille, IMC, % gras).

Correctif : ancres du marqueur réalignées sur les segments (**P10/P25/P50/P75 → 20/40/60/80 %**, P90 → 100 %). Le
marqueur tombe désormais toujours dans le même segment que la catégorie affichée. Ex. tour de taille 93 (Bien) → ~43 %
(segment Bien), au lieu de ~29 % (Acceptable). S'applique au rapport ET au dashboard (composant partagé).

Tests `CategoryRangeBar.test.ts` recalculés (10/10). Suite **138/138** ; `tsc` web + node ; build. Version : 0.1.56 → 0.1.57.

## ✅ Fait (v0.1.56 — Scores composites : échelle 1-5, « Force » réalignée, détail des sous-scores)

Marie-Eve trouvait « Force musculaire 3,8/5 » surprenant (pompes/redressements Excellents). Deux causes corrigées :

### Échelle 1-5 (Excellent = 5)
`calc.ts` : `CATEGORY_TO_SCORE` passe de 0,5-4,5 (CSEP) à **1-5** (À améliorer = 1 … Excellent = 5). Un client
« tout Excellent » obtient donc **5/5** (au lieu de 4,5). `scoreToCategory` re-borné à 1,5 / 2,5 / 3,5 / 4,5. Affecte
les deux systèmes de score (`scoring.ts` → rapport, `bilan-computed.ts` → dashboard) — un seul barème partagé.

### « Force musculaire » réalignée
Le composite `musculoGlobal` incluait 6 tests (dont **flexion du tronc** = souplesse et **endurance du dos**), qui
sont aussi dans « Dos et souplesse » → chevauchement + label trompeur. Réduit aux **4 vrais tests de force**
(pompes, redressements, saut, puissance), dans `scoring.ts` ET `bilan-computed.ts`. Pour Nicholas : Force passe de
**3,8 (Très bien) → 4,5 (Excellent)**.

### Détail des sous-scores (« pourquoi »)
Sous chaque carte de la vue d'ensemble, `CompositeBreakdown` liste les sous-tests avec leur cote colorée (ex. sous
« Force musculaire » : Pompes Excellent · Redressements Excellent · Saut Très bien · Puissance Très bien) — on voit
d'où vient le chiffre.

### Nouveaux scores Nicholas
Composition 2,0 Acceptable · Cœur 5,0 Excellent · Force 4,5 Excellent · Dos 4,3 Très bien · **Global 4,0 Très bien**.

### Vérifs
- Tests scoring/bilan-computed mis à jour (échelle 1-5, plages recalculées). Suite **138/138 pass** ; `tsc` web + node ;
  build ; lint baseline. Version : 0.1.55 → 0.1.56.

## ✅ Fait (v0.1.55 — Rapport : espace sous les graphiques)

Les graphiques et l'encart « Ce que ça veut dire » (deux cartes crème) se touchaient presque. `BigChartCard`
marginBottom 7 → 10 mm — plus d'air entre le dernier graphique et l'interprétation (et entre graphiques). Via la marge
**basse** (pas de fuite au saut de page). Version : 0.1.54 → 0.1.55.

## ✅ Fait (v0.1.54 — Rapport : marge du haut augmentée à 20 mm)

La marge de 12 mm (v0.1.53) était trop petite (contenu trop haut). Cause probable additionnelle : `@page { margin: 0 }`
pouvait écraser la marge printToPDF. Réglée **des deux côtés** à **20 mm** (`@page { margin: 20mm 0 }` ET
`printToPDF margins top/bottom 0.79″`) → identique sur chaque page, quelle que soit la règle qui prime. `minHeight`
des sections 265 → 250 mm (aire imprimable = 297 − 40 = 257 mm). Version : 0.1.53 → 0.1.54.

## ✅ Fait (v0.1.53 — Rapport : marge constante sur toutes les pages + graphiques réduits)

### Marge constante (haut/bas) sur toutes les pages
Problème : le padding vertical d'une section ne s'applique qu'à sa **1re page** (Chromium), donc les pages de
**continuation** n'avaient plus de marge haut/bas (texte collé au bord) — incohérent avec les débuts de section.
Solution : déplacer la marge **haut/bas au niveau de la page PDF** via `printToPDF({ margins: { top: 0.47, bottom:
0.47, left: 0, right: 0 } })` (pouces ≈ 12 mm) — appliquée **identiquement à chaque page physique**. Les sections
n'ont plus que du padding **horizontal** (`0 16mm`, qui lui s'applique déjà à toutes les pages). `minHeight` des
sections 293 → 265 mm (aire imprimable = 297 − 24 = 273 mm). Couverture : padding interne réduit en conséquence.

### Graphiques réduits (moins de vides)
`BigChartCard` 88 → 72 mm : toujours pleine largeur (plus grand que les anciens en 2 colonnes) mais rentre plus souvent
dans l'espace restant → moins de vides en bas de page avant « Évolution ».

`tsc` web + node ; build OK. Version : 0.1.52 → 0.1.53. ⚠️ Marges PDF non simulables hors Electron — à confirmer par régénération.

## ✅ Fait (v0.1.52 — Rapport : marge du haut (fix définitif) + barèmes ACSM)

### Marge du haut — fix définitif (flex gap)
La réduction du padding (v0.1.51) ne suffisait pas : des blocs avec `marginTop` (Avant/après, légende,
interprétation) « fuyaient » en haut des pages de continuation, s'ajoutant au padding. Passage de la vue d'ensemble
et des sections domaine à une disposition **`flex` column + `gap`** : `gap` ne se rend pas aux sauts de page, donc
plus d'espace parasite en haut. Les `marginTop` fautifs sont retirés.

### Barèmes de référence ACSM (demande Marie-Eve)
Nouveau composant `NormReferenceTable` dans chaque section domaine, après « Vos résultats » : un tableau montrant, pour
chaque test, la **plage numérique de chaque catégorie** (À améliorer → Excellent) pour l'âge et le sexe du client —
comme le tableau musculo du logiciel Physitest. La **cellule de la catégorie actuelle** du client est surlignée dans
sa couleur. Dérivé des percentiles ACSM (`categoryRange` : gère `lowerIsBetter`). Ex. Nicholas VO2max 57,6 → cellule
« Excellent (≥ 43) » ; % gras 23,1 → « Très bien (20–25) ».

Suite 138/138 ; `tsc` web + node ; build OK ; lint baseline (18). Version : 0.1.51 → 0.1.52.

## ✅ Fait (v0.1.51 — Rapport : marge du haut réduite)

Marie-Eve : marge du haut trop grande sur toutes les pages. Cause : `@page` margin à 0 (printToPDF `marginType:none`),
donc l'espace en haut vient du **padding de section** (16 mm), que Chromium applique en haut de **chaque page fragment**
(confirmé : un `BigChartCard` sans marge propre a quand même de l'espace au-dessus sur une page de continuation). Padding
des sections (`ReportSection` + `ReportFlowSection`) réduit de `16mm 17mm` à `10mm 16mm` → marge du haut plus fine sur
toutes les pages. `tsc` web + node ; build OK. Version : 0.1.50 → 0.1.51.

## ✅ Fait (v0.1.50 — Rapport : correctifs de pagination de la refonte)

La refonte v0.1.49 avait des défauts de sauts de page (vus sur le PDF réel) :
- **Titres orphelins** : « Avant / après », « Évolution dans le temps » restaient seuls en bas de page. Corrigé :
  `BlockTitle` porte `break-after: avoid` + `break-inside: avoid` → le titre migre avec son contenu.
- **Groupes sautant en bloc** : le wrapper « Vos résultats » (4 cartes) et `CompositionExtras` étaient marqués
  `break-inside-avoid`, donc sautaient entièrement s'ils ne rentraient pas → grand vide (intro seule sur une page).
  Corrigé : `break-inside-avoid` retiré des **groupes**, conservé uniquement sur les **éléments atomiques**
  (chaque `MetricBlock`, `BigChartCard`, grille de mesures, table BP/FC/récup, encart interprétation).
- **Vue d'ensemble** : passait mal en 2 pages (forcée en 1 page via `report-page`). Convertie en section **flow**
  avec chaque bloc (score+composites, héros, frise, avant/après, légende) protégé individuellement.

Suite 138/138 ; `tsc` web + node ; build OK. Version : 0.1.49 → 0.1.50. Rendu à reconfirmer par régénération.

## ✅ Fait (v0.1.49 — Rapport : refonte thématique par domaine)

### Objectif : un rapport organisé par thème, avec de grands graphiques et des explications
Retour de Marie-Eve : le rapport éparpillait chaque domaine entre les sections « Progression » et « En détail ».
Réécriture complète de `ReportPage.tsx` en **6 sections thématiques** (noms « chaleureux »), validée via une maquette
avant codage.

### Nouvelle structure
1. **Couverture** — inchangée.
2. **Votre bilan en un coup d'œil** (Section 1) — score global + 4 composites + parcours (héros, frise, avant/après)
   + légende des couleurs. Fusion des anciennes sections Parcours + Synthèse.
3. **Votre composition corporelle** (Section 2) — mesures (IMC, tour de taille, ratio, poids optimal, % gras, plis) +
   résultats catégorisés + **grands graphiques** (% gras, poids, IMC, tour de taille) + interprétation.
4. **Votre cœur et votre endurance** (Section 3) — VO2max/FC/tension catégorisés + tension nommée + zones cardiaques
   (grille 2 colonnes) + récupération + grands graphiques (VO2max, FC repos) + interprétation.
5. **Votre force musculaire** (Section 4) — pompes/redressements/saut/puissance + graphiques + interprétation.
6. **Votre dos et votre souplesse** (Section 5) — flexion + endurance dos + graphiques + interprétation.
7. **Vos forces et votre plan d'action** (Section 6) — inchangée (+ mot du kinésiologue).

### Changements techniques
- **Modèle de pages** (`print.css`) : passage de `break-after` + `break-inside:avoid` (1 page/section) à
  `break-before:page` + sections **« flow »** (`ReportFlowSection`) qui peuvent s'étaler sur **plusieurs pages A4** ;
  les blocs internes portent `break-inside-avoid`. Permet les grands graphiques (2-3 pages/section au besoin).
- **Grands graphiques** : `BigChartCard` pleine largeur, 88 mm de haut (vs 80 mm en 2 colonnes avant). Un graphique
  n'apparaît que si ≥ 2 bilans renseignent la donnée.
- **Textes d'interprétation** : `domainInterpretation` génère un « Ce que ça veut dire pour vous » par domaine (catégorie
  composite + point fort / à travailler + tendance de la métrique phare).
- Blocs réutilisés/extraits : `CompositionExtras`, `CardioExtras`, `RecoveryTable`, `MetricBlock`, `JourneyTimeline`,
  charts. Anciennes sections page-uniques (`ParcoursPage`, `SynthesePage`, `CompositionPage`, `ProgressionChartsPage`,
  `MetricDetailsPages`, `RecuperationEtNotesPage`) supprimées.

### Vérifs
- Suite **138/138 pass** ; `tsc` web + node clean ; `npm run build` OK ; `npm run lint` baseline inchangée (18).
- ⚠️ Rendu PDF multi-pages non vérifiable hors Electron — à confirmer par régénération. Version : 0.1.48 → 0.1.49.

## ✅ Fait (v0.1.48 — Rapport : section Composition sur une seule page)

Correctif de mise en page : l'ajout du bloc « Tension artérielle » (v0.1.47) avait poussé la table des zones
cardiaques (avec `break-inside-avoid`) juste au-delà de la page 4 → elle débordait seule sur une page presque vide.
Marges internes de la section resserrées (blocs 10 → 6 mm, lignes de la table cardiaque 2,6 → 2,1 mm) : tout le
contenu de la section Composition (mensurations, plis, tension, zones cardiaques) revient sur **une seule page A4**.
Suite 138/138 ; `tsc` web + node ; build OK. Version : 0.1.47 → 0.1.48.

## ✅ Fait (v0.1.47 — Rapport : légende des couleurs + zones de tension nommées)

Derniers items de contenu du rapport.

### Légende du code couleur
Composant `ColorLegend` en bas de la Synthèse (Section 3) : les 5 zones (À améliorer → Excellent) avec leur pastille
de couleur + une phrase expliquant que chaque barre situe le résultat sur cette échelle (normes ACSM par âge/sexe).
Explique une fois pour tout le rapport le sens des couleurs des `CategoryRangeBar`.

### Zones de tension artérielle nommées
- `src/lib/norms/clinical.ts` : `classifyBloodPressure(value, 'systolic' | 'diastolic')` → `{ zone, category }` avec
  les zones cliniques nommées (Optimale · Normale · Pré-hypertension · Hypertension 1 · Hypertension 2, seuils OMS/JNC,
  alignés sur les percentiles cliniques existants). Testé (`norms.test.ts`).
- Bloc « Tension artérielle au repos » dans la section Composition (Section 4) : systolique + diastolique avec la
  **pastille de zone nommée** (couleur = catégorie). `CategoryPill` accepte désormais un `label` optionnel.

### Vérifs
- Suite **138/138 pass** ; `tsc` web + node clean ; build OK. Version : 0.1.46 → 0.1.47.

## ✅ Fait (v0.1.46 — Rapport : 2 micro-correctifs)

Repérés sur le rapport régénéré de Nicholas :
- **Marge droite des graphiques** portée à 34 (était 20) — la dernière date de l'axe X (« juin 2026 ») n'est plus
  coupée au bord.
- **« (+0 unité) » supprimé quand l'écart est nul** — sur les pages « En détail » et le plan d'action, la parenthèse
  d'écart ne s'affiche plus si `delta === 0` (cas d'une valeur pile au seuil, ex. IMC 30 → « ≤ 30 kg/m² » sans « (+0) »).

Suite 137/137 ; `tsc` web + node clean ; build OK. Version : 0.1.45 → 0.1.46.

## ✅ Fait (v0.1.45 — Rapport : mot du kinésiologue personnalisé + plan d'action)

### Mot du kinésiologue (personnalisé)
Le bloc de clôture affichait seulement la signature générique. Il utilise désormais les **notes du bilan**
(`latest.data.notes`) comme message personnalisé au client, suivi de la signature en guise de signature manuscrite
(en italique). Sans notes → signature seule (comme avant).
- Le doublon « Observations » est retiré de la section Récupération (Section 7 = récupération post-effort seule,
  rendue uniquement si des données de récupération existent). Les notes n'apparaissent donc plus qu'une fois, à
  l'endroit le plus valorisant (la clôture).

### Plan d'action (priorités numérotées + objectifs chiffrés)
La colonne « À travailler » devient **« Votre plan d'action »** : les axes faibles (ACCEPTABLE / À améliorer) sont
présentés en **priorités numérotées** (badge 1, 2, 3), chacune avec sa recommandation concrète (`RECO`) et un
**objectif chiffré** dérivé de `getNextCategoryTarget` (« Objectif : ≥ X unité pour atteindre « Bien » (+Δ) »).
Les forces passent en 3 cartes compactes au-dessus. Titre de section : « Vos forces et votre plan d'action ».

### Vérifs
- Suite **137/137 pass** ; `tsc` web + node clean ; build OK. Version : 0.1.44 → 0.1.45.

## ✅ Fait (v0.1.44 — Rapport : section Composition corporelle + retrait CPAFLA de l'UI)

### Retrait de CPAFLA de l'interface (retour 100 % ACSM)
Décision (Marie-Eve) : les tables CPAFLA ne sont pas accessibles gratuitement (manuel CSEP-PATH payant) et le
logiciel actuel n'est pas sous la main pour en extraire les seuils. On retire donc l'option CPAFLA de l'UI et on reste
sur **ACSM** (déjà encodé, gratuit, largement reconnu).
- `SettingsPage` : la carte « Normes de catégorisation » n'affiche plus qu'ACSM (bloc informatif, plus de choix). Toute
  valeur `categorization_norms` stockée est normalisée vers `'acsm'` au chargement (défensif).
- Le plumbing interne reste (`cpafla.ts` scaffold, `NormsType`, routage) pour un retour facile si la source arrive un
  jour — invisible pour l'utilisatrice. Le rapport PDF lit toujours la norme active (donc ACSM).

### Nouvelle section « Composition corporelle » (Section 4 du rapport)
Inspirée du rapport du logiciel actuel (Physitest Canadien), en réutilisant les valeurs déjà calculées par
`computeBilan` :
- **Chiffres clés** : IMC, tour de taille, ratio taille/hanche, poids optimal max (IMC 25), % de gras
  (Durnin-Womersley), somme des 4 plis.
- **Détail des plis cutanés** (mm) présents.
- **Zones d'entraînement cardiaque** : table 60-90 % de la FC max prédite (Tanaka), avec libellés (Échauffement →
  VO2max) — rendue seulement si l'âge permet le calcul.
- Sections suivantes renumérotées (Progression 5, En détail 6, Récupération 7, Forces 8).

### Vérifs
- `computeBilan` (Nicholas) alimente bien la section (IMC 29,6 · poids opt. 77,4 · % gras 23,1 · zones FC 104-157).
- Suite **137/137 pass** ; `tsc` web + node clean ; build OK. Version : 0.1.43 → 0.1.44.

## ✅ Fait (v0.1.43 — Rapport PDF : correctifs visuels)

### Objectif : corriger les défauts d'affichage repérés sur un rapport réel (11 pages)
Revue visuelle du PDF de Nicholas → 4 correctifs dans `ReportPage.tsx` (voir ADR 0011, mise à jour) :

- **Frise des bilans** : espacement régulier par index (au lieu de la date réelle qui écrasait les points récents) +
  une étiquette sur deux au-delà de 8 bilans. Fini le chevauchement des dates.
- **Graphiques** : `minTickGap` sur l'axe X + étiquette de valeur uniquement sur le dernier point
  (`EndpointValueLabel`) — plus de labels qui se superposent à l'axe et entre eux.
- **Pages « En détail »** : pagination équilibrée (max 3 cartes/page, réparties uniformément) — fini la carte
  orpheline sur une page quasi vide.
- **Couverture** : légende « Condition physique globale » + pastille de catégorie sous l'anneau de score (équilibre le
  grand vide du bas).

### Vérifs
- Frise rendue en isolation (SVG→PNG, 11 dates réelles) pour confirmer l'absence de chevauchement. `tsc` web + node
  clean ; build OK ; suite **137/137 pass**. Version : 0.1.42 → 0.1.43.

## ✅ Fait (v0.1.42 — Formulaire de saisie : mode guidé (stepper) + garde-fou champs manquants)

### Objectif : une saisie moins intimidante sans dégrader le mode rapide
Le formulaire (~40 champs, 6 sections) gagne un mode « Guidé » optionnel (une section à la fois) et un rappel doux
des mesures importantes manquantes avant la sauvegarde. Le mode « Tout afficher » reste le défaut et strictement
inchangé. Voir ADR 0014.

### `BilanForm`
- Nouvelle prop `visibleSectionIds?: string[]` : rend uniquement ces sections (absente = toutes, comportement
  d'origine). Le mode guidé passe une seule section + `collapsible={false}` (section dépliée).

### `CreateBilanModal`
- Bascule « Tout afficher » / « Guidé » dans l'en-tête. Mode guidé : `StepperHeader` (barre de progression
  « Étape N / M — Titre » + %), Précédent / Section suivante, dernière étape → « Vérifier & enregistrer ».
  Synthèse sticky visible dans les deux modes.
- **Garde-fou (les deux modes)** : `missingImportantFields(data)` → `MissingFieldsDialog` non bloquant
  (« Compléter » / « Enregistrer quand même ») si taille, poids, tour de taille, VO2max, PA ou push-ups/situps
  manquent. `0` = renseigné ; `NaN`/`''` = manquant.

### Module — `src/pages/client/bilan-required-fields.ts`
`IMPORTANT_BILAN_FIELDS` + `missingImportantFields` (pur). Test : `bilan-required-fields.test.ts` (5 tests).

### Vérifs
- Suite complète **137/137 pass** ; `tsc` web + node clean ; build OK ; lint baseline inchangée.
  Version : 0.1.41 → 0.1.42.

## ✅ Fait (v0.1.41 — CPAFLA : ossature + rapport PDF débranché d'ACSM figé)

### Objectif : préparer l'intégration CPAFLA sans inventer de valeurs cliniques
Les seuils exacts CPAFLA vivent dans le CSEP-PATH Toolkit (sous droits d'auteur) — non reproductibles depuis les
sources publiques. Plutôt que fabriquer des barèmes (risque clinique), on livre **toute l'ossature** ; les valeurs
seront encodées quand Marie-Eve fournira la source. Voir ADR 0013.

### `src/lib/norms/cpafla.ts` — scaffold complet
- Structure identique à `acsm.ts` : `pct()` exporté, `TABLES: Record<TestKey, Ranges | null>` (tout `null`),
  `getCpaflaRange` opérationnel dès remplissage. Convention de conversion catégories CPAFLA → percentiles documentée
  (ADR 0006 : Acceptable→p10, Bien→p25, Très bien→p50, Excellent→p75, p90=2·p75−p50 ; lowerIsBetter décroissant).
- Helper `cpaflaHasTables()` : pilote le messaging Paramètres (pas de statut codé en dur).
- `bodyFat` (CPAFLA cote la somme des plis, pas le %) et `vo2max` (mCAFT) laissés `null` et documentés.

### Correction — rapport PDF figé sur ACSM
`ReportPage.tsx` forçait `norms: 'acsm'` : activer CPAFLA ne changeait pas le rapport. Il lit désormais
`settingsService.getCategorizationNorms()` (repli `'acsm'`). `deriveBilanFields` reste sur ACSM (stabilité des
scores **stockés**) ; seul l'affichage suit la norme active.

### Paramètres
Radio CPAFLA sélectionnable, libellé « CPAFLA (tables en attente) », message honnête tant que `cpaflaHasTables()`
est faux (tests non couverts → « — », rester sur ACSM pour une catégorisation complète).

### Vérifs
- `norms.test.ts` : CPAFLA → `null` partout + `cpaflaHasTables() === false`. Suite complète **122/122 pass**.
  `tsc` web + node clean ; build OK. Version : 0.1.40 → 0.1.41.

## ✅ Fait (v0.1.40 — Tooltips d'origine des valeurs en mode Synthèse)

### Objectif : lever l'opacité de la synthèse (« d'où vient cette valeur ? »)
En mode Synthèse, chaque hero stat peut venir d'un bilan différent. `fieldOriginDates` (calculé depuis v0.1.32 par
`buildSynthesisBilan` mais jamais affiché — dette ADR 0009) est maintenant exposé.

### UI — `StatCardXL`
- Nouvelle prop optionnelle `originDate?: string` → rappel discret « du 12 sept 2025 » sous la valeur + `title=` natif
  explicatif. `DashboardTab` ne la passe **que si `isSynthesisMode`**, pour les 4 cards (VO2max, IMC, % gras, tour de
  taille) depuis `synthesisResult.fieldOriginDates`.
- `CompositeMiniCard` volontairement exclu (agrège des dates hétérogènes → une date unique serait trompeuse).

### Vérifs
- Test ajouté à `src/lib/synthesisBilan.test.ts` (chaque champ pointe le bon bilan quand les dates diffèrent) → 8/8.
  Suite complète **122/122 pass**. `tsc` web + node clean ; build OK. Version : 0.1.39 → 0.1.40.

## ✅ Fait (v0.1.39 — Rapport PDF enrichi : récupération, notes, protocole)

### Objectif : intégrer au rapport les sections saisies mais jamais rendues
Le rapport PDF (refonte v0.1.36) ignorait la récupération post-effort, les notes de la kinésiologue et le protocole
aérobie utilisé. Ces trois éléments sont désormais affichés dans `ReportPage.tsx`.

### Helpers purs — `src/lib/report-helpers.ts`
- `hasRecoveryData(data)` : vrai si au moins un champ `recup_*` est un nombre fini.
- `aerobicProtocolLabel(data, formatMmSs)` : « Tapis roulant de Bruce — 13:30 » / « Test de Cooper (12 min) — 2400 m »
  / « Test de Léger (navette 20 m) — palier 8 », repli sur `test_aerobie` (imports .docx) puis `null`.
- Testés : `src/lib/report-helpers.test.ts` (5 tests).

### `ReportPage.tsx`
- **Ligne protocole** sous le VO2max des pages détaillées (« Estimé via … »).
- **Section 6 « Récupération & observations »** : tableau 1/3/5 min × (FC / PA sys / PA dia), rendu seulement si
  données présentes ; bloc **Observations** (`data.notes`, `pre-line`) rendu seulement si non vide. Ni l'un ni l'autre
  → page non générée. Blocs `break-inside-avoid`.
- **Forces & axes** renumérotée Section 7.
- `report-generator.ts` inchangé (DOM capté tel quel par `printToPDF`, timing `__REPORT_READY__` intact).

### Note — Bruce-FRIEND abandonné
Le chantier « équation Bruce-FRIEND » (matcher le VO2max ≈49 du logiciel actuel) a été **abandonné** après recherche :
aucune équation Bruce-FRIEND temporelle publiée n'existe (le registre FRIEND ne publie qu'une équation démographique
de référence, indépendante de la durée du test). Sans données de calibration du logiciel de Marie-Eve, on conserve
Foster/Pollock. Voir daily-note 2026-07-04.

### Vérifs
- `node --test src/lib/report-helpers.test.ts` → 5/5 ; suite complète **121/121 pass**.
- `tsc` web + node clean ; `npm run build` OK. Version `package.json` : 0.1.38 → 0.1.39.

## ✅ Fait (v0.1.38 — Validation de plausibilité à la saisie)

### Objectif : signaler les valeurs douteuses sans jamais bloquer Marie-Eve
Le formulaire de bilan acceptait n'importe quel nombre (VO2max négatif, taille de 300 cm). Chaque champ numérique
a désormais des bornes **souples** (avertissement amber « Valeur inhabituelle — vérifiez (habituellement X à Y) »)
et des bornes **dures** (bordure rouge « Valeur impossible » + rejet zod à l'IPC). La saisie n'est jamais bloquée
côté formulaire — seul le physiquement impossible est refusé à la sauvegarde.

### Module — `src/lib/bilan-bounds.ts`
- `BILAN_FIELD_BOUNDS` : bornes par champ (`hardMin`/`hardMax`/`softMin`/`softMax`). Bornes dures volontairement
  généreuses — ne doivent jamais rejeter une donnée réelle (imports .docx historiques inclus).
- `validateBilanField(key, value)` → `{ level: 'ok' | 'warn' | 'error', message? }`. Champ absent de la table →
  jamais borné (ex. `puissance_jambes_watts`, qui dépasse 6000 W chez certains clients).
- `flexion_tronc_cm` (sit-and-reach) : le négatif est légitime → bornes −15…60 (soft) / −30…80 (dur).
- Module sans dépendance au type ambiant `BilanData` → partagé avec le main process (ajouté à `tsconfig.node.json`,
  même pattern que `body-fat-calculator.ts`).

### UI
- `BilanForm.renderField` (champs numériques génériques) : bordure `!border-amber-400` / `!border-red-500` + message
  sous le champ selon le niveau. Jamais de blocage du `onChange`.
- `AerobicSection` : mêmes indicateurs sur FC repos, PA systolique/diastolique, distance Cooper, palier Léger
  (inputs rendus hors du `renderField` générique).

### IPC — `electron/ipc/bilans.ts`
- Helper `bounded(key)` : construit `z.number().finite().min(hardMin).max(hardMax).optional()` depuis
  `BILAN_FIELD_BOUNDS`. Remplace `numberOrUndef` sur tous les champs du `BilanDataSchema` (un champ sans borne
  reste simplement `finite`). S'applique à `bilans:create`, `bilans:update` et `bilans:import`.

### Vérifs
- `node --test src/lib/bilan-bounds.test.ts` → 7/7 pass, dont le cas Nicholas Jean complet (aucune valeur réelle
  rejetée ni signalée). Suite complète : **116/116 pass**.
- `tsc` web + node clean ; `npm run build` OK ; `npm run lint` baseline préexistante inchangée.
- Version `package.json` : 0.1.37 → 0.1.38.

## ✅ Fait (v0.1.37 — Corrections du rapport PDF)

5 correctifs sur le rapport PDF (v0.1.36) : couverture avec avatar carré (visage) au lieu du plein corps ; `break-inside: avoid` sur chaque bloc métrique (plus de blocs coupés entre pages) ; barèmes cliniques PA systolique/diastolique + FC repos ajoutés (`src/lib/norms/clinical.ts`, branchés via `getRange`) → PA et FC affichent leur `CategoryRangeBar` ; phrases explicatives par catégorie (lookup `EXPLANATION_BY_CATEGORY`) ; axes de graphes recalibrés (`interval="preserveStartEnd"`, ticks de score forcés à 0-5).

## ✅ Fait (v0.1.36 — Refonte rapport PDF : format éditorial avec progression visuelle)

### Objectif : valoriser la progression du client, pas dumper des tableaux
Le rapport PDF (`reports.generatePdf` → route `/report/:id` → `printToPDF`) était hérité de l'ancien logiciel : tableaux denses, peu parlants pour le client. Réécriture intégrale de `ReportPage.tsx` en document éditorial de 6 sections (1 page A4 chacune) : couverture, Votre parcours, Synthèse, Progression (graphes), En détail (par métrique), Forces & axes.

### Polices bundlées
Fraunces + Inter téléchargées en `.woff2` local (`src/assets/fonts/`), déclarées dans le nouveau `src/print.css` — le PDF reste fiable même sans connexion. `printToPDF` passe en A4.

### Réutilisation
Scores composites via `computeSynthesis`, catégorisation via `getCategorization`/`getNormPercentiles`/`getNextCategoryTarget`, composant `CategoryRangeBar` réutilisé. Recommandations génériques codées en dur (pas d'IA — PDF déterministe). Voir ADR 0011.

## ✅ Fait (v0.1.35 — Sous-onglet Mesures : sélecteur date + mode Synthèse (parité Bilan))

### Objectif : aligner le sous-onglet Mesures sur le sous-onglet Bilan
Le sous-onglet Mesures du dashboard avait son sélecteur de session en bas de page, sans mode synthèse et avec un état local non bookmarkable. Il adopte désormais le pattern du sous-onglet Bilan : sélecteur de pills en haut, premier pill « Synthèse » actif par défaut, état dans l'URL (`?mesure=synthesis|<date-ISO>`).

### Helper — `src/lib/synthesisMesures.ts`
`buildSynthesisCirc` / `buildPreviousSynthesisCirc` (agrégation latest non-null des circonférences champ par champ), `findLatestPlis` / `findPreviousPlis` (les plis ne sont pas agrégés champ par champ), `findCircAtOrBefore` / `findPlisAtOrBefore` (snapshot temporel strict), `buildUnifiedDates` (union des dates circ + plis). Couvert par `synthesisMesures.test.ts` (8 tests).

### Composant — `MesureSelectorPills`
Modelé sur `BilanSelectorPills` : pill spécial « Synthèse » + une pill par date, avec des points indicateurs (circonférences / plis cutanés) montrant les datasets pris ce jour-là.

### Refactor — `MesuresOverview`
Memo unique `activeView` (synthèse virtuelle ou snapshot temporel strict d'une date) en remplacement de `activeIdx`/`activeCirc`/`latestPlis`/`previousPlis`. Badge de header en mode synthèse, ou affichage des 2 dates en mode date quand circ et plis diffèrent. Section « Historique des prises » en bas supprimée (redondante). Voir ADR 0010.

## ✅ Fait (v0.1.34 — Dummy Jean : avatar auto à la création)

### Objectif : attacher la photo de profil de Dummy Jean dès le seed
Le bouton de seed (Réglages) crée le client de démo « Dummy Jean ». Il pousse désormais automatiquement son avatar via `clientsService.setAvatar`, à partir de 2 assets bundlés (`src/assets/dummy-jean.png` plein corps + `dummy-jean-square.png` carré). Le helper `assetToBase64` convertit les assets Vite en base64 (chunks de 0x8000). L'échec du chargement est loggué silencieusement sans faire échouer le reste du seed.

## ✅ Fait (v0.1.33 — Objectif « niveau suivant » sur les hero stats)

### Objectif : remplacer les sparklines (redondantes avec le ProgressionChart) par un indicateur d'objectif chiffré
Les 4 `StatCardXL` du dashboard (VO2max, IMC, % gras, tour de taille) affichaient une sparkline des 8 derniers bilans. Marie-Eve a remonté que personne ne la regardait, alors qu'un objectif chiffré (« +1.5 ml/kg/min pour atteindre Excellent ») répondait directement à la question que le client pose. La sparkline disparaît, l'objectif s'affiche à sa place — avec un trophée quand la catégorie maximale est atteinte.

### Module — `src/lib/norms/index.ts`
Nouvelle fonction `getNextCategoryTarget(test, value, age, sex, norms)` :
- `null` si valeur/profil invalide ou test hors barème.
- `{ nextCategory: 'EXCELLENT', targetValue: value, delta: 0, isAtTop: true }` si déjà EXCELLENT.
- Sinon : mapping `nextThresholdMap[current]` → `(nextCategory, percentileKey)` → cible = `percentiles[key]`, delta = `targetValue - value` (signé, arrondi à 1 décimale). Pour lower-is-better, delta négatif (il faut diminuer).

### UI — `StatCardXL` refactorée
- Retiré : imports `Line, LineChart, ResponsiveContainer` (recharts) + props `history` et `sparklineColor` + bloc de rendu sparkline.
- Ajouté : import `Trophy` (lucide), `getNextCategoryTarget` + `CATEGORY_LABELS`. Bloc « OBJECTIF NIVEAU SUIVANT » sous `<CategoryRangeBar>` (séparateur top-border), ou trophée gold + « Niveau maximal atteint » si `isAtTop`.

### DashboardTab — nettoyage
- Retiré : `SPARK_N`, `chrono`, `history()` (plus de consommateur).
- Retiré : props `history` / `sparklineColor` des 4 `<StatCardXL>`.

### Vérifs
- `tsc` web + node clean
- `npm run build` OK (2316 modules — recharts toujours utilisé par ProgressionChart et MusculoRadar)
- `npm run lint` baseline 17 préexistantes inchangée
- Suite tests : **111/111 pass** (104 + 7 nouveaux pour `getNextCategoryTarget`)
- Version `package.json` : 0.1.32 → 0.1.33

## 🔮 Prochain (v0.1.34 — Tooltips d'origine + envoi conseils par email + Notes branché)

- Encodage des tables **CPAFLA** dans `src/lib/norms/cpafla.ts` (architecture pluggable depuis v0.1.15).
- Source des tables CPAFLA : à confirmer avec Marie-Eve (manuel CPAFLA, captures du logiciel actuel, ou normes publiques).
- Intégration des nouvelles sections (récupération, notes, synthèse, paramètres Bruce/Cooper/Léger) dans le rapport PDF (`ReportPage.tsx`).
- Équation **Bruce-FRIEND** (Kaminsky 2017) avec âge intégré — donne le VO2max ≈49 que Marie-Eve voit dans ses bilans actuels pour Nicholas à 12:30.
- Léger : exposer une variante adulte / formule alternative (palier → vitesse km/h → formule) pour catégoriser les adultes en navette.

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
