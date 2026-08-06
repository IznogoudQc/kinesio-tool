/**
 * État de validation de chaque barème et de chaque formule.
 *
 * Source unique : le document PDF « Barèmes & formules » le lit pour cocher sa
 * checklist, et `docs/a-valider-avec-marie.md` raconte la même chose en prose.
 * Écrire l'état à deux endroits garantirait qu'ils divergent — c'est déjà
 * arrivé avec les barèmes eux-mêmes (v0.9.64 à 0.9.66).
 *
 * ⚠️ Ne jamais passer une entrée à `'confirme'` sans preuve : une capture de
 * l'ancien logiciel, une photo du guide, ou une réponse écrite de Marie. Un
 * statut optimiste est pire que pas de statut — il fait cesser les questions.
 *
 * Module autonome (aucun import) : il traverse la frontière Electron/renderer.
 */

export type ValidationStatut =
  /** Preuve à l'appui : capture de l'ancien logiciel, photo du guide, ou accord écrit. */
  | 'confirme'
  /** Source connue et citée, mais la transcription n'a jamais été recontrôlée. */
  | 'a_confirmer'
  /** Reconstitué par rétro-calcul ou choisi par défaut. Aucune source. */
  | 'deduit'

export interface ValidationEntree {
  /** Identifiant stable, utilisé comme clé de rendu. */
  id: string
  /** Ce dont on parle, tel que Marie le reconnaîtra. */
  label: string
  statut: ValidationStatut
  /** D'où vient la valeur. Phrase courte, sans jargon de code. */
  source: string
  /** Ce qui manque pour passer à `'confirme'`. `null` si déjà confirmé. */
  manque: string | null
  /** `true` si un écart fausserait une note remise au client (pas juste un libellé). */
  entreDansLeScore: boolean
}

export const VALIDATION_STATUS_LABELS: Record<ValidationStatut, string> = {
  confirme: 'Confirmé',
  a_confirmer: 'À confirmer',
  deduit: 'Déduit — sans source'
}

