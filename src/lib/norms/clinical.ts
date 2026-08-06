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

/** Cote 0-4 de la **pression artérielle systolique** telle que l'utilise le score
 *  « Santé et condition physique globale » de l'ancien logiciel.
 *
 *  ⚠️ **PROVISOIRE — barème non confirmé.** Déduit par rétro-calcul sur 4 bilans
 *  réels (voir ADR 0030) : 112 → 4, 113 → 4, 122 → 0, 129 → 0. La règle « < 120 mmHg
 *  → 4, sinon 0 » est la plus simple compatible avec ces quatre points, et 120 est
 *  la borne clinique standard de la PA optimale.
 *
 *  Ce qu'on ignore encore : la frontière exacte entre 113 et 122, et l'existence
 *  éventuelle de cotes intermédiaires (1, 2, 3). À remplacer dès que Marie fournit
 *  la table de classification du test « Pression artérielle systolique ».
 *
 *  `null` si la mesure est absente → la composante est exclue du score global. */
/**
 * Barème du **tour de taille** de l'ancien logiciel — test « Circonférence de la
 * taille » (#20, cm), onglet Classification, « Tous les âges ».
 *
 * Relevé sur capture de la fenêtre Propriétés (Nicholas, 2026-08-04) :
 *
 * | | Mâle | Femelle |
 * |---|---|---|
 * | 4 Excellent            | < 94  | < 80 |
 * | 3 Risque potentiel     | < 102 | < 90 |
 * | 1 Risque considérable  | reste | reste |
 *
 * Trois niveaux, et les cotes **sautent le 2** — c'est ainsi que la fenêtre
 * l'imprime. Ne pas « normaliser » en 4/3/2 : ce serait inventer une cote que
 * l'ancien logiciel n'attribue jamais.
 *
 * ⚠️ Ce barème est **distinct** de la cote de tour de taille utilisée par
 * l'indice de santé du dos et l'aptitude musculosquelettique, qui vient des
 * tables de composition (fig. 7-4/7-5) et dépend de la bande d'IMC — voir
 * `cpaflaWaistPoints`. Les deux coexistent dans l'ancien logiciel ; les
 * confondre casserait une parité vérifiée sur 6 bilans.
 *
 * La case « Des résultats plus bas indique une amélioration » est cochée.
 */
export interface WaistRatingLegacy {
  /** Cote 0-4 telle qu'imprimée : 4, 3 ou 1. Jamais 2, jamais 0. */
  cote: number
  /** Libellé exact de la fenêtre Propriétés. */
  label: string
}

/** Seuils par sexe : [borne « Excellent », borne « Risque potentiel »] en cm. */
export const WAIST_LEGACY_BOUNDS: Record<'M' | 'F', [number, number]> = {
  M: [94, 102],
  F: [80, 90]
}

export function waistRatingLegacy(
  value: number | null | undefined,
  sex: 'F' | 'M' | null | undefined
): WaistRatingLegacy | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (sex !== 'M' && sex !== 'F') return null
  const [excellent, potentiel] = WAIST_LEGACY_BOUNDS[sex]
  if (value < excellent) return { cote: 4, label: 'Excellent' }
  if (value < potentiel) return { cote: 3, label: 'Risque potentiel' }
  return { cote: 1, label: 'Risque considérable' }
}

/**
 * Catégorie du tour de taille, dérivée de `waistRatingLegacy`.
 *
 * Le barème n'a que **trois** niveaux et saute la cote 2 — il ne peut donc pas
 * passer par la mécanique des percentiles, qui en produit toujours cinq. D'où
 * cette fonction dédiée, appelée avant toute table par les **deux** points
 * d'entrée de la cotation (`getCategorization` et `categorizeRaw`). En oublier
 * un ferait diverger le tableau de bord et le formulaire.
 *
 * Le mapping cote → catégorie est direct : notre échelle est celle de l'ancien
 * logiciel (< 0,5 À améliorer … ≥ 3,5 Excellent), confirmée par capture.
 */
export function waistCategoryLegacy(
  value: number | null | undefined,
  sex: 'F' | 'M' | null | undefined
): Category | null {
  const r = waistRatingLegacy(value, sex)
  if (!r) return null
  if (r.cote === 4) return 'EXCELLENT'
  if (r.cote === 3) return 'TRES_BIEN'
  return 'ACCEPTABLE' // cote 1 — « Risque considérable »
}

export function systolicRatingLegacy(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value < 120 ? 4 : 0
}
