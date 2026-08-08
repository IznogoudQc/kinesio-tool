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
import {
  cpaflaCombineDetail,
  MUSCULO_WEIGHTS,
  BACK_HEALTH_WEIGHTS,
  type CpaflaKeyedContribution,
  type CpaflaCombineDetail
} from './norms/cpafla-combined.ts'
import { cpaflaComposition, cpaflaWaistPoints, s5pcForScoring } from './norms/cpafla-composition.ts'
import { systolicRating, waistCategory } from './norms/clinical.ts'
import { BILAN_TO_TEST_KEY } from './norms/bilan-keys.ts'
import { computeAge } from './norms/index.ts'
import { DEFAULT_NORMS } from './norms/types.ts'
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
  /**
   * FC max saisie par Marie-Eve pour ce client, qui remplace la prédiction de
   * Tanaka. `null`/absent = on garde la prédiction.
   *
   * Portée par le PROFIL et non par un paramètre séparé : le dashboard, le
   * rapport PDF et le document HTML construisent tous leur profil avec
   * `buildBilanProfile(client)`, donc l'ajustement les atteint tous les trois
   * sans câblage supplémentaire — et surtout sans qu'une surface puisse
   * l'oublier.
   */
  fcMaxManuel?: number | null
}

/**
 * Profil de cotation d'un client — **point d'entrée unique** du dashboard, du
 * rapport PDF et du rapport HTML autonome.
 *
 * Les trois construisaient ce profil chacun de leur côté, et ils ont divergé :
 * le HTML alimentait `norms` depuis le réglage `categorization_norms`, retiré
 * en v0.9.31, si bien que sa lecture retombait toujours sur ACSM. Le même
 * client affichait une composition corporelle de 3,0 dans le document remis et
 * de 4,0 à l'écran. Passer par ce helper garantit que les trois surfaces cotent
 * sur les mêmes bases : même âge (calculé à la date du jour) et même norme.
 */
