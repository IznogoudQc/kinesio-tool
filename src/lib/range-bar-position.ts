/** Logique pure (sans JSX) du calcul de position pour `<CategoryRangeBar>`.
 *  Séparée pour rester testable avec `node --test` (qui ne charge pas .tsx). */

import type { NormPercentiles } from './norms/types'

/** Position du marqueur (0-100 %) sur l'axe « percentile de performance ».
 *  Pour `lowerIsBetter`, l'axe des valeurs est inversé (low value = high perf). */
export function calculatePosition(
  value: number,
  p: NormPercentiles,
  lowerIsBetter = false
): number {
  if (!Number.isFinite(value)) return 0
  const anchors = [
    { pct: 10, value: p.p10 },
    { pct: 25, value: p.p25 },
    { pct: 50, value: p.p50 },
    { pct: 75, value: p.p75 },
    { pct: 90, value: p.p90 }
  ]
  const perf = (v: number) => (lowerIsBetter ? -v : v)
  const v = perf(value)
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  if (v <= perf(first.value)) {
    const next = anchors[1]
    const slope = (next.pct - first.pct) / (perf(next.value) - perf(first.value))
    return Math.max(0, first.pct + slope * (v - perf(first.value)))
  }
  if (v >= perf(last.value)) {
    const prev = anchors[anchors.length - 2]
    const slope = (last.pct - prev.pct) / (perf(last.value) - perf(prev.value))
    return Math.min(100, last.pct + slope * (v - perf(last.value)))
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    const pa = perf(a.value)
    const pb = perf(b.value)
    if (v >= pa && v <= pb) {
      const slope = (b.pct - a.pct) / (pb - pa)
      return a.pct + slope * (v - pa)
    }
  }
  return 50
}
