import { app, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { basename } from 'path'
import { z } from 'zod'
import { eq, inArray } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { bilans, clientNotes, clients, mesuresCirconferences, mesuresPlisCutanes } from '../../db/schema'
import { ensureAvatarsDir, getAvatarPath } from '../lib/avatars'
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  clientRowSchema,
  matchExistingClient,
  mergeClientForImport,
  planImport,
  summarizeBundle,
  type ClientBundle,
  type ExistingClient,
  type ExportedClient
} from '../../src/lib/client-bundle'

// Les lignes ne sont pas figées colonne par colonne : ajouter une colonne au
// schéma ne doit pas invalider les fichiers déjà exportés.
const RowSchema = z.record(z.unknown())

const BundleSchema = z.object({
  format: z.literal(BUNDLE_FORMAT),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  appVersion: z.string(),
  clients: z.array(
    z.object({
      client: clientRowSchema,
      bilans: z.array(RowSchema),
      circonferences: z.array(RowSchema),
      plis: z.array(RowSchema),
      notes: z.array(RowSchema),
      avatars: z.record(z.string())
    })
  )
})

/** Ancien `.kinesio` : un seul client, sans identifiants, sans notes ni photos. */
const LegacyBundleSchema = z.object({
  client: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    birthdate: z.union([z.string(), z.null()]).optional(),
    sex: z.union([z.enum(['F', 'M']), z.null()]).optional(),
    unitLength: z.enum(['cm', 'in']).optional(),
    unitWeight: z.enum(['kg', 'lb']).optional()
  }),
  bilans: z.array(RowSchema).optional(),
  mesures_circonferences: z.array(RowSchema).optional(),
  mesures_plis_cutanes: z.array(RowSchema).optional()
})

/**
 * Convertit un ancien fichier au format courant. Les identifiants manquants sont
 * créés ici : le rapprochement avec la base se fera donc par courriel.
 */
function fromLegacy(raw: z.infer<typeof LegacyBundleSchema>): ClientBundle {
  const now = new Date().toISOString()
  const clientId = crypto.randomUUID()
  const withIds = (rows: Record<string, unknown>[] | undefined): Record<string, unknown>[] =>
    (rows ?? []).map(r => ({ ...r, id: crypto.randomUUID(), clientId, createdAt: r.createdAt ?? now }))

  const exported: ExportedClient = {
    client: {
      id: clientId,
      name: raw.client.name,
      email: raw.client.email,
      birthdate: raw.client.birthdate ?? null,
      sex: raw.client.sex ?? null,
      unitLength: raw.client.unitLength ?? 'cm',
      unitWeight: raw.client.unitWeight ?? 'kg',
      createdAt: now,
      updatedAt: now
    },
    bilans: withIds(raw.bilans).map(b => ({
      ...b,
      // L'ancien format stockait `data` en objet ; la colonne attend du JSON.
      data: typeof b.data === 'string' ? b.data : JSON.stringify(b.data ?? {}),
      source: b.source === 'import_docx' ? 'import_docx' : 'manuel'
    })),
    circonferences: withIds(raw.mesures_circonferences),
    plis: withIds(raw.mesures_plis_cutanes),
    notes: [],
    avatars: {}
  }

  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: now,
    appVersion: 'ancien format',
    clients: [exported]
  }
}

/** Lit et valide un `.kinesio` (format courant ou ancien). Erreurs lisibles. */
async function readBundle(filePath: string): Promise<ClientBundle> {
  if (!existsSync(filePath)) throw new Error('Le fichier sélectionné est introuvable.')

  let raw: unknown
  try {
    raw = JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    throw new Error('Fichier .kinesio invalide (JSON illisible).')
  }

  const current = BundleSchema.safeParse(raw)
  if (current.success) {
    if (current.data.version > BUNDLE_VERSION) {
      throw new Error(
        `Ce fichier vient d'une version plus récente de l'application (format ${current.data.version}). Mettez Kinésio Outils à jour avant de l'importer.`
      )
    }
    return current.data as ClientBundle
  }

  const legacy = LegacyBundleSchema.safeParse(raw)
  if (legacy.success) return fromLegacy(legacy.data)

  throw new Error("Ce fichier n'est pas un export de clients Kinésio.")
}

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

function existingClients(): ExistingClient[] {
  return getDb().select({ id: clients.id, email: clients.email }).from(clients).all()
}

