/** Tables CPAFLA / ÉCPHV (Société canadienne de physiologie de l'exercice —
 *  Guide du conseiller en condition physique et habitudes de vie, 3e éd.).
 *
 *  STATUT : **tables musculosquelettiques encodées** depuis les Figures 7-18
 *  (hommes) et 7-19 (femmes) du guide fourni par Marie-Eve. Encore `null` (→
 *  repli sur ACSM dans `getCategorization`) : VO2max (mCAFT), IMC et tour de
 *  taille (seuils Santé Canada, indépendants de la norme fitness). Le % de gras
 *  n'utilise plus la norme du tout — il suit la grille de Marie (ADR 0024).
 *  Source à compléter (plis cutanés, etc.) au besoin — Marie a le livre complet.
 *
 *  ── Convention d'encodage ────────────────────────────────────────────────────
 *  Le type `NormRange` code 5 percentiles P10/P25/P50/P75/P90. CPAFLA publie des
 *  **catégories** (bornes de zone) ; on convertit (comme la migration ACSM,
 *  ADR 0006) via le helper `band(...)` :
 *    borne basse « Acceptable » → p10 ; « Bien » → p25 ; « Très bien » → p50 ;
 *    « Excellent » → p75 ; p90 = 2·p75 − p50 (extrapolation).
 *  `categorizeRaw` fait ensuite `value >= p75 → Excellent`, etc. — ce qui
 *  reproduit exactement les intervalles contigus du guide.
 *
 *  Voir ADR 0013 (ossature) et 0025 (encodage + repli ACSM).
 */

import type { NormPercentiles, NormRange, NormSet, TestKey } from './types'

type Ranges = NormRange[]

/** Helper : construit une plage à partir des 5 percentiles littéraux.
 *  Exporté pour l'encodage futur des tables (même signature que dans `acsm.ts`). */
export function pct(p10: number, p25: number, p50: number, p75: number, p90: number): NormPercentiles {
  return { p10, p25, p50, p75, p90 }
}

/** Construit une plage à partir des **bornes basses de catégorie CPAFLA**
 *  (guide CPHV/ÉCPHV, Figures 7-18 et 7-19 — hommes/femmes) :
 *    a  = borne basse « Acceptable »  → p10
 *    b  = borne basse « Bien »        → p25
 *    tb = borne basse « Très bien »   → p50
 *    e  = borne basse « Excellent »   → p75
 *  p90 = 2·e − tb (extrapolation, sert seulement au delta/affichage fin).
 *  La catégorisation (`categorizeRaw`) utilise `value >= p75 → Excellent`, etc.,
 *  ce qui reproduit exactement les intervalles contigus du guide.
 *  Tous les tests musculosquelettiques CPAFLA sont « plus haut = mieux ». */
function band(ageMin: number, ageMax: number, sex: 'F' | 'M', a: number, b: number, tb: number, e: number): NormRange {
  return { ageMin, ageMax, sex, percentiles: pct(a, b, tb, e, 2 * e - tb) }
}

// ── Tables CPAFLA — encodées depuis le Guide du conseiller CPHV, 3e éd. ────────
// Figures 7-18 (hommes) / 7-19 (femmes) : « Normes et catégories de bénéfices-
// santé, selon le groupe d'âge ». Tranches : 15-19, 20-29, 30-39, 40-49, 50-59,
// 60-69. Force de préhension non encodée (aucun champ de bilan correspondant).

// Extension des bras (n).
const PUSHUPS: Ranges = [
  band(15, 19, 'M', 18, 23, 29, 39), band(20, 29, 'M', 17, 22, 29, 36),
  band(30, 39, 'M', 12, 17, 22, 30), band(40, 49, 'M', 10, 13, 17, 25),
  band(50, 59, 'M', 7, 10, 13, 21), band(60, 69, 'M', 5, 8, 11, 18),
  band(15, 19, 'F', 12, 18, 25, 33), band(20, 29, 'F', 10, 15, 21, 30),
  band(30, 39, 'F', 8, 13, 20, 27), band(40, 49, 'F', 5, 11, 15, 24),
  band(50, 59, 'F', 2, 7, 11, 21), band(60, 69, 'F', 2, 5, 12, 17)
]

// Redressements assis partiels (n) — Excellent plafonné à 25 (max du test).
const SITUPS: Ranges = [
  band(15, 19, 'M', 16, 21, 23, 25), band(20, 29, 'M', 11, 16, 21, 25),
  band(30, 39, 'M', 11, 15, 18, 25), band(40, 49, 'M', 6, 13, 18, 25),
  band(50, 59, 'M', 8, 11, 17, 25), band(60, 69, 'M', 6, 11, 16, 25),
  band(15, 19, 'F', 12, 17, 22, 25), band(20, 29, 'F', 5, 14, 18, 25),
  band(30, 39, 'F', 6, 10, 19, 25), band(40, 49, 'F', 4, 11, 19, 25),
  band(50, 59, 'F', 6, 10, 19, 25), band(60, 69, 'F', 3, 8, 17, 25)
]

