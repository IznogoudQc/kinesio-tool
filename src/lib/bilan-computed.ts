/** Module central de calculs dérivés pour un bilan.
 *
 *  Une fonction `computeBilan(raw, age, sex, norms)` retourne **tous** les
 *  champs auto-calculés (anthropo, aérobie, musculo) et les 5+1 scores
 *  composites. Pas de side-effect : c'est une fonction pure qui peut être
 *  appelée en temps réel pendant la saisie et au moment de la sauvegarde.
 *
 *  Les helpers de bas niveau vivent dans `./norms/calc` et `./vo2max-calculator`.
 */

import { calculateBodyFat } from './body-fat-calculator.ts'
import { bodyFatGridRating } from './body-fat-risk.ts'
import {
  bruceTreadmillVo2max,
  cooperVo2max,
  legerVo2max,
  sayersLegPower,
  type AerobicTestType
} from './vo2max-calculator.ts'
import { computeBmi, computeFcMaxPredite, computeMet, categoryToScore, scoreToCategory } from './norms/calc.ts'
import { getAcsmRange } from './norms/acsm.ts'
import { getCpaflaRange } from './norms/cpafla.ts'
import { BILAN_TO_TEST_KEY } from './norms/bilan-keys.ts'
import type { Category, NormsType, TestKey } from './norms/types.ts'

export type { Category, NormsType }

/**
 * Affichage de l'« Indice de santé du dos » — temporairement MASQUÉ.
 *
 * La structure de la formule est confirmée (moyenne taille + IMC + tests dos
 * pondérés), mais le barème CPAFLA exact du tour de taille / IMC n'est pas
 * disponible : nos normes ACSM notent ces deux mesures beaucoup plus
 * sévèrement, ce qui tire l'indice ~1,5 point sous la valeur de l'ancien
 * logiciel (validé sur bilans réels). Tant que le barème n'est pas calé, on
 * masque la carte partout ET on l'exclut du score global, pour ne pas fausser.
 * Basculer à `false` pour re-masquer une fois `BackHealthComposite` élucidé
 * (ou si le barème CPAFLA taille/IMC n'est toujours pas calé).
 * Voir mémoire [[backhealth-formula-deferred]].
 */
export const SHOW_BACK_HEALTH = true

export interface BilanProfile {
  age: number | null
  sex: 'F' | 'M' | null
  norms: NormsType
}

export interface CompositeScore {
  score: number | null
  category: Category | null
}

/** Zones de fréquence cardiaque cibles (60-90% FC max prédite par tranches de 5%). */
export interface FcZones {
  z60: number
  z65: number
  z70: number
  z75: number
  z80: number
  z85: number
  z90: number
}

export interface BilanComputed {
  // ── Anthropométrie
  imc: number | null
  /** Poids correspondant à un IMC de 25 (limite supérieure « normal »). */
  poidsOptimalMaxKg: number | null
  ratioTailleHanche: number | null
  pourcentageGrasDurnin: number | null
  /** Libellé de la zone de la grille de Marie pour le % de gras (« En santé », « Optimal », …). */
  bodyFatGridLabel: string | null
  // ── Aérobie
  vo2max: number | null
  metEquivalent: number | null
  fcMaxPredite: number | null
  fcZones: FcZones | null
  // ── Musculo
  sautVerticalCm: number | null
  puissanceJambesW: number | null
  // ── Scores composites (échelle 0-4, comme l'ancien logiciel : ≥ 3,5 = Excellent)
  composition: CompositeScore
  bodyFat: CompositeScore
  aerobic: CompositeScore
  backHealth: CompositeScore
  musculoGlobal: CompositeScore
  overall: CompositeScore
}

// ── Catégorisation ────────────────────────────────────────────────────────────

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

function catFor(
  key: keyof BilanData,
  value: number | null | undefined,
  profile: BilanProfile
): Category | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (profile.age === null || profile.sex === null) return null
  // Le % de gras est coté selon la **grille de Marie** (En santé / Optimal / …),
  // pas le percentile ACSM — cohérent avec l'affichage. Voir [[body-fat-risk]].
  if (key === 'pourcentage_gras') {
    return bodyFatGridRating(value, profile.sex)?.category ?? null
  }
  const testKey = BILAN_TO_TEST_KEY[key]
  if (!testKey) return null
  return categorizeRaw(testKey, value, profile.age, profile.sex, profile.norms)
}

function avg(scores: (number | null)[]): number | null {
  const present = scores.filter((s): s is number => s !== null)
  if (present.length === 0) return null
  return present.reduce((s, x) => s + x, 0) / present.length
}

