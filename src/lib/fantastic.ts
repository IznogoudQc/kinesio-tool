/**
 * Questionnaire FANTASTIC — « participation à des activités physiques favorables
 * à la santé ».
 *
 * Instrument validé (Université McMaster, largement utilisé en kinésiologie au
 * Québec). Son nom vient de l'initiale de ses sections :
 *
 *   **F**amille et amis · **A**ctivité physique · **N**utrition · **T**abac et
 *   drogues · **A**lcool · **S**ommeil-sécurité-stress · **T**ype de
 *   comportement · **I**ntrospection (émotions) · **C**arrière
 *
 * ── Cotation ────────────────────────────────────────────────────────────────
 * Les cinq colonnes vont TOUJOURS du moins favorable (gauche, 0 point) au plus
 * favorable (droite, 4 points). C'est ce qui permet une cotation uniforme malgré
 * des énoncés formulés dans les deux sens : « Je suis positif(ve) » se lit
 * « Presque jamais → Presque toujours », tandis que « Je me sens pressé(e) » se
 * lit « presque toujours → presque jamais ». Dans les deux cas la colonne la
 * plus à droite vaut 4.
 *
 * 25 énoncés × 4 points = **100**.
 *
 * Module PUR : aucune dépendance Electron/DB, testable via `node --test`.
 */

export interface FantasticItem {
  /** Clé stable — sert de nom de champ, ne jamais la renuméroter. */
  key: string
  /** L'énoncé, tel qu'imprimé sur la feuille de Marie-Eve. */
  label: string
  /** Les cinq réponses, de 0 (gauche) à 4 (droite) points. */
  choices: [string, string, string, string, string]
}

export interface FantasticSection {
  key: string
  /** Titre de la section, tel qu'imprimé (parfois sur plusieurs lignes). */
  title: string
  items: FantasticItem[]
}

/** Échelle de fréquence la plus courante — du moins au plus favorable. */
const FREQ: [string, string, string, string, string] = [
  'Presque jamais',
  'Rarement',
  'À l’occasion',
  'Assez souvent',
  'Presque toujours'
]

/** La même, pour un énoncé formulé négativement (« Je me sens pressé(e) »). */
const FREQ_INVERSE: [string, string, string, string, string] = [
  'Presque toujours',
  'Assez souvent',
  'Parfois',
  'Rarement',
  'Presque jamais'
]

/** Fréquence hebdomadaire d'activité. */
const FREQ_SEMAINE: [string, string, string, string, string] = [
  'Moins d’une fois par semaine',
  '1-2 fois',
  '3×',
  '4×',
  '5× ou plus'
]

