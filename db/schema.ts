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

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
})

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert

export const bilans = sqliteTable('bilans', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  data: text('data').notNull(),
  source: text('source').notNull(),
  createdAt: text('created_at').notNull()
})

export type Bilan = typeof bilans.$inferSelect
export type NewBilan = typeof bilans.$inferInsert
