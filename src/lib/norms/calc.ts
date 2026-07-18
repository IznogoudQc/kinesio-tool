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

/** Échelle 0-4 : une catégorie = un point entier (À améliorer = 0 … Excellent = 4).
 *  Cette échelle reproduit celle de l'ancien logiciel de Marie (« Résultats de 0
 *  à 4 ; ≥ 3.5 = Excellent »), pour que les scores composites soient directement
 *  comparables aux anciens bilans. Un score moyen se lit avec une jauge à 4 points. */
const CATEGORY_TO_SCORE: Record<Category, number> = {
  A_AMELIORER: 0,
  ACCEPTABLE: 1,
  BIEN: 2,
  TRES_BIEN: 3,
  EXCELLENT: 4
}

export function categoryToScore(c: Category | null): number | null {
  return c === null ? null : CATEGORY_TO_SCORE[c]
}

/** Score 0-4 → Category. Bornes aux milieux entre deux niveaux :
 *  <0.5 = À améliorer, <1.5 = Acceptable, <2.5 = Bien, <3.5 = Très bien, sinon Excellent.
 *  Le seuil Excellent ≥ 3.5 est identique à celui de l'ancien logiciel. */
export function scoreToCategory(score: number | null): Category | null {
  if (score === null || !Number.isFinite(score)) return null
  if (score < 0.5) return 'A_AMELIORER'
  if (score < 1.5) return 'ACCEPTABLE'
  if (score < 2.5) return 'BIEN'
  if (score < 3.5) return 'TRES_BIEN'
  return 'EXCELLENT'
}
