/** Seuils cliniques pour la pression artérielle et la fréquence cardiaque au
 *  repos — métriques qui n'ont pas de barème dans les tables ACSM de fitness.
 *
 *  Modélisés en `NormRange` (avec `lowerIsBetter: true`) pour réutiliser tel
 *  quel le moteur de catégorisation (`getCategorization`, `getNormPercentiles`,
 *  `getNextCategoryTarget`) et le composant `CategoryRangeBar`.
 *
 *  Correspondance zone clinique → catégorie ACSM (5 niveaux) :
 *    PA : Optimale→EXCELLENT, Normale→TRES_BIEN, Pré-HT→BIEN, HT1→ACCEPTABLE, HT2→A_AMELIORER
 *    FC : Excellent→EXCELLENT, Bien→TRES_BIEN, Moyen→BIEN, Faible→ACCEPTABLE, Mauvais→A_AMELIORER
 *
 *  Sources :
 *   - Pression artérielle : seuils OMS / JNC (universels, indépendants de l'âge et du sexe).
 *   - FC repos : ACSM (chart de fréquence cardiaque au repos). Base : hommes 36-45 ans.
 *     Les normes FC repos varient peu selon l'âge adulte (≈ 2-3 bpm) — on les
 *     traite donc comme indépendantes de l'âge ; l'écart femmes/hommes (≈ +3 bpm)
 *     est appliqué. Simplification assumée (v0.1.37).
 */

import type { Category, NormPercentiles, NormRange, TestKey } from './types'

/** Les percentiles sont en ordre décroissant (lowerIsBetter) : p10 = pire,
 *  p75 = seuil d'excellence, p90 = repère « encore meilleur ». */
const CLINICAL: Partial<Record<TestKey, { M: NormPercentiles; F: NormPercentiles }>> = {
  // Systolique : Optimale <120, Normale 120-129, Pré-HT 130-139, HT1 140-159, HT2 ≥160.
  bloodPressureSystolic: {
    M: { p10: 160, p25: 140, p50: 130, p75: 120, p90: 110 },
    F: { p10: 160, p25: 140, p50: 130, p75: 120, p90: 110 }
  },
  // Diastolique : Optimale <80, Normale 80-84, Pré-HT 85-89, HT1 90-99, HT2 ≥100.
  bloodPressureDiastolic: {
    M: { p10: 100, p25: 90, p50: 85, p75: 80, p90: 70 },
    F: { p10: 100, p25: 90, p50: 85, p75: 80, p90: 70 }
  },
  // FC repos (ACSM) : Excellent <56, Bien 57-62, Moyen 63-66, Faible 67-71, Mauvais ≥72.
  restingHeartRate: {
    M: { p10: 72, p25: 67, p50: 63, p75: 56, p90: 50 },
    F: { p10: 75, p25: 70, p50: 66, p75: 59, p90: 53 }
  }
}

export type BpKind = 'systolic' | 'diastolic'
export interface BpClassification {
  /** Nom de la zone clinique (Optimale → Hypertension 2). */
  zone: string
  /** Catégorie associée — pour la couleur (via CAT_BG/CAT_FG). */
  category: Category
}

/** Classe une valeur de tension artérielle dans les zones cliniques nommées
 *  (indépendantes de l'âge et du sexe — seuils OMS/JNC, alignés sur `CLINICAL`).
 *    Systolique : Optimale <120 · Normale 120-129 · Pré-HT 130-139 · HT1 140-159 · HT2 ≥160
 *    Diastolique : Optimale <80 · Normale 80-84 · Pré-HT 85-89 · HT1 90-99 · HT2 ≥100
 */
/** Bornes des zones cliniques de PA (OMS/JNC), par type. */
export const BP_BOUNDS: Record<BpKind, [number, number, number, number]> = {
  systolic: [120, 130, 140, 160],
  diastolic: [80, 85, 90, 100]
}

/** Les 5 zones nommées, de la meilleure (Optimale) à la pire (Hypertension 2),
 *  avec la catégorie associée (pour la couleur). */
export const BP_ZONES: { label: string; category: Category }[] = [
  { label: 'Optimale', category: 'EXCELLENT' },
  { label: 'Normale', category: 'TRES_BIEN' },
  { label: 'Pré-hypertension', category: 'BIEN' },
  { label: 'Hypertension 1', category: 'ACCEPTABLE' },
  { label: 'Hypertension 2', category: 'A_AMELIORER' }
]

/** Étendue affichée de la barre [min, max] par type (au-delà, repère saturé). */
export const BP_DISPLAY: Record<BpKind, [number, number]> = {
  systolic: [90, 180],
  diastolic: [60, 115]
}

export function classifyBloodPressure(value: number, kind: BpKind): BpClassification | null {
  if (!Number.isFinite(value)) return null
  const t = BP_BOUNDS[kind]
  const i = value < t[0] ? 0 : value < t[1] ? 1 : value < t[2] ? 2 : value < t[3] ? 3 : 4
  return { zone: BP_ZONES[i].label, category: BP_ZONES[i].category }
}

export interface BpBarZone {
  label: string
  category: Category
  /** Borne inférieure incluse. */
  min: number
  /** Borne supérieure exclue. */
  max: number
}
export interface BpBar {
  zones: BpBarZone[]
  scaleMin: number
  scaleMax: number
  current: BpBarZone | null
  markerRatio: number | null
}

/** Prépare la barre segmentée d'une valeur de PA : 5 zones proportionnelles,
 *  repère du client, zone courante. `null` si `value` n'est pas un nombre. */
export function bloodPressureBar(value: number | null | undefined, kind: BpKind): BpBar | null {
  const [scaleMin, scaleMax] = BP_DISPLAY[kind]
  const b = BP_BOUNDS[kind]
  const edges = [scaleMin, b[0], b[1], b[2], b[3], scaleMax]
  const zones: BpBarZone[] = BP_ZONES.map((z, i) => ({ label: z.label, category: z.category, min: edges[i], max: edges[i + 1] }))
  const v = typeof value === 'number' && Number.isFinite(value) ? value : null
  const cls = v === null ? null : classifyBloodPressure(v, kind)
  const current = cls ? zones.find(z => z.label === cls.zone) ?? null : null
  const markerRatio = v === null ? null : Math.max(0, Math.min(1, (v - scaleMin) / (scaleMax - scaleMin)))
  return { zones, scaleMin, scaleMax, current, markerRatio }
}

/** Retourne la plage clinique pour un test donné, ou `null` si le test n'est
 *  pas géré ici (auquel cas l'appelant retombe sur les tables ACSM/CPAFLA). */
export function getClinicalRange(test: TestKey, sex: 'F' | 'M'): NormRange | null {
  const entry = CLINICAL[test]
  if (!entry) return null
  return {
    ageMin: 0,
    ageMax: 200,
    sex,
    percentiles: entry[sex],
    lowerIsBetter: true
  }
}
