import { ipcMain, shell } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { clients } from '../../db/schema'
import {
  generateBaremesPdf,
  generateClientReportPdf,
  htmlFileToPdf,
  safeClientFileName,
  todayISODate
} from '../lib/report-generator'
import { generateFoodJournalHtml, generateInteractiveReportHtml, generateNutritionDocumentHtml } from '../lib/standalone-report'
import { getDocumentsFolder, getSmtpCredentials } from './settings'

const ClientIdSchema = z.string().uuid()

const SendReportSchema = z.object({
  clientId: ClientIdSchema,
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(20000),
  /** `bilan` (défaut) = PDF + document interactif ; `nutrition` = document nutrition seul. */
  kind: z.enum(['bilan', 'nutrition']).optional()
})

export function registerReportsHandlers(): void {
  // ── Génération du rapport PDF ────────────────────────────────────────────────
  ipcMain.handle('reports:generate-pdf', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    return generateClientReportPdf(id)
  })

  // Génère le PDF « Barèmes de référence » (aucun paramètre — lit le code).
  // Document interactif seul — même fichier que celui joint au courriel.
  ipcMain.handle('reports:generate-html', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    return generateInteractiveReportHtml(id)
  })

  // Document HTML autonome dédié à la nutrition & au jeûne (distinct du bilan).
  ipcMain.handle('reports:generate-nutrition-html', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    return generateNutritionDocumentHtml(id)
  })

  // Journal alimentaire vierge imprimable.
  ipcMain.handle('reports:generate-foodlog-html', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    return generateFoodJournalHtml(id)
  })

  ipcMain.handle('reports:generate-baremes', async () => {
    return generateBaremesPdf()
  })

  // Ouvre un fichier local avec l'application par défaut du système.
  ipcMain.handle('reports:open-path', async (_e, filePath: unknown) => {
    const p = z.string().min(1).parse(filePath)
    const err = await shell.openPath(p)
    if (err) throw new Error(err)
  })

  // ── Export de TOUS les documents d'un client dans le dossier configuré ───────
  // Structure : {dossier}/{Nom Client}/ avec Bilan PDF+HTML, Nutrition PDF+HTML,
  // Journal alimentaire HTML. Chaque étape est tentée indépendamment (un client
  // sans bilan n'empêche pas d'exporter la nutrition).
  ipcMain.handle('reports:export-client-documents', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    const client = getDb().select().from(clients).where(eq(clients.id, id)).get()
    if (!client) throw new Error('Client introuvable.')
    const folder = await getDocumentsFolder()
    if (!folder) throw new Error('Aucun dossier configuré. Choisissez-le dans les Paramètres.')

    const clientDir = join(folder, safeClientFileName(client.name))
    await fs.mkdir(clientDir, { recursive: true })
    const stem = `${safeClientFileName(client.name)}-${todayISODate()}`

    const temps: string[] = []
    let written = 0
    const step = async (fn: () => Promise<void>): Promise<void> => {
      try {
        await fn()
      } catch {
        // Étape ignorée (ex. aucun bilan pour le PDF) — on continue.
      }
    }

    await step(async () => {
      const p = await generateClientReportPdf(id)
      temps.push(p)
      await fs.copyFile(p, join(clientDir, `Bilan-${stem}.pdf`))
      written++
    })
    await step(async () => {
      const p = await generateInteractiveReportHtml(id)
      temps.push(p)
      await fs.copyFile(p, join(clientDir, `Bilan-interactif-${stem}.html`))
      written++
    })

    let nutriHtml: string | null = null
    await step(async () => {
      const p = await generateNutritionDocumentHtml(id)
      temps.push(p)
      nutriHtml = p
      await fs.copyFile(p, join(clientDir, `Nutrition-${stem}.html`))
      written++
    })
    await step(async () => {
      if (!nutriHtml) return
      const buf = await htmlFileToPdf(nutriHtml)
      await fs.writeFile(join(clientDir, `Nutrition-${stem}.pdf`), buf)
      written++
    })

    await step(async () => {
      const p = await generateFoodJournalHtml(id)
      temps.push(p)
      await fs.copyFile(p, join(clientDir, `Journal-alimentaire-${stem}.html`))
      written++
    })

    for (const t of temps) {
      try {
        await fs.unlink(t)
      } catch {
        // best effort
      }
    }
    if (written === 0) throw new Error("Aucun document n'a pu être généré. Le client a-t-il un bilan ?")
    return { dir: clientDir, count: written }
  })

  // Ouvre le sous-dossier du client dans l'explorateur (le crée au besoin).
  ipcMain.handle('reports:open-client-folder', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    const client = getDb().select().from(clients).where(eq(clients.id, id)).get()
    if (!client) throw new Error('Client introuvable.')
    const folder = await getDocumentsFolder()
    if (!folder) throw new Error('Aucun dossier configuré. Choisissez-le dans les Paramètres.')
    const clientDir = join(folder, safeClientFileName(client.name))
    await fs.mkdir(clientDir, { recursive: true })
    const err = await shell.openPath(clientDir)
    if (err) throw new Error(err)
  })

  // ── Envoi du rapport par courriel (génère + attache + nettoie) ──────────────
  ipcMain.handle('reports:send-email', async (_e, payload: unknown) => {
    const { clientId, subject, body, kind } = SendReportSchema.parse(payload)
    const client = getDb().select().from(clients).where(eq(clients.id, clientId)).get()
    if (!client) throw new Error('Client introuvable.')

    const credentials = await getSmtpCredentials()
    if (!credentials) {
      throw new Error('Configuration SMTP incomplète. Configurez votre SMTP dans Paramètres.')
    }

    const stem = `${safeClientFileName(client.name)}-${todayISODate()}`
    const paths: string[] = []
    let attachments: { filename: string; path: string }[] = []
    try {
      if (kind === 'nutrition') {
        const nutriPath = await generateNutritionDocumentHtml(clientId)
        const foodlogPath = await generateFoodJournalHtml(clientId)
        paths.push(nutriPath, foodlogPath)
        attachments = [
          { filename: `Nutrition-${stem}.html`, path: nutriPath },
          { filename: `Journal-alimentaire-${stem}.html`, path: foodlogPath }
        ]
      } else {
        const pdfPath = await generateClientReportPdf(clientId)
        // Document interactif : autonome, hors ligne. Le PDF reste la pièce jointe
        // fiable — certains filtres courriel suppriment les pièces jointes .html.
        const htmlPath = await generateInteractiveReportHtml(clientId)
        paths.push(pdfPath, htmlPath)
        attachments = [
          { filename: `Bilan-${stem}.pdf`, path: pdfPath },
          { filename: `Bilan-interactif-${stem}.html`, path: htmlPath }
        ]
      }

      const transporter = nodemailer.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        auth: { user: credentials.user, pass: credentials.password }
      })
      await transporter.sendMail({
        from: credentials.user,
        to: client.email,
        subject,
        text: body,
        attachments
      })
      return { sentTo: client.email }
    } finally {
      for (const path of paths) {
        try {
          await fs.unlink(path)
        } catch {
          // best effort
        }
      }
    }
  })

}
