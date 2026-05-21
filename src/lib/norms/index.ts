/** API publique du système de catégorisation.
 *
 *  Les tables ACSM fournissent désormais les percentiles P10/P25/P50/P75/P90
 *  pour chaque (test, tranche d'âge, sexe). La catégorie est dérivée :
 *    < P10           → A_AMELIORER
 *    P10 ≤ x < P25   → ACCEPTABLE
 *    P25 ≤ x < P50   → BIEN
 *    P50 ≤ x < P75   → TRES_BIEN
 *    ≥ P75           → EXCELLENT
 *  P90 sert à l'interpolation fine du percentile (≥80) et au delta vs moyenne.
 */

import { getAcsmRange } from './acsm'
import { getCpaflaRange } from './cpafla'
import { getClinicalRange } from './clinical'
import type { Category, NormPercentiles, NormRange, NormsType, TestKey } from './types'

export type { Category, NormsType, TestKey, NormRange, NormPercentiles } from './types'
export { CATEGORY_LABELS, CATEGORY_COLORS, DEFAULT_NORMS } from './types'

function getRange(test: TestKey, age: number, sex: 'F' | 'M', norms: NormsType): NormRange | null {
  // Les seuils cliniques (PA, FC repos) priment et sont indépendants du jeu de
  // normes fitness sélectionné — ils ne figurent pas dans les tables ACSM/CPAFLA.
  const clinical = getClinicalRange(test, sex)
  if (clinical) return clinical
  return norms === 'cpafla' ? getCpaflaRange(test, age, sex) : getAcsmRange(test, age, sex)
}

/** Dérive une `Category` à partir d'une valeur et des percentiles ACSM. */
export function getCategorization(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): Category | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (typeof age !== 'number' || age < 0) return null
  const range = getRange(test, age, sex, norms)
  if (!range) return null
  return categorize(value, range.percentiles, range.lowerIsBetter ?? false)
}

function categorize(value: number, p: NormPercentiles, lowerIsBetter: boolean): Category {
  if (lowerIsBetter) {
    if (value < p.p75) return 'EXCELLENT'
    if (value < p.p50) return 'TRES_BIEN'
    if (value < p.p25) return 'BIEN'
    if (value < p.p10) return 'ACCEPTABLE'
    return 'A_AMELIORER'
  }
  if (value >= p.p75) return 'EXCELLENT'
  if (value >= p.p50) return 'TRES_BIEN'
  if (value >= p.p25) return 'BIEN'
  if (value >= p.p10) return 'ACCEPTABLE'
  return 'A_AMELIORER'
}

/** Interpole un percentile (0-100) à partir d'une valeur et des P10/P25/P50/P75/P90.
 *  Le résultat est borné [0, 100]. Pour les tests `lowerIsBetter`, une valeur
 *  basse → percentile élevé (meilleure performance). */
export function getPercentile(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const range = getRange(test, age, sex, norms)
  if (!range) return null
  return interpolatePercentile(value, range.percentiles, range.lowerIsBetter ?? false)
}

/** Moyenne population (= P50) pour ce profil. */
export function getPopulationAverage(
  test: TestKey,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): number | null {
  const range = getRange(test, age, sex, norms)
  return range?.percentiles.p50 ?? null
}

/** Retourne les 5 percentiles + flag `lowerIsBetter` pour ce profil. Utilisé
 *  par `<CategoryRangeBar>` pour afficher les seuils + le marqueur. */
export function getNormPercentiles(
  test: TestKey,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): { percentiles: NormPercentiles; lowerIsBetter: boolean } | null {
  const range = getRange(test, age, sex, norms)
  if (!range) return null
  return { percentiles: range.percentiles, lowerIsBetter: range.lowerIsBetter ?? false }
}

/** Delta en % vs moyenne (P50), positif = meilleure performance, négatif = pire.
 *  Pour les tests `lowerIsBetter`, le signe est inversé pour rester intuitif. */
export function getDeltaVsAverage(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): { deltaPct: number; isBetter: boolean } | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const range = getRange(test, age, sex, norms)
  if (!range) return null
  const p50 = range.percentiles.p50
  if (p50 === 0) return null
  const raw = ((value - p50) / p50) * 100
  const lowerIsBetter = range.lowerIsBetter ?? false
  const deltaPct = lowerIsBetter ? -raw : raw
  return { deltaPct: Math.round(deltaPct * 10) / 10, isBetter: deltaPct >= 0 }
}

