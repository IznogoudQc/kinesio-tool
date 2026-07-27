/** Mapping entre les clés du modèle BilanData et les TestKey du système de
 *  normes. Centralisé ici pour que Dashboard, BilanDetail et un futur export
 *  PDF puissent tous catégoriser de la même manière. */

import type { TestKey } from './types'

/** NB : `imc` et `tour_taille_cm` sont volontairement ABSENTS. Ces deux mesures sont
 *  **mentionnées mais pas évaluées** (choix de Marie) : on affiche la valeur, jamais
 *  une cote ni un percentile — l'IMC seul ne dit rien de la composition d'un corps.
 *  Elles continuent d'alimenter le **score de composition** par un autre chemin : les
 *  tables CPAFLA Fig. 7-4/7-5 (bande d'IMC × tour de taille), qui ne passent pas par
 *  ce mapping. */
export const BILAN_TO_TEST_KEY: Partial<Record<keyof BilanData, TestKey>> = {
  vo2max: 'vo2max',
  pushups: 'pushups',
  situps: 'situps',
  saut_vertical_cm: 'verticalJump',
  puissance_jambes_watts: 'legPower',
  flexion_tronc_cm: 'trunkFlexion',
  endurance_dos_sec: 'backEndurance',
  pourcentage_gras: 'bodyFat',
  pa_systolique: 'bloodPressureSystolic',
  pa_diastolique: 'bloodPressureDiastolic',
  fc_repos: 'restingHeartRate'
}
