/** Grille de **risque** du pourcentage de gras corporel, reprise de l'ancien
 *  logiciel de Marie. Cinq zones, un seul palier d'âge (« moins de 70 ans »),
 *  avec du risque **aux deux extrémités** (trop maigre = risque, trop gras =
 *  risque). C'est la **référence unique de Marie** pour le % de gras : elle sert
 *  à la fois au libellé affiché (« En santé », « Optimal », …) et à la cote 0-4
 *  du % de gras dans le score de composition (via `bodyFatGridRating`). On
 *  n'utilise plus le percentile ACSM pour le % de gras (choix de Marie).
 *
 *  Source unique pour le document client, le rapport PDF, le Dashboard et le
 *  document des barèmes — mêmes bornes partout.
 *
 *  Bornes fournies par Marie (à valider quant à leur source publiée) :
 *    Femme : 15 · 25 · 34 · 42      Homme : 5 · 15 · 30 · 32,1
 */

import type { Category } from './norms/types.ts'

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

/** % de gras cible = **haut de la zone « Optimal »** (25 % femme, 15 % homme). */
export function optimalBodyFatMax(sex: 'F' | 'M'): number {
  return bodyFatRiskZones(sex)[1].max as number
}

/** % de gras = **haut de la zone « En santé »** (34 % femme, 30 % homme) — la
 *  limite haute encore saine. */
export function healthyBodyFatMax(sex: 'F' | 'M'): number {
  return bodyFatRiskZones(sex)[2].max as number
}

export interface BfTargetWeight {
  /** % de gras cible (haut de la zone). */
  targetBf: number
  /** Poids (kg) qui placerait le client à ce % de gras, à masse maigre constante. */
  targetKg: number
}

export interface BfTargetWeights {
  leanKg: number
  /** Poids au sommet de la zone « Optimal » (le plus bas des deux). */
  optimal: BfTargetWeight
  /** Poids au sommet de la zone « En santé » — limite haute encore saine. */
  healthyMax: BfTargetWeight
}

/** Deux poids-repères dérivés du % de gras courant, **à masse maigre constante**
 *  (masse maigre = poids × (1 − %gras/100) ; poids-cible = masse maigre /
 *  (1 − %cible/100)) : le poids « optimal » (haut de la zone Optimal) et le
 *  « poids santé maximum » (haut de la zone En santé, comme l'ancien logiciel de
 *  Marie). `null` si données manquantes/aberrantes. */
export function bodyFatTargetWeights(
  pct: number | null | undefined,
  weightKg: number | null | undefined,
  sex: 'F' | 'M' | null
): BfTargetWeights | null {
  const p = num(pct)
  const w = num(weightKg)
  if ((sex !== 'F' && sex !== 'M') || p === null || w === null) return null
  if (w <= 0 || p <= 0 || p >= 100) return null
  const leanKg = w * (1 - p / 100)
  const at = (bf: number) => leanKg / (1 - bf / 100)
  return {
    leanKg,
    optimal: { targetBf: optimalBodyFatMax(sex), targetKg: at(optimalBodyFatMax(sex)) },
    healthyMax: { targetBf: healthyBodyFatMax(sex), targetKg: at(healthyBodyFatMax(sex)) }
  }
}

/** Correspondance zone de risque → cote 0-4 (`Category`). L'ordre santé : Optimal
 *  (meilleur) → En santé → puis les zones à risque. La cotation des zones extrêmes
 *  (« Risques potentiels » = trop maigre) est indicative — à valider avec Marie. */
const ZONE_TO_CATEGORY: Record<BfRiskKey, Category> = {
  optimal: 'EXCELLENT',
  sante: 'TRES_BIEN',
  potentiel: 'BIEN',
  modere: 'ACCEPTABLE',
  eleve: 'A_AMELIORER'
}

export interface BodyFatGridRating {
  key: BfRiskKey
  /** Libellé de la grille (« Optimal », « En santé », « Risques modérés », …). */
  label: string
  /** Cote 0-4 (via `Category`) alignée sur le reste du bilan, pour le score ET la couleur. */
  category: Category
}

/** Cotation du % de gras **selon la grille de Marie** : renvoie le libellé de la
 *  zone (« En santé ») ET une cote 0-4. Source unique pour l'affichage (rapport,
 *  dashboard) et pour la contribution du % de gras au score de composition —
 *  remplace le percentile ACSM pour ce champ. `null` si `pct`/`sex` manquent. */
export function bodyFatGridRating(
  pct: number | null | undefined,
  sex: 'F' | 'M' | null
): BodyFatGridRating | null {
  const s = bodyFatRisk(pct, sex)
  if (!s || !s.current) return null
  return { key: s.current.key, label: s.current.label, category: ZONE_TO_CATEGORY[s.current.key] }
}

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
