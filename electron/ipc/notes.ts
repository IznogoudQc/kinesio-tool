import { ipcMain } from 'electron'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { clientNotes, clients } from '../../db/schema'

/**
 * IPC des notes cliniques d'un client — journal daté, privé (jamais dans le
 * rapport). CRUD simple : list / create / update / delete.
 */

function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (attendu AAAA-MM-JJ)')
  .refine(v => v <= todayISO(), 'La date de la note ne peut pas être dans le futur.')

const NoteInput = z
  .object({
    date: IsoDate.optional(),
    content: z.string().trim().min(1, 'La note est vide.').max(10000)
  })
  .strip()

function getClientOrThrow(clientId: string): void {
  const client = getDb().select().from(clients).where(eq(clients.id, clientId)).get()
  if (!client) throw new Error('Client introuvable.')
}

export function registerNotesHandlers(): void {
  ipcMain.handle('notes:list', (_e, clientId: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    return getDb()
      .select()
      .from(clientNotes)
      .where(eq(clientNotes.clientId, validId))
      .orderBy(desc(clientNotes.date), desc(clientNotes.createdAt))
      .all()
  })

  ipcMain.handle('notes:create', (_e, clientId: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(clientId)
    getClientOrThrow(validId)
    const data = NoteInput.parse(payload)
    const now = new Date().toISOString()
    const [row] = getDb()
      .insert(clientNotes)
      .values({
        id: crypto.randomUUID(),
        clientId: validId,
        date: data.date ?? todayISO(),
        content: data.content,
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .all()
    return row
  })

  ipcMain.handle('notes:update', (_e, id: unknown, payload: unknown) => {
    const validId = z.string().uuid().parse(id)
    const data = NoteInput.parse(payload)
    const db = getDb()
    const existing = db.select().from(clientNotes).where(eq(clientNotes.id, validId)).get()
    if (!existing) throw new Error('Note introuvable.')
    const [row] = db
      .update(clientNotes)
      .set({
        date: data.date ?? existing.date,
        content: data.content,
        updatedAt: new Date().toISOString()
      })
      .where(eq(clientNotes.id, validId))
      .returning()
      .all()
    return row
  })

  ipcMain.handle('notes:delete', (_e, id: unknown) => {
    const validId = z.string().uuid().parse(id)
    getDb().delete(clientNotes).where(eq(clientNotes.id, validId)).run()
  })
}