// Flexion du tronc / sit-and-reach (cm).
const TRUNK_FLEXION: Ranges = [
  band(15, 19, 'M', 24, 29, 34, 39), band(20, 29, 'M', 25, 30, 34, 40),
  band(30, 39, 'M', 23, 28, 33, 38), band(40, 49, 'M', 18, 24, 29, 35),
  band(50, 59, 'M', 16, 24, 28, 35), band(60, 69, 'M', 15, 20, 25, 33),
  band(15, 19, 'F', 29, 34, 38, 43), band(20, 29, 'F', 28, 33, 37, 41),
  band(30, 39, 'F', 27, 32, 36, 41), band(40, 49, 'F', 25, 30, 34, 38),
  band(50, 59, 'F', 25, 30, 33, 39), band(60, 69, 'F', 23, 27, 31, 35)
]

// Puissance des membres inférieurs (watts) — nomogramme de Keir / équation de Sayers.
const LEG_POWER: Ranges = [
  band(15, 19, 'M', 3323, 3858, 4185, 4644), band(20, 29, 'M', 3775, 4297, 4640, 5094),
  band(30, 39, 'M', 3485, 3967, 4389, 4860), band(40, 49, 'M', 2708, 3242, 3700, 4320),
  band(50, 59, 'M', 2512, 2937, 3567, 4019), band(60, 69, 'M', 2383, 2843, 3291, 3764),
  band(15, 19, 'F', 2156, 2399, 2795, 3167), band(20, 29, 'F', 2271, 2478, 2804, 3250),
  band(30, 39, 'F', 2147, 2335, 2550, 3193), band(40, 49, 'F', 1688, 2101, 2288, 2675),
  band(50, 59, 'F', 1386, 1701, 2161, 2559), band(60, 69, 'F', 1198, 1317, 1718, 2475)
]

// Saut vertical (cm).
const VERTICAL_JUMP: Ranges = [
  band(15, 19, 'M', 42, 46, 51, 56), band(20, 29, 'M', 42, 48, 54, 58),
  band(30, 39, 'M', 31, 40, 46, 52), band(40, 49, 'M', 26, 32, 36, 43),
  band(50, 59, 'M', 18, 28, 34, 41), band(60, 69, 'M', 18, 25, 29, 33),
  band(15, 19, 'F', 28, 32, 36, 40), band(20, 29, 'F', 25, 29, 34, 38),
  band(30, 39, 'F', 24, 28, 32, 36), band(40, 49, 'F', 18, 23, 27, 31),
  band(50, 59, 'F', 10, 16, 21, 25), band(60, 69, 'F', 7, 11, 15, 19)
]

// Extension du dos / endurance des extenseurs (secondes) — plafond du test à 180 s.
const BACK_ENDURANCE: Ranges = [
  band(15, 19, 'M', 91, 119, 135, 158), band(20, 29, 'M', 86, 99, 133, 176),
  band(30, 39, 'M', 56, 91, 109, 147), band(40, 49, 'M', 32, 71, 84, 130),
  band(50, 59, 'M', 20, 54, 88, 120), band(60, 69, 'M', 20, 52, 78, 117),
  band(15, 19, 'F', 91, 122, 141, 169), band(20, 29, 'F', 66, 102, 136, 180),
  band(30, 39, 'F', 61, 112, 141, 180), band(40, 49, 'F', 42, 80, 115, 180),
  band(50, 59, 'F', 15, 47, 75, 110), band(60, 69, 'F', 6, 19, 40, 91)
]

const TABLES: Record<TestKey, Ranges | null> = {
  vo2max: null, // mCAFT — pas de table CPAFLA ; repli sur ACSM (aérobie).
  bodyFat: null, // % de gras coté par la grille de Marie (ADR 0024), hors norme.
  pushups: PUSHUPS,
  situps: SITUPS,
  trunkFlexion: TRUNK_FLEXION,
  legPower: LEG_POWER,
  verticalJump: VERTICAL_JUMP,
  backEndurance: BACK_ENDURANCE,
  bmi: null, // IMC = catégories OMS (agnostiques à la norme fitness) — voir clinical/acsm.
  waistCircumference: null, // Tour de taille = seuils Santé Canada — indépendant de CPAFLA.
  // Seuils cliniques (PA, FC repos) — fournis par `clinical.ts`, hors CPAFLA.
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  restingHeartRate: null
}

/** Retourne la plage CPAFLA pour (test, âge, sexe), ou `null` si non encodée.
 *  Structure identique à `getAcsmRange` — fonctionnera dès que `TABLES` sera rempli. */
export function getCpaflaRange(test: TestKey, age: number, sex: 'F' | 'M'): NormRange | null {
  const ranges = TABLES[test]
  if (!ranges) return null
  return ranges.find(r => r.sex === sex && age >= r.ageMin && age <= r.ageMax) ?? null
}

/** Vrai si au moins une table CPAFLA est encodée. Permet à l'UI (Paramètres)
 *  d'annoncer honnêtement l'état : tables disponibles vs en attente de source. */
export function cpaflaHasTables(): boolean {
  return Object.values(TABLES).some(r => r !== null && r.length > 0)
}

export const cpaflaNorms: NormSet = {
  getRange: getCpaflaRange
}
