/**
 * Couche service "API-ready" pour les rapports (PDF, courriel). L'export /
 * import de dossiers clients vit dans `services/transfer.ts`. Aucun composant
 * React n'appelle l'IPC directement — voir docs/decisions/0002.
 */
export const reportsService = {
  /** Génère le rapport PDF du client et retourne le chemin du fichier (dossier temp). */
  async generatePdfForClient(clientId: string, bilanId?: string): Promise<string> {
    return window.api.reports.generatePdf(clientId, bilanId)
  },

  /** Génère le PDF « Barèmes de référence » et retourne le chemin du fichier. */
  async generateBaremesPdf(): Promise<string> {
    return window.api.reports.generateBaremes()
  },

  /** Génère le PDF d'un Q-AAP (questionnaire signé) et retourne son chemin. */
  async generateQaapPdf(questionnaireId: string, clientName: string): Promise<string> {
    return window.api.reports.generateQaap(questionnaireId, clientName)
  },

  /** Dépose le PDF d'un Q-AAP signé dans « Questionnaires et Notes » du client. */
  async archiveQaap(questionnaireId: string): Promise<{ path: string }> {
    return window.api.reports.archiveQaap(questionnaireId)
  },

  /** Génère le document HTML interactif du client (le même que celui joint au courriel). */
  async generateInteractiveHtml(clientId: string, bilanId?: string): Promise<string> {
    return window.api.reports.generateInteractiveHtml(clientId, bilanId)
  },

  /** Génère le document HTML autonome dédié à la nutrition & au jeûne du client. */
  async generateNutritionHtml(clientId: string): Promise<string> {
    return window.api.reports.generateNutritionHtml(clientId)
  },

  /** Génère le journal alimentaire vierge imprimable du client. */
  async generateFoodlogHtml(clientId: string): Promise<string> {
    return window.api.reports.generateFoodlogHtml(clientId)
  },

  /**
   * Écrit le formulaire d'habitudes de vie et retourne son chemin.
   *
   * Le HTML est construit ici, côté renderer (`renderFantasticForm`), et non
   * dans le processus principal : celui-ci ne peut pas importer les modules du
   * questionnaire sans dupliquer les 25 énoncés. Voir `writeFantasticFormHtml`.
   */
  async writeFantasticForm(clientId: string, html: string): Promise<string> {
    return window.api.reports.writeFantasticForm({ clientId, html })
  },

  /** Ouvre un PDF (ou tout autre fichier) avec l'application par défaut du système. */
  async openPdf(filePath: string): Promise<void> {
    return window.api.reports.openPath(filePath)
  },

  /** Génère et exporte tous les documents du client dans le dossier configuré (Paramètres). */
  async exportClientDocuments(clientId: string): Promise<{ dir: string; count: number }> {
    return window.api.reports.exportClientDocuments(clientId)
  },

  /** Ouvre le sous-dossier du client dans l'explorateur (le crée au besoin). */
  async openClientFolder(clientId: string): Promise<void> {
    return window.api.reports.openClientFolder(clientId)
  },

  /** Génère le(s) document(s), les attache et les envoie au client par courriel (SMTP des
   *  Paramètres). `kind` : `bilan` (PDF + interactif), `nutrition` (document nutrition)
   *  ou `questionnaire` (formulaire d'habitudes de vie à remplir). */
  async sendReportByEmail(
    clientId: string,
    subject: string,
    body: string,
    kind: 'bilan' | 'nutrition' | 'questionnaire' = 'bilan',
    /** Requis pour `questionnaire` — le formulaire construit par le renderer. */
    html?: string,
    /** Destinataires. Absent = l'adresse du client. */
    to?: string[]
  ): Promise<void> {
    await window.api.reports.sendEmail({ clientId, subject, body, kind, html, to })
  }
}
