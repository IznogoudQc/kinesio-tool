/**
 * Où se trouve le dossier OneDrive de l'utilisatrice Windows.
 *
 * La sauvegarde quotidienne n'utilise AUCUNE API Microsoft : elle écrit un
 * fichier dans un dossier local, et le client OneDrive de Windows le monte dans
 * le nuage tout seul. Il ne reste donc qu'à trouver ce dossier.
 *
 * Trois sources, dans cet ordre de fiabilité :
 *   1. les variables d'environnement posées par le client OneDrive lui-même ;
 *   2. le registre, si l'app a été lancée dans un environnement qui ne les a pas
 *      héritées (service, tâche planifiée) ;
 *   3. l'emplacement par défaut, `%USERPROFILE%\\OneDrive`.
 *
 * `null` quand rien n'est trouvé : la sauvegarde se désactive alors d'elle-même
 * plutôt que d'écrire dans un dossier qui ne se synchronise pas — ce qui
 * donnerait une fausse impression de sécurité.
 */
import { app } from 'electron'
import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Sous-dossier écrit dans OneDrive. Deux niveaux : le dossier de l'app, puis ses sauvegardes. */
export const BACKUP_SUBFOLDER = ['Kinesio-Outils', 'backups'] as const

/**
 * Résultat mémoïsé.
 *
 * `findOneDriveRoot()` est appelé à chaque ouverture des Paramètres. Sans cache,
 * un PC sans variable d'environnement paierait une interrogation du registre à
 * chaque fois. `undefined` = pas encore cherché, `null` = cherché sans succès.
 */
let cache: string | null | undefined

/**
 * Le dossier racine OneDrive, ou `null`.
 *
 * Le résultat est retenu pour la durée de la session : OneDrive ne se déplace
 * pas pendant qu'on travaille, et si Marie l'installe en cours de route un
 * redémarrage de l'app suffit.
 */
export async function findOneDriveRoot(): Promise<string | null> {
  if (cache !== undefined) return cache
  cache = await chercherRacine()
  return cache
}

/** Vide le cache — sert aux tests et à un éventuel bouton « revérifier ». */
export function forgetOneDriveRoot(): void {
  cache = undefined
}

async function chercherRacine(): Promise<string | null> {
  // OneDrive n'existe que sur Windows ; ailleurs on ne prétend rien.
  if (process.platform !== 'win32') return null

  // 1. Variables posées par le client OneDrive. `OneDrive` suit le compte
  //    principal ; les deux autres distinguent perso et professionnel.
  for (const candidat of [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial]) {
    if (candidat && existsSync(candidat)) return candidat
  }

  // 2. Le registre. On interroge TOUS les comptes d'un coup plutôt que
  //    `\\Personal` seul : un PC uniquement professionnel n'a pas cette clé, et
  //    la sous-clé `FileCoAuth` qui traîne là n'est pas un compte — elle ne
  //    porte pas de `UserFolder` et se fait donc écarter d'elle-même.
  const duRegistre = await lireRegistre()
  if (duRegistre) return duRegistre

  // 3. L'emplacement par défaut de l'installation.
  const defaut = join(app.getPath('home'), 'OneDrive')
  return existsSync(defaut) ? defaut : null
}

async function lireRegistre(): Promise<string | null> {
  try {
    // Arguments passés en tableau : aucun shell, donc aucune interprétation des
    // antislashes du chemin de clé.
    const { stdout } = await execFileAsync(
      'reg.exe',
      ['query', 'HKCU\\Software\\Microsoft\\OneDrive\\Accounts', '/s', '/v', 'UserFolder'],
      { timeout: 5000, windowsHide: true }
    )
    for (const ligne of stdout.split(/\r?\n/)) {
      const m = /^\s*UserFolder\s+REG_SZ\s+(.+?)\s*$/.exec(ligne)
      if (m && existsSync(m[1])) return m[1]
    }
  } catch {
    // reg.exe absent, clé absente, délai dépassé : on passe au repli suivant.
  }
  return null
}

/**
 * Le dossier de sauvegarde dans OneDrive, créé au besoin.
 *
 * `null` si OneDrive est introuvable. Ne crée rien dans ce cas : un dossier
 * `Kinesio-Outils` posé hors de OneDrive ne serait jamais synchronisé.
 */
export async function ensureBackupFolder(): Promise<string | null> {
  const racine = await findOneDriveRoot()
  if (!racine) return null
  const dossier = join(racine, ...BACKUP_SUBFOLDER)
  await mkdir(dossier, { recursive: true })
  return dossier
}
