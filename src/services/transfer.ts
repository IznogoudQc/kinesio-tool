/** Échange de clients entre deux installations (ADR 0002 : jamais de DB directe
 *  depuis un composant React). Les boîtes de dialogue fichier vivent côté main. */
export const transferService = {
  /** Ouvre « Enregistrer sous ». `null` si l'utilisateur annule. */
  async exportClients(clientIds: string[]): Promise<{ filePath: string; summary: BundleSummary } | null> {
    return window.api.transfer.exportClients(clientIds)
  },

  /** Ouvre un fichier et le valide, sans rien écrire. `null` si annulé. */
  async previewImport(): Promise<ImportPreview | null> {
    return window.api.transfer.previewImport()
  },

  async importClients(filePath: string, mode: 'replace' | 'merge'): Promise<ImportResult> {
    return window.api.transfer.importClients(filePath, mode)
  }
}
