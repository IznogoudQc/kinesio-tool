/** Zones de pourcentage de gras corporel selon l'American Council on Exercise
 *  (ACE), par sexe. Référence citable, standard en kinésiologie.
 *
 *  C'est un repère de **santé** distinct de la catégorie ACSM affichée ailleurs
 *  (qui, elle, compare le client aux percentiles de sa population). Les deux sont
 *  complémentaires.
 *
 *  Source unique pour le document client, le rapport PDF et le Dashboard — afin
 *  qu'ils affichent tous exactement les mêmes bornes.
 */

export type BfTone = 'low' | 'athlete' | 'fitness' | 'acceptable' | 'risk'

export interface BfZone {
  key: string
  label: string
  /** Borne inférieure incluse (%). */
  min: number
  /** Borne supérieure exclue (%), ou `null` = pas de plafond. */
  max: number | null
  tone: BfTone
}

export const BF_TONE_HEX: Record<BfTone, string> = {
  low: '#2563eb', // réserve faible (graisse essentielle) — bleu
  athlete: '#15803d', // vert foncé
  fitness: '#16a34a', // vert
  acceptable: '#ca8a04', // ambre
  risk: '#dc2626' // rouge
}

/** Bornes ACE, rendues contiguës pour une barre (on coupe à la borne basse de
 *  la catégorie suivante). Femme et homme. */
export const ACE_ZONES: Record<'F' | 'M', BfZone[]> = {
  F: [
    { key: 'essentielle', label: 'Graisse essentielle', min: 0, max: 14, tone: 'low' },
    { key: 'athlete', label: 'Athlète', min: 14, max: 21, tone: 'athlete' },
    { key: 'forme', label: 'En forme', min: 21, max: 25, tone: 'fitness' },
    { key: 'acceptable', label: 'Acceptable', min: 25, max: 32, tone: 'acceptable' },
    { key: 'obesite', label: 'Obésité', min: 32, max: null, tone: 'risk' }
  ],
  M: [
    { key: 'essentielle', label: 'Graisse essentielle', min: 0, max: 6, tone: 'low' },
    { key: 'athlete', label: 'Athlète', min: 6, max: 14, tone: 'athlete' },
    { key: 'forme', label: 'En forme', min: 14, max: 18, tone: 'fitness' },
    { key: 'acceptable', label: 'Acceptable', min: 18, max: 25, tone: 'acceptable' },
    { key: 'obesite', label: 'Obésité', min: 25, max: null, tone: 'risk' }
  ]
}

/** Fin de l'échelle affichée (au-delà, la barre est saturée). */
export const BF_SCALE_MAX: Record<'F' | 'M', number> = { F: 45, M: 38 }

export interface BodyFatScale {
  zones: BfZone[]
  scaleMax: number
  /** Zone où se situe le client, ou `null` si `pct`/`sex` manquent. */
  current: BfZone | null
  /** Position 0–1 du repère sur l'échelle (bornée). */
  markerRatio: number | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Prépare tout le nécessaire pour dessiner la barre + situer le client. */
export function bodyFatScale(pct: number | null | undefined, sex: 'F' | 'M' | null): BodyFatScale | null {
  if (sex !== 'F' && sex !== 'M') return null
  const zones = ACE_ZONES[sex]
  const scaleMax = BF_SCALE_MAX[sex]
  const p = num(pct)
  const current = p === null ? null : (zones.find(z => p >= z.min && (z.max === null || p < z.max)) ?? null)
  const markerRatio = p === null ? null : Math.max(0, Math.min(1, p / scaleMax))
  return { zones, scaleMax, current, markerRatio }
}
