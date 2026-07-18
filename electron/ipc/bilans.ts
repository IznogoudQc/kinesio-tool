import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync, unlinkSync } from 'fs'
import { basename, extname } from 'path'
import { z } from 'zod'
import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, clients } from '../../db/schema'
import { parseBilanDocx } from '../lib/bilan-parser'
import { convertDocToDocx } from '../lib/doc-converter'
import { BILAN_FIELD_BOUNDS } from '../../src/lib/bilan-bounds'
import { mergeBilanData } from '../../src/lib/bilan-merge'

// Champ numérique optionnel, contraint aux bornes DURES de plausibilité du
// champ (src/lib/bilan-bounds.ts). Un champ sans bornes reste juste `finite`.
// Les bornes souples ne sont PAS appliquées ici — elles n'avertissent qu'en UI.
function bounded(key: string) {
  const b = BILAN_FIELD_BOUNDS[key]
  let s = z.number().finite()
  if (b?.hardMin !== undefined) s = s.min(b.hardMin, `${key} : valeur impossible (min ${b.hardMin})`)
  if (b?.hardMax !== undefined) s = s.max(b.hardMax, `${key} : valeur impossible (max ${b.hardMax})`)
  return s.optional()
}

// Mirrors BilanData from electron/lib/bilan-parser.ts — kept here as the IPC
// boundary validator so anything coming from the renderer is sanitized.
const BilanDataSchema = z
  .object({
    taille_cm: bounded('taille_cm'),
    poids_kg: bounded('poids_kg'),
    imc: bounded('imc'),
    tour_taille_cm: bounded('tour_taille_cm'),
    tour_hanche_cm: bounded('tour_hanche_cm'),
    circ_biceps_flechi_cm: bounded('circ_biceps_flechi_cm'),
    circ_cuisse_cm: bounded('circ_cuisse_cm'),
    circ_epaules_pec_cm: bounded('circ_epaules_pec_cm'),
    pli_triceps: bounded('pli_triceps'),
    pli_biceps: bounded('pli_biceps'),
    pli_sous_scap: bounded('pli_sous_scap'),
    pli_iliaque: bounded('pli_iliaque'),
    pli_mollet: bounded('pli_mollet'),
    pli_cuisse: bounded('pli_cuisse'),
    pourcentage_gras: bounded('pourcentage_gras'),
    vo2max: bounded('vo2max'),
    test_aerobie: z.string().max(200).optional(),
    aerobie_test_type: z.enum(['bruce', 'cooper', 'leger', 'manual']).optional(),
    bruce_duration_sec: bounded('bruce_duration_sec'),
    cardio_paliers: z
      .array(z.object({ fc: z.number().finite().optional(), perception: z.number().finite().optional() }))
      .max(12)
      .optional(),
    cooper_distance_m: bounded('cooper_distance_m'),
    leger_palier: bounded('leger_palier'),
    met_equivalent: bounded('met_equivalent'),
    fc_repos: bounded('fc_repos'),
    fc_max_predite: bounded('fc_max_predite'),
    pa_systolique: bounded('pa_systolique'),
    pa_diastolique: bounded('pa_diastolique'),
    recup_1min_pa_sys: bounded('recup_1min_pa_sys'),
    recup_1min_pa_dia: bounded('recup_1min_pa_dia'),
    recup_1min_fc: bounded('recup_1min_fc'),
    recup_3min_pa_sys: bounded('recup_3min_pa_sys'),
    recup_3min_pa_dia: bounded('recup_3min_pa_dia'),
    recup_3min_fc: bounded('recup_3min_fc'),
    recup_5min_pa_sys: bounded('recup_5min_pa_sys'),
    recup_5min_pa_dia: bounded('recup_5min_pa_dia'),
    recup_5min_fc: bounded('recup_5min_fc'),
    pushups: bounded('pushups'),
    situps: bounded('situps'),
    diastase: z.string().max(200).optional(),
    saut_depart_cm: bounded('saut_depart_cm'),
    saut_finale_cm: bounded('saut_finale_cm'),
    saut_vertical_cm: bounded('saut_vertical_cm'),
    puissance_jambes_watts: bounded('puissance_jambes_watts'),
    puissance_calculated_auto: z.boolean().optional(),
    flexion_tronc_cm: bounded('flexion_tronc_cm'),
    endurance_dos_sec: bounded('endurance_dos_sec'),
    score_composition: bounded('score_composition'),
    indice_sante_dos: bounded('indice_sante_dos'),
    score_musculo_global: bounded('score_musculo_global'),
    score_global: bounded('score_global'),
    notes: z.string().max(5000).optional(),
    objectif: z.string().max(2000).optional()
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
  //  - existant → FUSION : le .docx fait autorité sur les champs qu'il contient,
  //    les autres gardent leur valeur en base (cf. `mergeBilanData`). Permet de
  //    réimporter un bilan corrigé sans perdre les champs absents du fichier.
  //  - rien n'a changé → on ignore silencieusement
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
      const { data: merged, changedKeys } = mergeBilanData(parseData(existing.data), item.data)
      if (changedKeys.length > 0) {
        db.update(bilans).set({ data: JSON.stringify(merged) }).where(eq(bilans.id, existing.id)).run()
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
