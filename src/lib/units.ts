/**
 * Conversion d'unités pour l'affichage/saisie côté UI.
 *
 * Principe : la DB stocke TOUJOURS en métrique (cm, kg). On ne convertit qu'à
 * l'affichage et à la saisie — jamais au stockage — pour éviter les arrondis
 * cumulatifs et les bugs de migration. Les plis cutanés restent en mm partout.
 */

export type LengthUnit = 'cm' | 'in'
export type WeightUnit = 'kg' | 'lb'

// ── Longueur ──────────────────────────────────────────────────────────────────
export function cmToIn(cm: number): number {
  return cm / 2.54
}
export function inToCm(inch: number): number {
  return inch * 2.54
}

// ── Poids ─────────────────────────────────────────────────────────────────────
export function kgToLb(kg: number): number {
  return kg * 2.2046226218
}
export function lbToKg(lb: number): number {
  return lb / 2.2046226218
}

// ── Helpers de formatage selon l'unité préférée du client ────────────────────
export function formatLength(cm: number | null, unit: LengthUnit): string {
  if (cm == null) return '—'
  const value = unit === 'in' ? cmToIn(cm) : cm
  return value.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
}

export function formatWeight(kg: number | null, unit: WeightUnit): string {
  if (kg == null) return '—'
  const value = unit === 'lb' ? kgToLb(kg) : kg
  return value.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
}

// ── Valeur numérique à pré-remplir dans un champ de saisie (métrique → unité) ──
// En unité métrique on renvoie la valeur stockée telle quelle (aucune perte) ;
// en unité impériale on arrondit à 0,1 (la conversion est de toute façon approchée).
export function cmToLengthInput(cm: number, unit: LengthUnit): number {
  if (unit === 'cm') return cm
  return Math.round(cmToIn(cm) * 10) / 10
}

export function kgToWeightInput(kg: number, unit: WeightUnit): number {
  if (unit === 'kg') return kg
  return Math.round(kgToLb(kg) * 10) / 10
}

// ── Conversion INPUT utilisateur → stockage métrique ─────────────────────────
export function lengthInputToCm(input: number, unit: LengthUnit): number {
  return unit === 'in' ? inToCm(input) : input
}

export function weightInputToKg(input: number, unit: WeightUnit): number {
  return unit === 'lb' ? lbToKg(input) : input
}

// ── Libellés courts affichés à l'utilisateur ─────────────────────────────────
export function lengthUnitLabel(unit: LengthUnit): string {
  return unit === 'in' ? 'po' : 'cm'
}
export function weightUnitLabel(unit: WeightUnit): string {
  return unit === 'lb' ? 'lb' : 'kg'
}
