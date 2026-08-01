/**
 * Sections du rapport que Marie-Eve peut montrer ou masquer, par client.
 *
 * Le PDF et le document HTML n'ont pas la même structure — l'un est paginé en
 * sections numérotées, l'autre déroule des blocs éditoriaux. Ce module définit
 * les **thèmes communs** aux deux, pour qu'un œil fermé produise le même
 * résultat des deux côtés (décision de Nicholas : un seul réglage pour les deux
 * documents).
 *
 * ── Pourquoi stocker ce qui est MASQUÉ ──────────────────────────────────────
 * On enregistre la liste des sections cachées, pas celle des visibles. Ainsi une
 * section ajoutée plus tard apparaît par défaut chez tous les clients existants,
 * au lieu de rester invisible parce qu'elle ne figurait pas dans une liste
 * écrite avant sa création. Un dossier sans réglage = tout est montré.
 *
 * Module PUR : aucune dépendance Electron/DB, testable via `node --test`.
 */

export type ReportSectionKey =
  | 'composition'
  | 'compositionTrend'
  | 'risqueSante'
  | 'pourcentageGras'
  | 'mesures'
  | 'objectif'
  | 'progression'
  | 'cardio'
  | 'cardioTrend'
  | 'pressionArterielle'
  | 'zonesEntrainement'
  | 'forceMobilite'
  | 'nutrition'
  | 'planAction'
  | 'motKine'

export interface ReportSectionDef {
  key: ReportSectionKey
  /** Intitulé montré à Marie dans la liste des yeux. */
  label: string
  /** Ce que le client perd si la section est masquée. */
  hint: string
}

/** Les sections masquables, dans l'ordre où elles apparaissent au rapport. */
export const REPORT_SECTIONS: ReportSectionDef[] = [
  {
    key: 'composition',
    label: 'Composition corporelle',
    hint: 'Poids, IMC, tour de taille, % de gras et risque pour la santé.'
  },
  {
    key: 'compositionTrend',
    label: 'Évolution de la composition',
    hint: 'La courbe du score de composition dans le temps.'
  },
  {
    key: 'risqueSante',
    label: 'Risque pour la santé',
    hint: 'IMC et tour de taille lus ensemble (tableau 4.4 du guide).'
  },
  {
    key: 'pourcentageGras',
    label: 'Pourcentage de gras',
    hint: 'Le % de gras, sa grille et sa courbe.'
  },
  {
    key: 'mesures',
    label: 'Mesures détaillées',
    hint: 'Le relevé chiffré de toutes les mesures du bilan.'
  },
  {
    key: 'objectif',
    label: 'Objectif du client',
    hint: 'L’objectif chiffré et l’échéance estimée.'
  },
  {
    key: 'progression',
    label: 'Progression',
    hint: 'Les courbes d’évolution mesure par mesure.'
  },
  {
    key: 'cardio',
    label: 'Aptitude aérobie',
    hint: 'VO2max et son interprétation.'
  },
  {
    key: 'cardioTrend',
    label: 'Évolution du VO2max',
    hint: 'La courbe du VO2max dans le temps.'
  },
  {
    key: 'pressionArterielle',
    label: 'Pression artérielle',
    hint: 'Barres systolique et diastolique, et le relevé après l’effort.'
  },
  {
    key: 'zonesEntrainement',
    label: 'Zones d’entraînement',
    hint: 'Les fréquences cardiaques cibles calculées d’après la FC max.'
  },
  {
    key: 'forceMobilite',
    label: 'Force et mobilité',
    hint: 'Pompes, redressements, saut, flexion du tronc, endurance du dos.'
  },
  {
    key: 'nutrition',
    label: 'Nutrition et plan',
    hint: 'Objectif chiffré, macros, jeûne, aliments — si le module est activé.'
  },
  {
    key: 'planAction',
    // Nommé d'après ce qui existe RÉELLEMENT en clôture. Le « plan d'action »
    // avec priorités numérotées a été retiré en v0.9.82 : un œil qui ne masque
    // rien serait pire que pas d'œil du tout.
    label: 'Principes de clôture',
    hint: 'Les cinq principes de bien-être en fin de rapport.'
  },
  {
    key: 'motKine',
    label: 'Mot du kinésiologue',
    hint: 'Le texte personnel adressé au client en clôture.'
  }
]

const CLES = new Set<string>(REPORT_SECTIONS.map(s => s.key))

/**
 * Lit le réglage stocké au dossier du client.
 *
 * Tolérant : `null`, chaîne vide, JSON invalide ou clé inconnue donnent « rien
 * de masqué ». Un réglage illisible ne doit jamais faire disparaître une section
 * en silence — c'est l'inverse qui est sûr.
 */
export function parseHiddenSections(raw: string | null | undefined): Set<ReportSectionKey> {
  if (!raw || typeof raw !== 'string') return new Set()
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((k): k is ReportSectionKey => typeof k === 'string' && CLES.has(k)))
  } catch {
    return new Set()
  }
}

/** Sérialise pour la base. Retourne `null` quand rien n'est masqué. */
export function serializeHiddenSections(hidden: Iterable<ReportSectionKey>): string | null {
  // On garde l'ordre de `REPORT_SECTIONS` plutôt que celui des clics : deux
  // réglages identiques doivent produire la même chaîne, sinon un export/import
  // ou une comparaison de dossiers signale une différence qui n'existe pas.
  const set = new Set(hidden)
  const ordonne = REPORT_SECTIONS.filter(s => set.has(s.key)).map(s => s.key)
  return ordonne.length === 0 ? null : JSON.stringify(ordonne)
}

/** Cette section doit-elle être rendue ? */
export function isSectionVisible(key: ReportSectionKey, hidden: Set<ReportSectionKey>): boolean {
  return !hidden.has(key)
}

/**
 * Résumé pour l'interface : « 2 sections masquées », ou `null` si tout est
 * montré. Sert à signaler d'un coup d'œil qu'un rapport est allégé — sans quoi
 * Marie pourrait envoyer un document amputé sans s'en souvenir.
 */
export function hiddenSummary(hidden: Set<ReportSectionKey>): string | null {
  const n = hidden.size
  if (n === 0) return null
  return n === 1 ? '1 section masquée' : `${n} sections masquées`
}
