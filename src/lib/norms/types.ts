/** Catégorisation des résultats de tests physiques selon une norme pluggable.
 *
 *  Le système supporte plusieurs jeux de tables (ACSM, CPAFLA…). Chaque jeu
 *  fournit une fonction `get<Norm>Range(test, age, sex)` qui retourne, ou non,
 *  une plage de seuils pour le triplet (test, âge, sexe). La fonction
 *  publique `getCategorization` (voir `./index.ts`) compare la valeur à ces
 *  seuils pour retourner une `Category`.
 */

export type Category =
  | 'A_AMELIORER'
  | 'ACCEPTABLE'
  | 'BIEN'
  | 'TRES_BIEN'
  | 'EXCELLENT'

export const CATEGORY_LABELS: Record<Category, string> = {
  A_AMELIORER: 'À améliorer',
  ACCEPTABLE: 'Acceptable',
  BIEN: 'Bien',
  TRES_BIEN: 'Très bien',
  EXCELLENT: 'Excellent'
}

/** Couleurs Tailwind associées (cohérentes Dashboard / BilanDetail). */
export const CATEGORY_COLORS: Record<Category, string> = {
  A_AMELIORER: 'text-red-500',
  ACCEPTABLE: 'text-orange-500',
  BIEN: 'text-yellow-600',
  TRES_BIEN: 'text-green-500',
  EXCELLENT: 'text-green-700 font-semibold'
}

export type TestKey =
  | 'vo2max'
  | 'pushups'
  | 'situps'
  | 'verticalJump'
  | 'legPower'        // watts
  | 'trunkFlexion'    // cm
  | 'backEndurance'   // sec
  | 'bodyFat'         // %
  | 'bmi'             // kg/m²
  | 'waistCircumference' // cm
  | 'bloodPressureSystolic'   // mmHg — seuils cliniques (clinical.ts)
  | 'bloodPressureDiastolic'  // mmHg — seuils cliniques (clinical.ts)
  | 'restingHeartRate'        // bpm  — seuils cliniques (clinical.ts)

export type NormsType = 'acsm' | 'cpafla'

export const DEFAULT_NORMS: NormsType = 'acsm'

/** Percentiles ACSM (P10, P25, P50, P75, P90) — la base de toute catégorisation.
 *  La catégorie est dérivée des cutoffs P10/P25/P50/P75 :
 *    < P10           → A_AMELIORER
 *    P10 ≤ x < P25   → ACCEPTABLE
 *    P25 ≤ x < P50   → BIEN
 *    P50 ≤ x < P75   → TRES_BIEN
 *    ≥ P75           → EXCELLENT
 *  P90 sert au calcul de delta vs moyenne et à l'affichage du percentile fin.
 *
 *  Pour un test `lowerIsBetter` (% gras, IMC, tour de taille) : les valeurs
 *  sont rangées en ordre **décroissant** (p10 > p25 > p50 > p75 > p90), parce
 *  qu'une valeur basse = bonne performance = percentile élevé. */
export interface NormPercentiles {
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export interface NormRange {
  ageMin: number
  ageMax: number
  sex: 'F' | 'M'
  percentiles: NormPercentiles
  /** Si true, valeur basse = meilleure performance (% gras, IMC, tour de taille). */
  lowerIsBetter?: boolean
}

export interface NormSet {
  getRange(test: TestKey, age: number, sex: 'F' | 'M'): NormRange | null
}
