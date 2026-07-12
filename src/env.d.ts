/// <reference types="vite/client" />

type Sex = 'F' | 'M'

interface Client {
  id: string
  name: string
  email: string
  /** Date de naissance ISO `AAAA-MM-JJ`, ou `null` si non renseignée. */
  birthdate: string | null
  /** Sexe biologique — sert à la silhouette + au calcul du % gras. */
  sex: Sex | null
  /** Photo de profil recadrée en carré (`uuid.webp` dans `userData/avatars/`) — avatars circulaires. `null` si aucune. */
  avatarFilename: string | null
  /** Photo de profil originale non recadrée (`uuid.webp` dans `userData/avatars/`) — affichée dans l'onglet Mesures. `null` si aucune. */
  avatarFullbodyFilename: string | null
  /** Unité préférée pour les longueurs (affichage/saisie). La DB stocke toujours en cm. */
  unitLength: 'cm' | 'in'
  /** Unité préférée pour le poids (affichage/saisie). La DB stocke toujours en kg. */
  unitWeight: 'kg' | 'lb'
  /** Module « Objectif chiffré & nutrition » activé pour ce client (opt-in). */
  nutritionEnabled: boolean
  /** % de gras corporel visé par le client (ex. 15). `null` si non défini. */
  nutritionTargetBodyFat: number | null
  /** Niveau d'activité pour l'estimation calorique. `null` si non défini.
   *  Union alignée sur `ActivityLevel` de src/lib/nutrition.ts. */
  nutritionActivityLevel: 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif' | null
  /** Rythme de perte visé (kg/semaine) — échéance estimée + déficit des macros. `null` = défaut. */
  nutritionRateKgPerWeek: number | null
  /** Formule des macros (modifiable) : g de protéines par lb de masse maigre. `null` = 1. */
  nutritionProteinPerLbLean: number | null
  /** Formule des macros : plafond de lipides en g. `null` = 60. */
  nutritionFatMaxG: number | null
  /** Calories cibles fixées manuellement (kcal). `null` = calcul automatique. */
  nutritionTargetKcal: number | null
  /** Macros saisies à la main (grammes) plutôt que calculées par la formule. */
  nutritionMacroManual: boolean
  nutritionManualProteinG: number | null
  nutritionManualFatG: number | null
  nutritionManualCarbG: number | null
  /** Principe personnalisé (6e pilier) affiché en clôture du rapport si rempli. `null`/vide = non affiché. */
  principePersoTitre: string | null
  /** Texte du principe personnalisé. */
  principePersoTexte: string | null
  /** Protocole de jeûne intermittent choisi. `null` = pas de jeûne configuré. */
  jeuneType: '16:8' | '18:6' | '20:4' | 'omad' | '5:2' | null
  /** Début de la fenêtre d'alimentation (HH:MM). `null` si non défini. */
  jeuneFenetreDebut: string | null
  /** Fin de la fenêtre d'alimentation (HH:MM). `null` si non défini. */
  jeuneFenetreFin: string | null
  /** Consignes libres de Marie sur le jeûne. */
  jeuneNotes: string | null
  /** Planning de jeûne flexible — chaîne JSON d'un tableau de programmes (voir src/lib/fasting-planning.ts). `null`/vide = aucun. */
  jeunePlanning: string | null
  /** Cible d'hydratation en ml/jour. `null` = calcul auto d'après le poids. */
  hydratationMlParJour: number | null
  /** Suppléments recommandés (texte libre). */
  supplementsNotes: string | null
  /** Aliments à privilégier (texte libre). */
  alimentsPrivilegier: string | null
  /** Aliments à éviter (texte libre). */
  alimentsEviter: string | null
  /** Mot de Marie sur la nutrition (affiché dans le rapport). */
  nutritionMot: string | null
  createdAt: string
  updatedAt: string
}

interface SmtpConfig {
  host: string
  port: number
  user: string
  secure: boolean
}

interface ProfileSettings {
  name: string
  signature: string
}

interface EmailTemplate {
  subject: string
  body: string
}

/** Circonférences saisissables — catalogue et ordre dans `src/lib/mesure-fields.ts`. */
type MesureFieldKey =
  | 'cou'
  | 'epaule'
  | 'bicepsG'
  | 'bicepsD'
  | 'poitrine'
  | 'taille'
  | 'abdomen'
  | 'hanche'
  | 'cuisseG'
  | 'cuisseD'
  | 'molletG'
  | 'molletD'

