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
  }
}
