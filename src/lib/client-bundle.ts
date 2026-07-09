/** Format du fichier d'échange de clients entre deux installations.
 *
 *  Un export contient **les clients choisis** et tout ce qui leur appartient :
 *  bilans, circonférences, plis cutanés, notes, photos. Rien d'autre — ni les
 *  réglages de l'app, ni la configuration courriel, ni les autres clients.
 *
 *  Les photos voyagent en base64 dans le fichier (quelques Ko en .webp), ce qui
 *  évite une archive .zip et donc une dépendance de plus.
 */

export const BUNDLE_FORMAT = 'kinesio-clients'
/** Incrémenter si la forme du fichier change de façon non rétrocompatible. */
export const BUNDLE_VERSION = 1

export interface ExportedClient {
  client: Record<string, unknown>
  bilans: Record<string, unknown>[]
  circonferences: Record<string, unknown>[]
  plis: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  /** `{ 'uuid.webp': '<base64>' }` — avatar carré et/ou photo pleine hauteur. */
  avatars: Record<string, string>
}

export interface ClientBundle {
  format: typeof BUNDLE_FORMAT
  version: number
  /** ISO — quand l'export a été fait. */
  exportedAt: string
  /** Version de l'app qui a produit le fichier (diagnostic). */
  appVersion: string
  clients: ExportedClient[]
}

export interface BundleSummary {
  clientCount: number
  bilanCount: number
  mesureCount: number
  plisCount: number
  noteCount: number
  avatarCount: number
  exportedAt: string
  appVersion: string
  /** Noms des clients, pour que Marie reconnaisse le fichier avant d'importer. */
  clientNames: string[]
}

export function summarizeBundle(bundle: ClientBundle): BundleSummary {
  return {
    clientCount: bundle.clients.length,
    bilanCount: bundle.clients.reduce((n, c) => n + c.bilans.length, 0),
    mesureCount: bundle.clients.reduce((n, c) => n + c.circonferences.length, 0),
    plisCount: bundle.clients.reduce((n, c) => n + c.plis.length, 0),
    noteCount: bundle.clients.reduce((n, c) => n + c.notes.length, 0),
    avatarCount: bundle.clients.reduce((n, c) => n + Object.keys(c.avatars).length, 0),
    exportedAt: bundle.exportedAt,
    appVersion: bundle.appVersion,
    clientNames: bundle.clients.map(c => String(c.client.name ?? '—'))
  }
}

export type ImportMode = 'replace' | 'merge'

export interface ExistingClient {
  id: string
  email: string
}

/**
 * Le client du fichier correspond-il à quelqu'un déjà en base ?
 *
 * D'abord par identifiant — c'est le cas normal entre deux installations qui
 * ont échangé un fichier. Sinon par courriel, ce qui rattrape (1) les anciens
 * fichiers `.kinesio` qui ne transportaient pas l'id, et (2) un même client
 * créé à la main des deux côtés, donc avec deux ids différents.
 */
export function matchExistingClient(
  client: Record<string, unknown>,
  existing: ExistingClient[]
): ExistingClient | null {
  const id = client.id === undefined || client.id === null ? null : String(client.id)
  if (id) {
    const byId = existing.find(e => e.id === id)
    if (byId) return byId
  }
  const email = typeof client.email === 'string' ? client.email.trim().toLowerCase() : null
  if (!email) return null
  return existing.find(e => e.email.trim().toLowerCase() === email) ?? null
}

export interface ImportPlan {
  /** Noms des clients absents de la base — toujours simplement ajoutés. */
  toAdd: string[]
  /** Noms des clients déjà présents — c'est eux que `mode` concerne. */
  toUpdate: string[]
}

/**
 * Qui sera ajouté, qui sera touché. Les clients de la base absents du fichier
 * ne sont jamais listés : un import ne les supprime jamais, quel que soit le mode.
 */
export function planImport(bundle: ClientBundle, existing: ExistingClient[]): ImportPlan {
  const toAdd: string[] = []
  const toUpdate: string[] = []
  for (const c of bundle.clients) {
    const name = String(c.client.name ?? '—')
    if (matchExistingClient(c.client, existing)) toUpdate.push(name)
    else toAdd.push(name)
  }
  return { toAdd, toUpdate }
}
