import { ipcMain } from 'electron'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { clients, mesuresCirconferences, mesuresPlisCutanes } from '../../db/schema'
import { calculateAge, calculateBodyFat, type Sex } from '../../src/lib/body-fat-calculator'

// Date ISO `AAAA-MM-JJ` qui ne peut pas être dans le futur. Le contrôle UI
// (`max={today}` sur l'input) couvre 99 % des cas, mais un copier-coller manuel
// pourrait sinon passer outre.
const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (attendu AAAA-MM-JJ)')
  .refine(d => d <= todayISO(), 'La date de la mesure ne peut pas être dans le futur.')

const cm = z.number().positive('Valeur invalide').max(400).optional()
const kg = z.number().positive('Valeur invalide').max(500).optional()
const mm = z.number().positive('Valeur invalide').max(100)

const CIRC_FIELDS = [
  'cou', 'epaule', 'bicepsG', 'bicepsD', 'poitrine',
  'taille', 'abdomen', 'hanche', 'cuisseG', 'cuisseD', 'molletG', 'molletD'
] as const

const CircDataSchema = z
  .object({
    date: IsoDateSchema.optional(),
    // poidsKg : toujours reçu en kg (la conversion lb se fait côté UI).
    poidsKg: kg,
    cou: cm, epaule: cm, bicepsG: cm, bicepsD: cm, poitrine: cm,
    taille: cm, abdomen: cm, hanche: cm, cuisseG: cm, cuisseD: cm, molletG: cm, molletD: cm,
    notes: z.string().max(2000).optional()
  })
  .strip()

const PlisDataSchema = z
  .object({
    date: IsoDateSchema.optional(),
    triceps: mm,
    biceps: mm,
    sousscapulaire: mm,
    iliaque: mm,
    notes: z.string().max(2000).optional()
  })
  .strip()

function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function getClientOrThrow(clientId: string): typeof clients.$inferSelect {
  const client = getDb().select().from(clients).where(eq(clients.id, clientId)).get()
  if (!client) throw new Error('Client introuvable.')
  return client
}

function requireSex(client: typeof clients.$inferSelect): Sex {
  if (client.sex === 'F' || client.sex === 'M') return client.sex
  throw new Error('Le sexe du client doit être renseigné pour calculer le pourcentage de gras.')
}

function requireAge(client: typeof clients.$inferSelect): number {
  if (!client.birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(client.birthdate)) {
    throw new Error('La date de naissance du client doit être renseignée pour calculer le pourcentage de gras.')
  }
  const age = calculateAge(client.birthdate)
  if (!Number.isFinite(age) || age <= 0 || age > 120) {
    throw new Error('Date de naissance invalide.')
  }
  return age
}

/** Construit l'objet des 13 champs de circonférence avec `null` pour les absents. */
function circMeasurements(data: z.infer<typeof CircDataSchema>): Record<(typeof CIRC_FIELDS)[number], number | null> {
  const out = {} as Record<(typeof CIRC_FIELDS)[number], number | null>
  for (const f of CIRC_FIELDS) out[f] = data[f] ?? null
  return out
}

