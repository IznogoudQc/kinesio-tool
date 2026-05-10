import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync, promises as fs } from 'fs'
import { basename } from 'path'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, clients, mesuresCirconferences, mesuresPlisCutanes } from '../../db/schema'
import {
  generateClientReportPdf,
  loadClientBundle,
  safeClientFileName,
  todayISODate
} from '../lib/report-generator'
import { getSmtpCredentials } from './settings'

const ClientIdSchema = z.string().uuid()

// ── Schéma d'un fichier .kinesio (volontairement tolérant — c'est un outil de test/backup) ──
const fin = z.number().finite()
const cmOrNull = z.union([fin, z.null()]).optional()
const strOrNull = z.union([z.string(), z.null()]).optional()

const KinesioBundleSchema = z.object({
  version: z.string().optional(),
  exportedAt: z.string().optional(),
  client: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    birthdate: strOrNull,
    sex: z.union([z.enum(['F', 'M']), z.null()]).optional(),
    unitLength: z.enum(['cm', 'in']).optional(),
    unitWeight: z.enum(['kg', 'lb']).optional()
  }),
  bilans: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        data: z.record(z.unknown()).optional(),
        source: z.string().optional(),
        createdAt: z.string().optional()
      })
    )
    .optional()
    .default([]),
  mesures_circonferences: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        poidsKg: cmOrNull,
        cou: cmOrNull,
        epaule: cmOrNull,
        // Legacy : anciens fichiers .kinesio exportaient deux mesures d'épaule (G/D),
        // désormais fusionnées en une seule — voir le calcul de `epaule` à l'import.
        epauleG: cmOrNull,
        epauleD: cmOrNull,
        bicepsG: cmOrNull,
        bicepsD: cmOrNull,
        poitrine: cmOrNull,
        taille: cmOrNull,
        abdomen: cmOrNull,
        hanche: cmOrNull,
        cuisseG: cmOrNull,
        cuisseD: cmOrNull,
        molletG: cmOrNull,
        molletD: cmOrNull,
        notes: strOrNull,
        createdAt: z.string().optional()
      })
    )
    .optional()
    .default([]),
  mesures_plis_cutanes: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        triceps: fin,
        biceps: fin,
        sousscapulaire: fin,
        iliaque: fin,
        somme4Plis: fin,
        densiteCorporelle: fin,
        pourcentageGrasSiri: fin,
        pourcentageGrasBrozek: fin,
        ageAuCalcul: z.number().int(),
        sexeAuCalcul: z.string(),
        notes: strOrNull,
        createdAt: z.string().optional()
      })
    )
    .optional()
    .default([])
})

const ImportPayloadSchema = z.object({
  filePath: z.string().min(1),
  mode: z.enum(['create', 'merge']).optional()
})

const SendReportSchema = z.object({
  clientId: ClientIdSchema,
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(20000)
})

const CIRC_FIELDS = [
  'cou', 'epaule', 'bicepsG', 'bicepsD', 'poitrine',
  'taille', 'abdomen', 'hanche', 'cuisseG', 'cuisseD', 'molletG', 'molletD'
] as const

function activeWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