function interpolatePercentile(value: number, p: NormPercentiles, lowerIsBetter: boolean): number {
  // Les anchors sont toujours rangés dans l'ordre "performance croissante" :
  //   higher-is-better → [p10, p25, p50, p75, p90] en valeurs absolues croissantes
  //   lower-is-better  → on lit pareil mais en inversant le sens de comparaison
  const anchors = [
    { perc: 10, value: p.p10 },
    { perc: 25, value: p.p25 },
    { perc: 50, value: p.p50 },
    { perc: 75, value: p.p75 },
    { perc: 90, value: p.p90 }
  ]

  const performance = (v: number) => (lowerIsBetter ? -v : v)
  const v = performance(value)

  // Cas en dehors des bornes — extrapolation linéaire douce, clampée à [0, 100].
  if (v <= performance(anchors[0].value)) {
    const a = anchors[0]
    const b = anchors[1]
    const slope = (b.perc - a.perc) / (performance(b.value) - performance(a.value))
    const extr = a.perc + slope * (v - performance(a.value))
    return Math.max(0, Math.round(extr * 10) / 10)
  }
  if (v >= performance(anchors[anchors.length - 1].value)) {
    const a = anchors[anchors.length - 2]
    const b = anchors[anchors.length - 1]
    const slope = (b.perc - a.perc) / (performance(b.value) - performance(a.value))
    const extr = b.perc + slope * (v - performance(b.value))
    return Math.min(100, Math.round(extr * 10) / 10)
  }

  // Interpolation linéaire entre deux anchors adjacents.
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    const pa = performance(a.value)
    const pb = performance(b.value)
    if (v >= pa && v <= pb) {
      const slope = (b.perc - a.perc) / (pb - pa)
      const result = a.perc + slope * (v - pa)
      return Math.round(result * 10) / 10
    }
  }
  return 50
}

/** Cible « niveau suivant » pour un test donné — pour afficher un objectif
 *  motivant sur les hero stats du dashboard.
 *
 *  Retour :
 *    - `null` si valeur/profil invalide ou test hors barème.
 *    - `{ nextCategory: 'EXCELLENT', targetValue: value, delta: 0, isAtTop: true }`
 *      si le client est déjà au niveau max → on affiche un trophée côté UI.
 *    - Sinon : la catégorie immédiatement supérieure (`nextCategory`), la valeur
 *      seuil à atteindre (`targetValue`), et le delta **signé** `targetValue - value`.
 *      Pour higher-is-better, delta positif = augmenter. Pour lower-is-better,
 *      delta négatif = diminuer.
 */
export interface NextCategoryTarget {
  nextCategory: Category
  targetValue: number
  delta: number
  isAtTop: boolean
}

export function getNextCategoryTarget(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): NextCategoryTarget | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (typeof age !== 'number' || age < 0) return null
  const range = getRange(test, age, sex, norms)
  if (!range) return null

  const lowerIsBetter = range.lowerIsBetter ?? false
  const current = categorize(value, range.percentiles, lowerIsBetter)

  if (current === 'EXCELLENT') {
    return { nextCategory: 'EXCELLENT', targetValue: value, delta: 0, isAtTop: true }
  }

  // Le seuil à atteindre pour passer à la catégorie supérieure est la borne
  // haute de la catégorie courante. La même clé `pXX` fait l'affaire pour
  // higher-is-better ET lower-is-better (la table inverse l'ordre des valeurs
  // sur l'axe, mais pas la signification des clés).
  const nextThresholdMap: Record<
    Exclude<Category, 'EXCELLENT'>,
    { next: Category; key: keyof NormPercentiles }
  > = {
    A_AMELIORER: { next: 'ACCEPTABLE', key: 'p10' },
    ACCEPTABLE: { next: 'BIEN', key: 'p25' },
    BIEN: { next: 'TRES_BIEN', key: 'p50' },
    TRES_BIEN: { next: 'EXCELLENT', key: 'p75' }
  }
  const { next, key } = nextThresholdMap[current]
  const targetValue = range.percentiles[key]
  const delta = Math.round((targetValue - value) * 10) / 10

  return { nextCategory: next, targetValue, delta, isAtTop: false }
}

/** Calcule l'âge (entier) à partir d'une date de naissance ISO `AAAA-MM-JJ`
 *  et d'une date de référence (par défaut : aujourd'hui). Retourne `null` si
 *  la date de naissance est invalide. */
export function computeAge(birthdate: string | null | undefined, refDate: Date = new Date()): number | null {
  if (!birthdate) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null

  let age = refDate.getFullYear() - y
  const monthDiff = refDate.getMonth() + 1 - mo
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < d)) age--
  return age < 0 ? null : age
}
