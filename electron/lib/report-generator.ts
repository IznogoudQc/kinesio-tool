import { app, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, clients, mesuresCirconferences, mesuresPlisCutanes } from '../../db/schema'

const isDev = !app.isPackaged

/** Date du jour au format `AAAA-MM-JJ` (heure locale, sans dérive de fuseau). */
export function todayISODate(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Normalise un nom de client pour servir de nom de fichier (ASCII, tirets). */
export function safeClientFileName(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les diacritiques (accents)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || 'client'
}

/** Données complètes d'un client — utilisées pour l'export `.kinesio`. */
export interface ClientBundle {
  version: '1.0'
  exportedAt: string
  client: typeof clients.$inferSelect
  bilans: Array<{
    id: string
    clientId: string
    date: string
    data: unknown
    source: string
    createdAt: string
  }>
  mesures_circonferences: Array<typeof mesuresCirconferences.$inferSelect>
  mesures_plis_cutanes: Array<typeof mesuresPlisCutanes.$inferSelect>
}

function getClientOrThrow(clientId: string): typeof clients.$inferSelect {
  const client = getDb().select().from(clients).where(eq(clients.id, clientId)).get()
  if (!client) throw new Error('Client introuvable.')
  return client
}

/** Charge le client + ses bilans + ses mesures (ordre chronologique). */
export function loadClientBundle(clientId: string): ClientBundle {
  const db = getDb()
  const client = getClientOrThrow(clientId)
  const bilanRows = db.select().from(bilans).where(eq(bilans.clientId, clientId)).orderBy(asc(bilans.date)).all()
  const circ = db
    .select()
    .from(mesuresCirconferences)
    .where(eq(mesuresCirconferences.clientId, clientId))
    .orderBy(asc(mesuresCirconferences.date))
    .all()
  const plis = db
    .select()
    .from(mesuresPlisCutanes)
    .where(eq(mesuresPlisCutanes.clientId, clientId))
    .orderBy(asc(mesuresPlisCutanes.date))
    .all()

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    client,
    bilans: bilanRows.map(row => {
      let data: unknown = {}
      try {
        data = JSON.parse(row.data)
      } catch {
        data = {}
      }
      return {
        id: row.id,
        clientId: row.clientId,
        date: row.date,
        data,
        source: row.source,
        createdAt: row.createdAt
      }
    }),
    mesures_circonferences: circ,
    mesures_plis_cutanes: plis
  }
}

/** Attend que la page `/report/:id` signale qu'elle a fini de se rendre. */
async function waitForReportReady(win: BrowserWindow, timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const ready = await win.webContents.executeJavaScript('window.__REPORT_READY__ === true')
      if (ready) return
    } catch {
      // page en cours de navigation — on réessaie
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  // Délai dépassé : on génère quand même avec ce qui est rendu.
}

/**
 * Imprime un document HTML **autonome** (fichier local, données inline) en PDF.
 * Sert pour le document nutrition, qui n'a pas de route React dédiée.
 */
export async function htmlFileToPdf(htmlPath: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 1400,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  try {
    await win.loadFile(htmlPath)
    // Le document monte React au chargement — on laisse le rendu se stabiliser.
    await new Promise(resolve => setTimeout(resolve, 700))
    return await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    })
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/**
 * Génère le rapport PDF d'un client en chargeant la route React dédiée
 * `/report/:id` dans une fenêtre cachée, puis `webContents.printToPDF()`.
 * Retourne le chemin du PDF écrit dans le dossier temporaire.
 */
export async function generateClientReportPdf(clientId: string): Promise<string> {
  const client = getClientOrThrow(clientId)

  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 1400,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  try {
    const hash = `/report/${clientId}`
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
    } else {
      await win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
    }

    await waitForReportReady(win)

    // Marges haut/bas au niveau de la PAGE PDF (~12 mm) → identiques sur chaque
    // page, y compris les pages de continuation d'une section (le padding CSS
    // d'une section ne s'applique qu'à sa 1re page). Gauche/droite = 0 ici : géré
    // par le padding horizontal des sections (qui, lui, s'applique à toutes les
    // pages). Valeurs en pouces (0.47" ≈ 12 mm).
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.79, bottom: 0.79, left: 0, right: 0 } // pouces ≈ 20 mm
    })

    const fileName = `Bilan-${safeClientFileName(client.name)}-${todayISODate()}.pdf`
    const outPath = join(app.getPath('temp'), fileName)
    await fs.writeFile(outPath, pdfData)
    return outPath
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/**
 * Génère le PDF « Barèmes de référence » en chargeant la route `/baremes`
 * (document autonome, données lues depuis le code → toujours synchro). Retourne
 * le chemin du PDF dans le dossier temporaire.
 */
export async function generateBaremesPdf(): Promise<string> {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 1400,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  try {
    const hash = '/baremes'
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
    } else {
      await win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
    }

    await waitForReportReady(win)

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.55, bottom: 0.55, left: 0.4, right: 0.4 } // pouces
    })

    const outPath = join(app.getPath('temp'), `Baremes-Kinesio-Outils-${todayISODate()}.pdf`)
    await fs.writeFile(outPath, pdfData)
    return outPath
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}