export const FANTASTIC_SECTIONS: FantasticSection[] = [
  {
    key: 'famille',
    title: 'Famille et amis',
    items: [
      { key: 'confident', label: 'J’ai quelqu’un à qui parler de chose importante pour moi', choices: FREQ },
      { key: 'affection', label: 'Je donne et je reçois de l’affection', choices: FREQ }
    ]
  },
  {
    key: 'activite',
    title: 'Activité physiques',
    items: [
      {
        key: 'intense',
        label: 'Je pratique un activité physique intense au moins 30 min. par jour (course, cyclisme, ect.)',
        choices: FREQ_SEMAINE
      },
      {
        key: 'modere',
        label: 'Je suis modérément actif(ve) (travaux ménager, montée d’escalier, jardinages, travaux ménager)',
        choices: FREQ_SEMAINE
      }
    ]
  },
  {
    key: 'alimentation',
    title: 'Alimentation',
    items: [
      { key: 'equilibre', label: 'J’ai une alimentation équilibré', choices: FREQ },
      {
        key: 'exces',
        label: 'Je mange trop de : 1) Sucre 2) Sel 3) Graisse animal 4) Aliments peu nutritif',
        choices: ['Les 4', '3', '2', '1', 'Aucun']
      },
      {
        key: 'poids',
        label: 'D’après moi, je suis à moins de ___ lbs de mon poids santé',
        choices: ['Plus de 20 lbs', '20 lbs', '15 lbs', '10 lbs', '5 lbs et moins']
      }
    ]
  },
  {
    key: 'tabac',
    title: 'Tabac et drogues',
    items: [
      {
        key: 'tabac',
        label: 'Je fume du tabac et/ou de la marijuana',
        choices: [
          'Plus de 10× / semaine',
          '1 à 10×',
          'À l’occasion',
          'Aucune fois depuis un an',
          'Aucune fois depuis 5 ans — jamais'
        ]
      },
      {
        key: 'drogues',
        // Seules les colonnes extrêmes sont imprimées sur la feuille : les trois
        // du milieu sont vides. On les garde vides plutôt que d'inventer des
        // libellés — le client coche une case, pas un mot.
        label: 'Je consomme des drogues sans ordonnance',
        choices: ['Parfois', '', '', '', 'Jamais']
      },
      {
        key: 'medicaments',
        label: 'J’abuse des médicaments (par ordonnance ou vente libre)',
        choices: ['Presque quotidiennement', 'Assez souvent', 'À l’occasion', 'Presque jamais', 'Jamais']
      },
      {
        key: 'cafeine',
        label: 'Je consomme des boissons contenant de la caféine (café, thé, cola, boisson d’énergie)',
        choices: ['Plus de 10/jour', '7-10', '3-6', '1-2', 'Jamais']
      }
    ]
  },
  {
    key: 'alcool',
    title: 'Alcool',
    items: [
      {
        key: 'semaine',
        label: 'Je prends en moyenne ___ consommation d’alcool par semaine',
        choices: ['Plus de 20', '13-20', '11-12', '8-10', '0-7']
      },
      {
        key: 'binge',
        label: 'Je prends plus de 4 consommation en un seule occasion',
        choices: ['Presque quotidiennement', 'Assez souvent', 'À l’occasion', 'Presque jamais', 'Jamais']
      },
      { key: 'conduite', label: 'Je conduis après avoir bu', choices: ['Parfois', '', '', '', 'Jamais'] }
    ]
  },
  {
    key: 'sommeil',
    title: 'Sommeil, ceinture de sécurité, stress, pratiques sexuelles',
    items: [
      { key: 'sommeil', label: 'Je dort et me sens reposé(e)', choices: FREQ },
      { key: 'ceinture', label: 'J’attache ma ceinture de sécurité', choices: FREQ },
      { key: 'stress', label: 'Je suis capable de gérer le stress de ma vie', choices: FREQ },
      { key: 'detente', label: 'Je me détends et profite de mes temps libres', choices: FREQ },
      { key: 'sexualite', label: 'J’ai des pratiques sexuelles sécuritaires', choices: FREQ }
    ]
  },
  {
    key: 'comportement',
    title: 'Comportement',
    items: [
      { key: 'presse', label: 'Je me sens pressé(e)', choices: FREQ_INVERSE },
      { key: 'fache', label: 'Je me sens fâché(e) ou agressif(ve)', choices: FREQ_INVERSE }
    ]
  },
  {
    key: 'emotions',
    title: 'Émotions',
    items: [
      { key: 'optimiste', label: 'Je suis positif(ve) et optimiste', choices: FREQ },
      { key: 'tendu', label: 'Je me sens tendu(e) ou nerveux(se)', choices: FREQ_INVERSE },
      { key: 'triste', label: 'Je me sens triste ou déprimé(e)', choices: FREQ_INVERSE }
    ]
  },
  {
    key: 'travail',
    title: 'Vie professionnelle',
    items: [{ key: 'satisfaction', label: 'Je suis satisfait(e) dans mon travail', choices: FREQ }]
  }
]

/** Tous les énoncés, à plat, dans l'ordre de la feuille. */
export const FANTASTIC_ITEMS: FantasticItem[] = FANTASTIC_SECTIONS.flatMap(s => s.items)

/** 25 énoncés × 4 points. */
export const FANTASTIC_MAX = FANTASTIC_ITEMS.length * 4

/**
 * Réponses : une entrée par énoncé, `null` tant que le client n'a pas répondu.
 * Indexées par `"<section>.<item>"` pour rester stables si l'ordre change.
 */
export type FantasticAnswers = Record<string, number | null>

/** Clé stable d'un énoncé (`'alcool.binge'`). */
export function itemKey(section: FantasticSection, item: FantasticItem): string {
  return `${section.key}.${item.key}`
}

/**
 * Les réponses réellement offertes pour un énoncé.
 *
 * Deux énoncés — « Je consomme des drogues sans ordonnance » et « Je conduis
 * après avoir bu » — n'ont que **deux** réponses sur la feuille de Marie-Eve :
 * *Parfois* et *Jamais*. Les trois cases du milieu y sont vides ; elles servent
 * uniquement à aligner les colonnes avec les autres énoncés, ce ne sont pas des
 * choix. Les afficher comme cliquables proposait au client trois réponses qui
 * n'existent pas.
 *
 * On garde malgré tout les cinq emplacements dans `choices` : la position porte
 * la valeur (0 à gauche, 4 à droite), donc *Jamais* vaut bien 4 et l'énoncé
 * compte pour autant que les autres dans le total sur 100.
 */
export function selectableChoices(item: FantasticItem): { value: number; label: string }[] {
  return item.choices
    .map((label, value) => ({ value, label }))
    .filter(choix => choix.label.trim() !== '')
}

/** Toutes les clés, dans l'ordre de la feuille. */
export const FANTASTIC_KEYS: string[] = FANTASTIC_SECTIONS.flatMap(s => s.items.map(i => itemKey(s, i)))

