import { clipboard, ipcMain, shell } from 'electron'
import { z } from 'zod'
import {
  DEFAULT_PULSE_PASSWORD,
  PULSE_ALLOWED_HOSTS,
  getPulsePassword,
  getPulseUrl,
  getSavedPulsePassword,
  setPulsePassword
} from './settings'

/**
 * Ouvre une page d'Effet dans le navigateur par défaut.
 *
 * On ne tend jamais une URL non vérifiée à `shell.openExternal` : le navigateur
 * y obéirait aussi bien pour un `file:` ou un protocole exotique. L'adresse
 * vient de nos réglages aujourd'hui, ce qui ne dispense de rien.
 *
 * `chemin` est posé APRÈS coup sur l'URL validée, et jamais concaténé avant
 * l'analyse : un chemin malveillant ne peut donc pas emporter l'hôte avec lui.
 */
async function ouvrirDansEffet(chemin?: string): Promise<void> {
  const raw = await getPulseUrl()

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`L'adresse d'Effet est illisible : ${raw}`)
  }

  if (url.protocol !== 'https:' || !PULSE_ALLOWED_HOSTS.includes(url.hostname)) {
    throw new Error(`L'adresse d'Effet n'est pas autorisée : ${raw}`)
  }

  if (chemin) url.pathname = chemin

  // `url.href` et non `raw` : c'est la forme normalisée qu'on vient de valider.
  await shell.openExternal(url.href)
}

/**
 * Effet — l'app web où Marie prescrit les programmes d'entraînement.
 * Application séparée : on l'ouvre dans le navigateur par défaut, jamais dans
 * une fenêtre Electron ni depuis le renderer.
 *
 * Les canaux IPC et les clés de réglages gardent le préfixe `pulse` : l'app
 * s'appelait Kinésio Pulse avant d'être renommée Effet. Les renommer casserait
 * les réglages déjà enregistrés sur le poste de Marie.
 */
export function registerPulseHandlers(): void {
  ipcMain.handle('pulse:open', async () => ouvrirDansEffet())

  /**
   * Ouvre le fil d'une cliente — depuis la pastille de la liste des clients.
   *
   * L'identifiant est celui d'EFFET, pas celui de Kinésio Outils. Il est validé
   * comme UUID : il vient d'une réponse réseau, et se retrouve dans une URL
   * qu'on remet au navigateur.
   */
  ipcMain.handle('pulse:openFil', async (_e, payload: unknown) => {
    const clientId = z.string().uuid().parse(payload)
    await ouvrirDansEffet(`/coach/notes/${clientId}`)
  })

  // ── Mot de passe de connexion à Effet ──────────────────────────────────────
  // Affiché en clair sous le bouton pour que Marie le recopie dans le
  // navigateur. Dépannage temporaire, en attendant qu'Effet garde la session.

  ipcMain.handle('pulse:getPassword', async () => getPulsePassword())

  /** Ce que la carte de Paramètres doit afficher : le remplacement enregistré
   *  dans le champ, la valeur livrée seulement en indication. */
  ipcMain.handle('pulse:getPasswordSettings', async () => ({
    saisi: await getSavedPulsePassword(),
    livre: DEFAULT_PULSE_PASSWORD || null
  }))

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
