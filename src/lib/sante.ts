/**
 * Questionnaire de santé — blessures / conditions musculo-squelettiques.
 * Rempli à l'admission : conditions de santé, zones de tension/douleur (via une
 * silhouette cliquable), et restrictions de mouvement à respecter.
 * Module PUR (testable via node --test).
 *
 * Décision (ADR 0021, révise 0020) : les zones sont marquées sur une **silhouette
 * avant/arrière** ; chaque zone est jaune (tension) ou rouge (douleur).
 */

/** Sévérité d'une zone : tension légère (jaune) ou douleur (rouge). */
export type PainSeverity = 'jaune' | 'rouge'

/** Une zone marquée sur la silhouette : sévérité + description optionnelle. */
export interface ZoneMark {
  severity: PainSeverity
  description?: string
}

export interface SanteData {
  /** Conditions de santé signalées par le client (texte libre). */
  conditions?: string
  /** Zones marquées sur la silhouette : id de région → { sévérité, description }. */
  zonesDetail?: Record<string, ZoneMark>
  /** Zone(s) non listée(s) — texte libre. */
  zonesAutre?: string
  /**
   * @deprecated ancien format (sévérité seule) — lu et converti en `zonesDetail`.
   */
  zonesSeverity?: Record<string, PainSeverity>
  /**
   * @deprecated ancien format (cases à cocher) — conservé en lecture seule.
   */
  zones?: string[]
  /** Y a-t-il des restrictions de mouvement à respecter ? (null = non renseigné) */
  restrictions?: boolean | null
  /** Description des restrictions si « OUI ». */
  restrictionsDetail?: string
  /** Note interne de Marie (jamais montrée au client). */
  notes?: string
}

/** Une zone cliquable de la silhouette (ellipse positionnée sur le dessin). */
export interface BodyRegion {
  id: string
  label: string
  view: 'face' | 'dos'
  cx: number
  cy: number
  rx: number
  ry: number
}

/**
 * Régions cliquables — coordonnées dans le repère SVG `0 0 160 380` de chaque
 * silhouette (voir BodyPainMap). Face et dos = ensembles distincts.
 */
