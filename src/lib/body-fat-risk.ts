/** Grille de **risque** du pourcentage de gras corporel, reprise de l'ancien
 *  logiciel de Marie. Cinq zones, un seul palier d'âge (« moins de 70 ans »),
 *  avec du risque **aux deux extrémités** (trop maigre = risque, trop gras =
 *  risque). C'est une lentille de **santé**, distincte du percentile ACSM (qui,
 *  lui, sert au score interne de composition corporelle).
 *
 *  Source unique pour le document client, le rapport PDF, le Dashboard et le
 *  document des barèmes — mêmes bornes partout.
 *
 *  Bornes fournies par Marie (à valider quant à leur source publiée) :
 *    Femme : 15 · 25 · 34 · 42      Homme : 5 · 15 · 30 · 32,1
 */

export type BfRiskKey = 'potentiel' | 'optimal' | 'sante' | 'modere' | 'eleve'

export interface BfRiskZone {
  key: BfRiskKey
  label: string
  /** Borne inférieure incluse (%). */
  min: number
  /** Borne supérieure exclue (%), ou `null` = pas de plafond. */
  max: number | null
}

/** Palette « diapason » accordée au site : ambre doux (trop maigre) → deux verts
 *  (favorables) → ambre chaud → terracotta (trop gras). Pas de rouge criard. */
export const BF_RISK_HEX: Record<BfRiskKey, string> = {
  potentiel: '#c99a4e',
  optimal: '#3f7d5a',
  sante: '#6fa987',
  modere: '#d38a3f',
  eleve: '#b34a37'
}

const LABELS: Record<BfRiskKey, string> = {
  potentiel: 'Risques potentiels',
  optimal: 'Optimal',
  sante: 'En santé',
  modere: 'Risques modérés',
  eleve: 'Risques élevés'
}

/** Bornes internes [b1, b2, b3, b4] par sexe (palier « moins de 70 ans »). */
const CUTS: Record<'F' | 'M', [number, number, number, number]> = {
  F: [15, 25, 34, 42],
  M: [5, 15, 30, 32.1]
}

/** Fin de l'échelle affichée (au-delà, le repère est saturé). */
export const BF_RISK_SCALE_MAX: Record<'F' | 'M', number> = { F: 50, M: 40 }

/** Les cinq zones pour ce sexe (indépendant de l'âge, palier < 70). */
export function bodyFatRiskZones(sex: 'F' | 'M'): BfRiskZone[] {
  const [b1, b2, b3, b4] = CUTS[sex]
  return [
    { key: 'potentiel', label: LABELS.potentiel, min: 0, max: b1 },
    { key: 'optimal', label: LABELS.optimal, min: b1, max: b2 },
    { key: 'sante', label: LABELS.sante, min: b2, max: b3 },
    { key: 'modere', label: LABELS.modere, min: b3, max: b4 },
    { key: 'eleve', label: LABELS.eleve, min: b4, max: null }
  ]
}

export interface BodyFatRiskScale {
  zones: BfRiskZone[]
  scaleMax: number
  /** Zone où se situe le client, ou `null` si `pct`/`sex` manquent. */
  current: BfRiskZone | null
  /** Position 0–1 du repère sur l'échelle (bornée). */
  markerRatio: number | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Prépare tout le nécessaire pour dessiner la barre + situer le client. */
export function bodyFatRisk(pct: number | null | undefined, sex: 'F' | 'M' | null): BodyFatRiskScale | null {
  if (sex !== 'F' && sex !== 'M') return null
  const zones = bodyFatRiskZones(sex)
  const scaleMax = BF_RISK_SCALE_MAX[sex]
  const p = num(pct)
  const current = p === null ? null : (zones.find(z => p >= z.min && (z.max === null || p < z.max)) ?? null)
  const markerRatio = p === null ? null : Math.max(0, Math.min(1, p / scaleMax))
  return { zones, scaleMax, current, markerRatio }
}
