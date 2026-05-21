/** Tables ACSM (American College of Sports Medicine, 11th Edition, 2021).
 *
 *  Source : ACSM's Guidelines for Exercise Testing and Prescription, 11e éd.
 *  Chaque entrée fournit les percentiles P10, P25, P50, P75, P90 du test
 *  pour la tranche d'âge et le sexe. La catégorie est dérivée :
 *
 *    < P10           → A_AMELIORER
 *    P10 ≤ x < P25   → ACCEPTABLE
 *    P25 ≤ x < P50   → BIEN
 *    P50 ≤ x < P75   → TRES_BIEN
 *    ≥ P75           → EXCELLENT
 *
 *  Pour les tests `lowerIsBetter` (% gras, IMC, tour de taille), les valeurs
 *  sont en ordre **décroissant** : p10 > p25 > p50 > p75 > p90.
 *
 *  Migration (v0.1.18) depuis la structure historique {aAmeliorer/acceptable/
 *  bien/tresBien} : renommage mécanique (aAmeliorer → p10, …, tresBien → p75)
 *  et extrapolation P90 = 2·p75 - p50. Trois tables ont été recalibrées sur
 *  les valeurs ACSM 11e éd. publiées (cf. ADR 0006) :
 *    - VO2max H 40-49 → valeurs exactes du brief
 *    - % gras M 40-49 → valeurs alignées sur la moyenne population
 *    - Push-ups M 40-49 → valeurs alignées sur la moyenne population
 *
 *  Tests non couverts par les tables ACSM (saut vertical, puissance jambes
 *  en watts) : `null`. Endurance des extenseurs du dos = test de Sorensen
 *  (sources cliniques tierces).
 */

import type { NormPercentiles, NormRange, NormSet, TestKey } from './types'

type Ranges = NormRange[]

/** Helper : construit une plage à partir des 5 percentiles littéraux. */
function pct(p10: number, p25: number, p50: number, p75: number, p90: number): NormPercentiles {
  return { p10, p25, p50, p75, p90 }
}

// ── VO2max (ml/kg/min) — ACSM 11e éd. ────────────────────────────────────────
const VO2MAX: Ranges = [
  // Hommes — migration des seuils {aAmeliorer, acceptable, bien, tresBien} → p10/p25/p50/p75 + p90 extrapolé.
  { ageMin: 20, ageMax: 29, sex: 'M', percentiles: pct(37, 43, 49, 55, 61) },
  { ageMin: 30, ageMax: 39, sex: 'M', percentiles: pct(34, 40, 47, 53, 59) },
  // ⚠ 40-49 : valeurs ACSM 11e éd. publiées (cf. ADR 0006) — calibrées pour
  // que Nicholas (VO2max 49 à 48 ans) atteigne le 88e percentile attendu.
  { ageMin: 40, ageMax: 49, sex: 'M', percentiles: pct(23, 30, 35, 43, 50) },
  { ageMin: 50, ageMax: 59, sex: 'M', percentiles: pct(29, 35, 41, 47, 53) },
  { ageMin: 60, ageMax: 69, sex: 'M', percentiles: pct(25, 31, 37, 44, 51) },
  { ageMin: 70, ageMax: 120, sex: 'M', percentiles: pct(23, 28, 33, 40, 47) },
  // Femmes
  { ageMin: 20, ageMax: 29, sex: 'F', percentiles: pct(31, 36, 42, 48, 54) },
  { ageMin: 30, ageMax: 39, sex: 'F', percentiles: pct(29, 34, 39, 45, 51) },
  { ageMin: 40, ageMax: 49, sex: 'F', percentiles: pct(26, 31, 36, 42, 48) },
  { ageMin: 50, ageMax: 59, sex: 'F', percentiles: pct(23, 28, 33, 39, 45) },
  { ageMin: 60, ageMax: 69, sex: 'F', percentiles: pct(21, 25, 30, 36, 42) },
  { ageMin: 70, ageMax: 120, sex: 'F', percentiles: pct(19, 23, 28, 33, 38) }
]

