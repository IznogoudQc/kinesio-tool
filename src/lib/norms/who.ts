/** Risque cardio-métabolique sur 3 niveaux — tour de taille, ratio T/H.
 *
 *  Volontairement séparé des tables ACSM de catégorisation fitness (cf.
 *  `acsm.ts`) : les normes ACSM mappent une performance sur 5 catégories
 *  (À améliorer → Excellent), là où ces seuils mappent un risque sur 3 niveaux
 *  selon le sexe.
 *
 *  ⚠️ Le tour de taille suit les normes de **Statistique Canada** (variable
 *  dérivée HWMDWSTA), dont les bornes sont importées de `clinical.ts` plutôt
 *  que recopiées. Seul le **ratio taille/hanche** reste sur les seuils OMS,
 *  avec ses propres libellés.
 *
 *  Sources :
 *   - WHO, Waist circumference and waist-hip ratio: report of a WHO expert
 *     consultation (2008).
 *   - Santé Canada, Risque pour la santé en fonction du tour de taille.
 */

import { WAIST_BOUNDS } from './clinical.ts'

export type WhoRiskLevel = 'low' | 'high' | 'very_high'

export const WHO_RISK_LABELS: Record<WhoRiskLevel, string> = {
  low: 'Faible',
  high: 'Élevé',
  very_high: 'Très élevé'
}

/** Couleurs pour la barre de risque. Vert / jaune / rouge — sans nuance. */
export const WHO_RISK_COLORS: Record<WhoRiskLevel, { bg: string; text: string }> = {
  low: { bg: '#97C459', text: '#0a1c5e' },
  high: { bg: '#FAC775', text: '#0a1c5e' },
  very_high: { bg: '#E24B4A', text: '#ffffff' }
}

interface RiskThresholds {
  /** Borne supérieure du risque faible (exclu = passe à high). */
  low: number
  /** Borne supérieure du risque élevé (exclu = passe à very_high). */
  high: number
  /** Borne supérieure utile pour l'échelle visuelle (cap de la barre). */
  scaleMax: number
}

/**
 * Tour de taille : bornes importées de `WAIST_BOUNDS` (Statistique Canada),
 * jamais recopiées — ce barème a déjà existé en quatre exemplaires divergents
 * dans le projet.
 *
 * Les trois niveaux (cotes 4 / 3 / 1) tombent exactement sur les trois segments
 * de la barre : rien à adapter côté visuel.
 */
const WAIST_M: RiskThresholds = {
  low: WAIST_BOUNDS.M[0],
  high: WAIST_BOUNDS.M[1],
  scaleMax: 120
}
const WAIST_F: RiskThresholds = {
  low: WAIST_BOUNDS.F[0],
  high: WAIST_BOUNDS.F[1],
  scaleMax: 110
}

/** Libellés du tour de taille. Le ratio taille/hanche garde les siens (OMS). */
export const WAIST_RISK_LABELS: Record<WhoRiskLevel, string> = {
  low: 'Excellent',
  high: 'Risque potentiel',
  very_high: 'Risque considérable'
}

// Pas de source affichée sous la barre du tour de taille : le libellé se
// suffit, et l'origine du barème est documentée dans `clinical.ts` et dans le
// PDF des barèmes — pas dans l'interface.

// Ratio taille/hanche : inchangé, seuils OMS.
const RATIO_M: RiskThresholds = { low: 0.9, high: 1.0, scaleMax: 1.15 }
const RATIO_F: RiskThresholds = { low: 0.8, high: 0.85, scaleMax: 1.0 }

/**
 * ⚠️ `high` est **inclusive** pour le tour de taille : 101 cm chez l'homme reste
 * « Risque potentiel ». Le ratio T/H y gagne aussi une borne inclusive — sans
 * effet pratique, ses seuils étant des décimales que personne n'atteint pile.
 */
function classifyByThresholds(value: number, t: RiskThresholds): WhoRiskLevel {
  if (value < t.low) return 'low'
  if (value <= t.high) return 'high'
  return 'very_high'
}

/** Risque cardio-métabolique selon le tour de taille (cm). */
export function getWaistRisk(
  value: number,
  sex: 'F' | 'M'
): { level: WhoRiskLevel; thresholds: RiskThresholds } | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const thresholds = sex === 'M' ? WAIST_M : WAIST_F
  return { level: classifyByThresholds(value, thresholds), thresholds }
}

/** Risque cardio-métabolique selon le ratio taille / hanche. */
export function getRatioRisk(
  value: number,
  sex: 'F' | 'M'
): { level: WhoRiskLevel; thresholds: RiskThresholds } | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const thresholds = sex === 'M' ? RATIO_M : RATIO_F
  return { level: classifyByThresholds(value, thresholds), thresholds }
}

/** Position 0-100 % du marqueur sur une barre 3-segments. Segments occupent
 *  chacun 33.33 % de la largeur visuelle. Position basée sur la valeur dans
 *  son segment, clampée. */
export function calculateRiskBarPosition(value: number, t: RiskThresholds): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value < t.low) {
    // Segment 1 : 0 → low. On linéarise sur [0, low] mais on évite la collusion à 0.
    // L'origine pratique est `low * 0.5` (point « santé idéale »).
    const start = t.low * 0.5
    if (value <= start) return Math.max(0, (value / start) * 5)
    return 5 + ((value - start) / (t.low - start)) * 28.33
  }
  if (value < t.high) {
    return 33.33 + ((value - t.low) / (t.high - t.low)) * 33.33
  }
  // Segment 3 : high → scaleMax (clampé à 100 %).
  return Math.min(100, 66.66 + ((value - t.high) / (t.scaleMax - t.high)) * 33.34)
}
