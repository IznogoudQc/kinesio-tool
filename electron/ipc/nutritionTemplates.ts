import { ipcMain } from 'electron'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { nutritionTemplates } from '../../db/schema'

/**
 * Modèles de protocole nutrition réutilisables (app-level). `data` est une chaîne
 * JSON (un sous-ensemble des réglages nutrition), validée côté renderer et
 * réappliquée à un client. On borne seulement le nom et la taille du JSON.
 */
const SaveSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(80).trim(),
  data: z.string().min(2).max(20000)
})

const IdSchema = z.string().uuid()

export function registerNutritionTemplatesHandlers(): void {
  ipcMain.handle('nutrition-templates:list', () => {
    return getDb().select().from(nutritionTemplates).orderBy(asc(nutritionTemplates.name)).all()
  })

  ipcMain.handle('nutrition-templates:save', (_e, payload: unknown) => {
    const { name, data } = SaveSchema.parse(payload)
    const db = getDb()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const [row] = db
      .insert(nutritionTemplates)
      .values({ id, name, data, createdAt: now })
      .returning()
      .all()
    return row
  })

  ipcMain.handle('nutrition-templates:delete', (_e, id: unknown) => {
    const validId = IdSchema.parse(id)
    getDb().delete(nutritionTemplates).where(eq(nutritionTemplates.id, validId)).run()
  })
}
