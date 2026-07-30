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

/**
 * Sens de progression d'une mesure — `true` quand **plus bas est mieux**.
 *
 * C'est une propriété de la MESURE, pas du barème. Le rapport PDF la déduisait
 * de `lowerIsBetter` de la table de normes ; or `imc` et `tour_taille_cm` n'ont
 * plus de `TestKey` (voir ci-dessus), donc la lecture retombait sur `false` et
 * une **baisse** de l'IMC s'affichait en rouge avec une flèche « dégradation ».
 * Un client voyait son tour de taille passer de 99 à 93 cm annoncé comme un
 * recul.
 *
 * Déclaré ici, à côté du mapping dont la suppression a causé le défaut, pour que
 * les deux se lisent ensemble. `bilan-keys.test.ts` vérifie que cette table
 * s'accorde avec les tables de normes partout où les deux existent.
 */
export const BILAN_LOWER_IS_BETTER: Partial<Record<keyof BilanData, boolean>> = {
  // Mentionnées sans être évaluées — sans barème, donc sans autre source.
  imc: true,
  tour_taille_cm: true,
  // Plis cutanés : moins de gras sous-cutané est toujours l'objectif.
  pli_triceps: true,
  pli_biceps: true,
  pli_sous_scap: true,
  pli_iliaque: true,
  pli_mollet: true,
  pli_cuisse: true,
  // Circonférences MUSCULAIRES : grossir est l'objectif (confirmé par Marie —
  // voir le commentaire de `BilanMeasuresOverview`). À ne pas confondre avec le
  // tour de taille et le tour de hanche, qui mesurent de l'adiposité.
  circ_biceps_flechi_cm: false,
  circ_cuisse_cm: false,
  circ_epaules_pec_cm: false,
  // Cotées : redondant avec les tables, mais déclaré pour que le sens ne dépende
  // jamais de la présence d'un barème.
  pourcentage_gras: true,
  pa_systolique: true,
  pa_diastolique: true,
  fc_repos: true,
  vo2max: false,
  pushups: false,
  situps: false,
  saut_vertical_cm: false,
  puissance_jambes_watts: false,
  flexion_tronc_cm: false,
  endurance_dos_sec: false
}

/**
 * Mesures dont le sens dépend de l'OBJECTIF du client, et non de la mesure
 * elle-même. Le poids en est l'évidence ; le tour de hanche aussi, puisque c'est
 * de l'adiposité chez un client qui s'allège mais du muscle fessier chez un
 * client qui prend de la masse.
 *
 * Sans cette notion, le sens divergeait d'un écran à l'autre : l'onglet Mesures
 * faisait suivre l'objectif au tour de hanche, le graphique de progression le
 * figeait sur « baisse = mieux ».
 */
export const BILAN_GOAL_DEPENDENT: ReadonlySet<keyof BilanData> = new Set<keyof BilanData>([
  'poids_kg',
  'tour_hanche_cm'
])

/**
 * Plus bas est-il mieux pour cette mesure ?
 *
 * `weightLossGoal` ne sert qu'aux mesures de `BILAN_GOAL_DEPENDENT` ; ailleurs il
 * est ignoré. Défaut `true` : la perte de poids est le cas courant, et c'est déjà
 * le défaut retenu ailleurs dans l'app.
 */
export function isLowerBetter(key: keyof BilanData, weightLossGoal = true): boolean {
  if (BILAN_GOAL_DEPENDENT.has(key)) return weightLossGoal
  return BILAN_LOWER_IS_BETTER[key] ?? false
}
