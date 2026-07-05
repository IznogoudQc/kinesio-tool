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

/** Échelle 1-5 : une catégorie = un point entier (À améliorer = 1 … Excellent = 5).
 *  Un client « tout Excellent » obtient donc 5/5 (plus intuitif pour le client
 *  qu'un plafond à 4,5). Un score moyen se lit avec une jauge à 5 points. */
const CATEGORY_TO_SCORE: Record<Category, number> = {
  A_AMELIORER: 1,
  ACCEPTABLE: 2,
  BIEN: 3,
  TRES_BIEN: 4,
  EXCELLENT: 5
}

export function categoryToScore(c: Category | null): number | null {
  return c === null ? null : CATEGORY_TO_SCORE[c]
}

/** Score 1-5 → Category. Bornes aux milieux entre deux niveaux :
 *  <1.5 = À améliorer, <2.5 = Acceptable, <3.5 = Bien, <4.5 = Très bien, sinon Excellent. */
export function scoreToCategory(score: number | null): Category | null {
  if (score === null || !Number.isFinite(score)) return null
  if (score < 1.5) return 'A_AMELIORER'
  if (score < 2.5) return 'ACCEPTABLE'
  if (score < 3.5) return 'BIEN'
  if (score < 4.5) return 'TRES_BIEN'
  return 'EXCELLENT'
}
