/**
 * Questionnaire de santé — blessures / conditions musculo-squelettiques.
 * Rempli à l'admission : conditions de santé, zones de tension/douleur, et
 * restrictions de mouvement à respecter. Module PUR (testable via node --test).
 *
 * Décision (ADR 0020) : le « schéma corporel » du formulaire papier est
 * simplifié en **cases à cocher de zones** + texte, pas une carte cliquable.
 */

export interface SanteData {
  /** Conditions de santé signalées par le client (texte libre). */
  conditions?: string
  /** Zones de tension / douleur cochées (libellés issus de SANTE_ZONES). */
  zones?: string[]
  /** Zone(s) non listée(s) — texte libre. */
  zonesAutre?: string
  /** Y a-t-il des restrictions de mouvement à respecter ? (null = non renseigné) */
  restrictions?: boolean | null
  /** Description des restrictions si « OUI ». */
  restrictionsDetail?: string
  /** Note interne de Marie (jamais montrée au client). */
  notes?: string
}

/** Zones du corps proposées en cases à cocher (avant/arrière confondus). */
export const SANTE_ZONES: readonly string[] = [
  'Nuque / cou',
  'Épaules',
  'Haut du dos',
  'Bas du dos (lombaires)',
  'Bras / coudes',
  'Poignets / mains',
  'Poitrine',
  'Hanches / bassin',
  'Fessiers',
  'Cuisses',
  'Genoux',
  'Mollets',
  'Chevilles / pieds'
] as const

/** Crée un questionnaire de santé vierge. */
export function emptySante(): SanteData {
  return { restrictions: null }
}

/** Active/désactive une zone et retourne un nouveau tableau trié selon SANTE_ZONES. */
export function toggleZone(zones: string[] | undefined, zone: string): string[] {
  const set = new Set(zones ?? [])
  if (set.has(zone)) set.delete(zone)
  else set.add(zone)
  return SANTE_ZONES.filter(z => set.has(z))
}

/** `true` si rien n'est renseigné (rien à enregistrer). */
export function santeIsBlank(data: SanteData): boolean {
  const hasText = (v: string | undefined) => typeof v === 'string' && v.trim() !== ''
  return (
    !hasText(data.conditions) &&
    (!data.zones || data.zones.length === 0) &&
    !hasText(data.zonesAutre) &&
    (data.restrictions === null || data.restrictions === undefined) &&
    !hasText(data.restrictionsDetail) &&
    !hasText(data.notes)
  )
}
