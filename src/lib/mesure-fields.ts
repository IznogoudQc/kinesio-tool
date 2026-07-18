/** Catalogue des circonférences prises en note, et quelles mesures Marie-Eve
 *  souhaite réellement saisir. Toutes les colonnes existent toujours en base :
 *  masquer un champ n'efface aucune donnée déjà enregistrée. */

export interface MesureField {
  key: MesureFieldKey
  label: string
  /** Colonne du formulaire : la silhouette occupe la colonne centrale. */
  side: 'left' | 'right'
}

/**
 * Ordre d'affichage : chaque paire gauche/droite occupe une ligne.
 *
 * Les 5 premiers correspondent aux circonférences du BILAN (celles que Marie-Eve
 * utilise) — mêmes libellés, même ordre : Taille, Hanche, Biceps fléchi,
 * Cuisse (2 po du genou), Épaules et pec. Leur appariement gauche/droite est
 * choisi pour que la tabulation suive cet ordre :
 *   ligne 1 : Taille · Hanche   ligne 2 : Biceps fléchi · Cuisse   ligne 3 : Épaules et pec.
 * Les colonnes réutilisées : « Biceps fléchi » = `bicepsG`, « Cuisse (2 po du
 * genou) » = `cuisseG`, « Épaules et pec » = `epaule` (pas de migration).
 *
 * On ne liste QUE les 5 circonférences utilisées par Marie. Les autres colonnes
 * existent encore en base (données anciennes préservées, non effacées à l'édition
 * — voir `ALL_CIRC_KEYS` dans MesuresTab) mais ne sont plus proposées à la saisie
 * ni dans le sélecteur de champs.
 */
export const MESURE_FIELDS: MesureField[] = [
  { key: 'taille', label: 'Taille', side: 'left' },
  { key: 'hanche', label: 'Hanche', side: 'right' },
  { key: 'bicepsG', label: 'Biceps fléchi', side: 'left' },
  { key: 'cuisseG', label: 'Cuisse (2 po du genou)', side: 'right' },
  { key: 'epaule', label: 'Épaules et pec', side: 'left' }
]

export const ALL_MESURE_FIELD_KEYS: MesureFieldKey[] = MESURE_FIELDS.map(f => f.key)

/**
 * Champs affichés PAR DÉFAUT (réglage jamais enregistré) = les 5 circonférences
 * du bilan, dans l'ordre. Marie-Eve peut en activer d'autres dans Paramètres.
 */
export const DEFAULT_MESURE_FIELD_KEYS: MesureFieldKey[] = ['taille', 'hanche', 'bicepsG', 'cuisseG', 'epaule']

/** Taille et hanche pilotent le ratio Taille/Hanche — les masquer le ferait disparaître. */
export const REQUIRED_MESURE_FIELD_KEYS: MesureFieldKey[] = ['taille', 'hanche']

/**
 * Champs à afficher, dans l'ordre du catalogue.
 * `enabled === null` (réglage jamais enregistré) → les 5 champs par défaut.
 * Les champs obligatoires sont réintroduits même si absents du réglage.
 */
export function visibleMesureFields(enabled: MesureFieldKey[] | null): MesureField[] {
  const keys = enabled === null ? DEFAULT_MESURE_FIELD_KEYS : enabled
  const set = new Set<MesureFieldKey>([...keys, ...REQUIRED_MESURE_FIELD_KEYS])
  return MESURE_FIELDS.filter(f => set.has(f.key))
}

/**
 * Lignes `[gauche, droite]` du formulaire.
 *
 * L'appariement est **figé par le catalogue** : chaque mesure garde la ligne qui
 * correspond à sa position sur le corps (le cou est en haut, les mollets en bas).
 * Masquer « Cou » laisse donc sa place vide — « Biceps G » ne remonte pas.
 *
 * Seule exception : une ligne dont les deux côtés sont masqués disparaît, sinon
 * le formulaire garderait un trou béant.
 */
export function mesureRows(enabled: MesureFieldKey[] | null): [MesureField | null, MesureField | null][] {
  const visible = new Set(visibleMesureFields(enabled).map(f => f.key))
  const left = MESURE_FIELDS.filter(f => f.side === 'left')
  const right = MESURE_FIELDS.filter(f => f.side === 'right')

  const rows: [MesureField | null, MesureField | null][] = []
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i] && visible.has(left[i].key) ? left[i] : null
    const r = right[i] && visible.has(right[i].key) ? right[i] : null
    if (l || r) rows.push([l, r])
  }
  return rows
}