export function registerReportsHandlers(): void {
  // ── Génération du rapport PDF ────────────────────────────────────────────────
  ipcMain.handle('reports:generate-pdf', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    return generateClientReportPdf(id)
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
    try {
      pdfPath = await generateClientReportPdf(clientId)
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
        attachments: [{ filename: `Bilan-${safeClientFileName(client.name)}-${todayISODate()}.pdf`, path: pdfPath }]
      })
      return { sentTo: client.email }
    } finally {
      if (pdfPath) {
        try {
          await fs.unlink(pdfPath)
        } catch {
          // best effort
        }
      }
    }
  })

  // ── Export JSON (.kinesio) ──────────────────────────────────────────────────
  ipcMain.handle('reports:export-json', async (_e, clientId: unknown) => {
    const id = ClientIdSchema.parse(clientId)
    const bundle = loadClientBundle(id)
    const win = activeWindow()
    const defaultName = `${safeClientFileName(bundle.client.name)}-export-${todayISODate()}.kinesio`
    const options = {
      title: 'Exporter le dossier client',
      defaultPath: defaultName,
      filters: [{ name: 'Dossier Kinésio', extensions: ['kinesio'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { canceled: true as const }
    await fs.writeFile(result.filePath, JSON.stringify(bundle, null, 2), 'utf-8')
    return { filePath: result.filePath }
  })

  // ── Sélection d'un fichier .kinesio à importer ──────────────────────────────
  ipcMain.handle('reports:pick-import-file', async () => {
    const win = activeWindow()
    const options = {
      title: 'Importer un dossier client (.kinesio)',
      filters: [{ name: 'Dossier Kinésio', extensions: ['kinesio', 'json'] }],
      properties: ['openFile' as const]
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return { canceled: true as const }
    const filePath = result.filePaths[0]
    return { canceled: false as const, filePath, fileName: basename(filePath) }
  })

  // ── Import JSON (.kinesio) → recrée le client + ses données ─────────────────
  ipcMain.handle('reports:import-json', async (_e, payload: unknown) => {
    const { filePath, mode } = ImportPayloadSchema.parse(payload)
    if (!existsSync(filePath)) throw new Error('Le fichier sélectionné est introuvable.')

    let raw: string
    try {
      raw = await fs.readFile(filePath, 'utf-8')
    } catch {
      throw new Error('Impossible de lire le fichier sélectionné.')
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('Fichier .kinesio invalide (JSON illisible).')
    }
    const bundle = KinesioBundleSchema.parse(parsed)

    const db = getDb()
    const existing = db.select().from(clients).where(eq(clients.email, bundle.client.email)).get()
    if (existing && !mode) {
      return { status: 'conflict' as const, existingName: existing.name }
    }

    const now = new Date().toISOString()
    let targetId: string
    if (existing && mode === 'merge') {
      targetId = existing.id
      const birthdate = existing.birthdate ?? bundle.client.birthdate ?? null
      const sex = existing.sex ?? bundle.client.sex ?? null
      if (birthdate !== existing.birthdate || sex !== existing.sex) {
        db.update(clients).set({ birthdate, sex, updatedAt: now }).where(eq(clients.id, targetId)).run()
      }
    } else {
      targetId = crypto.randomUUID()
      db.insert(clients)
        .values({
          id: targetId,
          name: bundle.client.name,
          email: bundle.client.email,
          birthdate: bundle.client.birthdate ?? null,
          sex: bundle.client.sex ?? null,
          unitLength: bundle.client.unitLength ?? 'cm',
          unitWeight: bundle.client.unitWeight ?? 'kg',
          createdAt: now,
          updatedAt: now
        })
        .run()
    }

    const existingBilanDates =
      existing && mode === 'merge'
        ? new Set(db.select().from(bilans).where(eq(bilans.clientId, targetId)).all().map(b => b.date))
        : new Set<string>()

    for (const b of bundle.bilans) {
      if (existingBilanDates.has(b.date)) continue
      const source = b.source === 'import_docx' || b.source === 'manuel' ? b.source : 'manuel'
      db.insert(bilans)
        .values({
          id: crypto.randomUUID(),
          clientId: targetId,
          date: b.date,
          data: JSON.stringify(b.data ?? {}),
          source,
          createdAt: b.createdAt ?? now
        })
        .run()
    }

    for (const m of bundle.mesures_circonferences) {
      const fields = {} as Record<(typeof CIRC_FIELDS)[number], number | null>
      for (const f of CIRC_FIELDS) fields[f] = m[f] ?? null
      // Legacy : si le fichier a les anciennes mesures d'épaule G/D, les fusionner
      // (moyenne si les deux existent, sinon celle qui existe).
      if (fields.epaule == null) {
        const g = m.epauleG ?? null
        const d = m.epauleD ?? null
        fields.epaule = g != null && d != null ? (g + d) / 2 : g ?? d
      }
      db.insert(mesuresCirconferences)
        .values({
          id: crypto.randomUUID(),
          clientId: targetId,
          date: m.date,
          poidsKg: m.poidsKg ?? null,
          ...fields,
          notes: m.notes ?? null,
          createdAt: m.createdAt ?? now
        })
        .run()
    }

    for (const m of bundle.mesures_plis_cutanes) {
      db.insert(mesuresPlisCutanes)
        .values({
          id: crypto.randomUUID(),
          clientId: targetId,
          date: m.date,
          triceps: m.triceps,
          biceps: m.biceps,
          sousscapulaire: m.sousscapulaire,
          iliaque: m.iliaque,
          somme4Plis: m.somme4Plis,
          densiteCorporelle: m.densiteCorporelle,
          pourcentageGrasSiri: m.pourcentageGrasSiri,
          pourcentageGrasBrozek: m.pourcentageGrasBrozek,
          ageAuCalcul: m.ageAuCalcul,
          sexeAuCalcul: m.sexeAuCalcul,
          notes: m.notes ?? null,
          createdAt: m.createdAt ?? now
        })
        .run()
    }

    return { status: 'ok' as const, clientId: targetId }
  })
}
