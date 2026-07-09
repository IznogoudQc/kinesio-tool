/** Catalogue des circonférences prises en note, et quelles mesures Marie-Eve
 *  souhaite réellement saisir. Toutes les colonnes existent toujours en base :
 *  masquer un champ n'efface aucune donnée déjà enregistrée. */

export interface MesureField {
  key: MesureFieldKey
  label: string
  /** Colonne du formulaire : la silhouette occupe la colonne centrale. */
  side: 'left' | 'right'
}

/** Ordre d'affichage : chaque paire gauche/droite occupe une ligne. */
export const MESURE_FIELDS: MesureField[] = [
  { key: 'cou', label: 'Cou', side: 'left' },
  { key: 'epaule', label: 'Épaule', side: 'right' },
  { key: 'bicepsG', label: 'Biceps G', side: 'left' },
  { key: 'bicepsD', label: 'Biceps D', side: 'right' },
  { key: 'poitrine', label: 'Poitrine', side: 'left' },
  { key: 'taille', label: 'Taille', side: 'right' },
  { key: 'abdomen', label: 'Abdomen', side: 'left' },
  { key: 'hanche', label: 'Hanche', side: 'right' },
  { key: 'cuisseG', label: 'Cuisse G', side: 'left' },
  { key: 'cuisseD', label: 'Cuisse D', side: 'right' },
  { key: 'molletG', label: 'Mollet G', side: 'left' },
  { key: 'molletD', label: 'Mollet D', side: 'right' }
]

export const ALL_MESURE_FIELD_KEYS: MesureFieldKey[] = MESURE_FIELDS.map(f => f.key)

/** Taille et hanche pilotent le ratio Taille/Hanche — les masquer le ferait disparaître. */
export const REQUIRED_MESURE_FIELD_KEYS: MesureFieldKey[] = ['taille', 'hanche']

/**
 * Champs à afficher, dans l'ordre du catalogue.
 * `enabled === null` (réglage jamais enregistré) → tout est affiché.
 * Les champs obligatoires sont réintroduits même si absents du réglage.
 */
export function visibleMesureFields(enabled: MesureFieldKey[] | null): MesureField[] {
  if (enabled === null) return MESURE_FIELDS
  const set = new Set<MesureFieldKey>([...enabled, ...REQUIRED_MESURE_FIELD_KEYS])
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