/** Moyenne PONDÉRÉE (ignore les cotes absentes). `null` si aucune cote présente. */
function weightedAvg(pairs: [number | null, number][]): number | null {
  let sum = 0
  let wsum = 0
  for (const [s, w] of pairs) {
    if (s !== null && !Number.isNaN(s)) {
      sum += s * w
      wsum += w
    }
  }
  return wsum === 0 ? null : sum / wsum
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── VO2max selon protocole ────────────────────────────────────────────────────

function computeVo2maxByProtocol(
  data: BilanData,
  age: number | null,
  sex: 'F' | 'M' | null
): number | null {
  const t: AerobicTestType = data.aerobie_test_type ?? 'manual'
  if (t === 'bruce' && data.bruce_duration_sec !== undefined && sex !== null) {
    const v = bruceTreadmillVo2max({ durationSeconds: data.bruce_duration_sec, sex })
    return Number.isFinite(v) ? round1(v) : null
  }
  if (t === 'cooper' && data.cooper_distance_m !== undefined) {
    const v = cooperVo2max(data.cooper_distance_m)
    return Number.isFinite(v) ? round1(v) : null
  }
  if (t === 'leger' && data.leger_palier !== undefined && age !== null) {
    const v = legerVo2max(data.leger_palier, age)
    return Number.isFinite(v) ? round1(v) : null
  }
  // Manual ou paramètres manquants : on respecte la saisie utilisateur.
  return typeof data.vo2max === 'number' ? data.vo2max : null
}

function computeFcZones(fcMax: number | null): FcZones | null {
  if (fcMax === null) return null
  return {
    z60: Math.round(fcMax * 0.6),
    z65: Math.round(fcMax * 0.65),
    z70: Math.round(fcMax * 0.7),
    z75: Math.round(fcMax * 0.75),
    z80: Math.round(fcMax * 0.8),
    z85: Math.round(fcMax * 0.85),
    z90: Math.round(fcMax * 0.9)
  }
}

// ── Anthropométrie auxiliaire ─────────────────────────────────────────────────

function computePoidsOptimalMax(tailleCm: number | undefined): number | null {
  if (!tailleCm || tailleCm <= 0) return null
  const m = tailleCm / 100
  return round1(25 * m * m)
}

function computeRatioTailleHanche(taille: number | undefined, hanche: number | undefined): number | null {
  if (!taille || !hanche || hanche <= 0) return null
  return Math.round((taille / hanche) * 100) / 100
}

function computePourcentageGrasDurnin(
  data: BilanData,
  age: number | null,
  sex: 'F' | 'M' | null
): number | null {
  if (
    age === null ||
    sex === null ||
    typeof data.pli_triceps !== 'number' ||
    typeof data.pli_biceps !== 'number' ||
    typeof data.pli_sous_scap !== 'number' ||
    typeof data.pli_iliaque !== 'number'
  ) {
    return null
  }
  try {
    const r = calculateBodyFat(
      {
        triceps: data.pli_triceps,
        biceps: data.pli_biceps,
        sousscapulaire: data.pli_sous_scap,
        iliaque: data.pli_iliaque
      },
      age,
      sex
    )
    return round1(r.bodyFatSiri)
  } catch {
    return null
  }
}

// ── Fonction principale ───────────────────────────────────────────────────────

export function computeBilan(raw: BilanData, profile: BilanProfile): BilanComputed {
  const { age, sex } = profile

  // Anthropo
  const bmi = computeBmi(raw.taille_cm, raw.poids_kg)
  const imc = bmi === null ? null : round1(bmi)
  const poidsOptimalMaxKg = computePoidsOptimalMax(raw.taille_cm)
  const ratioTailleHanche = computeRatioTailleHanche(raw.tour_taille_cm, raw.tour_hanche_cm)
  const pourcentageGrasDurnin = computePourcentageGrasDurnin(raw, age, sex)

  // Aérobie
  const vo2max = computeVo2maxByProtocol(raw, age, sex)
  const metRaw = computeMet(vo2max ?? undefined)
  const metEquivalent = metRaw === null ? null : round1(metRaw)
  const fcMaxRaw = computeFcMaxPredite(age)
  const fcMaxPredite = fcMaxRaw === null ? null : Math.round(fcMaxRaw)
  const fcZones = computeFcZones(fcMaxPredite)

  // Musculo
  // Saut vertical : finale − départ si les deux sont saisis (feuille papier),
  // sinon la valeur directe (rétro-compatibilité des anciens bilans / imports).
  const sautVerticalCm = (() => {
    if (typeof raw.saut_depart_cm === 'number' && typeof raw.saut_finale_cm === 'number') {
      return Math.max(0, Math.round((raw.saut_finale_cm - raw.saut_depart_cm) * 10) / 10)
    }
    return typeof raw.saut_vertical_cm === 'number' ? raw.saut_vertical_cm : null
  })()
  const puissanceJambesW = (() => {
    // Préserver les valeurs importées du logiciel d'origine.
    if (raw.puissance_calculated_auto === false && typeof raw.puissance_jambes_watts === 'number') {
      return raw.puissance_jambes_watts
    }
    const computed = sayersLegPower(sautVerticalCm ?? undefined, raw.poids_kg)
    if (computed !== null) return computed
    return typeof raw.puissance_jambes_watts === 'number' ? raw.puissance_jambes_watts : null
  })()

  // ── Scores composites ──────────────────────────────────────────────────────
  // On utilise les valeurs *dérivées* (imc, vo2max, pourcentage_gras) pour les
  // catégoriser, pour que les scores soient cohérents avec ce qui s'affiche.
  const enriched: BilanData = {
    ...raw,
    imc: imc ?? raw.imc,
    vo2max: vo2max ?? raw.vo2max,
    pourcentage_gras: pourcentageGrasDurnin ?? raw.pourcentage_gras,
    saut_vertical_cm: sautVerticalCm ?? raw.saut_vertical_cm,
    puissance_jambes_watts: puissanceJambesW ?? raw.puissance_jambes_watts
  }

  const score = (key: keyof BilanData) => categoryToScore(catFor(key, enriched[key] as number | undefined, profile))
  const compose = (keys: (keyof BilanData)[]): CompositeScore => {
    const s = avg(keys.map(score))
    return { score: s, category: scoreToCategory(s) }
  }

  const composition = compose(['imc', 'pourcentage_gras', 'tour_taille_cm'])
  const bodyFat = compose(['pourcentage_gras'])
  // Libellé de la zone de la grille de Marie (« En santé », …) pour l'affichage du % de gras.
  const bodyFatGridLabel = bodyFatGridRating(enriched.pourcentage_gras, profile.sex)?.label ?? null
  const aerobic = compose(['vo2max'])
  // Indice de santé du dos — formule de l'ancien logiciel (CPAFLA), SANS le terme
  // « effets bénéfiques de l'activité physique » (aérobie) : moyenne des cotes de la
  // taille, de l'IMC et d'une moyenne pondérée redressements(×1) / flexion(×1) /
  // extension du dos(×2). Voir mémoire [[backhealth-formula-deferred]].
  const dosRatings = weightedAvg([
    [score('situps'), 1],
    [score('flexion_tronc_cm'), 1],
    [score('endurance_dos_sec'), 2]
  ])
  const backHealthScore = avg([score('tour_taille_cm'), score('imc'), dosRatings])
  const backHealth: CompositeScore = { score: backHealthScore, category: scoreToCategory(backHealthScore) }
  // Force musculaire : tests de force/puissance seulement (flexibilité + dos → backHealth).
  const musculoGlobal = compose(['pushups', 'situps', 'saut_vertical_cm', 'puissance_jambes_watts'])
  const overallScore = avg([
    composition.score,
    aerobic.score,
    ...(SHOW_BACK_HEALTH ? [backHealth.score] : []),
    musculoGlobal.score
  ])
  const overall: CompositeScore = { score: overallScore, category: scoreToCategory(overallScore) }

  return {
    imc,
    poidsOptimalMaxKg,
    ratioTailleHanche,
    pourcentageGrasDurnin,
    bodyFatGridLabel,
    vo2max,
    metEquivalent,
    fcMaxPredite,
    fcZones,
    sautVerticalCm,
    puissanceJambesW,
    composition,
    bodyFat,
    aerobic,
    backHealth,
    musculoGlobal,
    overall
  }
}

/** Injecte les champs calculés dans le BilanData pour persistance (au save). */
export function mergeComputedIntoBilan(raw: BilanData, computed: BilanComputed): BilanData {
  const next = { ...raw }
  if (computed.imc !== null) next.imc = computed.imc
  if (computed.vo2max !== null) next.vo2max = computed.vo2max
  if (computed.metEquivalent !== null) next.met_equivalent = computed.metEquivalent
  if (computed.fcMaxPredite !== null) next.fc_max_predite = computed.fcMaxPredite
  if (computed.pourcentageGrasDurnin !== null) next.pourcentage_gras = computed.pourcentageGrasDurnin
  // Saut vertical dérivé de départ/finale (si les deux sont saisis).
  if (typeof raw.saut_depart_cm === 'number' && typeof raw.saut_finale_cm === 'number' && computed.sautVerticalCm !== null) {
    next.saut_vertical_cm = computed.sautVerticalCm
  }
  // Puissance : ne pas écraser une valeur importée (flag === false).
  if (
    computed.puissanceJambesW !== null &&
    raw.puissance_calculated_auto !== false &&
    !(raw.puissance_calculated_auto === undefined && typeof raw.puissance_jambes_watts === 'number')
  ) {
    next.puissance_jambes_watts = computed.puissanceJambesW
    next.puissance_calculated_auto = true
  }
  return next
}
