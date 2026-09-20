import { clipboard, ipcMain, shell } from 'electron'
import { z } from 'zod'
import {
  PULSE_ALLOWED_HOSTS,
  getPulsePassword,
  getPulseUrl,
  setPulsePassword
} from './settings'

/**
 * Kinésio Pulse — l'app web où Marie prescrit les programmes d'entraînement.
 * Application séparée : on l'ouvre dans le navigateur par défaut, jamais dans
 * une fenêtre Electron ni depuis le renderer.
 */
export function registerPulseHandlers(): void {
  ipcMain.handle('pulse:open', async () => {
    const raw = await getPulseUrl()

    // On ne tend jamais une URL non vérifiée à `shell.openExternal` : le
    // navigateur y obéirait aussi bien pour un `file:` ou un protocole exotique.
    // L'adresse vient de nos réglages aujourd'hui, ce qui ne dispense de rien.
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new Error(`L'adresse de Kinésio Pulse est illisible : ${raw}`)
    }

    if (url.protocol !== 'https:' || !PULSE_ALLOWED_HOSTS.includes(url.hostname)) {
      throw new Error(`L'adresse de Kinésio Pulse n'est pas autorisée : ${raw}`)
    }

    // `url.href` et non `raw` : c'est la forme normalisée qu'on vient de valider.
    await shell.openExternal(url.href)
  })

  // ── Mot de passe de connexion à Pulse ──────────────────────────────────────
  // Affiché en clair sous le bouton pour que Marie le recopie dans le
  // navigateur. Dépannage temporaire, en attendant que Pulse garde la session.

  ipcMain.handle('pulse:getPassword', async () => getPulsePassword())

  ipcMain.handle('pulse:setPassword', async (_e, payload: unknown) => {
    await setPulsePassword(z.string().max(200).parse(payload))
  })

  /** Copie dans le presse-papiers depuis le processus principal plutôt que via
   *  `navigator.clipboard`, qui demande un contexte sécurisé — la fenêtre est
   *  chargée en `file://` une fois l'app empaquetée. */
  ipcMain.handle('pulse:copyPassword', async () => {
    const password = await getPulsePassword()
    if (!password) return false
    clipboard.writeText(password)
    return true
  })
}
