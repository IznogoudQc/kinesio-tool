/// <reference types="vite/client" />

interface Client {
  id: string
  name: string
  email: string
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

interface Window {
  api: {
    clients: {
      list(): Promise<Client[]>
      create(data: { name: string; email: string }): Promise<Client>
      update(id: string, data: { name?: string; email?: string }): Promise<Client>
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
    }
    email: {
      sendBilan(data: { clientId: string; subject: string; body: string }): Promise<{ sentTo: string }>
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
