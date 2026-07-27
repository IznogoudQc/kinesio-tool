/** Notes combinées CPAFLA / ÉCPHV (Guide du conseiller CPHV, 3ᵉ éd.).
 *
 *  Le guide n'agrège PAS les cotes par simple moyenne : chaque test reçoit une
 *  **note pondérée** (cote 0-4 × poids), on somme (« note obtenue »), on somme les
 *  maxima des tests **présents** (« note maximale »), et le score = le rapport
 *  `obtenue / max × 4` — c'est-à-dire la **moyenne pondérée des cotes**.
 *
 *  ⚠️ Le score est gardé **avec ses décimales**. Le nomogramme du guide
 *  (Fig. 7-21 musculo / 7-25 dos) n'est que la version *arrondie* de ce même
 *  rapport (`arrondi-inférieur-à-la-demie`, cf. `cpaflaNomogramme`) ; le logiciel
 *  que l'app remplace, lui, affiche la valeur non arrondie (« 3,6 points »).
 *
 *  **Validé** contre 6 rapports réels de l'ancien logiciel (2011 → juin 2026) :
 *  dos 2,6 = 13/5 · 2,0 = 2/1 · 3,6 = 18/5 ; musculo 2,8 = 17/6 · 3,5 = 21/6 ·
 *  3,7 = 22/6. Voir ADR 0028.
 *
 *  Poids (Fig. 7-20 / 7-24), **par sexe**. Deux mesures du guide sont volontairement
 *  exclues car l'app ne les capte pas (choix de Marie — repli par note max réduite) :
 *    · Force de préhension (dynamomètre) — note combinée musculo
 *    · Niveau d'activité physique       — indice de santé du dos (n'apparaît que
 *      dans le bilan 2011 des rapports de Marie ; plus administré depuis)
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

/** Nomogramme du guide (Fig. 7-21 / 7-25) : la note combinée **arrondie** à
 *  l'entier. L'app affiche la valeur non arrondie de `cpaflaCombine` (comme le
 *  logiciel d'origine) ; cette fonction sert à reproduire la grille du guide. */
export function cpaflaNomogramme(score: number | null): number | null {
  return score === null ? null : roundHalfDown(score)
}

/** Une contribution : la cote 0-4 du test (ou `null` si non mesuré) et son poids. */
export type CpaflaContribution = [score: number | null, weight: number]

/** Combine des cotes 0-4 pondérées → score combiné 0-4 (moyenne pondérée des
 *  cotes = note obtenue / note maximale × 4), **décimales conservées**.
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
  return (obtenue / max) * 4
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

// ── Détail du calcul (pour expliquer la note au client) ──────────────────────

/** Une contribution nommée : clé du test, sa cote 0-4 (ou `null` si non mesuré), son poids. */
export type CpaflaKeyedContribution = [key: string, score: number | null, weight: number]

export interface CpaflaCombineRow {
  key: string
  /** Cote 0-4 du test, ou `null` s'il n'a pas été mesuré (exclu du calcul). */
  cote: number | null
  poids: number
  /** Note pondérée obtenue (cote × poids), `null` si non mesuré. */
  points: number | null
  /** Note pondérée maximale du test (4 × poids) — comptée seulement s'il est mesuré. */
  maxPoints: number
}

export interface CpaflaCombineDetail {
  score: number | null
  /** Somme des notes pondérées obtenues. */
  obtenue: number
  /** Somme des notes pondérées maximales des tests **présents**. */
  max: number
  rows: CpaflaCombineRow[]
}

/** Même calcul que `cpaflaCombine`, mais en conservant le détail par test — sert à
 *  expliquer la note (« pourquoi 3,7 ? ») sans risquer de diverger du score affiché. */
export function cpaflaCombineDetail(contribs: CpaflaKeyedContribution[]): CpaflaCombineDetail {
  const rows: CpaflaCombineRow[] = contribs.map(([key, score, weight]) => {
    const mesure = score !== null && !Number.isNaN(score)
    return {
      key,
      cote: mesure ? score : null,
      poids: weight,
      points: mesure ? (score as number) * weight : null,
      maxPoints: 4 * weight
    }
  })
  let obtenue = 0
  let max = 0
  for (const r of rows) {
    if (r.points === null) continue
    obtenue += r.points
    max += r.maxPoints
  }
  return {
    score: max === 0 ? null : (obtenue / max) * 4,
    obtenue,
    max,
    rows
  }
}

/** Libellés des tests, pour l'affichage du détail. */
export const CPAFLA_TEST_LABELS: Record<string, string> = {
  pushups: 'Extension des bras (push-ups)',
  situps: 'Redressements assis',
  flexion_tronc_cm: 'Flexion du tronc',
  endurance_dos_sec: 'Extension du dos (endurance)',
  puissance_jambes_watts: 'Puissance des jambes',
  tour_taille_cm: 'Tour de taille'
}
