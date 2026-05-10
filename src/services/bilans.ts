/**
 * Couche service "API-ready" pour les bilans — aucun composant React n'appelle
 * l'IPC directement (voir docs/decisions/0002-architecture-api-ready.md).
 */
export const bilansService = {
  /** Ouvre le dialog natif de sélection de fichier .docx. */
  async pickDocxFile(): Promise<PickedDocx> {
    return window.api.bilans.pickDocxFile()
  },

  /**
   * Analyse un fichier de bilan (.doc ou .docx) choisi par l'utilisatrice et
   * retourne les valeurs extraites. Les .doc sont convertis en .docx côté main
   * (Word ou LibreOffice) avant l'analyse.
   */
  async import_docx(clientId: string, filePath: string): Promise<ImportBilanResult> {
    return window.api.bilans.parseDocx(clientId, filePath)
  },

  async create(
    clientId: string,
    payload: { date: string; data: BilanData; source?: BilanSource }
  ): Promise<Bilan> {
    return window.api.bilans.create(clientId, payload)
  },

  /** Import par lot avec déduplication sur (client, date) — voir le handler IPC. */
  async importBilans(
    clientId: string,
    items: { date: string; data: BilanData }[]
  ): Promise<ImportBilansSummary> {
    return window.api.bilans.importBilans(clientId, items)
  },

  async update(id: string, payload: { date?: string; data?: BilanData }): Promise<Bilan> {
    return window.api.bilans.update(id, payload)
  },

  async delete(id: string): Promise<void> {
    return window.api.bilans.delete(id)
  },

  /** Supprime les bilans en double (même date) en gardant le plus complet. */
  async dedupe(clientId: string): Promise<DedupeSummary> {
    return window.api.bilans.dedupe(clientId)
  },

  async list(clientId: string): Promise<Bilan[]> {
    return window.api.bilans.list(clientId)
  },

  /** Alias explicite de `list` — bilans du client, du plus récent au plus ancien. */
  async getBilansForClient(clientId: string): Promise<Bilan[]> {
    return window.api.bilans.list(clientId)
  },

  /** Résumé utilisé par le dashboard : dernier bilan, précédent, total, première date. */
  async getBilanStats(clientId: string): Promise<BilanStats> {
    const all = await window.api.bilans.list(clientId)
    return {
      latest: all[0] ?? null,
      previous: all[1] ?? null,
      count: all.length,
      firstDate: all.length > 0 ? all[all.length - 1].date : null
    }
  },

  async getById(id: string): Promise<Bilan | null> {
    return window.api.bilans.getById(id)
  }
}