export function registerMesuresHandlers(): void {
  // ── Circonférences ──────────────────────────────────────────────────────────
  ipcMain.handle('mesures:circ:list', (_e, clientId: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    return getDb()
      .select()
      .from(mesuresCirconferences)
      .where(eq(mesuresCirconferences.clientId, validId))
      .orderBy(desc(mesuresCirconferences.date), desc(mesuresCirconferences.createdAt))
      .all()
  })

  ipcMain.handle('mesures:circ:create', (_e, clientId: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    getClientOrThrow(validId)
    const data = CircDataSchema.parse(payload)
    const now = new Date().toISOString()
    const [row] = getDb()
      .insert(mesuresCirconferences)
      .values({
        id: crypto.randomUUID(),
        clientId: validId,
        date: data.date ?? todayISO(),
        poidsKg: data.poidsKg ?? null,
        ...circMeasurements(data),
        notes: data.notes ?? null,
        createdAt: now
      })
      .returning()
      .all()
    return row
  })

  ipcMain.handle('mesures:circ:update', (_e, id: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(id)
    const data = CircDataSchema.parse(payload)
    const db = getDb()
    const existing = db.select().from(mesuresCirconferences).where(eq(mesuresCirconferences.id, validId)).get()
    if (!existing) throw new Error('Mesure introuvable.')
    const [row] = db
      .update(mesuresCirconferences)
      .set({
        date: data.date ?? existing.date,
        poidsKg: data.poidsKg ?? null,
        ...circMeasurements(data),
        notes: data.notes ?? null
      })
      .where(eq(mesuresCirconferences.id, validId))
      .returning()
      .all()
    return row
  })

  ipcMain.handle('mesures:circ:delete', (_e, id: unknown) => {
    const validId = z.string().uuid().parse(id)
    getDb().delete(mesuresCirconferences).where(eq(mesuresCirconferences.id, validId)).run()
  })

  // ── Plis cutanés (calcul du % gras côté main) ───────────────────────────────
  ipcMain.handle('mesures:plis:list', (_e, clientId: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    return getDb()
      .select()
      .from(mesuresPlisCutanes)
      .where(eq(mesuresPlisCutanes.clientId, validId))
      .orderBy(desc(mesuresPlisCutanes.date), desc(mesuresPlisCutanes.createdAt))
      .all()
  })

  ipcMain.handle('mesures:plis:create', (_e, clientId: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    const client = getClientOrThrow(validId)
    const sex = requireSex(client)
    const age = requireAge(client)
    const data = PlisDataSchema.parse(payload)
    const calc = calculateBodyFat(
      { triceps: data.triceps, biceps: data.biceps, sousscapulaire: data.sousscapulaire, iliaque: data.iliaque },
      age,
      sex
    )
    const now = new Date().toISOString()
    const [row] = getDb()
      .insert(mesuresPlisCutanes)
      .values({
        id: crypto.randomUUID(),
        clientId: validId,
        date: data.date ?? todayISO(),
        triceps: data.triceps,
        biceps: data.biceps,
        sousscapulaire: data.sousscapulaire,
        iliaque: data.iliaque,
        somme4Plis: calc.sumPlis,
        densiteCorporelle: calc.density,
        pourcentageGrasSiri: calc.bodyFatSiri,
        pourcentageGrasBrozek: calc.bodyFatBrozek,
        ageAuCalcul: age,
        sexeAuCalcul: sex,
        notes: data.notes ?? null,
        createdAt: now
      })
      .returning()
      .all()
    return row
  })

  ipcMain.handle('mesures:plis:update', (_e, id: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(id)
    const data = PlisDataSchema.parse(payload)
    const db = getDb()
    const existing = db.select().from(mesuresPlisCutanes).where(eq(mesuresPlisCutanes.id, validId)).get()
    if (!existing) throw new Error('Mesure introuvable.')
    const client = getClientOrThrow(existing.clientId)
    const sex = requireSex(client)
    const age = requireAge(client)
    const calc = calculateBodyFat(
      { triceps: data.triceps, biceps: data.biceps, sousscapulaire: data.sousscapulaire, iliaque: data.iliaque },
      age,
      sex
    )
    const [row] = db
      .update(mesuresPlisCutanes)
      .set({
        date: data.date ?? existing.date,
        triceps: data.triceps,
        biceps: data.biceps,
        sousscapulaire: data.sousscapulaire,
        iliaque: data.iliaque,
        somme4Plis: calc.sumPlis,
        densiteCorporelle: calc.density,
        pourcentageGrasSiri: calc.bodyFatSiri,
        pourcentageGrasBrozek: calc.bodyFatBrozek,
        ageAuCalcul: age,
        sexeAuCalcul: sex,
        notes: data.notes ?? null
      })
      .where(eq(mesuresPlisCutanes.id, validId))
      .returning()
      .all()
    return row
  })

  ipcMain.handle('mesures:plis:delete', (_e, id: unknown) => {
    const validId = z.string().uuid().parse(id)
    getDb().delete(mesuresPlisCutanes).where(eq(mesuresPlisCutanes.id, validId)).run()
  })
}
