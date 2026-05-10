/** Définitions partagées des champs d'un bilan — utilisées par le formulaire
 *  d'import, la vue détaillée et (plus tard) la saisie manuelle. */

export interface BilanFieldDef {
  key: keyof BilanData
  label: string
  unit?: string
  type?: 'number' | 'text'
}

export interface BilanFieldGroup {
  title: string
  fields: BilanFieldDef[]
}

export const BILAN_FIELD_GROUPS: BilanFieldGroup[] = [
  {
    title: 'Anthropométrie',
    fields: [
      { key: 'taille_cm', label: 'Taille', unit: 'cm' },
      { key: 'poids_kg', label: 'Poids', unit: 'kg' },
      { key: 'imc', label: 'IMC' },
      { key: 'tour_taille_cm', label: 'Tour de taille', unit: 'cm' },
      { key: 'tour_hanche_cm', label: 'Tour de hanche', unit: 'cm' },
      { key: 'pli_triceps', label: 'Pli triceps', unit: 'mm' },
      { key: 'pli_biceps', label: 'Pli biceps', unit: 'mm' },
      { key: 'pli_sous_scap', label: 'Pli sous-scapulaire', unit: 'mm' },
      { key: 'pli_iliaque', label: 'Pli crête iliaque', unit: 'mm' },
      { key: 'pli_mollet', label: 'Pli mollet', unit: 'mm' },
      { key: 'pli_cuisse', label: 'Pli cuisse', unit: 'mm' },
      { key: 'pourcentage_gras', label: 'Pourcentage de gras', unit: '%' }
    ]
  },
  {
    title: 'Aptitude aérobie',
    fields: [
      { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min' },
      { key: 'test_aerobie', label: 'Type de test', type: 'text' },
      { key: 'fc_repos', label: 'FC au repos', unit: 'bpm' },
      { key: 'pa_systolique', label: 'Pression artérielle systolique', unit: 'mmHg' },
      { key: 'pa_diastolique', label: 'Pression artérielle diastolique', unit: 'mmHg' }
    ]
  },
  {
    title: 'Musculosquelettique',
    fields: [
      { key: 'pushups', label: 'Extension des bras (push-ups)', unit: 'reps' },
      { key: 'situps', label: 'Redressements assis partiels', unit: 'reps' },
      { key: 'saut_vertical_cm', label: 'Saut vertical', unit: 'cm' },
      { key: 'puissance_jambes_watts', label: 'Puissance des jambes', unit: 'W' },
      { key: 'flexion_tronc_cm', label: 'Flexion avant du tronc', unit: 'cm' },
      { key: 'endurance_dos_sec', label: 'Endurance des extenseurs du dos', unit: 's' }
    ]
  },
  {
    title: 'Indices',
    fields: [
      { key: 'score_composition', label: 'Score composition corporelle' },
      { key: 'indice_sante_dos', label: 'Indice de santé du dos' },
      { key: 'score_musculo_global', label: 'Aptitude musculosquelettique globale' },
      { key: 'score_global', label: 'Santé et condition physique globale' }
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