interface BilanData {
  taille_cm?: number
  poids_kg?: number
  imc?: number
  tour_taille_cm?: number
  tour_hanche_cm?: number
  pli_triceps?: number
  pli_biceps?: number
  pli_sous_scap?: number
  pli_iliaque?: number
  pli_mollet?: number
  pli_cuisse?: number
  pourcentage_gras?: number
  vo2max?: number
  test_aerobie?: string
  /** Protocole utilisé pour estimer le VO2max — pilote l'UI de saisie. */
  aerobie_test_type?: 'bruce' | 'cooper' | 'leger' | 'manual'
  /** Bruce : durée totale tenue sur le tapis (secondes). */
  bruce_duration_sec?: number
  /** Cooper : distance parcourue en 12 min (mètres). */
  cooper_distance_m?: number
  /** Léger : palier atteint (navette 20 m). */
  leger_palier?: number
  /** MET équivalent — VO2max / 3.5 (calculé auto, mais persisté pour les rapports). */
  met_equivalent?: number
  fc_repos?: number
  /** FC max prédite via Tanaka — 208 - 0.7 × âge (calculée auto). */
  fc_max_predite?: number
  pa_systolique?: number
  pa_diastolique?: number
  /** Récupération à 1, 3 et 5 minutes après l'effort. */
  recup_1min_pa_sys?: number
  recup_1min_pa_dia?: number
  recup_1min_fc?: number
  recup_3min_pa_sys?: number
  recup_3min_pa_dia?: number
  recup_3min_fc?: number
  recup_5min_pa_sys?: number
  recup_5min_pa_dia?: number
  recup_5min_fc?: number
  pushups?: number
  situps?: number
  saut_vertical_cm?: number
  /** Puissance maximale des jambes (Watts) — calculée via Sayers ou importée du logiciel d'origine. */
  puissance_jambes_watts?: number
  /** `true` : valeur calculée par l'app (Sayers). `false` : valeur importée du .docx — on préserve.
   *  `undefined` : ancien bilan sans flag, on calcule si saut + poids sont disponibles. */
  puissance_calculated_auto?: boolean
  flexion_tronc_cm?: number
  endurance_dos_sec?: number
  score_composition?: number
  indice_sante_dos?: number
  score_musculo_global?: number
  score_global?: number
  /** Observations / conseils libres saisis par Marie-Eve (uniquement saisie manuelle). */
  notes?: string
  /** Objectif du client dans ses mots (ex. « perdre 10 kg », « courir un 10 km »).
   *  Affiché en tête de la Vue d'ensemble du rapport pour donner du sens aux scores. */
  objectif?: string
}

interface ExtractedBilan {
  date: string
  data: BilanData
}

type BilanSource = 'import_docx' | 'manuel'

interface Bilan {
  id: string
  clientId: string
  date: string
  data: BilanData
  source: BilanSource
  createdAt: string
}

interface PickedDocx {
  canceled: boolean
  fileName?: string
  /** Absolute path of the chosen .doc/.docx file (main process reads it). */
  filePath?: string
}

interface ImportBilanResult {
  extracted: ExtractedBilan
  historical: ExtractedBilan[]
}

interface ImportBilansSummary {
  imported: number
  updated: number
  skipped: number
}

interface DedupeSummary {
  /** Nombre de dates qui avaient des doublons. */
  groups: number
  /** Nombre de bilans supprimés. */
  removed: number
}

interface BilanStats {
  latest: Bilan | null
  /** Avant-dernier bilan (par date) — pour les comparaisons ▲▼. */
  previous: Bilan | null
  count: number
  /** Date du tout premier bilan, ou null si aucun. */
  firstDate: string | null
}

interface SmtpTestResult {
  success: boolean
  error?: string
}

// ── Échange de clients entre installations (voir src/lib/client-bundle.ts) ────
interface BundleSummary {
  clientCount: number
  bilanCount: number
  mesureCount: number
  plisCount: number
  noteCount: number
  avatarCount: number
  exportedAt: string
  appVersion: string
  clientNames: string[]
}

interface ImportPreview {
  filePath: string
  fileName: string
  summary: BundleSummary
  /** Noms des clients. `toAdd` : nouveaux. `toUpdate` : déjà présents en base. */
  plan: { toAdd: string[]; toUpdate: string[] }
}

interface ImportResult {
  added: number
  updated: number
  mode: 'replace' | 'merge'
  summary: BundleSummary
}

// ── Mesures : circonférences corporelles ──────────────────────────────────────
interface MesureCirconferences {
  id: string
  clientId: string
  date: string
  /** Poids en kg (toujours stocké en métrique), `null` si non mesuré. */
  poidsKg: number | null
  /** Toutes les circonférences en cm, `null` si non mesurée. */
  cou: number | null
  epaule: number | null
  bicepsG: number | null
  bicepsD: number | null
  poitrine: number | null
  taille: number | null
  abdomen: number | null
  hanche: number | null
  cuisseG: number | null
  cuisseD: number | null
  molletG: number | null
  molletD: number | null
  notes: string | null
  createdAt: string
}

