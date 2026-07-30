/** Détecte les « victoires » d'un client à afficher/célébrer sur le Dashboard :
 *  montée de catégorie d'un composite, score global en hausse, record personnel
 *  sur une métrique, ou objectif de composition atteint. Pur (sans JSX). */

import { SHOW_BACK_HEALTH } from './bilan-computed.ts'
import type { BilanComputed, CompositeScore } from './bilan-computed'
import { CATEGORY_LABELS, type Category } from './norms/types.ts'

const RANK: Record<Category, number> = {
  A_AMELIORER: 1,
  ACCEPTABLE: 2,
  BIEN: 3,
  TRES_BIEN: 4,
  EXCELLENT: 5
}

export interface Win {
  icon: string
  text: string
}

interface RecordDef {
  key: keyof BilanData
  label: string
  unit?: string
  lowerBetter?: boolean
}

const RECORD_METRICS: RecordDef[] = [
  { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min' },
  { key: 'pushups', label: 'Pompes', unit: 'reps' },
  { key: 'situps', label: 'Redressements', unit: 'reps' },
  { key: 'saut_vertical_cm', label: 'Saut vertical', unit: 'cm' },
  { key: 'pourcentage_gras', label: '% de gras', unit: '%', lowerBetter: true },
  { key: 'imc', label: 'IMC', lowerBetter: true },
  { key: 'tour_taille_cm', label: 'Tour de taille', unit: 'cm', lowerBetter: true }
]

const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null)

export function detectWins(opts: {
  computed: BilanComputed
  previous?: BilanComputed
  bilans: Bilan[]
  currentData: BilanData
  objectifAtGoal?: boolean
}): Win[] {
  const { computed, previous, bilans, currentData, objectifAtGoal } = opts
  const wins: Win[] = []

  if (objectifAtGoal) wins.push({ icon: '🎯', text: 'Objectif de composition atteint — bravo !' })

  if (previous) {
    const pairs: { label: string; cur: CompositeScore; prev: CompositeScore }[] = [
      { label: 'Composition', cur: computed.composition, prev: previous.composition },
      { label: 'Cœur & endurance', cur: computed.aerobic, prev: previous.aerobic },
      { label: 'Force musculaire', cur: computed.musculoGlobal, prev: previous.musculoGlobal },
      ...(SHOW_BACK_HEALTH
        ? [{ label: 'Dos & souplesse', cur: computed.backHealth, prev: previous.backHealth }]
        : [])
    ]
    for (const p of pairs) {
      if (p.cur.category && p.prev.category && RANK[p.cur.category] > RANK[p.prev.category]) {
        wins.push({ icon: '🔼', text: `${p.label} : ${CATEGORY_LABELS[p.prev.category]} → ${CATEGORY_LABELS[p.cur.category]}` })
      }
    }
    if (
      computed.overall.score !== null &&
      previous.overall.score !== null &&
      computed.overall.score - previous.overall.score >= 0.1
    ) {
      wins.push({ icon: '📈', text: `Score global : +${(computed.overall.score - previous.overall.score).toFixed(1)}` })
    }
  }

  // Records personnels : la valeur courante est le meilleur de l'historique, de
  // façon stricte (bat le 2e meilleur) — il faut au moins 2 mesures du champ.
  for (const m of RECORD_METRICS) {
    const cur = num(currentData[m.key])
    if (cur === null) continue
    const vals = bilans.map(b => num(b.data[m.key])).filter((v): v is number => v !== null)
    if (vals.length < 2) continue
    const sorted = [...vals].sort((a, b) => (m.lowerBetter ? a - b : b - a))
    const best = sorted[0]
    const second = sorted[1]
    const isBest = m.lowerBetter ? cur <= best : cur >= best
    const strict = m.lowerBetter ? best < second : best > second
    if (isBest && strict) {
      wins.push({
        icon: '🏆',
        text: `Record personnel — ${m.label} ${cur.toLocaleString('fr-CA', { maximumFractionDigits: 1 })}${m.unit ? ` ${m.unit}` : ''}`
      })
    }
  }

  return wins.slice(0, 5)
}

/**
 * Message affiché **à la place** des victoires quand il n'y en a aucune.
 *
 * Décision de Nicholas : ne jamais laisser un client devant un constat de recul.
 * `detectWins` ne produit déjà que du positif ; il restait le cas où la liste est
 * vide. Plutôt qu'un blanc (première version) ou qu'un « aucun progrès » (qui
 * serait exactement le découragement qu'on veut éviter), on tourne la page vers
 * la suite.
 *
 * Deux situations bien distinctes, et les confondre sonnerait faux :
 *  · Aucun bilan précédent → il n'y a rien à comparer, ce n'est pas un échec.
 *  · Un précédent existe, mais rien ne s'est amélioré → on ne le nomme pas. Le
 *    reste du document montre déjà les chiffres ; les répéter ici en négatif
 *    n'apporterait rien au client.
 */
export interface NoWinsMessage {
  title: string
  text: string
}

export function noWinsMessage(hasPrevious: boolean): NoWinsMessage {
  if (!hasPrevious) {
    return {
      title: 'Votre point de départ',
      text: 'Ce premier bilan sert de repère. C’est à partir de lui que se mesureront vos progrès — rendez-vous au prochain pour voir le chemin parcouru.'
    }
  }
  return {
    title: 'La suite se joue maintenant',
    text: 'Ce bilan sert de base pour la période qui vient. Chaque séance compte, et les prochains résultats se construisent à partir d’aujourd’hui — votre kinésiologue vous accompagne pour cibler les prochains gains.'
  }
}