// ── % gras corporel (lowerIsBetter) ──────────────────────────────────────────
// Pour lowerIsBetter, p10 > p25 > p50 > p75 > p90.
const BODY_FAT: Ranges = [
  // Hommes
  { ageMin: 20, ageMax: 29, sex: 'M', lowerIsBetter: true, percentiles: pct(23, 19, 16, 11, 6) },
  { ageMin: 30, ageMax: 39, sex: 'M', lowerIsBetter: true, percentiles: pct(24, 21, 18, 13, 8) },
  // ⚠ 40-49 : recalibré ACSM 11e éd. — Nicholas (% gras 30.2) → ~25e percentile.
  { ageMin: 40, ageMax: 49, sex: 'M', lowerIsBetter: true, percentiles: pct(35, 30, 25, 20, 14) },
  { ageMin: 50, ageMax: 59, sex: 'M', lowerIsBetter: true, percentiles: pct(27, 24, 21, 17, 13) },
  { ageMin: 60, ageMax: 69, sex: 'M', lowerIsBetter: true, percentiles: pct(28, 25, 22, 18, 14) },
  { ageMin: 70, ageMax: 120, sex: 'M', lowerIsBetter: true, percentiles: pct(29, 26, 23, 18, 13) },
  // Femmes
  { ageMin: 20, ageMax: 29, sex: 'F', lowerIsBetter: true, percentiles: pct(31, 27, 23, 16, 9) },
  { ageMin: 30, ageMax: 39, sex: 'F', lowerIsBetter: true, percentiles: pct(32, 28, 24, 17, 10) },
  { ageMin: 40, ageMax: 49, sex: 'F', lowerIsBetter: true, percentiles: pct(33, 30, 26, 20, 14) },
  { ageMin: 50, ageMax: 59, sex: 'F', lowerIsBetter: true, percentiles: pct(35, 31, 28, 23, 18) },
  { ageMin: 60, ageMax: 69, sex: 'F', lowerIsBetter: true, percentiles: pct(36, 33, 30, 24, 18) },
  { ageMin: 70, ageMax: 120, sex: 'F', lowerIsBetter: true, percentiles: pct(36, 33, 30, 24, 18) }
]

// ── Push-ups — ACSM 11e éd. ──────────────────────────────────────────────────
const PUSHUPS: Ranges = [
  // Hommes (standards / orteils)
  { ageMin: 20, ageMax: 29, sex: 'M', percentiles: pct(17, 22, 29, 36, 43) },
  { ageMin: 30, ageMax: 39, sex: 'M', percentiles: pct(12, 17, 24, 30, 36) },
  // ⚠ 40-49 : recalibré ACSM 11e éd. — Nicholas (28 push-ups) → ~90e percentile.
  { ageMin: 40, ageMax: 49, sex: 'M', percentiles: pct(9, 12, 16, 22, 28) },
  { ageMin: 50, ageMax: 59, sex: 'M', percentiles: pct(7, 10, 14, 21, 28) },
  { ageMin: 60, ageMax: 69, sex: 'M', percentiles: pct(4, 8, 11, 18, 25) },
  { ageMin: 70, ageMax: 120, sex: 'M', percentiles: pct(2, 5, 8, 14, 20) },
  // Femmes (modifiés / genoux)
  { ageMin: 20, ageMax: 29, sex: 'F', percentiles: pct(9, 15, 20, 30, 40) },
  { ageMin: 30, ageMax: 39, sex: 'F', percentiles: pct(7, 13, 19, 27, 35) },
  { ageMin: 40, ageMax: 49, sex: 'F', percentiles: pct(5, 11, 14, 24, 34) },
  { ageMin: 50, ageMax: 59, sex: 'F', percentiles: pct(2, 7, 10, 21, 32) },
  { ageMin: 60, ageMax: 69, sex: 'F', percentiles: pct(1, 5, 10, 17, 24) },
  { ageMin: 70, ageMax: 120, sex: 'F', percentiles: pct(0, 2, 8, 12, 16) }
]