export const BODY_REGIONS: readonly BodyRegion[] = [
  // ── Face (avant) ──
  { id: 'f_cou', label: 'Cou', view: 'face', cx: 80, cy: 55, rx: 11, ry: 7 },
  { id: 'f_epaule_g', label: 'Épaule G', view: 'face', cx: 47, cy: 66, rx: 12, ry: 9 },
  { id: 'f_epaule_d', label: 'Épaule D', view: 'face', cx: 113, cy: 66, rx: 12, ry: 9 },
  { id: 'f_poitrine', label: 'Poitrine', view: 'face', cx: 80, cy: 90, rx: 22, ry: 13 },
  { id: 'f_bras_g', label: 'Bras G', view: 'face', cx: 40, cy: 118, rx: 8, ry: 28 },
  { id: 'f_bras_d', label: 'Bras D', view: 'face', cx: 120, cy: 118, rx: 8, ry: 28 },
  { id: 'f_abdomen', label: 'Abdomen', view: 'face', cx: 80, cy: 132, rx: 20, ry: 17 },
  { id: 'f_main_g', label: 'Main G', view: 'face', cx: 41, cy: 183, rx: 7, ry: 9 },
  { id: 'f_main_d', label: 'Main D', view: 'face', cx: 119, cy: 183, rx: 7, ry: 9 },
  { id: 'f_hanche_g', label: 'Hanche G', view: 'face', cx: 65, cy: 196, rx: 12, ry: 11 },
  { id: 'f_hanche_d', label: 'Hanche D', view: 'face', cx: 95, cy: 196, rx: 12, ry: 11 },
  { id: 'f_cuisse_g', label: 'Cuisse G', view: 'face', cx: 65, cy: 245, rx: 11, ry: 30 },
  { id: 'f_cuisse_d', label: 'Cuisse D', view: 'face', cx: 95, cy: 245, rx: 11, ry: 30 },
  { id: 'f_genou_g', label: 'Genou G', view: 'face', cx: 64, cy: 295, rx: 9, ry: 9 },
  { id: 'f_genou_d', label: 'Genou D', view: 'face', cx: 96, cy: 295, rx: 9, ry: 9 },
  { id: 'f_tibia_g', label: 'Tibia G', view: 'face', cx: 63, cy: 335, rx: 9, ry: 22 },
  { id: 'f_tibia_d', label: 'Tibia D', view: 'face', cx: 97, cy: 335, rx: 9, ry: 22 },
  { id: 'f_pied_g', label: 'Pied G', view: 'face', cx: 60, cy: 371, rx: 10, ry: 7 },
  { id: 'f_pied_d', label: 'Pied D', view: 'face', cx: 100, cy: 371, rx: 10, ry: 7 },
  // ── Dos (arrière) ──
  { id: 'd_nuque', label: 'Nuque', view: 'dos', cx: 80, cy: 55, rx: 11, ry: 7 },
  { id: 'd_epaule_g', label: 'Épaule G', view: 'dos', cx: 47, cy: 66, rx: 12, ry: 9 },
  { id: 'd_epaule_d', label: 'Épaule D', view: 'dos', cx: 113, cy: 66, rx: 12, ry: 9 },
  { id: 'd_haut_dos', label: 'Haut du dos', view: 'dos', cx: 80, cy: 90, rx: 23, ry: 15 },
  { id: 'd_bras_g', label: 'Bras G', view: 'dos', cx: 40, cy: 118, rx: 8, ry: 28 },
  { id: 'd_bras_d', label: 'Bras D', view: 'dos', cx: 120, cy: 118, rx: 8, ry: 28 },
  { id: 'd_bas_dos', label: 'Bas du dos (lombaires)', view: 'dos', cx: 80, cy: 132, rx: 21, ry: 15 },
  { id: 'd_main_g', label: 'Main G', view: 'dos', cx: 41, cy: 183, rx: 7, ry: 9 },
  { id: 'd_main_d', label: 'Main D', view: 'dos', cx: 119, cy: 183, rx: 7, ry: 9 },
  { id: 'd_fessiers', label: 'Fessiers', view: 'dos', cx: 80, cy: 198, rx: 23, ry: 13 },
  { id: 'd_ischio_g', label: 'Arrière cuisse G', view: 'dos', cx: 65, cy: 247, rx: 11, ry: 28 },
  { id: 'd_ischio_d', label: 'Arrière cuisse D', view: 'dos', cx: 95, cy: 247, rx: 11, ry: 28 },
  { id: 'd_mollet_g', label: 'Mollet G', view: 'dos', cx: 63, cy: 330, rx: 9, ry: 23 },
  { id: 'd_mollet_d', label: 'Mollet D', view: 'dos', cx: 97, cy: 330, rx: 9, ry: 23 },
  { id: 'd_talon_g', label: 'Talon G', view: 'dos', cx: 60, cy: 371, rx: 10, ry: 7 },
  { id: 'd_talon_d', label: 'Talon D', view: 'dos', cx: 100, cy: 371, rx: 10, ry: 7 }
] as const

const REGION_BY_ID: Record<string, BodyRegion> = Object.fromEntries(BODY_REGIONS.map(r => [r.id, r]))

/** Libellé lisible d'une région (avec la vue), ex. « Épaule D (face) ». */
export function regionLabel(id: string): string {
  const r = REGION_BY_ID[id]
  if (!r) return id
  return `${r.label} (${r.view === 'face' ? 'face' : 'dos'})`
}

/** Cycle de sévérité au clic : rien → jaune → rouge → rien. */
export function cyclePain(cur: PainSeverity | undefined): PainSeverity | undefined {
  return cur === undefined ? 'jaune' : cur === 'jaune' ? 'rouge' : undefined
}

/** Crée un questionnaire de santé vierge. */
export function emptySante(): SanteData {
  return { restrictions: null, zonesDetail: {} }
}

/**
 * Normalise les zones vers `zonesDetail` (convertit l'ancien `zonesSeverity`).
 * Retourne toujours un objet (jamais undefined).
 */
export function normalizeZones(data: SanteData): Record<string, ZoneMark> {
  if (data.zonesDetail && typeof data.zonesDetail === 'object') return data.zonesDetail
  if (data.zonesSeverity && typeof data.zonesSeverity === 'object') {
    return Object.fromEntries(Object.entries(data.zonesSeverity).map(([id, sev]) => [id, { severity: sev }]))
  }
  return {}
}

/** `true` si rien n'est renseigné (rien à enregistrer). */
export function santeIsBlank(data: SanteData): boolean {
  const hasText = (v: string | undefined) => typeof v === 'string' && v.trim() !== ''
  const zoneCount = Object.keys(normalizeZones(data)).length
  const oldZoneCount = data.zones ? data.zones.length : 0
  return (
    !hasText(data.conditions) &&
    zoneCount === 0 &&
    oldZoneCount === 0 &&
    !hasText(data.zonesAutre) &&
    (data.restrictions === null || data.restrictions === undefined) &&
    !hasText(data.restrictionsDetail) &&
    !hasText(data.notes)
  )
}
