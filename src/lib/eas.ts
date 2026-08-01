/**
 * ÉAS — « Évaluation de la participation à des activités physiques favorables à
 * la santé ».
 *
 * Figure 4-6 du *Guide du conseiller en condition physique et habitudes de vie*,
 * 3ᵉ édition (p. 4-5) — le même guide que celui dont proviennent les barèmes
 * musculo déjà encodés (voir `norms/cpafla.ts`).
 *
 * Trois questions, un total sur 11, cinq catégories de bénéfices-santé.
 *
 * ── La cotation dépend du sexe ──────────────────────────────────────────────
 * C'est la particularité de cet outil, et elle n'est pas anodine : la grille du
 * guide a deux colonnes, Homme et Femme, avec des points **différents** pour la
 * même réponse. « Moyenne » à la perception vaut 3 chez l'homme et 1 chez la
 * femme ; « au moins trois fois » vaut 3 chez l'homme et 5 chez la femme.
 *
 * Ces écarts ne sont pas une erreur de transcription : les deux colonnes
 * plafonnent bien au même total (3+3+5 = 11 et 5+3+3 = 11), ce qui concorde avec
 * la catégorie « Excellent : 9 – 11 ». Un test le vérifie.
 *
 * Conséquence pratique : **sans sexe au dossier, pas de score**. On préfère
 * l'annoncer plutôt que de coter au hasard une valeur qui serait fausse une fois
 * sur deux.
 *
 * Module PUR : aucune dépendance Electron/DB, testable via `node --test`.
 */

/** Points d'une réponse, selon le sexe. */
export interface EasPoints {
  M: number
  F: number
}

export interface EasChoice {
  /** Libellé tel qu'imprimé dans le questionnaire (Figure 4-6, haut de page). */
  label: string
  /** Points accordés, par sexe — grille du bas de la figure. */
  points: EasPoints
}

export interface EasQuestion {
  /** Clé stable — sert de nom de champ, ne jamais la renommer. */
  key: 'frequence' | 'intensite' | 'perception'
  /** Numéro imprimé (#1, #2, #3). */
  numero: number
  /** Intitulé court, tel qu'imprimé. */
  titre: string
  /** La question posée au client. */
  question: string
  /**
   * Réponses dans l'ordre **imprimé sur la feuille** — la meilleure en premier.
   * On garde cet ordre plutôt que de l'inverser pour coller au FANTASTIC : le
   * client et Marie doivent retrouver la feuille qu'ils connaissent.
   */
  choices: EasChoice[]
}

export const EAS_QUESTIONS: EasQuestion[] = [
  {
    key: 'frequence',
    numero: 1,
    titre: 'Fréquence',
    question:
      'Sur une période représentative d’une semaine (sept jours), combien de fois pratiquez-vous une activité physique vigoureuse et prolongée caractérisée par la sudation et un pouls rapide ?',
    choices: [
      { label: 'Au moins trois fois', points: { M: 3, F: 5 } },
      { label: 'Normalement une ou deux fois', points: { M: 2, F: 3 } },
      { label: 'Rarement ou jamais', points: { M: 0, F: 0 } }
    ]
  },
  {
    key: 'intensite',
    numero: 2,
    titre: 'Intensité',
    question: 'Quand vous pratiquez une activité physique, avez-vous l’impression que vous faites :',
    choices: [
      { label: 'un effort intense', points: { M: 3, F: 3 } },
      { label: 'un effort moyen', points: { M: 1, F: 2 } },
      { label: 'un effort léger', points: { M: 0, F: 0 } }
    ]
  },
  {
    key: 'perception',
    numero: 3,
    titre: 'Perception de la condition physique',
    question: 'De façon générale, diriez-vous que votre condition physique actuelle est :',
    // Cinq réponses au questionnaire, mais la grille de cotation ne distingue
    // que trois paliers : « bonne ou très bonne », « moyenne », « très faible ou
    // faible ». D'où les points identiques deux à deux aux extrémités.
    choices: [
      { label: 'Très bonne', points: { M: 5, F: 3 } },
      { label: 'Bonne', points: { M: 5, F: 3 } },
      { label: 'Moyenne', points: { M: 3, F: 1 } },
      { label: 'Faible', points: { M: 0, F: 0 } },
      { label: 'Très faible', points: { M: 0, F: 0 } }
    ]
  }
]