export function registerTransferHandlers(): void {
  ipcMain.handle('transfer:export', async (_e, payload: unknown) => {
    const clientIds = z.array(z.string().uuid()).min(1).parse(payload)
    const db = getDb()

    const rows = db.select().from(clients).where(inArray(clients.id, clientIds)).all()
    if (rows.length === 0) throw new Error('Aucun client à exporter.')

    const exported: ExportedClient[] = []
    for (const row of rows) {
      exported.push({
        client: row as unknown as Record<string, unknown>,
        bilans: db.select().from(bilans).where(eq(bilans.clientId, row.id)).all() as unknown as Record<string, unknown>[],
        circonferences: db
          .select()
          .from(mesuresCirconferences)
          .where(eq(mesuresCirconferences.clientId, row.id))
          .all() as unknown as Record<string, unknown>[],
        plis: db
          .select()
          .from(mesuresPlisCutanes)
          .where(eq(mesuresPlisCutanes.clientId, row.id))
          .all() as unknown as Record<string, unknown>[],
        notes: db.select().from(clientNotes).where(eq(clientNotes.clientId, row.id)).all() as unknown as Record<
          string,
          unknown
        >[],
        avatars: await collectAvatars(row)
      })
    }

    const bundle: ClientBundle = {
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      clients: exported
    }

    const today = new Date().toISOString().slice(0, 10)
    const slug = (s: string): string => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase()
    const defaultPath =
      rows.length === 1 ? `${slug(rows[0].name)}-export-${today}.kinesio` : `${rows.length}-clients-export-${today}.kinesio`

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: rows.length === 1 ? 'Exporter le dossier client' : 'Exporter les dossiers clients',
      defaultPath,
      filters: [{ name: 'Dossier Kinésio', extensions: ['kinesio'] }]
    })
    if (canceled || !filePath) return null

    await writeFile(filePath, JSON.stringify(bundle, null, 2), 'utf-8')
    return { filePath, summary: summarizeBundle(bundle) }
  })

  /** Ouvre un fichier, le valide, et décrit ce qu'il ferait. N'écrit rien. */
  ipcMain.handle('transfer:preview', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Importer des dossiers clients (.kinesio)',
      properties: ['openFile'],
      filters: [{ name: 'Dossier Kinésio', extensions: ['kinesio', 'json'] }]
    })
    if (canceled || filePaths.length === 0) return null

    const filePath = filePaths[0]
    const bundle = await readBundle(filePath)
    return {
      filePath,
      fileName: basename(filePath),
      summary: summarizeBundle(bundle),
      plan: planImport(bundle, existingClients())
    }
  })

  ipcMain.handle('transfer:import', async (_e, payload: unknown) => {
    const { filePath, mode } = z
      .object({ filePath: z.string().min(1), mode: z.enum(['replace', 'merge']) })
      .parse(payload)

    const bundle = await readBundle(filePath)
    const db = getDb()
    await ensureAvatarsDir()

    // Les photos d'abord : si une écriture échoue, la base n'a pas encore bougé.
    for (const c of bundle.clients) {
      for (const [filename, base64] of Object.entries(c.avatars)) {
        // `filename` vient du fichier : on n'en garde que le nom, jamais un chemin.
        await writeFile(getAvatarPath(basename(filename)), Buffer.from(base64, 'base64'))
      }
    }

    const known = existingClients()
    let added = 0
    let updated = 0

    // Transaction unique : un import interrompu ne laisse pas la base à moitié écrite.
    db.transaction(tx => {
      for (const c of bundle.clients) {
        const match = matchExistingClient(c.client, known)
        // Le client existant garde SON id : les lignes enfants sont réécrites dessus.
        const targetId = match ? match.id : String(c.client.id)

        if (match) {
          tx.update(clients)
            .set(mergeClientForImport(c.client, targetId) as never)
            .where(eq(clients.id, targetId))
            .run()
          updated++
          if (mode === 'replace') {
            // On efface les données de CE client seulement, puis on réinsère le
            // contenu du fichier. Les autres clients ne sont jamais touchés.
            tx.delete(bilans).where(eq(bilans.clientId, targetId)).run()
            tx.delete(mesuresCirconferences).where(eq(mesuresCirconferences.clientId, targetId)).run()
            tx.delete(mesuresPlisCutanes).where(eq(mesuresPlisCutanes.clientId, targetId)).run()
            tx.delete(clientNotes).where(eq(clientNotes.clientId, targetId)).run()
          }
        } else {
          tx.insert(clients).values(c.client as never).run()
          added++
        }

        // Fusion : une ligne de même id met à jour l'existante au lieu de la dupliquer.
        // C'est ce qui rend un réimport idempotent.
        const upsert = (
          table: typeof bilans | typeof mesuresCirconferences | typeof mesuresPlisCutanes | typeof clientNotes,
          rows: Record<string, unknown>[]
        ): void => {
          for (const row of rows) {
            const value = { ...row, clientId: targetId }
            tx.insert(table)
              .values(value as never)
              .onConflictDoUpdate({ target: table.id, set: value as never })
              .run()
          }
        }
        upsert(bilans, c.bilans)
        upsert(mesuresCirconferences, c.circonferences)
        upsert(mesuresPlisCutanes, c.plis)
        upsert(clientNotes, c.notes)
      }
    })

    return { added, updated, mode, summary: summarizeBundle(bundle) }
  })
}