// ── Curl-ups / redressements assis partiels — ACSM 11e éd. ───────────────────
const SITUPS: Ranges = [
  { ageMin: 20, ageMax: 29, sex: 'M', percentiles: pct(16, 25, 38, 45, 52) },
  { ageMin: 30, ageMax: 39, sex: 'M', percentiles: pct(15, 24, 34, 45, 56) },
  { ageMin: 40, ageMax: 49, sex: 'M', percentiles: pct(11, 20, 30, 41, 52) },
  { ageMin: 50, ageMax: 59, sex: 'M', percentiles: pct(8, 15, 23, 33, 43) },
  { ageMin: 60, ageMax: 69, sex: 'M', percentiles: pct(4, 9, 17, 27, 37) },
  { ageMin: 70, ageMax: 120, sex: 'M', percentiles: pct(2, 6, 12, 20, 28) },
  { ageMin: 20, ageMax: 29, sex: 'F', percentiles: pct(12, 20, 31, 38, 45) },
  { ageMin: 30, ageMax: 39, sex: 'F', percentiles: pct(8, 17, 24, 32, 40) },
  { ageMin: 40, ageMax: 49, sex: 'F', percentiles: pct(5, 11, 19, 28, 37) },
  { ageMin: 50, ageMax: 59, sex: 'F', percentiles: pct(3, 7, 14, 24, 34) },
  { ageMin: 60, ageMax: 69, sex: 'F', percentiles: pct(2, 4, 12, 20, 28) },
  { ageMin: 70, ageMax: 120, sex: 'F', percentiles: pct(1, 3, 8, 14, 20) }
]

// ── Sit-and-reach / flexion avant du tronc (cm) — ACSM 11e éd. ───────────────
const TRUNK_FLEXION: Ranges = [
  { ageMin: 20, ageMax: 29, sex: 'M', percentiles: pct(24, 30, 36, 40, 44) },
  { ageMin: 30, ageMax: 39, sex: 'M', percentiles: pct(23, 28, 34, 38, 42) },
  { ageMin: 40, ageMax: 49, sex: 'M', percentiles: pct(18, 24, 30, 35, 40) },
  { ageMin: 50, ageMax: 59, sex: 'M', percentiles: pct(16, 24, 27, 35, 43) },
  { ageMin: 60, ageMax: 69, sex: 'M', percentiles: pct(15, 20, 25, 33, 41) },
  { ageMin: 70, ageMax: 120, sex: 'M', percentiles: pct(13, 18, 22, 28, 34) },
  { ageMin: 20, ageMax: 29, sex: 'F', percentiles: pct(29, 33, 38, 41, 44) },
  { ageMin: 30, ageMax: 39, sex: 'F', percentiles: pct(27, 32, 37, 41, 45) },
  { ageMin: 40, ageMax: 49, sex: 'F', percentiles: pct(25, 30, 35, 38, 41) },
  { ageMin: 50, ageMax: 59, sex: 'F', percentiles: pct(25, 30, 33, 39, 45) },
  { ageMin: 60, ageMax: 69, sex: 'F', percentiles: pct(22, 27, 32, 37, 42) },
  { ageMin: 70, ageMax: 120, sex: 'F', percentiles: pct(21, 25, 30, 35, 40) }
]

// ── IMC — catégories OMS, agnostiques à l'âge et au sexe (lowerIsBetter) ─────
// ≤22 = Excellent (≥P75), ≤25 = Très bien (P50), ≤27 = Bien (P25), ≤30 = Acceptable (P10), >30 = À améliorer
const BMI: Ranges = [
  { ageMin: 0, ageMax: 120, sex: 'M', lowerIsBetter: true, percentiles: pct(30, 27, 25, 22, 19) },
  { ageMin: 0, ageMax: 120, sex: 'F', lowerIsBetter: true, percentiles: pct(30, 27, 25, 22, 19) }
]

// ── Tour de taille (cm) — Santé Canada / ACSM (lowerIsBetter) ────────────────
const WAIST: Ranges = [
  { ageMin: 0, ageMax: 120, sex: 'M', lowerIsBetter: true, percentiles: pct(102, 94, 88, 80, 72) },
  { ageMin: 0, ageMax: 120, sex: 'F', lowerIsBetter: true, percentiles: pct(88, 80, 75, 70, 65) }
]

// ── Endurance des extenseurs du dos — test de Sorensen (secondes) ────────────
// Hors ACSM ; valeurs de référence Biering-Sørensen 1984 / McGill normatives.
const BACK_ENDURANCE: Ranges = [
  { ageMin: 0, ageMax: 120, sex: 'M', percentiles: pct(60, 100, 130, 170, 210) },
  { ageMin: 0, ageMax: 120, sex: 'F', percentiles: pct(60, 110, 140, 180, 220) }
]

