import { ipcMain, shell } from 'electron'
import { promises as fs } from 'fs'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { clients } from '../../db/schema'
import {
  generateBaremesPdf,
  generateClientReportPdf,
  safeClientFileName,
  todayISODate
} from '../lib/report-generator'
import { generateInteractiveReportHtml, generateNutritionDocumentHtml } from '../lib/standalone-report'
import { getSmtpCredentials } from './settings'

const ClientIdSchema = z.string().uuid()

const SendReportSchema = z.object({
  clientId: ClientIdSchema,
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(20000)
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

  ipcMain.handle('reports:generate-baremes', async () => {
    return generateBaremesPdf()
  })

  // Ouvre un fichier local avec l'application par défaut du système.
  ipcMain.handle('reports:open-path', async (_e, filePath: unknown) => {
    const p = z.string().min(1).parse(filePath)
    const err = await shell.openPath(p)
    if (err) throw new Error(err)
  })

  // ── Envoi du rapport par courriel (génère + attache + nettoie) ──────────────
  ipcMain.handle('reports:send-email', async (_e, payload: unknown) => {
    const { clientId, subject, body } = SendReportSchema.parse(payload)
    const client = getDb().select().from(clients).where(eq(clients.id, clientId)).get()
    if (!client) throw new Error('Client introuvable.')

    const credentials = await getSmtpCredentials()
    if (!credentials) {
      throw new Error('Configuration SMTP incomplète. Configurez votre SMTP dans Paramètres.')
    }

    let pdfPath: string | null = null
    let htmlPath: string | null = null
    try {
      pdfPath = await generateClientReportPdf(clientId)
      // Document interactif : autonome, hors ligne. Le PDF reste la pièce jointe
      // fiable — certains filtres courriel suppriment les pièces jointes .html.
      htmlPath = await generateInteractiveReportHtml(clientId)

      const stem = `${safeClientFileName(client.name)}-${todayISODate()}`
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
        attachments: [
          { filename: `Bilan-${stem}.pdf`, path: pdfPath },
          { filename: `Bilan-interactif-${stem}.html`, path: htmlPath }
        ]
      })
      return { sentTo: client.email }
    } finally {
      for (const path of [pdfPath, htmlPath]) {
        if (!path) continue
        try {
          await fs.unlink(path)
        } catch {
          // best effort
        }
      }
    }
  })

}
