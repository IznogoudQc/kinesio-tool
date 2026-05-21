import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync, unlinkSync } from 'fs'
import { basename, extname } from 'path'
import { z } from 'zod'
import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, clients } from '../../db/schema'
import { parseBilanDocx } from '../lib/bilan-parser'
import { convertDocToDocx } from '../lib/doc-converter'

const numberOrUndef = z.number().finite().optional()

// Mirrors BilanData from electron/lib/bilan-parser.ts — kept here as the IPC
// boundary validator so anything coming from the renderer is sanitized.
const BilanDataSchema = z
  .object({
    taille_cm: numberOrUndef,
    poids_kg: numberOrUndef,
    imc: numberOrUndef,
    tour_taille_cm: numberOrUndef,
    tour_hanche_cm: numberOrUndef,
    pli_triceps: numberOrUndef,
    pli_biceps: numberOrUndef,
    pli_sous_scap: numberOrUndef,
    pli_iliaque: numberOrUndef,
    pli_mollet: numberOrUndef,
    pli_cuisse: numberOrUndef,
    pourcentage_gras: numberOrUndef,
    vo2max: numberOrUndef,
    test_aerobie: z.string().max(200).optional(),
    aerobie_test_type: z.enum(['bruce', 'cooper', 'leger', 'manual']).optional(),
    bruce_duration_sec: numberOrUndef,
    cooper_distance_m: numberOrUndef,
    leger_palier: numberOrUndef,
    met_equivalent: numberOrUndef,
    fc_repos: numberOrUndef,
    fc_max_predite: numberOrUndef,
    pa_systolique: numberOrUndef,
    pa_diastolique: numberOrUndef,
    recup_1min_pa_sys: numberOrUndef,
    recup_1min_pa_dia: numberOrUndef,
    recup_1min_fc: numberOrUndef,
    recup_3min_pa_sys: numberOrUndef,
    recup_3min_pa_dia: numberOrUndef,
    recup_3min_fc: numberOrUndef,
    recup_5min_pa_sys: numberOrUndef,
    recup_5min_pa_dia: numberOrUndef,
    recup_5min_fc: numberOrUndef,
    pushups: numberOrUndef,
    situps: numberOrUndef,
    saut_vertical_cm: numberOrUndef,
    puissance_jambes_watts: numberOrUndef,
    puissance_calculated_auto: z.boolean().optional(),
    flexion_tronc_cm: numberOrUndef,
    endurance_dos_sec: numberOrUndef,
    score_composition: numberOrUndef,
    indice_sante_dos: numberOrUndef,
    score_musculo_global: numberOrUndef,
    score_global: numberOrUndef,
    notes: z.string().max(5000).optional()
  })
  .strip()

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (attendu AAAA-MM-JJ)')

const CreateBilanSchema = z.object({
  date: IsoDateSchema,
  data: BilanDataSchema,
  source: z.enum(['import_docx', 'manuel']).default('manuel')
})

const UpdateBilanSchema = z.object({
  date: IsoDateSchema.optional(),
  data: BilanDataSchema.optional()
})

const ImportBilansSchema = z.object({
  clientId: z.string().uuid(),
  bilans: z.array(z.object({ date: IsoDateSchema, data: BilanDataSchema })).min(1).max(50)
})

/** Compte les champs renseignés (non vides) d'un objet de données de bilan. */
function countFilled(data: unknown): number {
  if (!data || typeof data !== 'object') return 0
  return Object.values(data as Record<string, unknown>).filter(v => v !== undefined && v !== null && v !== '').length
}