/** Champs modifiables d'une entrée de circonférences (mesures en cm). */
interface CirconferencesInput {
  date?: string
  /** Poids en kg (déjà converti en métrique côté UI). */
  poidsKg?: number
  cou?: number
  epaule?: number
  bicepsG?: number
  bicepsD?: number
  poitrine?: number
  taille?: number
  abdomen?: number
  hanche?: number
  cuisseG?: number
  cuisseD?: number
  molletG?: number
  molletD?: number
  notes?: string
}

// ── Mesures : plis cutanés (4 plis Durnin-Womersley) ──────────────────────────
interface MesurePlisCutanes {
  id: string
  clientId: string
  date: string
  /** Plis en mm. */
  triceps: number
  biceps: number
  sousscapulaire: number
  iliaque: number
  /** Valeurs calculées et figées au moment de l'enregistrement. */
  somme4Plis: number
  densiteCorporelle: number
  pourcentageGrasSiri: number
  pourcentageGrasBrozek: number
  ageAuCalcul: number
  sexeAuCalcul: string
  notes: string | null
  createdAt: string
}

/** Champs modifiables d'une entrée de plis cutanés (les 4 plis en mm). */
interface PlisInput {
  date?: string
  triceps: number
  biceps: number
  sousscapulaire: number
  iliaque: number
  notes?: string
}

/** Note clinique libre sur un client — journal daté, privé (jamais dans le rapport). */
interface ClientNote {
  id: string
  clientId: string
  date: string
  content: string
  createdAt: string
  updatedAt: string
}
interface ClientNoteInput {
  date?: string
  content: string
}

