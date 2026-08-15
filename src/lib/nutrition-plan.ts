/**
 * Modèle structuré des plans nutrition remplis par l'IA (suppléments par moment
 * de prise, menu par journée). Objectif : ne plus stocker un gros bloc de texte
 * Markdown, mais des CHAMPS séparés — faciles à afficher proprement et à paginer
 * dans le PDF. Voir NutritionTab (saisie) et EditorialReport (rendu du document).
 *
 * Stockage : sérialisé en JSON dans les colonnes existantes `supplementsNotes`
 * et `nutritionMenu` (aucune migration). Rétro-compatible : un ancien contenu en
 * texte libre est détecté et conservé (`parseSuppPlan` le remet dans `input`,
 * `parseMenuPlan` renvoie `null` → l'appelant garde l'ancien rendu).
 */

export type SuppMomentKey = 'reveil' | 'dejeuner' | 'apresEntrainement' | 'souper' | 'coucher'

/** Les 5 moments fixes (ordre d'affichage) + leur libellé. */
export const SUPP_MOMENTS: { key: SuppMomentKey; label: string }[] = [
  { key: 'reveil', label: 'Au réveil / à jeun' },
  { key: 'dejeuner', label: 'Déjeuner' },
  { key: 'apresEntrainement', label: "Après l'entraînement" },
  { key: 'souper', label: 'Souper' },
  { key: 'coucher', label: 'Au coucher' }
]

/** Mention légale finale, ajoutée automatiquement (jamais stockée ni éditée). */
export const SUPP_MENTION =
  'Horaire indicatif — validez les doses et les interactions avec votre pharmacien ou professionnel de la santé, surtout en cas de médication.'
export const MENU_MENTION =
  "Idées générales à titre d'exemple — pour un plan personnalisé, consultez une nutritionniste."

/** Un plan de suppléments : la liste brute saisie (`input`) + le contenu de
 *  chaque moment + les consignes d'espacement. Tous des textes multi-lignes. */
export interface SuppPlan {
  input: string
  reveil: string
  dejeuner: string
  apresEntrainement: string
  souper: string
  coucher: string
  interactions: string
}

export const EMPTY_SUPP_PLAN: SuppPlan = {
  input: '',
  reveil: '',
  dejeuner: '',
  apresEntrainement: '',
  souper: '',
  coucher: '',
  interactions: ''
}

/**
 * Suppléments qui APPORTENT DES PROTÉINES, et eux seuls.
 *
 * Ce sont les seuls à avoir leur place dans une idée de menu : une whey se boit
 * avec le déjeuner et compte dans la cible de protéines. Une vitamine D, un
 * oméga-3 ou un magnésium n'ont rien à faire dans la description d'un repas —
 * ils ont leur propre section, avec leurs consignes d'espacement.
 *
 * Heuristique par mots-clés, volontairement étroite : mieux vaut oublier une
 * protéine exotique que de faire apparaître « (+ magnésium) » dans un souper.
 */
const MOTS_PROTEINE = /prot[ée]ine|whey|cas[ée]ine|isolat|hydrolysat|petit-lait|prot[ée]in/i

/** Vrai si cette ligne de supplément apporte des protéines. */
export function estSupplementProteine(ligne: string): boolean {
  return MOTS_PROTEINE.test(ligne)
}

/**
 * Le plan de suppléments réduit aux protéines, par moment de prise — ou
 * `undefined` s'il n'y en a aucune.
 *
 * Chaque moment peut contenir plusieurs suppléments, un par ligne : le filtre
 * s'applique ligne à ligne, pas au bloc entier. Sinon un moment contenant
 * « Protéine (whey) » ET « Créatine » aurait tout emporté.
 */
export function supplementsProteines(plan: SuppPlan): string | undefined {
  const out: string[] = []
  for (const m of SUPP_MOMENTS) {
    const items = plan[m.key]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && estSupplementProteine(l))
    if (items.length) out.push(`${m.label} : ${items.join(' ; ')}`)
  }
  return out.length ? out.join('\n') : undefined
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function tryParseObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim()
  if (!t.startsWith('{')) return null
  try {
    const o = JSON.parse(t)
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Lit le contenu de `supplementsNotes`. JSON structuré (`v:2`) → champs séparés ;
 *  sinon texte libre historique → placé dans `input` (Marie pourra régénérer). */
export function parseSuppPlan(raw: string | null | undefined): SuppPlan {
  if (!raw || !raw.trim()) return { ...EMPTY_SUPP_PLAN }
  const o = tryParseObject(raw)
  if (o && o.v === 2 && o.kind === 'supp') {
    return {
      input: str(o.input),
      reveil: str(o.reveil),
      dejeuner: str(o.dejeuner),
      apresEntrainement: str(o.apresEntrainement),
      souper: str(o.souper),
      coucher: str(o.coucher),
      interactions: str(o.interactions)
    }
  }
  return { ...EMPTY_SUPP_PLAN, input: raw }
}

/** `true` si au moins un moment ou les interactions sont remplis (horaire prêt). */
export function suppPlanHasSchedule(p: SuppPlan): boolean {
  return (
    !!p.reveil.trim() ||
    !!p.dejeuner.trim() ||
    !!p.apresEntrainement.trim() ||
    !!p.souper.trim() ||
    !!p.coucher.trim() ||
    !!p.interactions.trim()
  )
}

/** Sérialise pour la colonne `supplementsNotes`. `null` si tout est vide. */
export function serializeSuppPlan(p: SuppPlan): string | null {
  const trimmed: SuppPlan = {
    input: p.input.trim(),
    reveil: p.reveil.trim(),
    dejeuner: p.dejeuner.trim(),
    apresEntrainement: p.apresEntrainement.trim(),
    souper: p.souper.trim(),
    coucher: p.coucher.trim(),
    interactions: p.interactions.trim()
  }
  if (!trimmed.input && !suppPlanHasSchedule(trimmed)) return null
  return JSON.stringify({ v: 2, kind: 'supp', ...trimmed })
}

export interface MenuPlan {
  /** Contenu de chaque journée (texte multi-lignes : repas + total). Max 2. */
  jours: string[]
}

/** Lit `nutritionMenu`. JSON structuré (`v:2`) → journées séparées ; sinon
 *  `null` (l'appelant conserve l'ancien rendu texte libre). */
export function parseMenuPlan(raw: string | null | undefined): MenuPlan | null {
  if (!raw || !raw.trim()) return null
  const o = tryParseObject(raw)
  if (o && o.v === 2 && o.kind === 'menu' && Array.isArray(o.jours)) {
    return { jours: (o.jours as unknown[]).map(str) }
  }
  return null
}

/**
 * Sérialise pour la colonne `nutritionMenu`. `null` si aucune journée remplie.
 *
 * Les journées vides sont CONSERVÉES à leur place, seules celles de la fin
 * étant coupées. Leur position porte une information depuis que les journées 6
 * et 7 sont la fin de semaine : les retirer décalait les suivantes, et une
 * journée de weekend se retrouvait annoncée comme une journée de semaine.
 */
export function serializeMenuPlan(jours: string[]): string | null {
  const propres = jours.map((j) => j.trim())
  const dernierRempli = propres.reduce((last, j, i) => (j ? i : last), -1)
  if (dernierRempli === -1) return null
  return JSON.stringify({ v: 2, kind: 'menu', jours: propres.slice(0, dernierRempli + 1) })
}
