/** Forces et priorités d'un bilan, avec un objectif chiffré par priorité.
 *
 *  Le rapport PDF construisait ça dans son composant ; le document client en
 *  avait besoin aussi. Extrait ici pour que les deux disent la même chose.
 */

import {
  CATEGORY_LABELS,
  getCategorization,
  getNextCategoryTarget,
  getNormPercentiles,
  getPercentile,
  type Category
} from './norms/index.ts'
import { BILAN_TO_TEST_KEY } from './norms/bilan-keys.ts'
import type { BilanProfile } from './bilan-computed.ts'

const SCORE_OF: Record<Category, number> = {
  A_AMELIORER: 1,
  ACCEPTABLE: 2,
  BIEN: 3,
  TRES_BIEN: 4,
  EXCELLENT: 5
}

export interface PlanMetric {
  key: keyof BilanData
  label: string
  unit: string
}

/** Les mesures qui peuvent apparaître dans un plan d'action, avec leur libellé client. */
export const PLAN_METRICS: PlanMetric[] = [
  { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min' },
  { key: 'pourcentage_gras', label: 'Pourcentage de gras', unit: '%' },
  { key: 'imc', label: 'Indice de masse corporelle', unit: 'kg/m²' },
  { key: 'tour_taille_cm', label: 'Tour de taille', unit: 'cm' },
  { key: 'pushups', label: 'Pompes', unit: 'reps' },
  { key: 'situps', label: 'Redressements assis', unit: 'reps' },
  { key: 'saut_vertical_cm', label: 'Saut vertical', unit: 'cm' },
  { key: 'puissance_jambes_watts', label: 'Puissance des jambes', unit: 'W' },
  { key: 'flexion_tronc_cm', label: 'Flexion du tronc', unit: 'cm' },
  { key: 'endurance_dos_sec', label: 'Endurance des muscles du dos', unit: 's' }
]

/** Recommandations courtes et génériques, une par mesure. */
export const RECO: Partial<Record<keyof BilanData, string>> = {
  vo2max: 'Intégrez 2 à 3 séances de cardio par semaine (continu ou par intervalles).',
  pourcentage_gras: 'Associez un léger déficit calorique à de la musculation pour préserver la masse maigre.',
  imc: 'Visez une perte de poids progressive (≈ 0,5 kg/semaine) par l’alimentation et l’activité.',
  tour_taille_cm: 'Le tour de taille répond bien au cardio régulier et à la réduction des sucres ajoutés.',
  pushups: 'Travaillez les pompes 3×/semaine en séries courtes, en progressant graduellement.',
  situps: 'Renforcez la sangle abdominale en alternant redressements et gainage.',
  saut_vertical_cm: 'Ajoutez des exercices de pliométrie (sauts, fentes sautées) à votre routine.',
  puissance_jambes_watts: 'Les squats et le travail explosif des jambes amélioreront votre puissance.',
  flexion_tronc_cm: 'Étirez quotidiennement les ischio-jambiers et le bas du dos pour gagner en souplesse.',
  endurance_dos_sec: 'Le gainage dorsal (Sorensen, superman) renforce l’endurance des muscles du dos.',
  pa_systolique: 'Réduisez le sel, gérez le stress et restez actif pour faire baisser la pression.',
  pa_diastolique: 'Activité régulière, sommeil et modération de l’alcool aident à abaisser la diastolique.',
  fc_repos: 'Un cœur entraîné bat plus lentement au repos — le cardio régulier le renforce.'
}

export interface PlanItem {
  metric: PlanMetric
  value: number
  category: Category
  percentile: number | null
  lowerIsBetter: boolean
  /** Recommandation à suivre (uniquement utile pour les priorités). */
  advice: string
  /** Cible du niveau suivant, ou `null` si déjà au sommet / hors norme. */
  next: { targetValue: number; delta: number; nextCategory: Category } | null
}

export interface ActionPlan {
  /** Jusqu'à 3 mesures « Très bien » ou « Excellent », les meilleures d'abord. */
  forces: PlanItem[]
  /** Jusqu'à 3 mesures « À améliorer » ou « Acceptable », les plus faibles d'abord. */
  priorities: PlanItem[]
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function buildActionPlan(data: BilanData, profile: BilanProfile): ActionPlan {
  const { age, sex, norms } = profile
  if (age === null || sex === null) return { forces: [], priorities: [] }

  const ranked: PlanItem[] = []
  for (const metric of PLAN_METRICS) {
    const value = num(data[metric.key])
    const testKey = BILAN_TO_TEST_KEY[metric.key]
    if (value === null || !testKey) continue
    const category = getCategorization(testKey, value, age, sex, norms)
    if (!category) continue

    const next = getNextCategoryTarget(testKey, value, age, sex, norms)
    ranked.push({
      metric,
      value,
      category,
      percentile: getPercentile(testKey, value, age, sex, norms),
      lowerIsBetter: getNormPercentiles(testKey, age, sex, norms)?.lowerIsBetter ?? false,
      advice: RECO[metric.key] ?? 'Discutez d’un plan ciblé avec votre kinésiologue.',
      next: next && !next.isAtTop ? { targetValue: next.targetValue, delta: next.delta, nextCategory: next.nextCategory } : null
    })
  }

  return {
    forces: ranked
      .filter(r => r.category === 'EXCELLENT' || r.category === 'TRES_BIEN')
      .sort((a, b) => SCORE_OF[b.category] - SCORE_OF[a.category])
      .slice(0, 3),
    priorities: ranked
      .filter(r => r.category === 'A_AMELIORER' || r.category === 'ACCEPTABLE')
      .sort((a, b) => SCORE_OF[a.category] - SCORE_OF[b.category])
      .slice(0, 3)
  }
}

/** « Objectif : ≥ 42 ml/kg/min pour atteindre Très bien (+4 ml/kg/min) » */
export function formatNextTarget(item: PlanItem): string | null {
  if (!item.next) return null
  const n = (v: number): string => v.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
  const sign = item.next.delta >= 0 ? '+' : ''
  return `${item.lowerIsBetter ? '≤' : '≥'} ${n(item.next.targetValue)} ${item.metric.unit} pour atteindre « ${CATEGORY_LABELS[item.next.nextCategory]} » (${sign}${n(item.next.delta)} ${item.metric.unit})`
}