interface Window {
  api: {
    clients: {
      list(): Promise<Client[]>
      create(data: {
        name: string
        email: string
        birthdate?: string | null
        sex?: Sex | null
        unitLength?: 'cm' | 'in'
        unitWeight?: 'kg' | 'lb'
      }): Promise<Client>
      update(
        id: string,
        data: {
          name?: string
          email?: string
          birthdate?: string | null
          sex?: Sex | null
          unitLength?: 'cm' | 'in'
          unitWeight?: 'kg' | 'lb'
          nutritionEnabled?: boolean
          nutritionTargetBodyFat?: number | null
          nutritionActivityLevel?: 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif' | null
          nutritionRateKgPerWeek?: number | null
          nutritionProteinPerLbLean?: number | null
          nutritionFatMaxG?: number | null
          nutritionTargetKcal?: number | null
          nutritionMacroManual?: boolean
          nutritionManualProteinG?: number | null
          nutritionManualFatG?: number | null
          nutritionManualCarbG?: number | null
          principePersoTitre?: string | null
          principePersoTexte?: string | null
          jeuneType?: '16:8' | '18:6' | '20:4' | 'omad' | '5:2' | null
          jeuneFenetreDebut?: string | null
          jeuneFenetreFin?: string | null
          jeuneNotes?: string | null
          jeunePlanning?: string | null
          hydratationMlParJour?: number | null
          supplementsNotes?: string | null
          alimentsPrivilegier?: string | null
          alimentsEviter?: string | null
          nutritionMot?: string | null
        }
      ): Promise<Client>
      delete(id: string): Promise<void>
      /** Ouvre le dialog natif de sélection d'une image (PNG/JPG/JPEG/WEBP) — renvoie une data URL à recadrer. */
      pickAvatar(): Promise<{ canceled: true } | { canceled: false; dataUrl: string }>
      /** Enregistre la photo de profil : `croppedBytes` = version carrée recadrée (cercles), `originalBytes` = image d'origine (Mesures). Retourne le client à jour. */
      setAvatar(
        clientId: string,
        croppedBase64: string,
        originalBase64: string
      ): Promise<Client>
      /** Supprime la photo de profil — retourne le client à jour. */
      removeAvatar(clientId: string): Promise<Client>
      /** Renvoie une data URL (image/webp) affichable, ou `null` si le fichier est introuvable. */
      getAvatarUrl(filename: string): Promise<string | null>
    }
    mesures: {
      circ: {
        list(clientId: string): Promise<MesureCirconferences[]>
        create(clientId: string, data: CirconferencesInput): Promise<MesureCirconferences>
        update(id: string, data: CirconferencesInput): Promise<MesureCirconferences>
        delete(id: string): Promise<void>
      }
      plis: {
        list(clientId: string): Promise<MesurePlisCutanes[]>
        create(clientId: string, data: PlisInput): Promise<MesurePlisCutanes>
        update(id: string, data: PlisInput): Promise<MesurePlisCutanes>
        delete(id: string): Promise<void>
      }
    }
    notes: {
      list(clientId: string): Promise<ClientNote[]>
      create(clientId: string, data: ClientNoteInput): Promise<ClientNote>
      update(id: string, data: ClientNoteInput): Promise<ClientNote>
      delete(id: string): Promise<void>
    }
    settings: {
      getProfile(): Promise<ProfileSettings>
      setProfile(data: ProfileSettings): Promise<void>
      getSmtpConfig(): Promise<SmtpConfig | null>
      setSmtpConfig(data: SmtpConfig): Promise<void>
      setSmtpPassword(password: string): Promise<void>
      hasSmtpPassword(): Promise<boolean>
      testSmtpConnection(): Promise<SmtpTestResult>
      getEmailTemplate(): Promise<EmailTemplate>
      setEmailTemplate(data: EmailTemplate): Promise<void>
      /** Le modèle par défaut de l'app, sans l'enregistrer. */
      getDefaultEmailTemplate(): Promise<EmailTemplate>
      getCategorizationNorms(): Promise<'acsm' | 'cpafla'>
      setCategorizationNorms(value: 'acsm' | 'cpafla'): Promise<void>
      /** `null` = réglage jamais enregistré → afficher toutes les circonférences. */
      getMesureFields(): Promise<MesureFieldKey[] | null>
      setMesureFields(value: MesureFieldKey[]): Promise<void>
    }
    transfer: {
      /** Ouvre « Enregistrer sous ». `null` si Marie-Eve annule. */
      exportClients(clientIds: string[]): Promise<{ filePath: string; summary: BundleSummary } | null>
      /** Ouvre « Ouvrir un fichier », valide, mais n'écrit rien. `null` si annulé. */
      previewImport(): Promise<ImportPreview | null>
      importClients(filePath: string, mode: 'replace' | 'merge'): Promise<ImportResult>
    }
    reports: {
      /** Génère le rapport PDF d'un client (route React `/report/:id`) — retourne le chemin du PDF. */
      generatePdf(clientId: string): Promise<string>
      /** Génère le PDF « Barèmes de référence » (route `/baremes`) — retourne le chemin du PDF. */
      generateBaremes(): Promise<string>
      /** Génère le document HTML interactif du client — retourne le chemin du fichier. */
      generateInteractiveHtml(clientId: string): Promise<string>
      /** Génère le document HTML nutrition & jeûne du client — retourne le chemin du fichier. */
      generateNutritionHtml(clientId: string): Promise<string>
      /** Ouvre un fichier local avec l'application par défaut du système. */
      openPath(filePath: string): Promise<void>
      /** Génère le rapport PDF, l'attache et l'envoie au client par courriel, puis supprime le fichier temp. */
      sendEmail(data: { clientId: string; subject: string; body: string }): Promise<{ sentTo: string }>
    }
    bilans: {
      pickDocxFile(): Promise<PickedDocx>
      parseDocx(clientId: string, filePath: string): Promise<ImportBilanResult>
      create(clientId: string, payload: { date: string; data: BilanData; source?: BilanSource }): Promise<Bilan>
      importBilans(clientId: string, items: { date: string; data: BilanData }[]): Promise<ImportBilansSummary>
      update(id: string, payload: { date?: string; data?: BilanData }): Promise<Bilan>
      delete(id: string): Promise<void>
      dedupe(clientId: string): Promise<DedupeSummary>
      list(clientId: string): Promise<Bilan[]>
      getById(id: string): Promise<Bilan | null>
    }
    ai: {
      hasApiKey(): Promise<boolean>
      setApiKey(key: string): Promise<void>
      removeApiKey(): Promise<void>
      testConnection(): Promise<{ ok: boolean; error?: string; code?: string }>
      /** Réponse : `{ ok: true, advice: AIAdvice }` ou `{ ok: false, error, code }`. */
      generate(payload: {
        sex: 'F' | 'M' | null
        age: number | null
        metrics: Array<{
          key: string
          label: string
          value: number | string
          unit?: string
          category?: string
          percentile?: number
          deltaPct?: number
        }>
      }): Promise<{ ok: boolean; advice?: unknown; error?: string; code?: string }>
    }
    app: {
      getVersion(): Promise<string>
    }
    update: {
      quitAndInstall(): Promise<void>
      onChecking(cb: () => void): void
      onAvailable(cb: (info: { version: string }) => void): void
      onNotAvailable(cb: () => void): void
      onDownloaded(cb: (info: { version: string }) => void): void
      onError(cb: (info: { message: string }) => void): void
    }
  }
}