export function buildBilanProfile(
  client:
    | { birthdate?: string | null; sex?: 'F' | 'M' | null; fcMaxManuel?: number | null }
    | null
    | undefined
): BilanProfile {
  return {
    age: computeAge(client?.birthdate),
    sex: client?.sex ?? null,
    norms: DEFAULT_NORMS,
    fcMaxManuel: client?.fcMaxManuel ?? null
  }
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
  /** FC max retenue : saisie manuelle si elle existe, sinon prédiction Tanaka. */
  fcMaxPredite: number | null
  /** D'où vient `fcMaxPredite` — pour que l'affichage ne mente pas. */
  fcMaxSource: 'manuel' | 'tanaka' | null
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
  /** Détail du calcul (cote × poids par test) — sert à expliquer la note dans le
   *  dashboard. `null` si le sexe du client est inconnu (méthode CPAFLA inapplicable). */
  backHealthDetail: CpaflaCombineDetail | null
  musculoDetail: CpaflaCombineDetail | null
  /** Détail du score global. Structure **confirmée** par la formule de l'ancien
   *  logiciel (ADR 0033). Le barème de la PA systolique l'est aussi depuis la
   *  v0.9.145 — plus aucune composante n'est provisoire (ADR 0040). */
  overallDetail: CpaflaCombineDetail
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
  // CPAFLA ne couvre que le musculosquelettique → repli sur ACSM pour les tests
  // sans table CPAFLA (VO2max, IMC, tour de taille). Voir ADR 0025.
  // Même barème dédié qu'en affichage — sans quoi le formulaire et le tableau
  // de bord coteraient le tour de taille différemment.
  if (test === 'waistCircumference') return waistCategory(value, sex)
  const range =
    norms === 'cpafla'
      ? (getCpaflaRange(test, age, sex) ?? getAcsmRange(test, age, sex))
      : getAcsmRange(test, age, sex)
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
  // FC max saisie par Marie-Eve si elle existe, sinon prédiction de Tanaka. Les
  // cinq zones en découlent entièrement, d'où l'importance de ne pas se tromper
  // de source : `fcMaxSource` permet à l'affichage de dire laquelle est utilisée
  // plutôt que d'annoncer « prédite » quoi qu'il arrive.
  const fcMaxRaw = computeFcMaxPredite(age)
  const fcMaxPreditRounded = fcMaxRaw === null ? null : Math.round(fcMaxRaw)
  const manuel = typeof profile.fcMaxManuel === 'number' && Number.isFinite(profile.fcMaxManuel)
    ? Math.round(profile.fcMaxManuel)
    : null
  const fcMaxPredite = manuel ?? fcMaxPreditRounded
  const fcMaxSource: 'manuel' | 'tanaka' | null =
    manuel !== null ? 'manuel' : fcMaxPreditRounded === null ? null : 'tanaka'
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
    // Toujours (re)calculer par Sayers dès que saut + poids sont connus — y compris
    // pour un bilan importé : la puissance est un champ **calculé** (jamais saisi à
    // la main), donc l'app doit en être la seule source. Sayers reproduit d'ailleurs
    // exactement les rapports d'origine quand leurs données sont cohérentes.
    // Repli sur la valeur importée seulement si le calcul est impossible (saut ou
    // poids manquant) — sinon on perdrait la donnée.
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

  // Composition corporelle. Sous **CPAFLA** : méthode du guide (tables
  // Fig. 7-4/7-5, cf. ADR 0027). La somme des 5 plis n'est pas utilisée —
  // Marie ne mesure pas le pli du mollet — donc la note suit la combinaison
  // « IMC + tour de taille » que le guide prévoit (voir `s5pcForScoring`).
  // Sous **ACSM** : moyenne historique (IMC + % gras-grille + taille).
  const composition = ((): CompositeScore => {
    if (profile.norms === 'cpafla' && (profile.sex === 'M' || profile.sex === 'F')) {
      const s5pc = s5pcForScoring({
        triceps: raw.pli_triceps,
        biceps: raw.pli_biceps,
        sousScap: raw.pli_sous_scap,
        iliaque: raw.pli_iliaque,
        mollet: raw.pli_mollet
      })
      const s = cpaflaComposition({ imc: enriched.imc, ct: enriched.tour_taille_cm, s5pc, sex: profile.sex })
      return { score: s, category: scoreToCategory(s) }
    }
    return compose(['imc', 'pourcentage_gras', 'tour_taille_cm'])
  })()
  const bodyFat = compose(['pourcentage_gras'])
  // Libellé de la zone de la grille de Marie (« En santé », …) pour l'affichage du % de gras.
  const bodyFatGridLabel = bodyFatGridRating(enriched.pourcentage_gras, profile.sex)?.label ?? null
  const aerobic = compose(['vo2max'])

  // ── Note combinée musculo + indice de santé du dos ─────────────────────────
  // Méthode du guide CPHV (Fig. 7-20 / 7-24) : moyenne pondérée des cotes, par
  // sexe, **décimales conservées** (préhension et activité physique exclues — non
  // captées, cf. ADR 0026). Appliquée **quelle que soit la norme choisie** : c'est
  // la seule formule sourcée pour ces deux composites, et elle reproduit à
  // l'identique les rapports de l'ancien logiciel (ADR 0028). Le repli historique
  // ci-dessous ne sert plus que si le sexe du client est inconnu.
  const useCpaflaCombined = profile.sex === 'M' || profile.sex === 'F'
  let backHealth: CompositeScore
  let musculoGlobal: CompositeScore
  let backHealthDetail: CpaflaCombineDetail | null = null
  let musculoDetail: CpaflaCombineDetail | null = null
  if (useCpaflaCombined) {
    const sex = profile.sex as 'M' | 'F'
    // Le tour de taille se cote via les tables de composition (Fig. 7-4/7-5, donc
    // selon la bande d'IMC) et non via les seuils Santé Canada — cf. `cpaflaWaistPoints`.
    const waistPts = cpaflaWaistPoints(enriched.imc, enriched.tour_taille_cm, sex)
    const contribs = (weights: Record<string, number>): CpaflaKeyedContribution[] =>
      Object.entries(weights).map(([k, w]) =>
        k === 'tour_taille_cm' ? [k, waistPts, w] : [k, score(k as keyof BilanData), w]
      )
    musculoDetail = cpaflaCombineDetail(contribs(MUSCULO_WEIGHTS[sex]))
    musculoGlobal = { score: musculoDetail.score, category: scoreToCategory(musculoDetail.score) }
    backHealthDetail = cpaflaCombineDetail(contribs(BACK_HEALTH_WEIGHTS[sex]))
    backHealth = { score: backHealthDetail.score, category: scoreToCategory(backHealthDetail.score) }
  } else {
    // Indice de santé du dos — approximation historique (SANS le terme aérobie) :
    // moyenne des cotes taille + IMC + moyenne pondérée redressements(×1) /
    // flexion(×1) / extension du dos(×2). Voir mémoire [[backhealth-formula-deferred]].
    const dosRatings = weightedAvg([
      [score('situps'), 1],
      [score('flexion_tronc_cm'), 1],
      [score('endurance_dos_sec'), 2]
    ])
    const backHealthScore = avg([score('tour_taille_cm'), score('imc'), dosRatings])
    backHealth = { score: backHealthScore, category: scoreToCategory(backHealthScore) }
    // Force musculaire : tests de force/puissance seulement (flexibilité + dos → backHealth).
    musculoGlobal = compose(['pushups', 'situps', 'saut_vertical_cm', 'puissance_jambes_watts'])
  }
  // ── Santé et condition physique globale ────────────────────────────────────
  // Structure **confirmée** par la fenêtre Propriétés de l'ancien logiciel (ADR
  // 0033), formule identique pour les hommes et les femmes :
  //
  //   AverageRatings([Questionnaire combiné]*1, [Composition corporelle]*1,
  //     [Pression artérielle systolique]*1, [METS max]*1, [Indice de santé du dos]*1,
  //     [Aptitudes musculosquelettiques]*1, [166]*1)
  //
  // Sept composantes, toutes ×1, moyenne des **cotes entières 0-4** (pas des scores
  // décimaux) et seules les composantes mesurées comptent — c'est le sens de
  // `AverageRatings`. On en implémente cinq : Marie n'utilise pas le test 166, et
  // ne fait pas le questionnaire à chaque fois (décision de Nicholas : on ne le
  // tient pas en compte pour l'instant). Notre `aerobic` correspond à leur
  // « METS max » — le METS n'étant que le VO2max ÷ 3,5, la cote est la même.
  //
  // ⚠️ Seul le barème de la PA systolique reste PROVISOIRE (`systolicRating`).
  const coteOf = (c: CompositeScore): number | null =>
    c.score === null ? null : categoryToScore(scoreToCategory(c.score))
  const overallDetail = cpaflaCombineDetail([
    ['composition', coteOf(composition), 1],
    ['aerobic', coteOf(aerobic), 1],
    ['pa_systolique', systolicRating(raw.pa_systolique), 1],
    ...(SHOW_BACK_HEALTH
      ? ([['backHealth', coteOf(backHealth), 1]] as CpaflaKeyedContribution[])
      : []),
    ['musculoGlobal', coteOf(musculoGlobal), 1]
  ])
  const overallScore = overallDetail.score
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
    fcMaxSource,
    fcZones,
    sautVerticalCm,
    puissanceJambesW,
    composition,
    bodyFat,
    aerobic,
    backHealth,
    musculoGlobal,
    backHealthDetail,
    musculoDetail,
    overallDetail,
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
  // Puissance : champ calculé, jamais saisi → toujours celle de l'app (Sayers).
  // `computed.puissanceJambesW` retombe déjà sur la valeur importée si le calcul
  // est impossible, donc on n'écrase jamais par du vide.
  if (computed.puissanceJambesW !== null) {
    next.puissance_jambes_watts = computed.puissanceJambesW
    next.puissance_calculated_auto = true
  }
  // Scores composites : **toujours** ceux calculés par l'app. À l'import d'un `.doc`,
  // le parser recopie les scores imprimés par le logiciel d'origine ; on les écrase
  // ici pour qu'il n'existe qu'une seule source de vérité (la section du formulaire
  // s'appelle « Indices (calculés) »). Arrondis à la décimale, comme à l'affichage.
  const round1 = (n: number): number => Math.round(n * 10) / 10
  if (computed.composition.score !== null) next.score_composition = round1(computed.composition.score)
  if (computed.backHealth.score !== null) next.indice_sante_dos = round1(computed.backHealth.score)
  if (computed.musculoGlobal.score !== null) next.score_musculo_global = round1(computed.musculoGlobal.score)
  if (computed.overall.score !== null) next.score_global = round1(computed.overall.score)
  return next
}