export const VALIDATION: ValidationEntree[] = [
  // ── Ce qui entre dans le score global ────────────────────────────────────
  {
    id: 'score-global-formule',
    label: 'Score global — structure du calcul',
    statut: 'confirme',
    source:
      'Fenêtre Propriétés de l’ancien logiciel : AverageRatings de 7 composantes, toutes ×1. Reproduit ses résultats sur tous les bilans vérifiés.',
    manque: null,
    entreDansLeScore: true
  },
  {
    id: 'pa-systolique-cote',
    label: 'Pression artérielle systolique — cote 0-4',
    statut: 'deduit',
    source:
      'Rétro-calcul sur 4 bilans seulement (112 → 4, 113 → 4, 122 → 0, 129 → 0). Règle appliquée : moins de 120 mmHg → 4, sinon 0.',
    manque:
      'La fenêtre Propriétés du test « Pression artérielle systolique », onglet des cotes. Vérifier que les bornes en mmHg sont lisibles et s’il y a une distinction homme/femme ou par âge.',
    entreDansLeScore: true
  },
  {
    id: 'composition-cpafla',
    label: 'Composition corporelle — figures 7-4 / 7-5 / 7-6',
    statut: 'a_confirmer',
    source:
      'Guide du conseiller, 3ᵉ éd. — figures 7-4 (hommes), 7-5 (femmes), 7-6 (catégories), formule p. 7-18. Les ENTRÉES sont confirmées par capture : CPAFLABodyComposition(tour de taille, IMC, somme des 5 plis). Et le calcul reproduit l’ancien logiciel sur les 6 bilans réels disponibles (IMC 29,6 à 38 · tour de taille 93 à 117 cm · les deux sexes).',
    manque:
      'Des photos des figures pour couvrir les plages jamais traversées par nos bilans : IMC sous 18,5 et au-dessus de 35. La colonne des 5 plis reste non testée — Marie ne mesure pas le mollet, donc la somme n’existe presque jamais.',
    entreDansLeScore: true
  },
  {
    id: 'aerobie-cpafla',
    label: 'Capacité aérobie (VO2max) — tableau 4.10',
    statut: 'confirme',
    source: 'Guide du conseiller, 3ᵉ éd., tableau 4.10. Attribution corrigée après vérification (ADR 0036).',
    manque: null,
    entreDansLeScore: true
  },
  {
    id: 'dos-musculo',
    label: 'Indice de santé du dos & aptitude musculosquelettique',
    statut: 'confirme',
    source:
      'Tables CPAFLA du guide CPHV. Reproduisent les résultats de l’ancien logiciel à l’identique (moyenne pondérée sans arrondi, taille cotée via fig. 7-4).',
    manque: null,
    entreDansLeScore: true
  },

  // ── Affichage seulement ──────────────────────────────────────────────────
  {
    id: 'vo2max-acsm',
    label: 'Table VO2max « ACSM »',
    statut: 'a_confirmer',
    source:
      'Hybride recalibré, pas la 11ᵉ édition exacte. Trois tables réalignées sur des valeurs publiées ; les autres issues d’une migration avec extrapolation P90 = 2·P75 − P50.',
    manque: 'Savoir quelle table Marie utilise réellement : ACSM, CPAFLA, ou celle de son logiciel.',
    entreDansLeScore: true
  },
  {
    id: 'pourcentage-gras-grille',
    label: '% de gras — grille de risque',
    statut: 'confirme',
    source: 'Grille de Marie, reprise de son ancien logiciel (palier « moins de 70 ans », 5 zones).',
    manque: null,
    entreDansLeScore: false
  },
  {
    id: 'risque-sante-4-4',
    label: 'Risque pour la santé — IMC et tour de taille',
    statut: 'confirme',
    source: 'Guide du conseiller, 3ᵉ éd., tableau 4.4 — adultes de 20 à 65 ans. Seuils recoupés avec Statistique Canada.',
    manque: null,
    entreDansLeScore: false
  },
  {
    id: 'tour-taille-autonome',
    label: 'Tour de taille jugé seul',
    statut: 'confirme',
    source:
      'Fenêtre Propriétés de l’ancien logiciel, test « Circonférence de la taille » (#20), onglet Classification, tous les âges. Hommes < 94 → 4, < 102 → 3, reste → 1. Femmes < 80 → 4, < 90 → 3, reste → 1. Les cotes sautent le 2, et le seuil féminin est 90 — pas 88 comme le référentiel Santé Canada.',
    manque: null,
    entreDansLeScore: false
  },
  {
    id: 'pa-diastolique-seuils',
    label: 'Pression diastolique — seuils affichés',
    statut: 'a_confirmer',
    source: 'Affiché : 80 / 85 / 90 / 100 mmHg. L’ancien logiciel montrait 75 / 80 / 90 / 100.',
    manque: 'Que Marie confirme les bornes qu’elle veut voir. Non modifié sans son accord.',
    entreDansLeScore: false
  },
  {
    id: 'hors-acsm',
    label: 'Endurance du dos, saut vertical, puissance en watts, FC repos',
    statut: 'a_confirmer',
    source: 'Sources cliniques tierces — les tables ACSM ne couvrent pas ces tests.',
    manque: 'Les barèmes que l’ancien logiciel applique à ces quatre tests.',
    entreDansLeScore: false
  },

  // ── Nutrition ────────────────────────────────────────────────────────────
  {
    id: 'proteines-par-kg',
    label: 'Protéines — 1 à 1,4 g/kg de poids corporel (jusqu’à 1,6)',
    statut: 'confirme',
    source: 'Méthode de Marie, transmise directement.',
    manque: null,
    entreDansLeScore: false
  },
  {
    id: 'lipides-30-40',
    label: 'Lipides — 30 à 40 % de l’apport calorique',
    statut: 'a_confirmer',
    source: 'Guide du conseiller CPAFLA, 3ᵉ éd. — attribution donnée par Nicholas ; la photo ne montrait ni tableau ni page.',
    manque: 'La page ou le chapitre exact.',
    entreDansLeScore: false
  },
  {
    id: 'glucides-nets',
    label: 'Glucides nets — glucides de l’aliment moins ses fibres',
    statut: 'a_confirmer',
    source: 'Définition confirmée par Nicholas : le calcul se fait par aliment.',
    manque: 'Savoir si Marie retire aussi les polyols, comme le font certaines conventions.',
    entreDansLeScore: false
  },
  {
    id: 'fibres-14g',
    label: 'Fibres — 14 g par 1000 kcal',
    statut: 'confirme',
    source: 'Santé Canada / DRI (Institute of Medicine, 2005). Référence publique vérifiable.',
    manque: null,
    entreDansLeScore: false
  },
  {
    id: 'guide-alimentaire',
    label: 'Les huit repères du Guide alimentaire canadien',
    statut: 'confirme',
    source: 'Guide alimentaire canadien — Santé Canada, 2019. Texte officiel repris mot pour mot, vérifié en ligne.',
    manque: null,
    entreDansLeScore: false
  },

  // ── Questionnaires ───────────────────────────────────────────────────────
  {
    id: 'fantastic',
    label: 'Questionnaire FANTASTIC — cotation',
    statut: 'confirme',
    source: 'Feuille papier de Marie : 25 énoncés, cotes 0 à 4 de gauche à droite, total ramené sur 100.',
    manque: null,
    entreDansLeScore: false
  },
  {
    id: 'eas',
    label: 'Questionnaire ÉAS — cotation par sexe',
    statut: 'confirme',
    source: 'Guide du conseiller, figure 4-6. Cotation dépendante du sexe, maximum 11 dans les deux colonnes.',
    manque: null,
    entreDansLeScore: false
  },
  {
    id: 'questionnaire-dans-score',
    label: 'Le questionnaire combiné compte-t-il dans le score global ?',
    statut: 'confirme',
    source:
      'Il fait partie des 7 composantes de la formule, mais il est exclu du calcul : Marie ne le remplit pas à chaque fois (décision de Nicholas). Le test [166] est exclu pour la même raison.',
    manque: null,
    entreDansLeScore: true
  }
]

/** Entrées encore ouvertes, les plus lourdes de conséquence d'abord. */
export function aValider(): ValidationEntree[] {
  return VALIDATION.filter(e => e.statut !== 'confirme').sort(
    (a, b) => Number(b.entreDansLeScore) - Number(a.entreDansLeScore)
  )
}

/** Compte par statut, pour le résumé en tête du document. */
export function compteParStatut(): Record<ValidationStatut, number> {
  const n: Record<ValidationStatut, number> = { confirme: 0, a_confirmer: 0, deduit: 0 }
  for (const e of VALIDATION) n[e.statut]++
  return n
}
