import { ipcMain } from 'electron'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { clients } from '../../db/schema'

const CreateClientSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(200).trim(),
  email: z.string().email('Courriel invalide').trim()
})

const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().trim().optional()
})

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
    const validId = z.string().uuid().parse(id)
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
    const validId = z.string().uuid().parse(id)
    getDb().delete(clients).where(eq(clients.id, validId)).run()
  })
}
