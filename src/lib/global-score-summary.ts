/**
 * Résumé du score « Santé et condition physique globale » — d'où vient la note
 * et ce qu'elle veut dire.
 *
 * Source unique du rapport PDF et du document HTML. Écrire ce texte deux fois
 * aurait produit deux textes divergents : c'est arrivé trois fois cette semaine
 * (libellés de barème v0.9.64-66, phrase de risque santé v0.9.68), à chaque
 * fois parce qu'une même formulation vivait dans plusieurs vues.
 *
 * Les chiffres viennent de `overallDetail`, calculé par `computeBilan` — jamais
 * d'un second calcul qui pourrait s'écarter de ce qu'affiche le dashboard.
 */

import type { BilanComputed } from './bilan-computed.ts'
import { CPAFLA_TEST_LABELS } from './norms/cpafla-combined.ts'
import type { Category } from './norms/types.ts'

/** Phrase d'ouverture selon la catégorie du score global. */
export const GLOBAL_BLURB: Record<Category, string> = {
  EXCELLENT:
    'Votre condition physique globale est excellente. Les bénéfices santé associés sont maximaux — l’objectif devient de maintenir ce niveau dans la durée.',
  TRES_BIEN:
    'Votre condition physique globale est très bonne. Vous êtes au-dessus de la moyenne pour votre âge et votre sexe, et proche du niveau optimal.',
  BIEN:
    'Votre condition physique globale est bonne. Les bases sont là ; c’est la composante la plus faible ci-dessous qui offre le meilleur retour sur effort.',
  ACCEPTABLE:
    'Votre condition physique globale est acceptable. Des gains santé nets sont accessibles, et ils viendront surtout des composantes les moins bien cotées.',
  A_AMELIORER:
    'Votre condition physique globale est à améliorer. C’est aussi la situation où chaque progrès compte le plus : les bénéfices santé sont les plus rapides à ce niveau.'
}

/** Libellé d'une composante. */
export function componentLabel(key: string): string {
  return CPAFLA_TEST_LABELS[key] ?? key
}

/**
 * Libellé en milieu de phrase. Minuscule sur la **première lettre seulement** :
 * un `toLowerCase()` complet transformait « Aptitude aérobie (METS max) » en
 * « aptitude aérobie (mets max) ».
 */
export function componentLabelInline(key: string): string {
  const l = componentLabel(key)
  return l.charAt(0).toLowerCase() + l.slice(1)
}

export interface GlobalComponent {
  key: string
  label: string
  cote: number
}

export interface GlobalScoreSummary {
  score: number
  category: Category | null
  /** Composantes réellement mesurées, dans l'ordre du calcul. */
  components: GlobalComponent[]
  /** Composantes absentes de ce bilan — exclues, jamais comptées zéro. */
  missing: { key: string; label: string }[]
  /** Meilleure et moins bonne composante. `null` si toutes sont à égalité :
   *  désigner un « point faible » n'aurait alors aucun sens. */
  strongest: GlobalComponent | null
  weakest: GlobalComponent | null
  /** « (4 + 3 + 2) ÷ 3 » — le calcul, en clair. */
  formula: string
}

/** `null` si le score n'est pas calculable (aucune composante mesurée). */
export function globalScoreSummary(computed: BilanComputed): GlobalScoreSummary | null {
  const { overall, overallDetail } = computed
  if (overall.score === null) return null

  const components: GlobalComponent[] = overallDetail.rows
    .filter(r => r.cote !== null)
    .map(r => ({ key: r.key, label: componentLabel(r.key), cote: r.cote as number }))
  if (components.length === 0) return null

  const missing = overallDetail.rows
    .filter(r => r.cote === null)
    .map(r => ({ key: r.key, label: componentLabel(r.key) }))

  const strongest = components.reduce((a, b) => (b.cote > a.cote ? b : a))
  const weakest = components.reduce((a, b) => (b.cote < a.cote ? b : a))
  const egalite = strongest.cote === weakest.cote

  return {
    score: overall.score,
    category: overall.category,
    components,
    missing,
    strongest: egalite ? null : strongest,
    weakest: egalite ? null : weakest,
    formula: `(${components.map(c => c.cote).join(' + ')}) ÷ ${components.length}`
  }
}