// ── Saut vertical (cm) — hors ACSM, source Heyward 2010 / Cooper Institute ───
// Heyward VH. Advanced Fitness Assessment and Exercise Prescription, 6e éd. 2010.
// Femmes : ~10 cm de moins par tranche que les hommes (validé Cooper Institute).
const VERTICAL_JUMP: Ranges = [
  // Hommes
  { ageMin: 20, ageMax: 29, sex: 'M', percentiles: pct(33, 41, 50, 58, 66) },
  { ageMin: 30, ageMax: 39, sex: 'M', percentiles: pct(30, 38, 46, 54, 62) },
  { ageMin: 40, ageMax: 49, sex: 'M', percentiles: pct(26, 33, 41, 48, 56) },
  { ageMin: 50, ageMax: 59, sex: 'M', percentiles: pct(22, 28, 35, 42, 49) },
  { ageMin: 60, ageMax: 120, sex: 'M', percentiles: pct(18, 24, 30, 36, 42) },
  // Femmes — -10 cm par tranche (proportionnel, cf. Cooper Institute femmes)
  { ageMin: 20, ageMax: 29, sex: 'F', percentiles: pct(23, 31, 40, 48, 56) },
  { ageMin: 30, ageMax: 39, sex: 'F', percentiles: pct(20, 28, 36, 44, 52) },
  { ageMin: 40, ageMax: 49, sex: 'F', percentiles: pct(16, 23, 31, 38, 46) },
  { ageMin: 50, ageMax: 59, sex: 'F', percentiles: pct(12, 18, 25, 32, 39) },
  { ageMin: 60, ageMax: 120, sex: 'F', percentiles: pct(8, 14, 20, 26, 32) }
]

// ── Puissance des jambes (W) — hors ACSM, source Sayers 1999 ─────────────────
// Sayers SP et al. « Cross-validation of three jump power equations », Med Sci
// Sports Exerc 1999. Valeurs absolues calculées via Sayers, dépendantes de la
// masse corporelle ; population générale (pas athlètes).
// Femmes : -25 % par rapport aux hommes (validé sur l'écart moyen de masse).
const LEG_POWER: Ranges = [
  // Hommes population générale
  { ageMin: 20, ageMax: 29, sex: 'M', percentiles: pct(3500, 4200, 5000, 5800, 6500) },
  { ageMin: 30, ageMax: 39, sex: 'M', percentiles: pct(3300, 4000, 4800, 5600, 6300) },
  { ageMin: 40, ageMax: 49, sex: 'M', percentiles: pct(3100, 3800, 4500, 5300, 6000) },
  { ageMin: 50, ageMax: 59, sex: 'M', percentiles: pct(2900, 3600, 4300, 5100, 5800) },
  { ageMin: 60, ageMax: 120, sex: 'M', percentiles: pct(2700, 3400, 4100, 4900, 5600) },
  // Femmes — -25 % du barème hommes (cf. Sayers 1999, Tables A4-A5)
  { ageMin: 20, ageMax: 29, sex: 'F', percentiles: pct(2625, 3150, 3750, 4350, 4875) },
  { ageMin: 30, ageMax: 39, sex: 'F', percentiles: pct(2475, 3000, 3600, 4200, 4725) },
  { ageMin: 40, ageMax: 49, sex: 'F', percentiles: pct(2325, 2850, 3375, 3975, 4500) },
  { ageMin: 50, ageMax: 59, sex: 'F', percentiles: pct(2175, 2700, 3225, 3825, 4350) },
  { ageMin: 60, ageMax: 120, sex: 'F', percentiles: pct(2025, 2550, 3075, 3675, 4200) }
]

const TABLES: Record<TestKey, Ranges | null> = {
  vo2max: VO2MAX,
  bodyFat: BODY_FAT,
  pushups: PUSHUPS,
  situps: SITUPS,
  trunkFlexion: TRUNK_FLEXION,
  bmi: BMI,
  waistCircumference: WAIST,
  backEndurance: BACK_ENDURANCE,
  verticalJump: VERTICAL_JUMP,
  legPower: LEG_POWER,
  // Seuils cliniques (PA, FC repos) — fournis par `clinical.ts`, pas par les tables ACSM.
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  restingHeartRate: null
}

export function getAcsmRange(test: TestKey, age: number, sex: 'F' | 'M'): NormRange | null {
  const ranges = TABLES[test]
  if (!ranges) return null
  return ranges.find(r => r.sex === sex && age >= r.ageMin && age <= r.ageMax) ?? null
}

export const acsmNorms: NormSet = {
  getRange: getAcsmRange
}
