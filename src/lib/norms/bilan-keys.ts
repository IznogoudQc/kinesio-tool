/** Mapping entre les clés du modèle BilanData et les TestKey du système de
 *  normes. Centralisé ici pour que Dashboard, BilanDetail et un futur export
 *  PDF puissent tous catégoriser de la même manière. */

import type { TestKey } from './types'

export const BILAN_TO_TEST_KEY: Partial<Record<keyof BilanData, TestKey>> = {
  vo2max: 'vo2max',
  pushups: 'pushups',
  situps: 'situps',
  saut_vertical_cm: 'verticalJump',
  puissance_jambes_watts: 'legPower',
  flexion_tronc_cm: 'trunkFlexion',
  endurance_dos_sec: 'backEndurance',
  pourcentage_gras: 'bodyFat',
  imc: 'bmi',
  tour_taille_cm: 'waistCircumference',
  pa_systolique: 'bloodPressureSystolic',
  pa_diastolique: 'bloodPressureDiastolic',
  fc_repos: 'restingHeartRate'
}
