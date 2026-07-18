/**
 * Questionnaire « Objectifs & habitudes de vie » — fiche d'admission remplie à
 * la main par Marie (objectif du client + tour d'horizon du mode de vie).
 * Essentiellement du texte libre. Module PUR (testable via node --test).
 */

export interface ObjectifsData {
  /** L'objectif principal du client (en-tête de la fiche papier). */
  objectif?: string
  preferences?: string
  activitePresente?: string
  activitesPassees?: string
  equipement?: string
  sommeil?: string
  alimentation?: string
  travailHoraire?: string
  /** « Quand ?… » — disponibilités / planification pour intégrer l'activité. */
  planification?: string
  /** Note interne de Marie (jamais montrée au client). */
  notes?: string
}

/** Définition d'affichage d'un champ (ordre = ordre de la fiche papier). */
export interface ObjectifsField {
  key: keyof ObjectifsData
  label: string
  placeholder: string
  rows: number
}

/** Champs libres (hors `objectif`, mis en avant à part, et `notes`). */
export const OBJECTIFS_FIELDS: readonly ObjectifsField[] = [
  { key: 'preferences', label: 'Préférences', placeholder: "Activités aimées, ce qui motive, ce qui rebute…", rows: 2 },
  { key: 'activitePresente', label: 'Activité présentement', placeholder: "Ce que le client fait actuellement (type, fréquence, intensité)…", rows: 2 },
  { key: 'activitesPassees', label: 'Activités passées', placeholder: "Sports/activités déjà pratiqués, blessures liées…", rows: 2 },
  { key: 'equipement', label: 'Équipement', placeholder: "Matériel disponible, accès à un gym, à domicile…", rows: 2 },
  { key: 'sommeil', label: 'Sommeil', placeholder: "Heures/nuit, qualité, horaire…", rows: 2 },
  { key: 'alimentation', label: 'Alimentation', placeholder: "Habitudes alimentaires, restrictions, repas types…", rows: 2 },
  { key: 'travailHoraire', label: 'Travail et horaire', placeholder: "Emploi, horaire, niveau d'activité au travail…", rows: 2 },
  { key: 'planification', label: 'Quand ? (planification)', placeholder: "Disponibilités, moments réalistes pour s'entraîner…", rows: 2 }
] as const

/** Toutes les clés de contenu (objectif + champs libres + notes). */
const CONTENT_KEYS: (keyof ObjectifsData)[] = [
  'objectif',
  ...OBJECTIFS_FIELDS.map(f => f.key),
  'notes'
]

/** Crée une fiche vierge. */
export function emptyObjectifs(): ObjectifsData {
  return {}
}

/** `true` si aucun champ n'est renseigné (rien à enregistrer). */
export function objectifsIsBlank(data: ObjectifsData): boolean {
  return CONTENT_KEYS.every(k => {
    const v = data[k]
    return v === undefined || v === null || v.trim() === ''
  })
}
