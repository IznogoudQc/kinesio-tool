/** Scores composites pour la saisie manuelle / lecture des bilans.
 *
 *  Les helpers purs (IMC, MET, FC max prédite, conversion catégorie ↔ score)
 *  vivent dans `./calc` — séparés pour rester testables sans tirer les tables.
 */

import { getAcsmRange } from './acsm'
import { getCpaflaRange } from './cpafla'
import type { Category, NormsType, TestKey } from './types'
import { BILAN_TO_TEST_KEY } from './bilan-keys'
import { categoryToScore, scoreToCategory } from './calc'

export {
  computeBmi,
  computeMet,
  computeFcMaxPredite,
  categoryToScore,
  scoreToCategory
} from './calc'
export type { Category, NormsType }

function categorizeRaw(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType
): Category | null {
  const range = norms === 'cpafla' ? getCpaflaRange(test, age, sex) : getAcsmRange(test, age, sex)
  if (!range) return null
  const { percentiles: p, lowerIsBetter } = range
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

// ── Scores composites ────────────────────────────────────────────────────────

export interface BilanProfile {
  age: number | null
  sex: 'F' | 'M' | null
  norms: NormsType
}

/** Catégorise un champ du bilan via la table de mapping. */
function catFor(
  key: keyof BilanData,
  value: number | undefined,
  profile: BilanProfile
): Category | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (profile.age === null || profile.sex === null) return null
  const testKey = BILAN_TO_TEST_KEY[key]
  if (!testKey) return null
  return categorizeRaw(testKey, value, profile.age, profile.sex, profile.norms)
}

function avg(scores: (number | null)[]): number | null {
  const present = scores.filter((s): s is number => s !== null)
  if (present.length === 0) return null
  return present.reduce((s, x) => s + x, 0) / present.length
}

export interface CompositeScore {
  /** Moyenne 0-5 des sous-tests catégorisés (null si aucun n'est catégorisable). */
  score: number | null
  /** Catégorie qui correspond au score moyen. */
  category: Category | null
}

/** Compose un score à partir d'une liste de clés du bilan. */
function composite(
  data: BilanData,
  keys: (keyof BilanData)[],
  profile: BilanProfile
): CompositeScore {
  const scores = keys.map(k => categoryToScore(catFor(k, data[k] as number | undefined, profile)))
  const score = avg(scores)
  return { score, category: scoreToCategory(score) }
}

export interface BilanSynthesis {
  /** Composition corporelle : IMC + % gras + tour de taille. Doit rester
   *  identique à `computeBilan` (bilan-computed.ts) pour que le rapport PDF et
   *  le Dashboard affichent le même score. */
  composition: CompositeScore
  /** % gras corporel seul. */
  bodyFat: CompositeScore
  /** Aptitude aérobie : VO2max. */
  aerobic: CompositeScore
  /** Indice santé du dos : flexion tronc + endurance dos + redressements. */
  backHealth: CompositeScore
  /** Force musculaire : 4 tests de force/puissance (pompes, redressements, saut, puissance). */
  musculoGlobal: CompositeScore
  /** Score global = moyenne pondérée 25/25/25/25 de composition, aérobie, dos, musculo. */
  overall: CompositeScore
}

/** Calcule les 5 + 1 scores synthèse à partir d'un BilanData et du profil client. */
export function computeSynthesis(data: BilanData, profile: BilanProfile): BilanSynthesis {
  const composition = composite(data, ['imc', 'pourcentage_gras', 'tour_taille_cm'], profile)
  const bodyFat = composite(data, ['pourcentage_gras'], profile)
  const aerobic = composite(data, ['vo2max'], profile)
  const backHealth = composite(data, ['flexion_tronc_cm', 'endurance_dos_sec', 'situps'], profile)
  // Force musculaire : uniquement les tests de force/puissance (la flexibilité et
  // l'endurance du dos vivent dans `backHealth`, plus dans « Force »).
  const musculoGlobal = composite(data, ['pushups', 'situps', 'saut_vertical_cm', 'puissance_jambes_watts'], profile)
  const overallScore = avg([composition.score, aerobic.score, backHealth.score, musculoGlobal.score])
  const overall: CompositeScore = { score: overallScore, category: scoreToCategory(overallScore) }
  return { composition, bodyFat, aerobic, backHealth, musculoGlobal, overall }
}
