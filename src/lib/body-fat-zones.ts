/** Zones de pourcentage de gras corporel, **ajustées selon l'âge**, d'après le
 *  tableau d'InBody Canada (les seuils montent avec l'âge). Référence canadienne
 *  et citable, plus juste qu'un barème fixe.
 *
 *  C'est un repère de **santé** distinct de la catégorie ACSM affichée ailleurs
 *  (qui, elle, compare le client aux percentiles de sa population). Complémentaires.
 *
 *  Source unique pour le document client, le rapport PDF et le Dashboard — mêmes
 *  bornes partout.
 *  https://inbodycanada.ca/fr/la-composition-corporelle/tableau-du-pourcentage-de-graisse-corporelle-un-guide-pour-vos-parametres-de-sante/
 */

export type BfTone = 'low' | 'fit' | 'acceptable' | 'risk'

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
  low: '#2563eb', // graisse essentielle (réserve faible) — bleu
  fit: '#16a34a', // athlétique / en forme — vert
  acceptable: '#ca8a04', // acceptable — ambre
  risk: '#dc2626' // obésité — rouge
}

/** Bornes de transition [début « en forme », début « acceptable », début
 *  « obésité »] par sexe et par tranche d'âge (index 0 = 20-29 … 4 = 60+). */
const CUTS: Record<'F' | 'M', [number, number, number][]> = {
  M: [
    [6, 14, 25], // 20-29
    [6, 15, 26], // 30-39
    [7, 16, 27], // 40-49
    [8, 17, 28], // 50-59
    [9, 18, 29] // 60+
  ],
  F: [
    [14, 21, 32], // 20-29
    [15, 22, 33], // 30-39
    [16, 23, 34], // 40-49
    [17, 24, 35], // 50-59
    [18, 25, 36] // 60+
  ]
}

/** Fin de l'échelle affichée (au-delà, la barre est saturée). */
export const BF_SCALE_MAX: Record<'F' | 'M', number> = { F: 45, M: 38 }

/** Index de tranche d'âge du tableau. `null`/< 30 → 20-29 (le plus jeune). */
function ageBracket(age: number | null): number {
  if (age === null || age < 30) return 0
  if (age < 40) return 1
  if (age < 50) return 2
  if (age < 60) return 3
  return 4
}

/** Les 4 zones (ajustées à l'âge) pour ce profil. */
export function bodyFatZones(sex: 'F' | 'M', age: number | null): BfZone[] {
  const [fit, acceptable, obese] = CUTS[sex][ageBracket(age)]
  return [
    { key: 'essentielle', label: 'Graisse essentielle', min: 0, max: fit, tone: 'low' },
    { key: 'forme', label: 'En forme', min: fit, max: acceptable, tone: 'fit' },
    { key: 'acceptable', label: 'Acceptable', min: acceptable, max: obese, tone: 'acceptable' },
    { key: 'obesite', label: 'Obésité', min: obese, max: null, tone: 'risk' }
  ]
}

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
export function bodyFatScale(
  pct: number | null | undefined,
  sex: 'F' | 'M' | null,
  age: number | null
): BodyFatScale | null {
  if (sex !== 'F' && sex !== 'M') return null
  const zones = bodyFatZones(sex, age)
  const scaleMax = BF_SCALE_MAX[sex]
  const p = num(pct)
  const current = p === null ? null : (zones.find(z => p >= z.min && (z.max === null || p < z.max)) ?? null)
  const markerRatio = p === null ? null : Math.max(0, Math.min(1, p / scaleMax))
  return { zones, scaleMax, current, markerRatio }
}
