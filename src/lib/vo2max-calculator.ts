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
 * Vitesse (km/h) du palier atteint au test navette 20 m : le palier 1 se court à
 * 8,5 km/h et chaque palier suivant ajoute 0,5 km/h.
 *
 * C'est cette **vitesse** — pas le numéro du palier — qui entre dans l'équation
 * de Léger. Voir `legerVo2max`.
 */
export function legerSpeedKmh(palier: number): number {
  return 8 + 0.5 * palier
}

/**
 * Test de Léger (navette 20 m) : VO2max à partir du palier atteint et de l'âge.
 *   VO2max = 31.025 + 3.238·V - 3.248·age + 0.1536·V·age
 *   V = vitesse du palier en km/h (`legerSpeedKmh`).
 * Source : Léger LA et al., J. Sports Sci. 1988 (équation officielle 20 m MSRT).
 *
 * ⚠️ Le `V` de l'équation publiée est une **vitesse en km/h**, pas un numéro de
 * palier. La première version passait le palier directement : un palier 8 à
 * 30 ans donnait −3,6 ml/kg/min, et tout palier réaliste sortait négatif. Aucun
 * bilan n'en a souffert (les 12 bilans de la base sont des Bruce), mais le
 * premier test navette aurait produit un VO2max négatif coté « À améliorer ».
 * Repéré en documentant les protocoles pour l'écran des barèmes (2026-08-07).
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
  const V = legerSpeedKmh(palier)
  return 31.025 + 3.238 * V - 3.248 * age + 0.1536 * V * age
}

// ── Description des protocoles — référence pour l'UI ─────────────────────────

export interface Vo2maxProtocole {
  key: Exclude<AerobicTestType, 'manual'>
  nom: string
  /** Ce qu'on mesure sur le terrain. */
  mesure: string
  /** L'équation, telle qu'elle est écrite juste au-dessus. */
  formule: string
  source: string
  /** Un cas concret, **calculé par la fonction réelle** — jamais écrit à la main. */
  exemple: () => { entree: string; vo2max: number }
}

/**
 * Les trois protocoles, décrits pour l'écran des barèmes.
 *
 * Volontairement dans ce fichier plutôt que dans le composant : la description
 * et l'implémentation se relisent d'un coup d'œil, donc changer un coefficient
 * sans changer la formule affichée demande de l'ignorer sciemment. Et l'exemple
 * appelle la vraie fonction — s'il dérive, le chiffre à l'écran bouge.
 */
export const VO2MAX_PROTOCOLES: Vo2maxProtocole[] = [
  {
    key: 'bruce',
    nom: 'Bruce (tapis roulant)',
    mesure: 'La durée totale tenue sur le tapis, paliers de 3 minutes.',
    formule:
      'Hommes : 14,76 − 1,379·T + 0,451·T² − 0,012·T³ · Femmes : 4,38·T − 3,9 (T = durée en minutes)',
    source: 'Foster/Pollock (1984), repris par l’ACSM',
    exemple: () => ({
      entree: 'homme, 10:00',
      vo2max: bruceTreadmillVo2max({ durationSeconds: 600, sex: 'M' })
    })
  },
  {
    key: 'cooper',
    nom: 'Cooper (12 minutes)',
    mesure: 'La distance parcourue en 12 minutes de course.',
    formule: '(distance en mètres − 504,9) ÷ 44,73',
    source: 'Cooper KH, JAMA 1968',
    exemple: () => ({ entree: '2 400 m', vo2max: cooperVo2max(2400) })
  },
  {
    key: 'leger',
    nom: 'Léger (navette 20 m)',
    mesure:
      'Le palier atteint au test navette. Dépend aussi de l’âge. Le palier 1 se court à 8,5 km/h, +0,5 km/h par palier.',
    formule: '31,025 + 3,238·V − 3,248·âge + 0,1536·V·âge (V = vitesse du palier, en km/h)',
    source: 'Léger LA et coll., J. Sports Sci. 1988',
    exemple: () => ({ entree: 'palier 8, 30 ans', vo2max: legerVo2max(8, 30) })
  }
]

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