export function emptyFantastic(): FantasticAnswers {
  const out: FantasticAnswers = {}
  for (const k of FANTASTIC_KEYS) out[k] = null
  return out
}

export interface FantasticScore {
  /** Points obtenus sur les énoncés RÉPONDUS. */
  points: number
  /** Maximum possible sur ces mêmes énoncés. */
  max: number
  /** Nombre d'énoncés répondus. */
  answered: number
  /** Score ramené sur 100, ou `null` si rien n'est répondu. */
  sur100: number | null
  /** `true` si les 25 énoncés ont une réponse. */
  complete: boolean
}

/**
 * Score du questionnaire.
 *
 * Ramené sur 100 **au prorata des énoncés répondus** plutôt que de compter un
 * blanc comme un zéro : un questionnaire à moitié rempli donnerait sinon un
 * score catastrophique qui n'aurait aucun sens clinique. `complete` dit à
 * l'appelant s'il peut se fier au total.
 */
export function fantasticScore(answers: FantasticAnswers): FantasticScore {
  let points = 0
  let answered = 0
  for (const k of FANTASTIC_KEYS) {
    const v = answers[k]
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 4) continue
    points += v
    answered++
  }
  const max = answered * 4
  return {
    points,
    max,
    answered,
    sur100: max === 0 ? null : Math.round((points / max) * 100),
    complete: answered === FANTASTIC_KEYS.length
  }
}

/** Les cinq paliers d'interprétation du FANTASTIC, du meilleur au moins bon. */
export const FANTASTIC_LEVELS = [
  { min: 85, label: 'Excellent' },
  { min: 70, label: 'Très bien' },
  { min: 55, label: 'Bien' },
  { min: 35, label: 'Passable' },
  { min: 0, label: 'À améliorer' }
] as const

export type FantasticLevel = (typeof FANTASTIC_LEVELS)[number]['label']

/** Palier correspondant à un score sur 100. `null` si le score est absent. */
export function fantasticLevel(sur100: number | null): FantasticLevel | null {
  if (sur100 === null || !Number.isFinite(sur100)) return null
  return (FANTASTIC_LEVELS.find(l => sur100 >= l.min) ?? FANTASTIC_LEVELS[FANTASTIC_LEVELS.length - 1]).label
}

/* ── Ce qui est stocké en base ──────────────────────────────────────────── */

/** Comment les réponses sont arrivées dans le dossier. */
export type FantasticSource = 'kine' | 'client'

export interface FantasticData {
  answers: FantasticAnswers
  notes?: string
  /**
   * `'client'` quand les réponses viennent d'un formulaire renvoyé par le
   * client, `'kine'` quand Marie les a saisies elle-même. Marie doit pouvoir
   * distinguer ce que le client a déclaré de ce qu'elle a transcrit.
   */
  source?: FantasticSource
  /** Date d'import du formulaire renvoyé (ISO). Absent si saisie directe. */
  receivedAt?: string
}

export function emptyFantasticData(): FantasticData {
  return { answers: emptyFantastic() }
}

/**
 * Normalise ce qui sort de la base en `FantasticData` utilisable.
 *
 * Accepte un objet **ou** une chaîne JSON : selon le chemin emprunté, l'IPC a
 * déjà désérialisé `data` ou non. En v0.9.86 un `JSON.parse` sur une valeur déjà
 * désérialisée produisait « "[object Object]" is not valid JSON » et le PDF du
 * Q-AAP sortait vide. On tolère les deux formes plutôt que de parier sur l'une.
 *
 * Toute réponse hors de l'échelle 0-4 est ramenée à `null` : mieux vaut un
 * énoncé sans réponse qu'un score calculé sur une valeur inventée.
 */
export function asFantasticData(raw: unknown): FantasticData {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return emptyFantasticData()
    }
  }
  if (!obj || typeof obj !== 'object') return emptyFantasticData()
  const src = obj as Partial<FantasticData>

  const answers = emptyFantastic()
  const given = src.answers
  if (given && typeof given === 'object') {
    for (const k of FANTASTIC_KEYS) {
      const v = (given as Record<string, unknown>)[k]
      answers[k] = typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4 ? v : null
    }
  }

  return {
    answers,
    notes: typeof src.notes === 'string' ? src.notes : undefined,
    source: src.source === 'client' || src.source === 'kine' ? src.source : undefined,
    receivedAt: typeof src.receivedAt === 'string' ? src.receivedAt : undefined
  }
}

/** Aucun énoncé répondu et aucune note — rien à enregistrer. */
export function fantasticIsBlank(data: FantasticData): boolean {
  return fantasticScore(data.answers).answered === 0 && !data.notes?.trim()
}
