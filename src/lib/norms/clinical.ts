/** Seuils cliniques pour la pression artérielle et la fréquence cardiaque au
 *  repos — métriques qui n'ont pas de barème dans les tables ACSM de fitness.
 *
 *  Modélisés en `NormRange` (avec `lowerIsBetter: true`) pour réutiliser tel
 *  quel le moteur de catégorisation (`getCategorization`, `getNormPercentiles`,
 *  `getNextCategoryTarget`) et le composant `CategoryRangeBar`.
 *
 *  Correspondance zone clinique → catégorie ACSM (5 niveaux) :
 *    PA : Optimale→EXCELLENT, Normale→TRES_BIEN, Pré-HT→BIEN, HT1→ACCEPTABLE, HT2→A_AMELIORER
 *    FC : Excellent→EXCELLENT, Bien→TRES_BIEN, Moyen→BIEN, Faible→ACCEPTABLE, Mauvais→A_AMELIORER
 *
 *  Sources :
 *   - Pression artérielle : seuils OMS / JNC (universels, indépendants de l'âge et du sexe).
 *   - FC repos : ACSM (chart de fréquence cardiaque au repos). Base : hommes 36-45 ans.
 *     Les normes FC repos varient peu selon l'âge adulte (≈ 2-3 bpm) — on les
 *     traite donc comme indépendantes de l'âge ; l'écart femmes/hommes (≈ +3 bpm)
 *     est appliqué. Simplification assumée (v0.1.37).
 */

import type { NormPercentiles, NormRange, TestKey } from './types'

/** Les percentiles sont en ordre décroissant (lowerIsBetter) : p10 = pire,
 *  p75 = seuil d'excellence, p90 = repère « encore meilleur ». */
const CLINICAL: Partial<Record<TestKey, { M: NormPercentiles; F: NormPercentiles }>> = {
  // Systolique : Optimale <120, Normale 120-129, Pré-HT 130-139, HT1 140-159, HT2 ≥160.
  bloodPressureSystolic: {
    M: { p10: 160, p25: 140, p50: 130, p75: 120, p90: 110 },
    F: { p10: 160, p25: 140, p50: 130, p75: 120, p90: 110 }
  },
  // Diastolique : Optimale <80, Normale 80-84, Pré-HT 85-89, HT1 90-99, HT2 ≥100.
  bloodPressureDiastolic: {
    M: { p10: 100, p25: 90, p50: 85, p75: 80, p90: 70 },
    F: { p10: 100, p25: 90, p50: 85, p75: 80, p90: 70 }
  },
  // FC repos (ACSM) : Excellent <56, Bien 57-62, Moyen 63-66, Faible 67-71, Mauvais ≥72.
  restingHeartRate: {
    M: { p10: 72, p25: 67, p50: 63, p75: 56, p90: 50 },
    F: { p10: 75, p25: 70, p50: 66, p75: 59, p90: 53 }
  }
}

/** Retourne la plage clinique pour un test donné, ou `null` si le test n'est
 *  pas géré ici (auquel cas l'appelant retombe sur les tables ACSM/CPAFLA). */
export function getClinicalRange(test: TestKey, sex: 'F' | 'M'): NormRange | null {
  const entry = CLINICAL[test]
  if (!entry) return null
  return {
    ageMin: 0,
    ageMax: 200,
    sex,
    percentiles: entry[sex],
    lowerIsBetter: true
  }
}
