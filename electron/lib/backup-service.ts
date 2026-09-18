/**
 * Sauvegarde quotidienne du dossier complet vers OneDrive.
 *
 * Pourquoi : tout vit sur le PC de Marie. Un vol, un SSD mort ou un
 * rançongiciel, et quinze ans de dossiers clients partent avec. Un fichier
 * `.kinesio` écrit chaque jour dans OneDrive suffit à repartir d'un autre PC —
 * l'app sait déjà l'importer (`ipc/transfer.ts`).
 *
 * Aucune API Microsoft : on écrit dans un dossier local, le client OneDrive de
 * Windows fait la synchronisation. Pas d'OAuth, pas de jeton à renouveler, rien
 * qui puisse expirer en silence. Voir `docs/decisions/0041-backup-onedrive-quotidien.md`.
 *
 * Le fichier est écrit EN CLAIR. C'est un choix assumé : une passphrase oubliée
 * rendrait la sauvegarde inutile le jour où elle sert, et une sauvegarde qui
 * existe vaut mieux qu'un chiffrement parfait qu'on n'ouvrira pas.
 */
import { readdir, rename, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { backupFileName, backupsToDelete } from '../../src/lib/backup-retention'
import { MEMO_FILENAME, memoRestauration } from './backup-memo'
import { buildClientBundle } from './client-bundle-builder'
import { ensureBackupFolder } from './onedrive'
import { readBooleanSetting, readNumberSetting, readSetting, writeBooleanSetting, writeSetting } from './settings-store'

export const BACKUP_KEYS = {
  enabled: 'backup.enabled',
  lastRunAt: 'backup.lastRunAt',
  lastRunPath: 'backup.lastRunPath',
  lastClientCount: 'backup.lastClientCount'
} as const

/**
 * Délai minimum entre deux sauvegardes automatiques.
 *
 * Vingt heures et non vingt-quatre : à 24 h, une app ouverte chaque matin à la
 * même heure raterait un jour sur deux — le démarrage de mardi 9 h tombe à 23 h
 * du précédent. Vingt heures laissent la marge sans jamais donner deux
 * sauvegardes dans la même journée de travail.
 */
const MIN_HOURS_BETWEEN_RUNS = 20

/**
 * Marque d'ordre des octets, en tête du mémo de restauration.
 *
 * Écrite par son échappement et jamais collée telle quelle : U+FEFF est
 * invisible, et un caractère invisible dans du source finit toujours par se faire
 * déplacer ou dupliquer sans que personne le voie.
 */
const BOM = '\uFEFF'

export interface BackupResult {
  filePath: string
  clientCount: number
}

export interface BackupStatus {
  /** OneDrive trouvé sur ce PC. Faux = la sauvegarde ne peut rien faire. */
  oneDriveDetected: boolean
  /** Dossier où les fichiers sont écrits, `null` si OneDrive est absent. */
  backupFolder: string | null
  enabled: boolean
  lastRunAt: string | null
  lastRunPath: string | null
  lastClientCount: number
}

/**
 * Écrit un bundle complet dans OneDrive. `null` si OneDrive est introuvable.
 *
 * Écriture en deux temps (fichier temporaire puis renommage) : OneDrive surveille
 * le dossier et téléverse dès qu'un fichier apparaît. Écrire directement sous le
 * nom final lui donnerait à synchroniser un JSON tronqué, et c'est cette version
 * tronquée qui attendrait dans le nuage.
 */
export async function runBackupNow(): Promise<BackupResult | null> {
  const folder = await ensureBackupFolder()
  if (!folder) return null

  const bundle = await buildClientBundle()
  const today = new Date().toISOString().slice(0, 10)
  const filePath = join(folder, backupFileName(today))
  const tempPath = `${filePath}.part`

  await writeFile(tempPath, JSON.stringify(bundle), 'utf-8')
  // Même dossier, donc renommage atomique : le fichier final n'existe jamais à
  // moitié écrit. Écrase la sauvegarde du jour si on relance à la main.
  await rename(tempPath, filePath)

  // Le mode d'emploi de restauration, réécrit à chaque passage : il porte le
  // chemin réel du dossier et la date, et la rétention ne le touche pas (elle ne
  // connaît que les noms `kinesio-backup-*.kinesio`).
  await writeMemo(folder)
  await applyRetentionPolicy(folder)

  writeSetting(BACKUP_KEYS.lastRunAt, new Date().toISOString())
  writeSetting(BACKUP_KEYS.lastRunPath, filePath)
  writeSetting(BACKUP_KEYS.lastClientCount, String(bundle.clients.length))

  return { filePath, clientCount: bundle.clients.length }
}

/**
 * Écrit `COMMENT-RESTAURER.txt` à côté des sauvegardes.
 *
 * En UTF-8 AVEC BOM : sans lui, le Bloc-notes d'un Windows plus ancien lit le
 * fichier dans la page de codes du système et transforme les accents et le cadre
 * en charabia — sur un PC neuf, en situation d'urgence, c'est exactement ce
 * qu'on ne veut pas.
 *
 * Un échec ici n'interrompt pas la sauvegarde : le fichier de données compte
 * plus que sa notice.
 */
async function writeMemo(folder: string): Promise<void> {
  const texte = memoRestauration(folder, new Date())
  await writeFile(join(folder, MEMO_FILENAME), BOM + texte, 'utf-8').catch(() => undefined)
}

/**
 * Applique la rétention (7 quotidiennes + 8 hebdomadaires).
 *
 * Une suppression qui échoue — fichier verrouillé par la synchronisation en
 * cours — est ignorée : elle sera retentée demain, et un fichier de trop est un
 * problème bien moins grave qu'une sauvegarde interrompue.
 */
async function applyRetentionPolicy(folder: string): Promise<void> {
  const noms = await readdir(folder)
  for (const nom of backupsToDelete(noms)) {
    await unlink(join(folder, nom)).catch(() => undefined)
  }
}

/** L'état affiché dans les Paramètres. */
export async function getBackupStatus(): Promise<BackupStatus> {
  const backupFolder = await ensureBackupFolder()
  return {
    oneDriveDetected: backupFolder !== null,
    backupFolder,
    enabled: readBooleanSetting(BACKUP_KEYS.enabled, true),
    lastRunAt: readSetting(BACKUP_KEYS.lastRunAt),
    lastRunPath: readSetting(BACKUP_KEYS.lastRunPath),
    lastClientCount: readNumberSetting(BACKUP_KEYS.lastClientCount, 0)
  }
}

export function setBackupEnabled(enabled: boolean): void {
  writeBooleanSetting(BACKUP_KEYS.enabled, enabled)
}

/**
 * Appelée au démarrage. Ne fait rien si la sauvegarde est désactivée, si la
 * dernière est trop récente, ou si OneDrive est introuvable.
 *
 * Ne lève JAMAIS : un démarrage d'app ne doit pas échouer parce qu'un dossier
 * réseau ne répond pas. Le résultat se lit dans les Paramètres, où la date de la
 * dernière sauvegarde dit la vérité même quand personne n'a vu la console.
 */
export async function maybeRunDailyBackup(): Promise<void> {
  try {
    if (!readBooleanSetting(BACKUP_KEYS.enabled, true)) return

    const lastRunAt = readSetting(BACKUP_KEYS.lastRunAt)
    if (lastRunAt) {
      const heures = (Date.now() - new Date(lastRunAt).getTime()) / 3_600_000
      // `heures` est NaN si la date enregistrée est illisible — on sauvegarde
      // alors, plutôt que de ne plus jamais le faire.
      if (heures < MIN_HOURS_BETWEEN_RUNS) return
    }

    await runBackupNow()
  } catch {
    // Silencieux côté démarrage : les Paramètres montrent la dernière date
    // réussie, et un échec s'y voit donc tout seul.
  }
}
