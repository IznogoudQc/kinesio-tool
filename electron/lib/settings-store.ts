/**
 * Accès brut à la table `settings` depuis le processus principal.
 *
 * La table est un simple couple clé → texte. Ces fonctions existaient en trois
 * copies (les `readKey`/`writeKey` de `ipc/settings.ts`, le `readSetting` de
 * `lib/standalone-report.ts`, et il en fallait une quatrième pour la
 * sauvegarde) : elles vivent ici une seule fois.
 *
 * Synchrones, parce que better-sqlite3 l'est : une version `async` ne
 * promettrait qu'une asynchronie de façade.
 */
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { settings } from '../../db/schema'

/** Valeur brute, ou `null` si la clé n'a jamais été écrite. */
export function readSetting(key: string): string | null {
  return getDb().select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
}

export function writeSetting(key: string, value: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  const existing = db.select().from(settings).where(eq(settings.key, key)).get()
  if (existing) {
    db.update(settings).set({ value, updatedAt: now }).where(eq(settings.key, key)).run()
  } else {
    db.insert(settings).values({ key, value, updatedAt: now }).run()
  }
}

/**
 * Réglage booléen. `defaut` sert quand la clé n'existe pas ENCORE — c'est ce qui
 * permet d'activer une fonction par défaut sans écrire en base au premier
 * démarrage.
 */
export function readBooleanSetting(key: string, defaut: boolean): boolean {
  const raw = readSetting(key)
  return raw === null ? defaut : raw === 'true'
}

export function writeBooleanSetting(key: string, value: boolean): void {
  writeSetting(key, value ? 'true' : 'false')
}

/** Réglage numérique. Une valeur illisible retombe sur `defaut`. */
export function readNumberSetting(key: string, defaut: number): number {
  const n = Number(readSetting(key))
  return Number.isFinite(n) ? n : defaut
}
