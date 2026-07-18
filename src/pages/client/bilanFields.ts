/** Définitions partagées des champs d'un bilan — utilisées par le formulaire
 *  d'import, la vue détaillée et la saisie manuelle. */

export type BilanFieldType = 'number' | 'text' | 'select' | 'textarea' | 'computed'

export interface BilanFieldDef {
  key: keyof BilanData
  label: string
  unit?: string
  type?: BilanFieldType
  /** Options pour `type: 'select'`. La valeur stockée est le label exact. */
  options?: string[]
  /** Hint affiché sous le champ — explication ou rappel de la formule. */
  hint?: string
}

export interface BilanFieldGroup {
  /** Identifiant stable (utilisé pour les sections collapsibles). */
  id: string
  title: string
  fields: BilanFieldDef[]
}

/** Options pour le test aérobie — couvre les protocoles standards utilisés par Marie-Eve. */
export const TEST_AEROBIE_OPTIONS = [
  'Tapis Roulant de Bruce',
  "Test d'Astrand",
  'Cooper 12 min',
  'Test de Léger',
  'Autre'
] as const

export const BILAN_FIELD_GROUPS: BilanFieldGroup[] = [
  {
    id: 'vitaux',
    title: 'Signes vitaux (repos)',
    fields: [
      { key: 'pa_systolique', label: 'PA systolique (repos)', unit: 'mmHg' },
      { key: 'pa_diastolique', label: 'PA diastolique (repos)', unit: 'mmHg' },
      { key: 'fc_repos', label: 'FC au repos', unit: 'bpm' },
      { key: 'pa_recup_sys', label: 'PA récup — systolique', unit: 'mmHg' },
      { key: 'pa_recup_dia', label: 'PA récup — diastolique', unit: 'mmHg' }
    ]
  },
  {
    id: 'anthropo',
    title: 'Anthropométrie',
    fields: [
      { key: 'poids_kg', label: 'Poids', unit: 'kg' },
      { key: 'taille_cm', label: 'Taille', unit: 'cm' },
      { key: 'imc', label: 'IMC', unit: 'kg/m²', type: 'computed', hint: 'Calculé : poids ÷ taille²' }
    ]
  },
  {
    id: 'circonferences',
    title: 'Circonférences',
    fields: [
      { key: 'tour_taille_cm', label: 'Taille', unit: 'cm' },
      { key: 'tour_hanche_cm', label: 'Hanche', unit: 'cm' },
      { key: 'circ_biceps_flechi_cm', label: 'Biceps fléchi', unit: 'cm' },
      { key: 'circ_cuisse_cm', label: 'Cuisse (2 po du genou)', unit: 'cm' },
      { key: 'circ_epaules_pec_cm', label: 'Épaules et pec', unit: 'cm' }
    ]
  },
  {
    id: 'plis',
    title: 'Plis cutanés',
    fields: [
      { key: 'pli_triceps', label: 'Triceps', unit: 'mm' },
      { key: 'pli_biceps', label: 'Biceps', unit: 'mm' },
      { key: 'pli_sous_scap', label: 'Sous-scapulaire', unit: 'mm' },
      { key: 'pli_iliaque', label: 'Crête iliaque', unit: 'mm' },
      {
        key: 'pourcentage_gras',
        label: 'Pourcentage de gras',
        unit: '%',
        type: 'computed',
        hint: 'Calculé : Durnin-Womersley (4 plis) si âge + sexe + plis disponibles'
      }
    ]
  },
  {
    id: 'aerobie',
    title: 'Aptitude aérobie',
    fields: [
      { key: 'test_aerobie', label: 'Test aérobie utilisé', type: 'select', options: [...TEST_AEROBIE_OPTIONS] },
      { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min' },
      { key: 'met_equivalent', label: 'MET équivalent', unit: 'MET', type: 'computed', hint: 'VO2max ÷ 3.5' },
      { key: 'fc_repos', label: 'FC au repos', unit: 'bpm' },
      {
        key: 'fc_max_predite',
        label: 'FC max prédite',
        unit: 'bpm',
        type: 'computed',
        hint: 'Tanaka : 208 − 0.7 × âge'
      },
      { key: 'pa_systolique', label: 'PA systolique (repos)', unit: 'mmHg' },
      { key: 'pa_diastolique', label: 'PA diastolique (repos)', unit: 'mmHg' }
    ]
  },
  {
    id: 'musculo',
    title: 'Musculosquelettique',
    fields: [
      { key: 'pushups', label: 'Extension des bras (push-ups)', unit: 'reps' },
      { key: 'situps', label: 'Abdominaux (redressements)', unit: 'reps' },
      {
        key: 'diastase',
        label: 'Diastase',
        type: 'text',
        hint: 'Écart des grands droits — texte libre (ex. « 2 doigts », « 3 cm », « aucune »)'
      },
      { key: 'saut_depart_cm', label: 'Saut — départ', unit: 'cm', hint: 'Hauteur atteinte bras levé, debout' },
      { key: 'saut_finale_cm', label: 'Saut — finale', unit: 'cm', hint: 'Hauteur atteinte au sommet du saut' },
      { key: 'saut_vertical_cm', label: 'Saut vertical', unit: 'cm', type: 'computed', hint: 'Calculé : finale − départ' },
      {
        key: 'puissance_jambes_watts',
        label: 'Puissance des jambes',
        unit: 'W',
        type: 'computed',
        hint: 'Sayers : 60.7 × saut + 45.3 × poids − 2055'
      },
      { key: 'endurance_dos_sec', label: 'Extension lombaires (endurance)', unit: 's' },
      { key: 'flexion_tronc_cm', label: 'Flexibilité (flexion du tronc)', unit: 'cm' }
    ]
  },
  {
    id: 'indices',
    title: 'Indices (calculés)',
    fields: [
      {
        key: 'score_composition',
        label: 'Score composition corporelle',
        type: 'computed',
        hint: 'Cf. cards de synthèse — composition / aérobie / dos / musculo'
      },
      { key: 'indice_sante_dos', label: 'Indice de santé du dos', type: 'computed' },
      { key: 'score_musculo_global', label: 'Aptitude musculosquelettique globale', type: 'computed' },
      { key: 'score_global', label: 'Santé et condition physique globale', type: 'computed' }
    ]
  },
  {
    id: 'notes',
    title: 'Objectif, notes et observations',
    fields: [
      {
        key: 'objectif',
        label: 'Objectif du client',
        type: 'textarea',
        hint: 'Dans les mots du client — apparaît en tête du rapport (ex. « perdre 10 kg », « courir un 10 km »)'
      },
      {
        key: 'notes',
        label: 'Mot au client (observations et conseils)',
        type: 'textarea',
        hint: 'Adressé au client : apparaît sous « Le mot de votre kinésiologue » dans le rapport PDF et le document interactif envoyés par courriel. Vos notes privées vont dans l’onglet Notes — elles ne sortent jamais.'
      }
    ]
  }
]

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

const MONTHS_FR_SHORT = [
  'janv', 'févr', 'mars', 'avr', 'mai', 'juin',
  'juill', 'août', 'sept', 'oct', 'nov', 'déc'
]

/** Formate une date ISO `AAAA-MM-JJ` sans dérive de fuseau horaire. */
export function formatBilanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const day = parseInt(m[3], 10)
  const month = parseInt(m[2], 10)
  return `${day} ${MONTHS_FR[month - 1] ?? m[2]} ${m[1]}`
}

/** Étiquette compacte pour les axes de graphiques, ex. `sept 2025`. */
export function formatBilanMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  if (!m) return iso
  const month = parseInt(m[2], 10)
  return `${MONTHS_FR_SHORT[month - 1] ?? m[2]} ${m[1]}`
}

/** Compte le nombre de mesures non vides dans un bilan. */
export function countFilledFields(data: BilanData): number {
  return Object.values(data).filter(v => v !== undefined && v !== null && v !== '').length
}
