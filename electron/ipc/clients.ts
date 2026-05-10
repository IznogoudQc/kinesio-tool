import { dialog, ipcMain } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname } from 'node:path'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { clients } from '../../db/schema'
import { deleteAvatar, getAvatarPath, saveAvatar } from '../lib/avatars'

const IsoDateOrNull = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (attendu AAAA-MM-JJ)'), z.null()])
  .optional()
const SexOrNull = z.union([z.enum(['F', 'M']), z.null()]).optional()

const CreateClientSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(200).trim(),
  email: z.string().email('Courriel invalide').trim()
})

const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().trim().optional(),
  birthdate: IsoDateOrNull,
  sex: SexOrNull
})

const ClientId = z.string().uuid()
const AvatarFilename = z.string().regex(/^[0-9a-f-]+\.webp$/i, 'Nom de fichier avatar invalide')
const ACCEPTED_AVATAR_EXTS = ['.png', '.jpg', '.jpeg', '.webp']
const MAX_AVATAR_BYTES = 10 * 1024 * 1024

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
      .values({ id, name: validated.name, email: validated.email, createdAt: now, updatedAt: now })
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
    getDb().delete(clients).where(eq(clients.id, validId)).run()
  })

  // ── Photo de profil ─────────────────────────────────────────────────────────
  ipcMain.handle('clients:pick-avatar', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choisir une photo',
      buttonLabel: 'Choisir',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true as const }
    return { canceled: false as const, filePath: result.filePaths[0] }
  })

  ipcMain.handle('clients:set-avatar', async (_event, clientId: unknown, sourcePath: unknown) => {
    const validId = ClientId.parse(clientId)
    const validPath = z.string().min(1).parse(sourcePath)
    if (!ACCEPTED_AVATAR_EXTS.includes(extname(validPath).toLowerCase())) {
      throw new Error('Format non supporté (formats acceptés : PNG, JPG, JPEG, WEBP).')
    }
    const info = await stat(validPath)
    if (info.size > MAX_AVATAR_BYTES) throw new Error('Image trop volumineuse (maximum 10 Mo).')

    const existing = getClientOrThrow(validId)
    const filename = await saveAvatar(validPath, existing.avatarFilename)
    const now = new Date().toISOString()
    const [client] = getDb()
      .update(clients)
      .set({ avatarFilename: filename, updatedAt: now })
      .where(eq(clients.id, validId))
      .returning()
      .all()
    return client
  })

  ipcMain.handle('clients:remove-avatar', async (_event, clientId: unknown) => {
    const validId = ClientId.parse(clientId)
    const existing = getClientOrThrow(validId)
    if (existing.avatarFilename) await deleteAvatar(existing.avatarFilename)
    const now = new Date().toISOString()
    const [client] = getDb()
      .update(clients)
      .set({ avatarFilename: null, updatedAt: now })
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
