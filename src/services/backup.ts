/** Sauvegarde quotidienne vers OneDrive (ADR 0012). Comme partout, le renderer
 *  passe par un service : jamais d'appel IPC depuis un composant. */
export const backupService = {
  async getStatus(): Promise<BackupStatus> {
    return window.api.backup.getStatus()
  },

  async setEnabled(enabled: boolean): Promise<void> {
    return window.api.backup.setEnabled(enabled)
  },

  /** Lève si OneDrive est introuvable — le message est destiné à l'écran. */
  async runNow(): Promise<{ filePath: string; clientCount: number }> {
    return window.api.backup.runNow()
  },

  async openFolder(): Promise<void> {
    return window.api.backup.openFolder()
  }
}
