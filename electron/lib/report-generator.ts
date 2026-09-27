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

/** Identité visuelle des documents client — doit suivre `editorial.css`. */
const DOC_MARINE = '#001331'
const DOC_OR = '#c9a77a'
const DOC_GRIS = '#8a94a6'
const DOC_FILET = '#e4dccd'

/** Ce qui s'imprime dans les bandeaux de chaque page. */
export interface BandeauxDocument {
  /** Nom du client, à gauche du pied de page. */
  client: string
  /** Ce qui suit le nom, après une barre oblique. Ex. « Évaluation du 25 juin 2026 ». */
  mention: string
  /** Aligné à droite de l'en-tête. Ex. « Bilan de forme physique ». */
  titre: string
}

/**
 * Bandeaux répétés sur chaque page du PDF.
 *
 * Chromium n'applique PAS les boîtes de marge de CSS Paged Media
 * (`@top-left`, `counter(pages)`…) : un en-tête courant ne peut donc pas venir
 * de la feuille de styles. Il passe forcément par ces gabarits, qui ont leurs
 * propres règles :
 *
 *  - tout le style doit être en ligne, la feuille du document n'est pas chargée ;
 *  - la taille de police par défaut est minuscule, il faut la poser ;
 *  - `-webkit-print-color-adjust` est nécessaire, sinon les couleurs tombent ;
 *  - le gabarit occupe toute la largeur de la page, marges comprises, d'où le
 *    rembourrage latéral qui réaligne les bandeaux sur le contenu ;
 *  - `.pageNumber` et `.totalPages` sont remplies par Chromium.
 *
 * Le titre de SECTION courante ne peut pas y figurer : le gabarit ignore tout
 * du contenu de la page qu'il coiffe. On affiche donc le titre du document.
 */
function gabaritEntete(b: BandeauxDocument): string {
  return `<div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:7.5pt;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
    padding:0 14mm;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding-bottom:3mm;border-bottom:0.4pt solid ${DOC_FILET};">
      <span style="color:${DOC_OR};font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Kinésio Conseil</span>
      <span style="color:${DOC_GRIS};">${echapperHtml(b.titre)}</span>
    </div>
  </div>`
}

function gabaritPied(b: BandeauxDocument): string {
  return `<div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:7.5pt;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
    padding:0 14mm;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding-top:3mm;border-top:0.4pt solid ${DOC_FILET};color:${DOC_GRIS};">
      <span>${echapperHtml(b.client)}&nbsp;&nbsp;/&nbsp;&nbsp;${echapperHtml(b.mention)}</span>
      <span style="color:${DOC_MARINE};font-weight:700;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </span>
    </div>
  </div>`
}

/** Un nom de client avec une esperluette casserait le gabarit. */
function echapperHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Imprime un document HTML **autonome** (fichier local, données inline) en PDF.
 * Sert pour la nutrition, le journal et le suivi de mesures (le bilan passe par
 * la route `/report`, voir plus haut).
 *
 * Avec `bandeaux`, chaque page reçoit un en-tête et un pied courants, numéro de
 * page compris. Les marges haute et basse passent alors à 18 mm pour leur faire
 * de la place.
 *
 * Ces 18 mm doivent être imposés par CSS : les documents déclarent leur propre
 * `@page { margin }` (12 mm, 9 mm pour le journal), et Chromium le fait passer
 * AVANT les `margins` de `printToPDF`. Sans l'injection, les 18 mm étaient
 * ignorés et le filet de l'en-tête touchait le contenu. Les marges latérales
 * du document, elles, ne sont pas touchées.
 */
export async function htmlFileToPdf(htmlPath: string, bandeaux?: BandeauxDocument): Promise<Buffer> {
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
    if (bandeaux) {
      await win.webContents.insertCSS('@page { margin-top: 18mm !important; margin-bottom: 18mm !important; }')
    }
    return await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: bandeaux
        ? { top: 0.71, bottom: 0.71, left: 0.4, right: 0.4 } // ≈ 18 mm / 10 mm
        : { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
      ...(bandeaux
        ? {
            displayHeaderFooter: true,
            headerTemplate: gabaritEntete(bandeaux),
            footerTemplate: gabaritPied(bandeaux)
          }
        : {})
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
export async function generateClientReportPdf(clientId: string, bilanId?: string): Promise<string> {
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
    // `?bilan=` : la page de rapport bascule alors sur CE bilan et borne son
    // historique a sa date. Absent = bilan de synthese, comportement d'origine.
    const hash = bilanId ? `/report/${clientId}?bilan=${bilanId}` : `/report/${clientId}`
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
/**
 * Q-AAP signé, en PDF. Rend `/qaap/:id` dans une fenêtre cachée.
 *
 * Une signature qu'on ne peut pas produire hors de l'application ne sert à
 * rien : c'est en cas de contestation qu'il faut sortir le document.
 */
export async function generateQaapPdf(questionnaireId: string, clientName: string): Promise<string> {
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
    const hash = `/qaap/${questionnaireId}`
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
    } else {
      await win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
    }

    await waitForReportReady(win)

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.55, bottom: 0.55, left: 0.4, right: 0.4 }
    })

    const outPath = join(app.getPath('temp'), `Q-AAP-${safeClientFileName(clientName)}-${todayISODate()}.pdf`)
    await fs.writeFile(outPath, pdfData)
    return outPath
  } finally {
    win.destroy()
  }
}

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
