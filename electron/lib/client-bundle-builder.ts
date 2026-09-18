/**
 * Construit un bundle `.kinesio` depuis la base.
 *
 * Un seul endroit pour les deux usages : l'export manuel de clients choisis
 * (`ipc/transfer.ts`) et la sauvegarde quotidienne de TOUT le dossier
 * (`lib/backup-service.ts`). C'est ce qui garantit qu'une colonne ajoutée au
 * schéma se retrouve dans les deux — une sauvegarde qui perdrait un champ que
 * l'export conserve serait le pire des deux mondes.
 */
import { app } from 'electron'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { eq, inArray } from 'drizzle-orm'
import { getDb } from '../../db/client'
import {
  bilans,
  clientNotes,
  clients,
  mesuresCirconferences,
  mesuresPlisCutanes,
  questionnaires
} from '../../db/schema'
import { getAvatarPath } from './avatars'
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  type ClientBundle,
  type ExportedClient
} from '../../src/lib/client-bundle'

/** Les lignes voyagent telles quelles : voir l'avertissement de `clientRowSchema`. */
type Row = Record<string, unknown>

/** Photos d'un client en base64. Un fichier manquant est simplement ignoré. */
async function collectAvatars(row: {
  avatarFilename: string | null
  avatarFullbodyFilename: string | null
}): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const filename of [row.avatarFilename, row.avatarFullbodyFilename]) {
    if (!filename) continue
    const path = getAvatarPath(filename)
    if (!existsSync(path)) continue
    out[filename] = (await readFile(path)).toString('base64')
  }
  return out
}

/**
 * Le bundle des clients demandés — ou de TOUS si `clientIds` est absent.
 *
 * Ne lève pas sur un dossier vide : une installation neuve doit pouvoir être
 * sauvegardée (un bundle à zéro client), même si l'export manuel, lui, refuse
 * de produire un fichier sans contenu.
 */
export async function buildClientBundle(clientIds?: string[]): Promise<ClientBundle> {
  const db = getDb()
  const rows =
    clientIds === undefined
      ? db.select().from(clients).all()
      : db.select().from(clients).where(inArray(clients.id, clientIds)).all()

  const exported: ExportedClient[] = []
  for (const row of rows) {
    exported.push({
      client: row as unknown as Row,
      bilans: db.select().from(bilans).where(eq(bilans.clientId, row.id)).all() as unknown as Row[],
      circonferences: db
        .select()
        .from(mesuresCirconferences)
        .where(eq(mesuresCirconferences.clientId, row.id))
        .all() as unknown as Row[],
      plis: db
        .select()
        .from(mesuresPlisCutanes)
        .where(eq(mesuresPlisCutanes.clientId, row.id))
        .all() as unknown as Row[],
      notes: db.select().from(clientNotes).where(eq(clientNotes.clientId, row.id)).all() as unknown as Row[],
      questionnaires: db
        .select()
        .from(questionnaires)
        .where(eq(questionnaires.clientId, row.id))
        .all() as unknown as Row[],
      avatars: await collectAvatars(row)
    })
  }

  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    clients: exported
  }
}