function parseData(raw: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function rowToBilan(row: typeof bilans.$inferSelect) {
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
}

function assertClientExists(clientId: string): void {
  const client = getDb().select().from(clients).where(eq(clients.id, clientId)).get()
  if (!client) throw new Error('Client introuvable.')
}

export function registerBilansHandlers(): void {
  ipcMain.handle('bilans:pick-docx', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const dialogOptions = {
      title: 'Choisir un bilan (.doc, .docx)',
      filters: [{ name: 'Documents Word', extensions: ['doc', 'docx'] }],
      properties: ['openFile' as const]
    }
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    return { canceled: false, fileName: basename(filePath), filePath }
  })

  ipcMain.handle('bilans:parse-docx', async (_e, clientId: unknown, filePath: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    assertClientExists(validId)
    if (typeof filePath !== 'string' || filePath.length === 0 || !existsSync(filePath)) {
      throw new Error('Le fichier sélectionné est introuvable.')
    }
    const ext = extname(filePath).toLowerCase()
    if (ext !== '.doc' && ext !== '.docx') {
      throw new Error('Format non supporté — choisissez un fichier .doc ou .docx.')
    }

    // Les .doc (ancien format binaire) sont d'abord convertis en .docx via Word ou LibreOffice.
    let parsablePath = filePath
    let tempPath: string | null = null
    if (ext === '.doc') {
      tempPath = await convertDocToDocx(filePath)
      parsablePath = tempPath
    }

    try {
      const parsed = await parseBilanDocx(parsablePath)
      return { extracted: parsed.current, historical: parsed.history }
    } finally {
      if (tempPath && existsSync(tempPath)) {
        try {
          unlinkSync(tempPath)
        } catch {
          // best effort
        }
      }
    }
  })

  ipcMain.handle('bilans:create', (_e, clientId: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    assertClientExists(validId)
    const { date, data, source } = CreateBilanSchema.parse(payload)
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const [row] = db
      .insert(bilans)
      .values({ id, clientId: validId, date, data: JSON.stringify(data), source, createdAt: now })
      .returning()
      .all()
    return rowToBilan(row)
  })

  // Import par lot avec déduplication sur (client_id, date) :
  //  - pas d'existant → INSERT
  //  - existant moins complet que le nouveau → UPDATE (on garde le plus riche)
  //  - sinon → on ignore silencieusement
  ipcMain.handle('bilans:import', (_e, payload: unknown) => {
    const { clientId, bilans: incoming } = ImportBilansSchema.parse(payload)
    assertClientExists(clientId)
    const db = getDb()
    const now = new Date().toISOString()
    let imported = 0
    let updated = 0
    let skipped = 0
    for (const item of incoming) {
      const existing = db
        .select()
        .from(bilans)
        .where(and(eq(bilans.clientId, clientId), eq(bilans.date, item.date)))
        .get()
      if (!existing) {
        db.insert(bilans)
          .values({
            id: crypto.randomUUID(),
            clientId,
            date: item.date,
            data: JSON.stringify(item.data),
            source: 'import_docx',
            createdAt: now
          })
          .run()
        imported++
        continue
      }
      if (countFilled(item.data) > countFilled(parseData(existing.data))) {
        db.update(bilans).set({ data: JSON.stringify(item.data) }).where(eq(bilans.id, existing.id)).run()
        updated++
      } else {
        skipped++
      }
    }
    return { imported, updated, skipped }
  })

  ipcMain.handle('bilans:delete', (_e, id: unknown) => {
    const validId = z.string().uuid().parse(id)
    getDb().delete(bilans).where(eq(bilans.id, validId)).run()
  })

  // Nettoyage des doublons d'un client : pour chaque date ayant >1 bilan, on garde
  // le plus complet (en y fusionnant les champs absents trouvés sur les autres),
  // puis on supprime les autres.
  ipcMain.handle('bilans:dedupe', (_e, clientId: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    const db = getDb()
    const rows = db.select().from(bilans).where(eq(bilans.clientId, validId)).orderBy(asc(bilans.createdAt)).all()
    const byDate = new Map<string, typeof rows>()
    for (const r of rows) {
      const arr = byDate.get(r.date)
      if (arr) arr.push(r)
      else byDate.set(r.date, [r])
    }
    let groups = 0
    let removed = 0
    for (const group of byDate.values()) {
      if (group.length < 2) continue
      groups++
      const ranked = group
        .map(r => ({ row: r, data: parseData(r.data) }))
        .map(x => ({ ...x, count: countFilled(x.data) }))
        .sort((a, b) => b.count - a.count)
      const keeper = ranked[0]
      const merged: Record<string, unknown> = { ...keeper.data }
      for (let i = 1; i < ranked.length; i++) {
        for (const [k, v] of Object.entries(ranked[i].data)) {
          const cur = merged[k]
          if ((cur === undefined || cur === null || cur === '') && v !== undefined && v !== null && v !== '') {
            merged[k] = v
          }
        }
      }
      if (countFilled(merged) > keeper.count) {
        db.update(bilans).set({ data: JSON.stringify(merged) }).where(eq(bilans.id, keeper.row.id)).run()
      }
      for (let i = 1; i < ranked.length; i++) {
        db.delete(bilans).where(eq(bilans.id, ranked[i].row.id)).run()
        removed++
      }
    }
    return { groups, removed }
  })

  ipcMain.handle('bilans:update', (_e, id: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(id)
    const patch = UpdateBilanSchema.parse(payload)
    const db = getDb()
    const existing = db.select().from(bilans).where(eq(bilans.id, validId)).get()
    if (!existing) throw new Error('Bilan introuvable.')
    const next = {
      date: patch.date ?? existing.date,
      data: patch.data ? JSON.stringify(patch.data) : existing.data
    }
    const [row] = db.update(bilans).set(next).where(eq(bilans.id, validId)).returning().all()
    return rowToBilan(row)
  })

  ipcMain.handle('bilans:list', (_e, clientId: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    const rows = getDb()
      .select()
      .from(bilans)
      .where(eq(bilans.clientId, validId))
      .orderBy(asc(bilans.date))
      .all()
    // Most recent first for display.
    return rows.map(rowToBilan).reverse()
  })

  ipcMain.handle('bilans:get-by-id', (_e, id: unknown) => {
    const validId = z.string().uuid().parse(id)
    const row = getDb().select().from(bilans).where(eq(bilans.id, validId)).get()
    return row ? rowToBilan(row) : null
  })
}
