import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { existsSync } from 'fs'
import * as schema from './schema'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let db: DrizzleDb | null = null

export function initDb(dbPath: string, migrationsPath: string): void {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  db = drizzle(sqlite, { schema })

  if (existsSync(migrationsPath)) {
    migrate(db, { migrationsFolder: migrationsPath })
  }
}

export function getDb(): DrizzleDb {
  if (!db) throw new Error('DB non initialisée — appeler initDb() en premier')
  return db
}
