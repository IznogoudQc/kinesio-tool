/** Helpers de calcul purs (sans dépendance aux tables ACSM/CPAFLA).
 *
 *  Séparés de `scoring.ts` pour que les tests `node --test` puissent les
 *  charger sans tirer toute la chaîne d'imports (qui exigerait des `.ts`
 *  explicites partout — incompatible avec tsc/vite).
 */

import type { Category } from './types'

/** IMC = poids (kg) / (taille (m))². Retourne `null` si une donnée manque. */
export function computeBmi(tailleCm: number | undefined, poidsKg: number | undefined): number | null {
  if (!tailleCm || !poidsKg || tailleCm <= 0) return null
  const m = tailleCm / 100
  return poidsKg / (m * m)
}

/** MET équivalent = VO2max / 3.5 (convention historique : 1 MET = 3.5 ml/kg/min). */
export function computeMet(vo2max: number | undefined): number | null {
  if (typeof vo2max !== 'number' || !Number.isFinite(vo2max) || vo2max <= 0) return null
  return vo2max / 3.5
}

/** FC max prédite via la formule de Tanaka (2001) : 208 - 0.7 × âge.
 *  Plus précise que Karvonen (220 - âge) pour les adultes, en particulier après 40 ans. */
export function computeFcMaxPredite(age: number | null): number | null {
  if (age === null || !Number.isFinite(age) || age < 0) return null
  return 208 - 0.7 * age
}

/** Échelle CSEP-like : milieu de chaque tranche [0,1[ … [4,5[. Permet de
 *  visualiser un score moyen avec une jauge à 5 points alignée sur la catégorie. */
const CATEGORY_TO_SCORE: Record<Category, number> = {
  A_AMELIORER: 0.5,
  ACCEPTABLE: 1.5,
  BIEN: 2.5,
  TRES_BIEN: 3.5,
  EXCELLENT: 4.5
}

export function categoryToScore(c: Category | null): number | null {
  return c === null ? null : CATEGORY_TO_SCORE[c]
}

/** Score 0-5 → Category. Bornes alignées sur les milieux de tranche :
 *  <1.0 = À améliorer, <2.0 = Acceptable, <3.0 = Bien, <4.0 = Très bien, sinon Excellent. */
export function scoreToCategory(score: number | null): Category | null {
  if (score === null || !Number.isFinite(score)) return null
  if (score < 1.0) return 'A_AMELIORER'
  if (score < 2.0) return 'ACCEPTABLE'
  if (score < 3.0) return 'BIEN'
  if (score < 4.0) return 'TRES_BIEN'
  return 'EXCELLENT'
}
