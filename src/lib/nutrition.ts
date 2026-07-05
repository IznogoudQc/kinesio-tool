/**
 * Calculs d'objectif chiffré & nutrition — logique pure (sans JSX, sans DB),
 * testable avec `node --test`.
 *
 * Deux volets :
 *  1. `bodyFatGoal` — poids-cible pour atteindre un % de gras visé, en préservant
 *     la masse maigre (méthode standard : on ne perd que du gras). Défendable, ce
 *     n'est que de l'arithmétique.
 *  2. `estimateMacros` — estimation calorique + macros pour une perte de gras.
 *     ⚠️ À TITRE INDICATIF seulement — la planification nutritionnelle relève des
 *     nutritionnistes/diététistes (OPDQ). Toujours accompagner d'un avertissement.
 *
 * Toutes les masses sont en kg en interne (la conversion lb se fait à l'affichage,
 * cf. src/lib/units.ts). Renvoie `null` dès qu'une donnée requise manque.
 */

export type ActivityLevel = 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif'

/** Multiplicateurs de dépense énergétique (BMR → TDEE) — valeurs Harris/Mifflin usuelles. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
  tres_actif: 1.9
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentaire: 'Sédentaire (peu ou pas d’exercice)',
  leger: 'Léger (1-3 j/sem)',
  modere: 'Modéré (3-5 j/sem)',
  actif: 'Actif (6-7 j/sem)',
  tres_actif: 'Très actif (travail physique + entraînement)'
}

export const ACTIVITY_ORDER: ActivityLevel[] = ['sedentaire', 'leger', 'modere', 'actif', 'tres_actif']

/** Déficit calorique appliqué pour la perte de gras (20 % sous le TDEE) — modéré
 *  et soutenable. On ne descend jamais sous le BMR (garde-fou de sécurité). */
const FAT_LOSS_DEFICIT = 0.2

/** Protéines visées par kg de poids-cible — haut de fourchette pour préserver la
 *  masse maigre en déficit (1,6-2,2 g/kg selon la littérature). */
const PROTEIN_G_PER_KG = 2.0

/** Part des lipides dans l'apport calorique cible (santé hormonale minimale). */
const FAT_KCAL_RATIO = 0.25

export interface BodyFatGoal {
  /** Poids à atteindre (kg) pour le % de gras visé, masse maigre constante. */
  goalKg: number
  /** Masse à perdre (kg). ≤ 0 si l'objectif est déjà atteint ou dépassé. */
  toLoseKg: number
  /** Masse maigre estimée (kg) — préservée dans le calcul. */
  leanKg: number
}

/**
 * Poids-cible pour atteindre `targetPct` % de gras, en gardant la masse maigre.
 *   masse maigre = poids × (1 − %gras/100)
 *   poids-cible  = masse maigre / (1 − %cible/100)
 */
export function bodyFatGoal(
  currentKg: number | null | undefined,
  currentBodyFatPct: number | null | undefined,
  targetPct: number | null | undefined
): BodyFatGoal | null {
  if (
    !Number.isFinite(currentKg ?? NaN) ||
    !Number.isFinite(currentBodyFatPct ?? NaN) ||
    !Number.isFinite(targetPct ?? NaN)
  ) {
    return null
  }
  const w = currentKg as number
  const bf = currentBodyFatPct as number
  const target = targetPct as number
  if (w <= 0 || bf < 0 || bf >= 100 || target <= 0 || target >= 100) return null

  const leanKg = w * (1 - bf / 100)
  const goalKg = leanKg / (1 - target / 100)
  return {
    goalKg: Math.round(goalKg * 10) / 10,
    toLoseKg: Math.round((w - goalKg) * 10) / 10,
    leanKg: Math.round(leanKg * 10) / 10
  }
}

/** BMR (métabolisme de repos, kcal/j) via Mifflin-St Jeor. */
export function mifflinBmr(params: {
  weightKg: number | null | undefined
  heightCm: number | null | undefined
  age: number | null | undefined
  sex: 'M' | 'F' | null | undefined
}): number | null {
  const { weightKg, heightCm, age, sex } = params
  if (
    !Number.isFinite(weightKg ?? NaN) ||
    !Number.isFinite(heightCm ?? NaN) ||
    !Number.isFinite(age ?? NaN) ||
    (sex !== 'M' && sex !== 'F')
  ) {
    return null
  }
  const base = 10 * (weightKg as number) + 6.25 * (heightCm as number) - 5 * (age as number)
  const bmr = sex === 'M' ? base + 5 : base - 161
  return bmr > 0 ? Math.round(bmr) : null
}

export interface MacroEstimate {
  bmr: number
  tdee: number
  targetKcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

/**
 * Estimation calorique + macros pour une perte de gras. `goalKg` (optionnel) sert
 * de base au calcul des protéines ; sinon on utilise le poids actuel.
 * ⚠️ Indicatif — accompagner d'un avertissement (champ de pratique).
 */
export function estimateMacros(params: {
  weightKg: number | null | undefined
  heightCm: number | null | undefined
  age: number | null | undefined
  sex: 'M' | 'F' | null | undefined
  activity: ActivityLevel | null | undefined
  goalKg?: number | null
}): MacroEstimate | null {
  const { weightKg, heightCm, age, sex, activity, goalKg } = params
  const bmr = mifflinBmr({ weightKg, heightCm, age, sex })
  if (bmr === null || !activity || !(activity in ACTIVITY_FACTORS)) return null

  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activity])
  // Déficit modéré, jamais sous le BMR.
  const targetKcal = Math.max(bmr, Math.round(tdee * (1 - FAT_LOSS_DEFICIT)))

  const proteinBaseKg = Number.isFinite(goalKg ?? NaN) ? (goalKg as number) : (weightKg as number)
  const proteinG = Math.round(proteinBaseKg * PROTEIN_G_PER_KG)
  const fatG = Math.round((targetKcal * FAT_KCAL_RATIO) / 9)
  const carbsKcal = targetKcal - proteinG * 4 - fatG * 9
  const carbsG = Math.max(0, Math.round(carbsKcal / 4))

  return { bmr, tdee, targetKcal, proteinG, carbsG, fatG }
}
