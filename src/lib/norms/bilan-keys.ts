/** Mapping entre les clés du modèle BilanData et les TestKey du système de
 *  normes. Centralisé ici pour que Dashboard, BilanDetail et un futur export
 *  PDF puissent tous catégoriser de la même manière. */

import type { TestKey } from './types'

/** NB : `tour_taille_cm` est volontairement ABSENT. Le tour de taille est
 *  **mentionné mais pas évalué** (choix de Marie) : on affiche la mesure, jamais
 *  une cote ni un percentile. Il continue d'alimenter le **score de composition**
 *  par un autre chemin — les tables CPAFLA Fig. 7-4/7-5 (`cpaflaWaistPoints`), qui
 *  ne passent pas par ce mapping. */
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
  pa_systolique: 'bloodPressureSystolic',
  pa_diastolique: 'bloodPressureDiastolic',
  fc_repos: 'restingHeartRate'
}
