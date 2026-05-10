export const emailService = {
  async sendBilan(clientId: string, subject: string, body: string): Promise<{ sentTo: string }> {
    return window.api.email.sendBilan({ clientId, subject, body })
  }
}
