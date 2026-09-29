import { ipcMain } from 'electron'
import { z } from 'zod'
import {
  definirCleEffet,
  definirNotificationsActives,
  etatVeille,
  nonLusParClient,
  verifierMaintenant
} from '../lib/effet-notifications-service'

/**
 * Ce que l'interface peut demander sur la veille des messages d'Effet.
 *
 * Aucun handler ne renvoie la clé d'accès ni le moindre contenu de message :
 * l'interface n'a besoin que de l'interrupteur et de l'heure de la dernière
 * vérification.
 */
export function registerEffetNotificationsHandlers(): void {
  ipcMain.handle('effet:notifications:status', async () => etatVeille())

  ipcMain.handle('effet:notifications:setActives', async (_e, payload: unknown) => {
    definirNotificationsActives(z.boolean().parse(payload))
    return etatVeille()
  })

  ipcMain.handle('effet:notifications:verifier', async () => verifierMaintenant())

  // Pour la pastille de la liste des clients : des comptes par courriel, jamais
  // un nom ni un texte de message.
  ipcMain.handle('effet:notifications:nonLus', async () => nonLusParClient())

  // Aller simple : la clé entre, elle ne ressort jamais. Chaîne vide = effacer.
  ipcMain.handle('effet:notifications:setCle', async (_e, payload: unknown) =>
    definirCleEffet(z.string().max(1000).parse(payload))
  )
}
