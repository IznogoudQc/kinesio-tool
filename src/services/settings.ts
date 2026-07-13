export const settingsService = {
  async getProfile(): Promise<ProfileSettings> {
    return window.api.settings.getProfile()
  },

  async setProfile(data: ProfileSettings): Promise<void> {
    return window.api.settings.setProfile(data)
  },

  async getSmtpConfig(): Promise<SmtpConfig | null> {
    return window.api.settings.getSmtpConfig()
  },

  async setSmtpConfig(data: SmtpConfig): Promise<void> {
    return window.api.settings.setSmtpConfig(data)
  },

  async setSmtpPassword(password: string): Promise<void> {
    return window.api.settings.setSmtpPassword(password)
  },

  async hasSmtpPassword(): Promise<boolean> {
    return window.api.settings.hasSmtpPassword()
  },

  async testSmtpConnection(): Promise<SmtpTestResult> {
    return window.api.settings.testSmtpConnection()
  },

  async getEmailTemplate(): Promise<EmailTemplate> {
    return window.api.settings.getEmailTemplate()
  },

  async setEmailTemplate(data: EmailTemplate): Promise<void> {
    return window.api.settings.setEmailTemplate(data)
  },

  /** Le modèle par défaut de l'app — ne l'enregistre pas. */
  async getDefaultEmailTemplate(): Promise<EmailTemplate> {
    return window.api.settings.getDefaultEmailTemplate()
  },

  async getCategorizationNorms(): Promise<'acsm' | 'cpafla'> {
    return window.api.settings.getCategorizationNorms()
  },

  async setCategorizationNorms(value: 'acsm' | 'cpafla'): Promise<void> {
    return window.api.settings.setCategorizationNorms(value)
  },

  /** `null` : Marie-Eve n'a jamais choisi → toutes les circonférences sont saisies. */
  async getMesureFields(): Promise<MesureFieldKey[] | null> {
    return window.api.settings.getMesureFields()
  },

  async setMesureFields(value: MesureFieldKey[]): Promise<void> {
    return window.api.settings.setMesureFields(value)
  },

  /** Dossier configuré pour l'export des documents clients (`null` si non défini). */
  async getDocumentsFolder(): Promise<string | null> {
    return window.api.settings.getDocumentsFolder()
  },

  /** Ouvre un sélecteur natif ; enregistre et retourne le dossier choisi, ou `null` si annulé. */
  async pickDocumentsFolder(): Promise<string | null> {
    return window.api.settings.pickDocumentsFolder()
  }
}
