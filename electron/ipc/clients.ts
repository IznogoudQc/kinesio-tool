import { dialog, ipcMain } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname } from 'node:path'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { clients } from '../../db/schema'
import { deleteAvatar, getAvatarPath, saveAvatar, saveFullbodyAvatar } from '../lib/avatars'

const IsoDateOrNull = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (attendu AAAA-MM-JJ)'), z.null()])
  .optional()
const SexOrNull = z.union([z.enum(['F', 'M']), z.null()]).optional()
const UnitLength = z.enum(['cm', 'in']).optional()
const UnitWeight = z.enum(['kg', 'lb']).optional()
// Module « Objectif chiffré & nutrition » (opt-in par client).
const NutritionActivity = z
  .union([z.enum(['sedentaire', 'leger', 'modere', 'actif', 'tres_actif']), z.null()])
  .optional()
const BodyFatTarget = z.union([z.number().min(3).max(60), z.null()]).optional()
const RateKgPerWeek = z.union([z.number().min(0.1).max(2), z.null()]).optional()
const ProteinPerLbLean = z.union([z.number().min(0.3).max(2.5), z.null()]).optional()
const FatMaxG = z.union([z.number().min(20).max(200), z.null()]).optional()
const TargetKcal = z.union([z.number().min(800).max(6000), z.null()]).optional()
// ── Nutrition & jeûne (onglet dédié) ──
const JeuneType = z.union([z.enum(['16:8', '18:6', '20:4', 'omad', '5:2']), z.null()]).optional()
const HeureOrNull = z
  .union([z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide (attendu HH:MM)'), z.null()])
  .optional()
const HydratationMl = z.union([z.number().min(0).max(10000), z.null()]).optional()
const TexteLibreOrNull = z.union([z.string().max(2000).trim(), z.null()]).optional()

const CreateClientSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(200).trim(),
  email: z.string().email('Courriel invalide').trim(),
  birthdate: IsoDateOrNull,
  sex: SexOrNull,
  unitLength: UnitLength,
  unitWeight: UnitWeight
})

const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().trim().optional(),
  birthdate: IsoDateOrNull,
  sex: SexOrNull,
  unitLength: UnitLength,
  unitWeight: UnitWeight,
  nutritionEnabled: z.boolean().optional(),
  nutritionTargetBodyFat: BodyFatTarget,
  nutritionActivityLevel: NutritionActivity,
  nutritionRateKgPerWeek: RateKgPerWeek,
  nutritionProteinPerLbLean: ProteinPerLbLean,
  nutritionFatMaxG: FatMaxG,
  nutritionTargetKcal: TargetKcal,
  nutritionMacroManual: z.boolean().optional(),
  nutritionManualProteinG: z.union([z.number().min(0).max(500), z.null()]).optional(),
  nutritionManualFatG: z.union([z.number().min(0).max(400), z.null()]).optional(),
  nutritionManualCarbG: z.union([z.number().min(0).max(800), z.null()]).optional(),
  principePersoTitre: z.union([z.string().max(60).trim(), z.null()]).optional(),
  principePersoTexte: z.union([z.string().max(300).trim(), z.null()]).optional(),
  jeuneType: JeuneType,
  jeuneFenetreDebut: HeureOrNull,
  jeuneFenetreFin: HeureOrNull,
  jeuneNotes: TexteLibreOrNull,
  // Planning de jeûne : chaîne JSON (validée côté renderer). On borne la taille.
  jeunePlanning: z.union([z.string().max(20000), z.null()]).optional(),
  hydratationMlParJour: HydratationMl,
  supplementsNotes: TexteLibreOrNull,
  alimentsPrivilegier: TexteLibreOrNull,
  alimentsEviter: TexteLibreOrNull,
  nutritionMot: TexteLibreOrNull
})

const ClientId = z.string().uuid()
const AvatarFilename = z.string().regex(/^[0-9a-f-]+\.webp$/i, 'Nom de fichier avatar invalide')
const MAX_AVATAR_BYTES = 10 * 1024 * 1024
/**
 * Valide des octets d'image reçus par IPC (sous forme base64 string) et les
 * normalise en Buffer.
 *
 * On utilise base64 (string) car contextBridge d'Electron ne sérialise pas de
 * façon fiable les Uint8Array/ArrayBuffer/Array — ils arrivent souvent comme
 * `undefined`. Une string traverse toujours sans souci.
 */
function toImageBuffer(value: unknown): Buffer {
  if (typeof value !== 'string') {
    console.error('[toImageBuffer] Attendu string base64, reçu:', {
      type: typeof value,
      ctor: (value as { constructor?: { name?: string } } | null | undefined)?.constructor?.name
    })
    throw new Error("Format d'image invalide reçu par IPC (base64 string attendu).")
  }
  if (value.length === 0) throw new Error('Image vide.')

  const buffer = Buffer.from(value, 'base64')
  if (buffer.byteLength === 0) throw new Error('Image vide après décodage base64.')
  if (buffer.byteLength > MAX_AVATAR_BYTES) throw new Error('Image trop volumineuse (maximum 10 Mo).')
  return buffer
}

