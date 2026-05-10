/** Logique de comparaison de valeurs entre deux bilans (indicateurs ▲▼). */

/** Champs où une *baisse* de la valeur est une amélioration. */
export const LOWER_IS_BETTER: ReadonlySet<keyof BilanData> = new Set([
  'pourcentage_gras',
  'tour_taille_cm',
  'tour_hanche_cm',
  'imc',
  'fc_repos',
  'pa_systolique',
  'pa_diastolique',
  'pli_triceps',
  'pli_biceps',
  'pli_sous_scap',
  'pli_iliaque',
  'pli_mollet',
  'pli_cuisse',
  'poids_kg'
])

export function isLowerBetter(key: keyof BilanData): boolean {
  return LOWER_IS_BETTER.has(key)
}

export interface ValueComparison {
  /** latest - previous */
  delta: number
  /** Variation relative en %, signée. 0 si la valeur précédente est 0. */
  percent: number
  /** true si l'évolution va dans le « bon » sens (selon lowerIsBetter). */
  isImprovement: boolean
  arrow: '▲' | '▼' | '='
}

export function compareValue(latest: number, previous: number, lowerIsBetter: boolean): ValueComparison {
  const delta = latest - previous
  if (delta === 0) {
    return { delta: 0, percent: 0, isImprovement: false, arrow: '=' }
  }
  const percent = previous === 0 ? 0 : (delta / Math.abs(previous)) * 100
  const arrow: '▲' | '▼' = delta > 0 ? '▲' : '▼'
  const isImprovement = lowerIsBetter ? delta < 0 : delta > 0
  return { delta, percent, isImprovement, arrow }
}

/**
 * Compare un champ numérique d'un bilan au même champ d'un bilan antérieur.
 * Retourne `null` si l'une des deux valeurs est absente (rien à comparer).
 */
export function compareField(
  key: keyof BilanData,
  latest: BilanData,
  previous: BilanData | null | undefined
): ValueComparison | null {
  const a = latest[key]
  const b = previous?.[key]
  if (typeof a !== 'number' || typeof b !== 'number') return null
  return compareValue(a, b, isLowerBetter(key))
}
