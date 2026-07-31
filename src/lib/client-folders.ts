/**
 * Organisation du dossier d'un client sur le disque.
 *
 * Tous les documents atterrissaient à plat dans `<Documents>/<Client>/`. Avec
 * les bilans, la nutrition, le journal alimentaire et maintenant les Q-AAP
 * signés, le dossier devenait illisible. Trois sous-dossiers, demandés par
 * Marie-Eve :
 *
 *     <Documents configurés>/
 *       Nicholas Jean/
 *         Bilan et mesure/
 *         Nutrition/
 *         Questionnaires et Notes/
 *
 * Module **pur** (aucun accès disque) pour que les noms soient testables : une
 * faute de frappe entre le code qui écrit et celui qui ouvre créerait un
 * répertoire fantôme, et Marie chercherait ses documents dans le mauvais.
 */

/** Les trois rayons du dossier client. */
export type ClientFolderKind = 'bilans' | 'nutrition' | 'questionnaires'

/**
 * Nom de chaque sous-dossier, tel qu'il apparaît dans l'explorateur.
 *
 * Libellés fournis par Marie-Eve — ne pas « corriger » l'orthographe ni le
 * singulier de « Bilan et mesure » : elle retrouve ses dossiers par ce nom, et
 * un renommage laisserait l'ancien répertoire orphelin à côté du nouveau.
 */
export const CLIENT_FOLDERS: Record<ClientFolderKind, string> = {
  bilans: 'Bilan et mesure',
  nutrition: 'Nutrition',
  questionnaires: 'Questionnaires et Notes'
}

/** Les trois noms, dans l'ordre d'affichage. */
export const CLIENT_FOLDER_NAMES: string[] = [
  CLIENT_FOLDERS.bilans,
  CLIENT_FOLDERS.nutrition,
  CLIENT_FOLDERS.questionnaires
]

/** Caractères qu'un nom de dossier ne peut pas contenir sous Windows. */
const CARACTERES_INTERDITS = ['\\', '/', ':', '*', '?', '"', '<', '>', '|']

/**
 * Un nom de dossier est-il créable tel quel sous Windows ?
 *
 * Vérifié parce que ces noms deviennent de vrais répertoires : un nom invalide
 * ferait échouer la création au moment d'exporter, c'est-à-dire devant un
 * client.
 *
 * Liste explicite plutôt qu'une expression régulière : la version précédente
 * avait perdu l'antislash à force d'échappements successifs, et acceptait donc
 * un nom qui aurait cassé le chemin.
 */
export function isValidFolderName(name: string): boolean {
  // Vide, ou entouré d'espaces : Windows les rogne en silence, ce qui ferait
  // diverger le nom écrit du nom réel du répertoire.
  if (name.trim() === '' || name !== name.trim()) return false
  // Les espaces INTERNES sont légitimes — deux des trois noms en contiennent.
  for (const c of name) {
    if (CARACTERES_INTERDITS.includes(c)) return false
    if (c.charCodeAt(0) < 0x20) return false
  }
  // Un nom terminé par un point est refusé par Windows.
  return !name.endsWith('.')
}
