/** Notes combinées CPAFLA / ÉCPHV (Guide du conseiller CPHV, 3ᵉ éd.).
 *
 *  Le guide n'agrège PAS les cotes par simple moyenne : chaque test reçoit une
 *  **note pondérée** (cote 0-4 × poids), on somme (« note obtenue »), on somme les
 *  maxima des tests **présents** (« note maximale »), puis un **nomogramme**
 *  (Fig. 7-21 musculo / 7-25 dos) convertit le couple (max, obtenue) en score 0-4.
 *
 *  Nomogramme ≡ `arrondi-inférieur-à-la-demie(obtenue / max × 4)` — validé sur les
 *  exemples résolus du guide (santé du dos : 23/28 → 3 ; musculo : 13/32 → 2).
 *
 *  Poids (Fig. 7-20 / 7-24), **par sexe**. Deux mesures du guide sont volontairement
 *  exclues car l'app ne les capte pas (choix de Marie — repli par note max réduite) :
 *    · Force de préhension (dynamomètre) — note combinée musculo
 *    · Niveau d'activité physique       — indice de santé du dos
 *  Voir ADR 0026.
 */

import type { Category } from './types.ts'

/** Cote 0-4 d'une catégorie (Fig. 7-22 / 7-26 : E=4, TB=3, B=2, A=1, AA=0). */
const CATEGORY_BASE: Record<Category, number> = {
  A_AMELIORER: 0,
  ACCEPTABLE: 1,
  BIEN: 2,
  TRES_BIEN: 3,
  EXCELLENT: 4
}

/** Arrondi « à la demie inférieure » (3.5 → 3, 2.5 → 2, 0.5 → 0) — reproduit le
 *  nomogramme CPAFLA. `Math.ceil(x − 0.5)` = round-half-down pour x ≥ 0. */
function roundHalfDown(x: number): number {
  const r = Math.ceil(x - 0.5)
  return r === 0 ? 0 : r // normalise -0 → 0
}

/** Une contribution : la cote 0-4 du test (ou `null` si non mesuré) et son poids. */
export type CpaflaContribution = [score: number | null, weight: number]

/** Combine des cotes 0-4 pondérées → score combiné 0-4 via le nomogramme CPAFLA.
 *  Les tests `null` (non mesurés) sont exclus de la note obtenue ET de la note max.
 *  `null` si aucun test présent. */
export function cpaflaCombine(contribs: CpaflaContribution[]): number | null {
  let obtenue = 0
  let max = 0
  for (const [score, weight] of contribs) {
    if (score === null || Number.isNaN(score)) continue
    obtenue += score * weight
    max += 4 * weight
  }
  if (max === 0) return null
  return roundHalfDown((obtenue / max) * 4)
}

/** Idem mais à partir de catégories (pratique pour les tests). */
export function cpaflaCombineCategories(items: [Category | null, number][]): number | null {
  return cpaflaCombine(items.map(([cat, w]) => [cat === null ? null : CATEGORY_BASE[cat], w]))
}

/** Poids par test et par sexe. `préhension` et `activité` ne sont pas listés : non
 *  captés par l'app, donc jamais dans le calcul (note max réduite en conséquence). */

/** Note combinée — aptitudes musculosquelettiques (Fig. 7-20). Clés = champs BilanData. */
export const MUSCULO_WEIGHTS: Record<'M' | 'F', Record<string, number>> = {
  // Hommes : extension des bras ×2 ; autres ×1.
  M: { pushups: 2, flexion_tronc_cm: 1, situps: 1, endurance_dos_sec: 1, puissance_jambes_watts: 1 },
  // Femmes : flexion du tronc ×2 ; autres ×1.
  F: { pushups: 1, flexion_tronc_cm: 2, situps: 1, endurance_dos_sec: 1, puissance_jambes_watts: 1 }
}

/** Indice de santé du dos (Fig. 7-24). Extension du dos ×2 partout ; circonférence de
 *  la taille ×2 chez la femme. Activité physique exclue. */
export const BACK_HEALTH_WEIGHTS: Record<'M' | 'F', Record<string, number>> = {
  M: { tour_taille_cm: 1, flexion_tronc_cm: 1, situps: 1, endurance_dos_sec: 2 },
  F: { tour_taille_cm: 2, flexion_tronc_cm: 1, situps: 1, endurance_dos_sec: 2 }
}
