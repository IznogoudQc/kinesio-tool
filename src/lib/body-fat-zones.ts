/** Zones de pourcentage de gras corporel, **ajustées selon l'âge**, dérivées
 *  directement des normes **ACSM (11ᵉ éd.)** déjà utilisées par l'app pour
 *  catégoriser le % de gras (`src/lib/norms/acsm.ts`, table `BODY_FAT`).
 *
 *  Comme la barre reprend exactement les cinq catégories du moteur de normes
 *  (À améliorer / Acceptable / Bien / Très bien / Excellent), le nom de la zone
 *  du client **coïncide toujours** avec la catégorie affichée ailleurs — plus de
 *  contradiction possible entre « la barre » et « la catégorie ».
 *
 *  Source unique pour le document client, le rapport PDF et le Dashboard.
 *  Référence : American College of Sports Medicine, *Guidelines for Exercise
 *  Testing and Prescription*, 11ᵉ éd.
 */

import { getCategorization, getNormPercentiles } from './norms/index.ts'
import { CATEGORY_LABELS, type Category, type NormsType } from './norms/types.ts'

export { CATEGORY_LABELS }
export type { Category }

/** Couleurs hex des cinq zones — équivalents des classes Tailwind de
 *  `CATEGORY_COLORS` (cohérence Dashboard / BilanDetail / document client). */
export const BF_CAT_HEX: Record<Category, string> = {
  A_AMELIORER: '#ef4444', // red-500
  ACCEPTABLE: '#f97316', // orange-500
  BIEN: '#ca8a04', // yellow-600
  TRES_BIEN: '#22c55e', // green-500
  EXCELLENT: '#15803d' // green-700
}

export interface BfZone {
  category: Category
  label: string
  /** Borne inférieure incluse (%). */
  min: number
  /** Borne supérieure exclue (%), ou `null` = pas de plafond. */
  max: number | null
}

export interface BodyFatScale {
  zones: BfZone[]
  scaleMax: number
  /** Zone où se situe le client, ou `null` si `pct`/`sex`/`âge` manquent. */
  current: BfZone | null
  /** Position 0–1 du repère sur l'échelle (bornée). */
  markerRatio: number | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Prépare tout le nécessaire pour dessiner la barre + situer le client, à
 *  partir des percentiles ACSM pour ce profil (âge + sexe). Renvoie `null` si le
 *  profil est incomplet ou si la norme ne couvre pas ce cas. */
export function bodyFatScale(
  pct: number | null | undefined,
  sex: 'F' | 'M' | null,
  age: number | null,
  norms: NormsType = 'acsm'
): BodyFatScale | null {
  if (sex !== 'F' && sex !== 'M') return null
  if (typeof age !== 'number' || !Number.isFinite(age)) return null
  const range = getNormPercentiles('bodyFat', age, sex, norms)
  // % de gras est un test « lowerIsBetter » : sans ça, l'ordre des zones serait faux.
  if (!range || !range.lowerIsBetter) return null

  const { p10, p25, p50, p75 } = range.percentiles
  // Ordre croissant de % de gras → gauche (peu de gras, Excellent) vers droite.
  // Cutoffs identiques à `categorize()` : < p75 Excellent … ≥ p10 À améliorer.
  const zones: BfZone[] = [
    { category: 'EXCELLENT', label: CATEGORY_LABELS.EXCELLENT, min: 0, max: p75 },
    { category: 'TRES_BIEN', label: CATEGORY_LABELS.TRES_BIEN, min: p75, max: p50 },
    { category: 'BIEN', label: CATEGORY_LABELS.BIEN, min: p50, max: p25 },
    { category: 'ACCEPTABLE', label: CATEGORY_LABELS.ACCEPTABLE, min: p25, max: p10 },
    { category: 'A_AMELIORER', label: CATEGORY_LABELS.A_AMELIORER, min: p10, max: null }
  ]

  // « À améliorer » est ouvert vers le haut ; on laisse une marge visible à droite.
  const scaleMax = p10 + 12
  const p = num(pct)
  const currentCat = p === null ? null : getCategorization('bodyFat', p, age, sex, norms)
  const current = currentCat ? (zones.find(z => z.category === currentCat) ?? null) : null
  const markerRatio = p === null ? null : Math.max(0, Math.min(1, p / scaleMax))
  return { zones, scaleMax, current, markerRatio }
}
