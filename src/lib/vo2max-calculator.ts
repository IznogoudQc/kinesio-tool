/**
 * Calculs de VO2max à partir des protocoles de terrain les plus utilisés au
 * Québec : Bruce (tapis), Cooper (12 min), Léger (navette 20 m).
 *
 * Toutes les formules retournent ml/kg/min. Les fonctions sont **pures** —
 * aucune dépendance aux normes ACSM/CPAFLA (qui sont la catégorisation, pas
 * l'estimation). Elles sont testées via `node --test`.
 */

export type AerobicTestType = 'bruce' | 'cooper' | 'leger' | 'manual'

export interface BruceInput {
  durationSeconds: number
  sex: 'F' | 'M'
}

/**
 * Bruce treadmill : VO2max à partir de la durée totale tenue.
 *  - Hommes (Foster/Pollock 1984) :
 *      VO2max = 14.76 - 1.379·T + 0.451·T² - 0.012·T³
 *  - Femmes (Pollock 1982 / Kline-like) :
 *      VO2max = 4.38·T - 3.9
 *  T = durée en minutes décimales.
 *
 * Source : ACSM Guidelines for Exercise Testing and Prescription, 11e éd.
 */
export function bruceTreadmillVo2max({ durationSeconds, sex }: BruceInput): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return Number.NaN
  const T = durationSeconds / 60
  if (sex === 'M') {
    return 14.76 - 1.379 * T + 0.451 * T ** 2 - 0.012 * T ** 3
  }
  return 4.38 * T - 3.9
}

/**
 * Cooper 12 min : VO2max à partir de la distance parcourue (mètres).
 *   VO2max = (distance - 504.9) / 44.73
 * Source : Cooper KH, JAMA 1968 (validée par Mahar et al. 2018 pour adultes).
 */
export function cooperVo2max(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return Number.NaN
  return (distanceMeters - 504.9) / 44.73
}

/**
 * Test de Léger (navette 20 m) : VO2max à partir du palier atteint et de l'âge.
 *   VO2max = 31.025 + 3.238·palier - 3.248·age + 0.1536·palier·age
 * Source : Léger LA et al., J. Sports Sci. 1988 (équation officielle 20 m MSRT).
 */
export function legerVo2max(palier: number, age: number): number {
  if (
    !Number.isFinite(palier) ||
    palier <= 0 ||
    !Number.isFinite(age) ||
    age <= 0
  ) {
    return Number.NaN
  }
  return 31.025 + 3.238 * palier - 3.248 * age + 0.1536 * palier * age
}

// ── Bruce stages — référence pour l'UI ───────────────────────────────────────

export interface BruceStage {
  stage: number
  /** Minute de fin du palier (chaque stage dure 3 min). */
  endMinutes: number
  speedKmh: number
  gradePct: number
  /** Estimation MET au pic du palier (Pollock 1976, tables ACSM). */
  mets: number
}

export const BRUCE_STAGES: BruceStage[] = [
  { stage: 1, endMinutes: 3, speedKmh: 2.7, gradePct: 10, mets: 5 },
  { stage: 2, endMinutes: 6, speedKmh: 4.0, gradePct: 12, mets: 7 },
  { stage: 3, endMinutes: 9, speedKmh: 5.5, gradePct: 14, mets: 10 },
  { stage: 4, endMinutes: 12, speedKmh: 6.8, gradePct: 16, mets: 13 },
  { stage: 5, endMinutes: 15, speedKmh: 8.0, gradePct: 18, mets: 16 },
  { stage: 6, endMinutes: 18, speedKmh: 8.9, gradePct: 20, mets: 18 },
  { stage: 7, endMinutes: 21, speedKmh: 9.7, gradePct: 22, mets: 20 }
]

/** Retourne le stage atteint pour une durée donnée (en secondes). */
export function bruceStageFor(durationSeconds: number): BruceStage | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null
  const minutes = durationSeconds / 60
  // Si on est encore dans le stage 1, on est < 3 min ; etc. On retourne le
  // stage *en cours* (celui où on s'est arrêté).
  for (const s of BRUCE_STAGES) {
    if (minutes <= s.endMinutes) return s
  }
  return BRUCE_STAGES[BRUCE_STAGES.length - 1]
}

/** Parse une saisie utilisateur "mm:ss" (ou "m:ss") en secondes. Retourne `null` si invalide. */
export function parseMmSs(input: string): number | null {
  const m = /^\s*(\d{1,3}):([0-5]?\d)\s*$/.exec(input)
  if (!m) return null
  const minutes = parseInt(m[1], 10)
  const seconds = parseInt(m[2], 10)
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  return minutes * 60 + seconds
}

/**
 * Puissance maximale des jambes (Watts) via la formule de Sayers (1999).
 *   P = (60.7 × saut_cm) + (45.3 × poids_kg) − 2055
 *
 * Source : Sayers SP, Harackiewicz DV, Harman EA, Frykman PN, Rosenstein MT.
 *   « Cross-validation of three jump power equations. » Med Sci Sports Exerc, 1999.
 * Standard ACSM / SCPE pour le saut vertical en bilan de condition physique.
 *
 * Retourne `null` si l'une des deux entrées manque. Arrondi à l'entier
 * (les bilans de Marie-Eve affichent toujours des Watts entiers).
 */
export function sayersLegPower(
  verticalJumpCm: number | undefined,
  bodyWeightKg: number | undefined
): number | null {
  if (
    !Number.isFinite(verticalJumpCm) ||
    !Number.isFinite(bodyWeightKg) ||
    (verticalJumpCm as number) <= 0 ||
    (bodyWeightKg as number) <= 0
  ) {
    return null
  }
  return Math.round(60.7 * (verticalJumpCm as number) + 45.3 * (bodyWeightKg as number) - 2055)
}

/** Formate une durée en secondes vers "mm:ss". */
export function formatMmSs(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds - minutes * 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