/** Total maximal — identique pour les deux sexes (vérifié par les tests). */
export const EAS_MAX = 11

/** Réponses : index du choix retenu, ou `null` si la question est sans réponse. */
export interface EasAnswers {
  frequence: number | null
  intensite: number | null
  perception: number | null
}

export const EAS_KEYS: EasAnswers extends Record<infer K, unknown> ? K[] : never = [
  'frequence',
  'intensite',
  'perception'
]

export function emptyEas(): EasAnswers {
  return { frequence: null, intensite: null, perception: null }
}

/** Les cinq catégories de bénéfices-santé, de la meilleure à la moins bonne. */
export const EAS_CATEGORIES = [
  { min: 9, label: 'Excellent' },
  { min: 6, label: 'Très bien' },
  { min: 4, label: 'Bien' },
  { min: 1, label: 'Acceptable' },
  { min: 0, label: 'À améliorer' }
] as const

export type EasCategory = (typeof EAS_CATEGORIES)[number]['label']

export interface EasScore {
  /** Points obtenus. `null` si le sexe est inconnu ou si rien n'est répondu. */
  points: number | null
  /** Catégorie de bénéfices-santé, ou `null` si pas de score. */
  category: EasCategory | null
  /** Nombre de questions répondues (0 à 3). */
  answered: number
  /** `true` si les trois questions ont une réponse. */
  complete: boolean
  /**
   * `true` quand le score n'a pas pu être calculé **faute de sexe au dossier**.
   * Permet à l'interface de dire pourquoi plutôt que d'afficher un vide.
   */
  sexeManquant: boolean
}

/**
 * Score de l'ÉAS.
 *
 * Contrairement au FANTASTIC, le total n'est **pas** ramené au prorata des
 * questions répondues : le barème du guide (9-11, 6-8, …) porte sur un total
 * absolu sur 11. Un questionnaire incomplet donne donc un score partiel, et
 * `complete` dit à l'appelant s'il peut s'y fier.
 */
export function easScore(answers: EasAnswers, sex: 'F' | 'M' | null | undefined): EasScore {
  let answered = 0
  let points = 0

  for (const q of EAS_QUESTIONS) {
    const idx = answers[q.key]
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= q.choices.length) continue
    answered++
    if (sex === 'F' || sex === 'M') points += q.choices[idx].points[sex]
  }

  if (sex !== 'F' && sex !== 'M') {
    return { points: null, category: null, answered, complete: answered === 3, sexeManquant: answered > 0 }
  }
  if (answered === 0) {
    return { points: null, category: null, answered: 0, complete: false, sexeManquant: false }
  }

  return {
    points,
    category: (EAS_CATEGORIES.find(c => points >= c.min) ?? EAS_CATEGORIES[EAS_CATEGORIES.length - 1]).label,
    answered,
    complete: answered === 3,
    sexeManquant: false
  }
}

/** Catégorie correspondant à un total sur 11. `null` si le score est absent. */
export function easCategory(points: number | null): EasCategory | null {
  if (points === null || !Number.isFinite(points)) return null
  return (EAS_CATEGORIES.find(c => points >= c.min) ?? EAS_CATEGORIES[EAS_CATEGORIES.length - 1]).label
}

/**
 * Normalise des réponses venues de la base.
 *
 * Tout index hors des choix offerts est ramené à `null` : mieux vaut une
 * question sans réponse qu'un score calculé sur une valeur inventée.
 */
export function asEasAnswers(raw: unknown): EasAnswers {
  const out = emptyEas()
  if (!raw || typeof raw !== 'object') return out
  const src = raw as Record<string, unknown>
  for (const q of EAS_QUESTIONS) {
    const v = src[q.key]
    out[q.key] =
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < q.choices.length ? v : null
  }
  return out
}

/** Aucune question répondue. */
export function easIsBlank(answers: EasAnswers): boolean {
  return EAS_QUESTIONS.every(q => answers[q.key] === null)
}