const AVATAR_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

function getClientOrThrow(id: string) {
  const client = getDb().select().from(clients).where(eq(clients.id, id)).get()
  if (!client) throw new Error('Client introuvable.')
  return client
}

export function registerClientsHandlers(): void {
  ipcMain.handle('clients:list', () => {
    return getDb().select().from(clients).orderBy(asc(clients.createdAt)).all()
  })

  ipcMain.handle('clients:create', (_event, data: unknown) => {
    const validated = CreateClientSchema.parse(data)
    const db = getDb()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const [client] = db
      .insert(clients)
      .values({
        id,
        name: validated.name,
        email: validated.email,
        birthdate: validated.birthdate ?? null,
        sex: validated.sex ?? null,
        // Si non fournis, on laisse les défauts DB s'appliquer ('cm' / 'kg').
        unitLength: validated.unitLength,
        unitWeight: validated.unitWeight,
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .all()
    return client
  })

  ipcMain.handle('clients:update', (_event, id: unknown, data: unknown) => {
    const validId = ClientId.parse(id)
    const validData = UpdateClientSchema.parse(data)
    const db = getDb()
    const now = new Date().toISOString()
    const [client] = db
      .update(clients)
      .set({ ...validData, updatedAt: now })
      .where(eq(clients.id, validId))
      .returning()
      .all()
    return client
  })

  ipcMain.handle('clients:delete', (_event, id: unknown) => {
    const validId = ClientId.parse(id)
    const existing = getDb().select().from(clients).where(eq(clients.id, validId)).get()
    if (existing?.avatarFilename) void deleteAvatar(existing.avatarFilename)
    if (existing?.avatarFullbodyFilename) void deleteAvatar(existing.avatarFullbodyFilename)
    getDb().delete(clients).where(eq(clients.id, validId)).run()
  })

  // ── Photo de profil ─────────────────────────────────────────────────────────
  // Sélection via dialog natif ; on renvoie directement une data URL pour
  // alimenter l'éditeur de cadrage côté renderer (évite les soucis `file://`).
  ipcMain.handle('clients:pick-avatar', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choisir une photo',
      buttonLabel: 'Choisir',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true as const }
    const filePath = result.filePaths[0]
    const ext = extname(filePath).toLowerCase()
    const mime = AVATAR_MIME[ext]
    if (!mime) throw new Error('Format non supporté (formats acceptés : PNG, JPG, JPEG, WEBP).')
    const info = await stat(filePath)
    if (info.size > MAX_AVATAR_BYTES) throw new Error('Image trop volumineuse (maximum 10 Mo).')
    const buffer = await readFile(filePath)
    return { canceled: false as const, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` }
  })

  // Reçoit deux images : `croppedBytes` = version carrée recadrée par l'éditeur
  // (avatars circulaires) et `originalBytes` = la photo d'origine non recadrée
  // (affichée en plein corps dans l'onglet Mesures). On optimise et stocke les
  // deux ; sharp accepte directement un Buffer.
  ipcMain.handle(
    'clients:set-avatar',
    async (_event, clientId: unknown, croppedBytes: unknown, originalBytes: unknown) => {
      const validId = ClientId.parse(clientId)
      const cropped = toImageBuffer(croppedBytes)
      const original = toImageBuffer(originalBytes)

      const existing = getClientOrThrow(validId)
      const filename = await saveAvatar(cropped, existing.avatarFilename)
      const fullbodyFilename = await saveFullbodyAvatar(original, existing.avatarFullbodyFilename)
      const now = new Date().toISOString()
      const [client] = getDb()
        .update(clients)
        .set({ avatarFilename: filename, avatarFullbodyFilename: fullbodyFilename, updatedAt: now })
        .where(eq(clients.id, validId))
        .returning()
        .all()
      return client
    }
  )

  ipcMain.handle('clients:remove-avatar', async (_event, clientId: unknown) => {
    const validId = ClientId.parse(clientId)
    const existing = getClientOrThrow(validId)
    if (existing.avatarFilename) await deleteAvatar(existing.avatarFilename)
    if (existing.avatarFullbodyFilename) await deleteAvatar(existing.avatarFullbodyFilename)
    const now = new Date().toISOString()
    const [client] = getDb()
      .update(clients)
      .set({ avatarFilename: null, avatarFullbodyFilename: null, updatedAt: now })
      .where(eq(clients.id, validId))
      .returning()
      .all()
    return client
  })

  // Renvoie une data URL (image/webp en base64) affichable directement dans un
  // <img> du renderer — évite les restrictions `file://` / webSecurity en dev.
  ipcMain.handle('clients:get-avatar-url', async (_event, filename: unknown) => {
    const validFilename = AvatarFilename.parse(filename)
    const path = getAvatarPath(validFilename)
    if (!existsSync(path)) return null
    const buffer = await readFile(path)
    return `data:image/webp;base64,${buffer.toString('base64')}`
  })
}
