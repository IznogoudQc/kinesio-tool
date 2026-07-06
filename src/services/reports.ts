/**
 * Couche service "API-ready" pour les rapports (PDF, courriel) et l'export /
 * import du dossier client en `.kinesio`. Aucun composant React n'appelle l'IPC
 * directement — voir docs/decisions/0002-architecture-api-ready.md.
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

  /** Ouvre un PDF (ou tout autre fichier) avec l'application par défaut du système. */
  async openPdf(filePath: string): Promise<void> {
    return window.api.reports.openPath(filePath)
  },

  /** Génère le rapport PDF, l'attache et l'envoie au client par courriel (SMTP des Paramètres). */
  async sendReportByEmail(clientId: string, subject: string, body: string): Promise<void> {
    await window.api.reports.sendEmail({ clientId, subject, body })
  },

  /** Exporte tout le dossier d'un client en `.kinesio` (dialog natif d'enregistrement inclus). */
  async exportClientToJson(clientId: string): Promise<{ filePath: string } | { canceled: true }> {
    return window.api.reports.exportJson(clientId)
  },

  /** Ouvre le dialog natif pour choisir un fichier `.kinesio` à importer. */
  async pickImportFile(): Promise<{ canceled: true } | { canceled: false; filePath: string; fileName: string }> {
    return window.api.reports.pickImportFile()
  },

  /**
   * Importe un fichier `.kinesio` et recrée le client + ses bilans + ses mesures.
   * Sans `mode`, si un client a déjà ce courriel, retourne `{ status: 'conflict' }` —
   * l'appelant doit alors rappeler avec `mode: 'merge'` (fusionner) ou `'create'` (doublon).
   */
  async importClientFromJson(
    filePath: string,
    mode?: 'create' | 'merge'
  ): Promise<{ status: 'ok'; clientId: string } | { status: 'conflict'; existingName: string }> {
    return window.api.reports.importJson({ filePath, mode })
  }
}
