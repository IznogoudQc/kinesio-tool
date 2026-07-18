import { ipcMain } from 'electron'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { questionnaires, clients } from '../../db/schema'

/**
 * IPC des questionnaires d'admission d'un client — datés, avec historique.
 * `type` discrimine le formulaire ('qaap' pour l'instant). `data` est validé
 * de façon souple par type puis stocké en JSON.
 */

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (attendu AAAA-MM-JJ)')

// Q-AAP : 7 réponses tri-état (OUI=true / NON=false / non répondu=null) + textes.
const QaapDataSchema = z
  .object({
    answers: z.array(z.boolean().nullable()).length(7),
    precision: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional()
  })
  .strip()

// Objectifs & habitudes de vie : uniquement des champs texte libres, tous optionnels.
const ObjectifsDataSchema = z
  .object({
    objectif: z.string().max(2000).optional(),
    preferences: z.string().max(2000).optional(),
    activitePresente: z.string().max(2000).optional(),
    activitesPassees: z.string().max(2000).optional(),
    equipement: z.string().max(2000).optional(),
    sommeil: z.string().max(2000).optional(),
    alimentation: z.string().max(2000).optional(),
    travailHoraire: z.string().max(2000).optional(),
    planification: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional()
  })
  .strip()

// Questionnaire de santé : conditions, zones de tension (cases), restrictions.
const SanteDataSchema = z
  .object({
    conditions: z.string().max(2000).optional(),
    // Zones marquées sur la silhouette : id de région → sévérité.
    zonesSeverity: z.record(z.string().max(40), z.enum(['jaune', 'rouge'])).optional(),
    // Ancien format (cases à cocher) — accepté en lecture pour rétro-compat.
    zones: z.array(z.string().max(60)).max(40).optional(),
    zonesAutre: z.string().max(500).optional(),
    restrictions: z.boolean().nullable().optional(),
    restrictionsDetail: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional()
  })
  .strip()

const TYPE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  qaap: QaapDataSchema,
  objectifs: ObjectifsDataSchema,
  sante: SanteDataSchema
}

const QuestionnaireType = z.enum(['qaap', 'objectifs', 'sante'])

/** Valide `data` selon `type`. Rejette un type inconnu. */
function parseDataForType(type: string, data: unknown): unknown {
  const schema = TYPE_SCHEMAS[type]
  if (!schema) throw new Error(`Type de questionnaire inconnu : ${type}`)
  return schema.parse(data)
}

const CreateSchema = z.object({
  type: QuestionnaireType,
  date: IsoDate,
  data: z.unknown()
})

const UpdateSchema = z.object({
  date: IsoDate.optional(),
  data: z.unknown().optional()
})

function rowToQuestionnaire(row: typeof questionnaires.$inferSelect) {
  let data: unknown = {}
  try {
    data = JSON.parse(row.data)
  } catch {
    data = {}
  }
  return {
    id: row.id,
    clientId: row.clientId,
    type: row.type,
    date: row.date,
    data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

function assertClientExists(clientId: string): void {
  const client = getDb().select().from(clients).where(eq(clients.id, clientId)).get()
  if (!client) throw new Error('Client introuvable.')
}

export function registerQuestionnairesHandlers(): void {
  ipcMain.handle('questionnaires:list', (_e, clientId: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    const rows = getDb()
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.clientId, validId))
      .orderBy(asc(questionnaires.date))
      .all()
    // Plus récent en premier pour l'affichage.
    return rows.map(rowToQuestionnaire).reverse()
  })

  ipcMain.handle('questionnaires:create', (_e, clientId: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    assertClientExists(validId)
    const { type, date, data } = CreateSchema.parse(payload)
    const cleanData = parseDataForType(type, data)
    const db = getDb()
    const now = new Date().toISOString()
    const [row] = db
      .insert(questionnaires)
      .values({
        id: crypto.randomUUID(),
        clientId: validId,
        type,
        date,
        data: JSON.stringify(cleanData),
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .all()
    return rowToQuestionnaire(row)
  })

  ipcMain.handle('questionnaires:update', (_e, id: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(id)
    const patch = UpdateSchema.parse(payload)
    const db = getDb()
    const existing = db.select().from(questionnaires).where(eq(questionnaires.id, validId)).get()
    if (!existing) throw new Error('Questionnaire introuvable.')
    const nextData =
      patch.data !== undefined ? JSON.stringify(parseDataForType(existing.type, patch.data)) : existing.data
    const [row] = db
      .update(questionnaires)
      .set({
        date: patch.date ?? existing.date,
        data: nextData,
        updatedAt: new Date().toISOString()
      })
      .where(eq(questionnaires.id, validId))
      .returning()
      .all()
    return rowToQuestionnaire(row)
  })

  ipcMain.handle('questionnaires:delete', (_e, id: unknown) => {
    const validId = z.string().uuid().parse(id)
    getDb().delete(questionnaires).where(eq(questionnaires.id, validId)).run()
  })

  ipcMain.handle('questionnaires:get-by-id', (_e, id: unknown) => {
    const validId = z.string().uuid().parse(id)
    const row = getDb().select().from(questionnaires).where(eq(questionnaires.id, validId)).get()
    return row ? rowToQuestionnaire(row) : null
  })
}
