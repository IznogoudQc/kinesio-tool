/**
 * Correspondance des mesures PARTAGÉES entre un bilan (`bilan.data`) et l'onglet
 * Mesures (tables `mesures_circonferences` / `mesures_plis_cutanes`).
 *
 * Les deux côtés stockent en MÉTRIQUE (cm, kg, mm) → aucune conversion, juste un
 * renommage de champ. Utilisé par la synchronisation à l'enregistrement (main
 * process, `electron/lib/measure-sync.ts`). Module PUR (testable).
 */

/** clé bilan.data ↔ colonne de `mesures_circonferences` (poids, grandeur, circ). */
export const CIRC_MAP: readonly { bilan: string; circ: string }[] = [
  { bilan: 'poids_kg', circ: 'poidsKg' },
  { bilan: 'taille_cm', circ: 'grandeurCm' }, // « taille » du bilan = grandeur/hauteur
  { bilan: 'tour_taille_cm', circ: 'taille' }, // tour de taille (waist)
  { bilan: 'tour_hanche_cm', circ: 'hanche' },
  { bilan: 'circ_biceps_flechi_cm', circ: 'bicepsG' },
  { bilan: 'circ_cuisse_cm', circ: 'cuisseG' },
  { bilan: 'circ_epaules_pec_cm', circ: 'epaule' }
] as const

/** clé bilan.data ↔ colonne de `mesures_plis_cutanes` (les 4 plis). */
export const PLIS_MAP: readonly { bilan: string; plis: string }[] = [
  { bilan: 'pli_triceps', plis: 'triceps' },
  { bilan: 'pli_biceps', plis: 'biceps' },
  { bilan: 'pli_sous_scap', plis: 'sousscapulaire' },
  { bilan: 'pli_iliaque', plis: 'iliaque' }
] as const

export function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
