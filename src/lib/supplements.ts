/**
 * Bibliothèque de suppléments proposés dans l'onglet Nutrition (puces cliquables),
 * avec le moment de prise recommandé. GLOBALE (vaut pour tous les clients) et
 * modifiable par Marie : la liste est stockée dans les réglages de l'app
 * (`nutrition.supplements`). Ces valeurs sont la liste par défaut, servie tant que
 * Marie n'a rien personnalisé. Partagé par le renderer (UI) et le main (défaut IPC).
 */

export interface SupplementItem {
  /** Nom affiché sur la puce (ex. « Vitamine D3 + K2 »). */
  label: string
  /** Moment de prise recommandé (ex. « au coucher »), inséré avec le nom. */
  timing: string
}

export const DEFAULT_SUPPLEMENTS: SupplementItem[] = [
  { label: 'Vitamine D3 + K2', timing: 'avec un repas contenant du gras' },
  { label: 'Oméga-3 (EPA/DHA)', timing: 'au repas' },
  { label: 'Magnésium', timing: 'le soir (souper ou coucher)' },
  { label: 'Zinc', timing: 'au coucher, à distance du calcium/fer' },
  { label: 'Créatine 5 g', timing: 'tous les jours, n’importe quand' },
  { label: 'Multivitamine', timing: 'au déjeuner' },
  { label: 'Vitamine C', timing: 'le matin' },
  { label: 'Probiotiques', timing: 'à jeun, le matin' },
  { label: 'Fer', timing: 'à jeun avec vitamine C, loin du café/thé' },
  { label: 'Protéine (whey)', timing: 'après l’entraînement ou en collation' },
  { label: 'Psyllium (fibres)', timing: 'avec beaucoup d’eau, à distance des médicaments et autres suppléments' },
  { label: 'Collagène', timing: 'tous les jours, avec ou sans nourriture (idéalement avec la vitamine C)' }
]
