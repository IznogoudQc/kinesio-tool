import { ipcMain, shell } from 'electron'
import { PULSE_ALLOWED_HOSTS, getPulseUrl } from './settings'

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
}
