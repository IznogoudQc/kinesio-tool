import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
