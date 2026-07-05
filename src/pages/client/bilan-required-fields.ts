/** Champs « importants » d'un bilan : ceux qu'on rappelle à Marie-Eve si elle
 *  sauvegarde sans les avoir remplis. Pas bloquant — juste un garde-fou doux
 *  (dialog récapitulatif avec « Enregistrer quand même »).
 *
 *  Volontairement court : uniquement les mesures structurantes qui alimentent
 *  les scores de synthèse et la catégorisation. Les champs calculés et la
 *  récupération post-effort n'en font pas partie. */

export interface ImportantField {
  key: keyof BilanData
  label: string
}

export const IMPORTANT_BILAN_FIELDS: ImportantField[] = [
  { key: 'taille_cm', label: 'Taille' },
  { key: 'poids_kg', label: 'Poids' },
  { key: 'tour_taille_cm', label: 'Tour de taille' },
  { key: 'vo2max', label: 'VO2max' },
  { key: 'pa_systolique', label: 'PA systolique' },
  { key: 'pa_diastolique', label: 'PA diastolique' },
  { key: 'pushups', label: 'Extension des bras (push-ups)' },
  { key: 'situps', label: 'Redressements assis' }
]

function isFilled(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))
}

/** Retourne les champs importants encore vides dans `data`, dans l'ordre de
 *  `IMPORTANT_BILAN_FIELDS`. Vide = tout est renseigné. */
export function missingImportantFields(data: BilanData): ImportantField[] {
  return IMPORTANT_BILAN_FIELDS.filter(f => !isFilled((data as Record<string, unknown>)[f.key as string]))
}
