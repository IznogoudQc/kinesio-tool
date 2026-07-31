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
  generateQaapPdf,
  generateClientReportPdf,
  htmlFileToPdf,
  safeClientFileName,
  todayISODate
} from '../lib/report-generator'
import { generateFoodJournalHtml, generateInteractiveReportHtml, generateNutritionDocumentHtml } from '../lib/standalone-report'
import { getDocumentsFolder, getSmtpCredentials } from './settings'
import { CLIENT_FOLDERS, CLIENT_FOLDER_NAMES } from '../../src/lib/client-folders'
import { asQaapData, qaapIsSigned } from '../../src/lib/qaap'
import { questionnaires } from '../../db/schema'

const ClientIdSchema = z.string().uuid()

/** Crée le dossier du client et ses trois sous-dossiers. Idempotent. */
async function ensureClientFolders(clientDir: string): Promise<void> {
  await fs.mkdir(clientDir, { recursive: true })
  for (const nom of CLIENT_FOLDER_NAMES) {
    await fs.mkdir(join(clientDir, nom), { recursive: true })
  }
}

/** Arguments des generateurs de rapport. `bilanId` absent = bilan de synthese
 *  (toutes les valeurs les plus recentes), comme avant. Fourni = rapport de CE
 *  bilan-la, avec l'historique borne a sa date. */
const ReportArgsSchema = z.object({
  clientId: ClientIdSchema,
  bilanId: z.string().uuid().optional()
})

const SendReportSchema = z.object({
  clientId: ClientIdSchema,
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(20000),
  /** `bilan` (défaut) = PDF + document interactif ; `nutrition` = document nutrition seul. */
  kind: z.enum(['bilan', 'nutrition']).optional()
})

export function registerReportsHandlers(): void {
  // ── Génération du rapport PDF ────────────────────────────────────────────────
  ipcMain.handle('reports:generate-pdf', async (_e, args: unknown) => {
    const { clientId, bilanId } = ReportArgsSchema.parse(args)
    return generateClientReportPdf(clientId, bilanId)
  })

  // Génère le PDF « Barèmes de référence » (aucun paramètre — lit le code).
  // Document interactif seul — même fichier que celui joint au courriel.
  // Q-AAP signé — le nom du client sert uniquement à nommer le fichier.
  ipcMain.handle('reports:generate-qaap', async (_e, args: unknown) => {
    const { questionnaireId, clientName } = z
      .object({ questionnaireId: z.string().uuid(), clientName: z.string().min(1) })
      .parse(args)
    return generateQaapPdf(questionnaireId, clientName)
  })

  ipcMain.handle('reports:generate-html', async (_e, args: unknown) => {
    const { clientId, bilanId } = ReportArgsSchema.parse(args)
    return generateInteractiveReportHtml(clientId, bilanId)
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
    // Les trois sous-dossiers sont créés même si une étape échoue : Marie doit
    // retrouver la même structure chez tous ses clients, pas un dossier dont
    // l'arborescence dépend de ce qui a pu être généré ce jour-là.
    await ensureClientFolders(clientDir)
    const stem = `${safeClientFileName(client.name)}-${todayISODate()}`
    const dirBilans = join(clientDir, CLIENT_FOLDERS.bilans)
    const dirNutrition = join(clientDir, CLIENT_FOLDERS.nutrition)
    const dirQuestionnaires = join(clientDir, CLIENT_FOLDERS.questionnaires)

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
      await fs.copyFile(p, join(dirBilans, `Bilan-${stem}.pdf`))
      written++
    })
    await step(async () => {
      const p = await generateInteractiveReportHtml(id)
      temps.push(p)
      await fs.copyFile(p, join(dirBilans, `Bilan-interactif-${stem}.html`))
      written++
    })

    let nutriHtml: string | null = null
    await step(async () => {
      const p = await generateNutritionDocumentHtml(id)
      temps.push(p)
      nutriHtml = p
      await fs.copyFile(p, join(dirNutrition, `Nutrition-${stem}.html`))
      written++
    })
    await step(async () => {
      if (!nutriHtml) return
      const buf = await htmlFileToPdf(nutriHtml)
      await fs.writeFile(join(dirNutrition, `Nutrition-${stem}.pdf`), buf)
      written++
    })

    await step(async () => {
      const p = await generateFoodJournalHtml(id)
      temps.push(p)
      await fs.copyFile(p, join(dirNutrition, `Journal-alimentaire-${stem}.html`))
      written++
    })

    // Q-AAP signés — « Télécharger tous les documents » doit vraiment tout
    // prendre. Les non signés sont ignorés : un formulaire d'attestation sans
    // signature n'a pas sa place dans le dossier archivé.
    await step(async () => {
      const qs = getDb().select().from(questionnaires).where(eq(questionnaires.clientId, id)).all()
      for (const q of qs) {
        if (q.type !== 'qaap' || !qaapIsSigned(asQaapData(q.data))) continue
        const p = await generateQaapPdf(q.id, client.name)
        temps.push(p)
        await fs.copyFile(p, join(dirQuestionnaires, `Q-AAP-${q.date}.pdf`))
        written++
      }
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

  /**
   * Archive un Q-AAP SIGNÉ dans « Questionnaires et Notes » du dossier client.
   *
   * Appelé automatiquement à l'enregistrement du questionnaire. Le refus d'un
   * Q-AAP non signé est vérifié ICI aussi, et pas seulement dans l'interface :
   * la règle « on n'archive pas une attestation sans signature » est le cœur de
   * la fonctionnalité, elle ne doit pas dépendre d'un écran.
   */
  ipcMain.handle('reports:archive-qaap', async (_e, args: unknown) => {
    const { questionnaireId } = z.object({ questionnaireId: z.string().uuid() }).parse(args)
    const db = getDb()
    const q = db.select().from(questionnaires).where(eq(questionnaires.id, questionnaireId)).get()
    if (!q) throw new Error('Questionnaire introuvable.')
    if (q.type !== 'qaap') throw new Error("Ce document n'est pas un Q-AAP.")
    if (!qaapIsSigned(asQaapData(q.data))) {
      throw new Error("Le Q-AAP n'est pas signé — il n'a pas été archivé.")
    }

    const client = db.select().from(clients).where(eq(clients.id, q.clientId)).get()
    if (!client) throw new Error('Client introuvable.')
    const folder = await getDocumentsFolder()
    if (!folder) throw new Error('Aucun dossier configuré. Choisissez-le dans les Paramètres.')

    const clientDir = join(folder, safeClientFileName(client.name))
    await ensureClientFolders(clientDir)
    const dest = join(clientDir, CLIENT_FOLDERS.questionnaires, `Q-AAP-${q.date}.pdf`)

    const temp = await generateQaapPdf(q.id, client.name)
    try {
      await fs.copyFile(temp, dest)
    } finally {
      try {
        await fs.unlink(temp)
      } catch {
        // best effort
      }
    }
    return { path: dest }
  })

  // Ouvre le sous-dossier du client dans l'explorateur (le crée au besoin).
  ipcMain.handle('reports:open-client-folder', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    const client = getDb().select().from(clients).where(eq(clients.id, id)).get()
    if (!client) throw new Error('Client introuvable.')
    const folder = await getDocumentsFolder()
    if (!folder) throw new Error('Aucun dossier configuré. Choisissez-le dans les Paramètres.')
    const clientDir = join(folder, safeClientFileName(client.name))
    await ensureClientFolders(clientDir)
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
