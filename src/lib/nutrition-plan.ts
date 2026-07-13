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

/** Sérialise pour la colonne `nutritionMenu`. `null` si aucune journée remplie. */
export function serializeMenuPlan(jours: string[]): string | null {
  const clean = jours.map((j) => j.trim()).filter(Boolean)
  if (clean.length === 0) return null
  return JSON.stringify({ v: 2, kind: 'menu', jours: clean })
}
