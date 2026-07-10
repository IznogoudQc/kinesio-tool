/** Objectif chiffré de composition + macros indicatives (module nutrition, opt-in).
 *
 *  Vivait dans `DashboardTab` ; le document client en a besoin aussi. Extrait ici
 *  pour que le Dashboard et le document envoyé au client disent la même chose.
 */

import type { BilanComputed } from './bilan-computed.ts'
import {
  DEFAULT_RATE_KG_PER_WEEK,
  bodyFatGoal,
  dailyDeficitForRate,
  estimateMacros,
  weeklyLossFromDeficit,
  weeksToGoal
} from './nutrition.ts'
import { estimatedGoalDate } from './objectif-format.ts'

/** Le sous-ensemble du client dont l'objectif dépend — évite de traîner tout `Client`. */
export interface ObjectifClient {
  sex: 'F' | 'M' | null
  nutritionEnabled: boolean
  nutritionTargetBodyFat: number | null
  nutritionActivityLevel: 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif' | null
  nutritionRateKgPerWeek: number | null
  nutritionProteinPerLbLean: number | null
  nutritionFatMaxG: number | null
  nutritionTargetKcal: number | null
}

export type Objectif = NonNullable<ReturnType<typeof buildObjectif>>

/** `null` si le module est désactivé, sans cible, ou sans poids / % de gras mesurés. */
export function buildObjectif(
  client: ObjectifClient,
  data: BilanData,
  computed: BilanComputed,
  age: number | null,
  startDateIso: string
) {
  if (!client.nutritionEnabled || client.nutritionTargetBodyFat == null) return null

  const weightKg = typeof data.poids_kg === 'number' ? data.poids_kg : null
  const bodyFatPct =
    computed.pourcentageGrasDurnin ?? (typeof data.pourcentage_gras === 'number' ? data.pourcentage_gras : null)
  const goal = bodyFatGoal(weightKg, bodyFatPct, client.nutritionTargetBodyFat)
  if (!goal) return null

  const rate = client.nutritionRateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK
  const macros = client.nutritionActivityLevel
    ? estimateMacros({
        weightKg,
        heightCm: typeof data.taille_cm === 'number' ? data.taille_cm : null,
        age,
        sex: client.sex,
        activity: client.nutritionActivityLevel,
        leanKg: goal.leanKg,
        dailyDeficitKcal: dailyDeficitForRate(rate),
        proteinPerLbLean: client.nutritionProteinPerLbLean,
        fatMaxG: client.nutritionFatMaxG,
        targetKcalOverride: client.nutritionTargetKcal
      })
    : null

  // Calories fixées à la main : le rythme réel se déduit du déficit obtenu.
  const manualKcal = client.nutritionTargetKcal
  const effectiveRate = manualKcal != null && macros ? weeklyLossFromDeficit(macros.tdee - macros.targetKcal) : rate

  const atGoal = goal.toLoseKg <= 0.3
  const weeks = atGoal ? null : weeksToGoal(goal.toLoseKg, effectiveRate)
  const goalDate = weeks != null ? estimatedGoalDate(startDateIso, weeks) : null

  return { goal, target: client.nutritionTargetBodyFat, macros, weeks, goalDate, atGoal }
}
