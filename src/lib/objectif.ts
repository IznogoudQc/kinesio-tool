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
  weeksToGoal,
  type MacroEstimate
} from './nutrition.ts'
import { estimatedGoalDate } from './objectif-format.ts'

/** Macros en saisie manuelle : Marie tape protéines / lipides / glucides, les
 *  calories se déduisent (P×4 + G×4 + L×9). `null` si une valeur manque. */
export function manualMacros(client: {
  nutritionManualProteinG?: number | null
  nutritionManualFatG?: number | null
  nutritionManualCarbG?: number | null
}): MacroEstimate | null {
  const proteinG = client.nutritionManualProteinG
  const fatG = client.nutritionManualFatG
  const carbsG = client.nutritionManualCarbG
  if (![proteinG, fatG, carbsG].every(v => typeof v === 'number' && Number.isFinite(v))) return null
  const targetKcal = Math.round((proteinG as number) * 4 + (carbsG as number) * 4 + (fatG as number) * 9)
  return {
    bmr: 0,
    tdee: 0,
    targetKcal,
    proteinG: Math.round(proteinG as number),
    fatG: Math.round(fatG as number),
    carbsG: Math.round(carbsG as number)
  }
}

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
  /** Macros en saisie manuelle (Marie tape les grammes P/L/G ; calories déduites). */
  nutritionMacroManual?: boolean | null
  nutritionManualProteinG?: number | null
  nutritionManualFatG?: number | null
  nutritionManualCarbG?: number | null
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
  const macros = client.nutritionMacroManual
    ? manualMacros(client)
    : client.nutritionActivityLevel
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

  // `rate` est le rythme RÉELLEMENT utilisé pour l'échéance : celui choisi par
  // Marie-Eve, ou celui déduit des calories manuelles. Le rapport et le document
  // client s'en servent pour expliquer d'où sort le nombre de semaines.
  return { goal, target: client.nutritionTargetBodyFat, macros, weeks, goalDate, atGoal, rate: effectiveRate }
}
