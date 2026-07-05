/**
 * « Âge en forme » — traduit le VO2max en âge physiologique : l'âge auquel le
 * VO2max mesuré correspond à la médiane de la population du même sexe.
 *
 * Logique pure (sans JSX), testable avec `node --test`.
 *
 * ⚠️ On utilise une courbe de référence VO2max→âge **dédiée, lissée et monotone**
 * (médianes de population approximatives), et NON les tables de catégorisation
 * ACSM `src/lib/norms/acsm.ts` : certaines tranches y sont recalibrées localement
 * (cf. ADR 0006) et ne sont pas monotones en âge, ce qui rendrait l'inversion
 * incohérente. Les valeurs ci-dessous sont indicatives, cohérentes avec les
 * normes usuelles de VO2max par âge.
 */

/** Médiane de VO2max (ml/kg/min) par âge, décroissante, par sexe. */
const MEDIAN_VO2MAX: Record<'M' | 'F', { age: number; vo2: number }[]> = {
  M: [
    { age: 20, vo2: 48 },
    { age: 30, vo2: 45 },
    { age: 40, vo2: 41 },
    { age: 50, vo2: 37 },
    { age: 60, vo2: 33 },
    { age: 70, vo2: 29 },
    { age: 80, vo2: 26 }
  ],
  F: [
    { age: 20, vo2: 42 },
    { age: 30, vo2: 39 },
    { age: 40, vo2: 35 },
    { age: 50, vo2: 31 },
    { age: 60, vo2: 28 },
    { age: 70, vo2: 25 },
    { age: 80, vo2: 22 }
  ]
}

/**
 * Âge physiologique estimé à partir du VO2max. Interpolation linéaire sur la
 * courbe médiane, bornée à [20, 80]. `null` si VO2max ou sexe manquent.
 *  - VO2max ≥ médiane à 20 ans → 20 (plancher).
 *  - VO2max ≤ médiane à 80 ans → 80 (plafond).
 */
export function fitnessAge(
  vo2max: number | null | undefined,
  sex: 'M' | 'F' | null | undefined
): number | null {
  if (!Number.isFinite(vo2max ?? NaN) || (sex !== 'M' && sex !== 'F')) return null
  const v = vo2max as number
  const curve = MEDIAN_VO2MAX[sex]
  const first = curve[0]
  const last = curve[curve.length - 1]
  if (v >= first.vo2) return first.age
  if (v <= last.vo2) return last.age
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i]
    const b = curve[i + 1] // a.vo2 > b.vo2
    if (v <= a.vo2 && v >= b.vo2) {
      const t = (a.vo2 - v) / (a.vo2 - b.vo2)
      return Math.round(a.age + t * (b.age - a.age))
    }
  }
  return null
}
