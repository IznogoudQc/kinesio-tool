/**
 * Nommage et rétention des sauvegardes quotidiennes.
 *
 * Module PUR : il ne connaît ni Electron, ni le disque, ni la base. Il prend des
 * noms de fichiers et rend ceux à supprimer — c'est ce qui permet de vérifier la
 * politique de rétention sans fabriquer dix jours de sauvegardes sur le disque.
 *
 * La politique : les 7 dernières journées, plus la sauvegarde la plus récente de
 * chacune des 8 dernières semaines. Sept jours couvrent « je m'en suis rendu
 * compte cette semaine » ; huit semaines couvrent « ce client a été abîmé il y a
 * un mois et je viens de le voir ». Au-delà, une sauvegarde d'un dossier vivant
 * n'a plus grand sens.
 */

/** Nombre de sauvegardes quotidiennes conservées. */
export const KEEP_DAILY = 7

/** Nombre de semaines dont on garde une sauvegarde. */
export const KEEP_WEEKLY = 8

/** `kinesio-backup-2026-09-18.kinesio` — une seule par journée, écrasée si relancée. */
const BACKUP_NAME = /^kinesio-backup-(\d{4}-\d{2}-\d{2})\.kinesio$/

export function backupFileName(isoDate: string): string {
  return `kinesio-backup-${isoDate}.kinesio`
}

/** La date d'un nom de sauvegarde, ou `null` si ce n'en est pas un. */
export function backupDate(fileName: string): string | null {
  return BACKUP_NAME.exec(fileName)?.[1] ?? null
}

/**
 * Le lundi de la semaine d'une date, en ISO — la clé qui regroupe les journées
 * d'une même semaine.
 *
 * Calculé depuis le lundi et non depuis le 1er janvier : une semaine à cheval
 * sur le Nouvel An reste UNE semaine, là où un compte de jours depuis janvier la
 * couperait en deux et garderait une sauvegarde de trop.
 */
export function weekKey(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const depuisLundi = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - depuisLundi)
  return d.toISOString().slice(0, 10)
}

/**
 * Les noms à conserver, du plus récent au plus ancien.
 *
 * Les fichiers qui ne suivent pas le nommage des sauvegardes sont ignorés de
 * bout en bout : rien d'autre ne sera ni gardé ni supprimé, pour qu'un fichier
 * déposé là à la main par Marie survive.
 */
export function backupsToKeep(fileNames: readonly string[]): string[] {
  const sauvegardes = fileNames
    .filter(f => backupDate(f) !== null)
    .sort()
    .reverse()

  const garder = new Set<string>(sauvegardes.slice(0, KEEP_DAILY))

  const semaines = new Set<string>()
  for (const f of sauvegardes) {
    const semaine = weekKey(backupDate(f) as string)
    if (semaines.has(semaine)) continue
    semaines.add(semaine)
    // La plus récente de la semaine : les noms sont parcourus du plus récent au
    // plus ancien, donc c'est celle qu'on rencontre d'abord.
    garder.add(f)
    if (semaines.size >= KEEP_WEEKLY) break
  }

  return sauvegardes.filter(f => garder.has(f))
}

/** Les noms à supprimer. Complément de `backupsToKeep` sur les seules sauvegardes. */
export function backupsToDelete(fileNames: readonly string[]): string[] {
  const garder = new Set(backupsToKeep(fileNames))
  return fileNames.filter(f => backupDate(f) !== null && !garder.has(f))
}
