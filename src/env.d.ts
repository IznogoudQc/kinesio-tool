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
  fc_repos?: number
  pa_systolique?: number
  pa_diastolique?: number
  pushups?: number
  situps?: number
  saut_vertical_cm?: number
  puissance_jambes_watts?: number
  flexion_tronc_cm?: number
  endurance_dos_sec?: number
  score_composition?: number
  indice_sante_dos?: number
  score_musculo_global?: number
  score_global?: number
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
    }
    reports: {
      /** Génère le rapport PDF d'un client (route React `/report/:id`) — retourne le chemin du PDF. */
      generatePdf(clientId: string): Promise<string>
      /** Ouvre un fichier local avec l'application par défaut du système. */
      openPath(filePath: string): Promise<void>
      /** Génère le rapport PDF, l'attache et l'envoie au client par courriel, puis supprime le fichier temp. */
      sendEmail(data: { clientId: string; subject: string; body: string }): Promise<{ sentTo: string }>
      /** Exporte tout le dossier d'un client en `.kinesio` (dialog natif inclus). */
      exportJson(clientId: string): Promise<{ filePath: string } | { canceled: true }>
      /** Ouvre le dialog natif de sélection d'un fichier `.kinesio` à importer. */
      pickImportFile(): Promise<{ canceled: true } | { canceled: false; filePath: string; fileName: string }>
      /** Importe un fichier `.kinesio`. Sans `mode`, retourne `conflict` si un client a déjà ce courriel. */
      importJson(data: {
        filePath: string
        mode?: 'create' | 'merge'
      }): Promise<{ status: 'ok'; clientId: string } | { status: 'conflict'; existingName: string }>
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
