/**
 * Couche service "API-ready" pour les rapports (PDF, courriel). L'export /
 * import de dossiers clients vit dans `services/transfer.ts`. Aucun composant
 * React n'appelle l'IPC directement — voir docs/decisions/0002.
 */
export const reportsService = {
  /** Génère le rapport PDF du client et retourne le chemin du fichier (dossier temp). */
  async generatePdfForClient(clientId: string): Promise<string> {
    return window.api.reports.generatePdf(clientId)
  },

  /** Génère le PDF « Barèmes de référence » et retourne le chemin du fichier. */
  async generateBaremesPdf(): Promise<string> {
    return window.api.reports.generateBaremes()
  },

  /** Génère le document HTML interactif du client (le même que celui joint au courriel). */
  async generateInteractiveHtml(clientId: string): Promise<string> {
    return window.api.reports.generateInteractiveHtml(clientId)
  },

  /** Ouvre un PDF (ou tout autre fichier) avec l'application par défaut du système. */
  async openPdf(filePath: string): Promise<void> {
    return window.api.reports.openPath(filePath)
  },

  /** Génère le rapport PDF, l'attache et l'envoie au client par courriel (SMTP des Paramètres). */
  async sendReportByEmail(clientId: string, subject: string, body: string): Promise<void> {
    await window.api.reports.sendEmail({ clientId, subject, body })
  }
}
