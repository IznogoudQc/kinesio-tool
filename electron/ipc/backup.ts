import { ipcMain, shell } from 'electron'
import { z } from 'zod'
import { getBackupStatus, runBackupNow, setBackupEnabled } from '../lib/backup-service'

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:status', async () => getBackupStatus())

  ipcMain.handle('backup:setEnabled', async (_e, payload: unknown) => {
    setBackupEnabled(z.boolean().parse(payload))
  })

  ipcMain.handle('backup:runNow', async () => {
    const result = await runBackupNow()
    if (!result) {
      throw new Error(
        "OneDrive n'a pas été trouvé sur ce PC. Installez-le et connectez-vous, puis redémarrez l'application."
      )
    }
    return result
  })

  /** Ouvre le dossier de sauvegarde dans l'explorateur — pour aller vérifier. */
  ipcMain.handle('backup:openFolder', async () => {
    const { backupFolder } = await getBackupStatus()
    if (!backupFolder) throw new Error("OneDrive n'a pas été trouvé sur ce PC.")
    const err = await shell.openPath(backupFolder)
    if (err) throw new Error(err)
  })
}
