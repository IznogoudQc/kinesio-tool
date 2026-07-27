import type { NormPercentiles } from '../lib/norms'

/** Courbe de progression du VO2max dans le temps, avec les **cinq zones de
 *  catégories en fond** (À améliorer → Excellent, rouge → vert) dérivées des
 *  percentiles ACSM (P10/P25/P50/P75) pour l'âge et le sexe du client. Même
 *  facture que `BodyFatTrend`, mais « plus haut = mieux ». Rendu vide < 2 points. */

interface Zone {
  key: string
  /** Borne basse et haute en VO2max (ml/kg/min) ; null = ±infini. */
  lo: number | null
  hi: number | null
  hex: string
}

export function Vo2maxTrend({
  series,
  percentiles,
  className = ''
}: {
  /** Du plus ancien au plus récent. */
  series: { date: string; vo2max: number }[]
  /** Seuils de catégories (âge/sexe). Absent → courbe sans zones. */
  percentiles?: NormPercentiles | null
  className?: string
}): React.JSX.Element | null {
  if (series.length < 2) return null

  const values = series.map(s => s.vo2max)

  // Domaine Y : données + marge, borné pour rester lisible.
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  let yMin = Math.max(0, Math.floor(dataMin - 4))
  let yMax = Math.ceil(dataMax + 4)
  if (yMax - yMin < 12) {
    const mid = (yMin + yMax) / 2
    yMin = Math.max(0, mid - 6)
    yMax = mid + 6
  }

  const p = percentiles ?? null
  const zones: Zone[] = p
    ? [
        { key: 'A_AMELIORER', lo: null, hi: p.p10, hex: '#c0392b' },
        { key: 'ACCEPTABLE', lo: p.p10, hi: p.p25, hex: '#d97706' },
        { key: 'BIEN', lo: p.p25, hi: p.p50, hex: '#caa53a' },
        { key: 'TRES_BIEN', lo: p.p50, hi: p.p75, hex: '#3f9a63' },
        { key: 'EXCELLENT', lo: p.p75, hi: null, hex: '#1b7a3f' }
      ]
    : []

  const W = 640
  const H = 210
  const L = 30 // gouttière gauche (valeurs)
  const R = 14
  const T = 12
  const B = 30 // gouttière bas (dates)
  const plotW = W - L - R
  const plotH = H - T - B

  const px = (i: number): number => L + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW)
  const py = (v: number): number => T + (1 - (v - yMin) / (yMax - yMin)) * plotH

  const line = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(s.vo2max).toFixed(1)}`).join(' ')
  const area = `${line} L ${px(series.length - 1).toFixed(1)} ${(T + plotH).toFixed(1)} L ${px(0).toFixed(1)} ${(T + plotH).toFixed(1)} Z`

  // Bandes de zones intersectées avec le domaine visible.
  const bands = zones
    .map(z => {
      const top = Math.min(yMax, z.hi ?? yMax)
      const bottom = Math.max(yMin, z.lo ?? yMin)
      if (top <= bottom) return null
      return { key: z.key, y: py(top), h: py(bottom) - py(top), hex: z.hex }
    })
    .filter((b): b is { key: string; y: number; h: number; hex: string } => b !== null)

  // Bornes internes visibles → étiquettes de gouttière + hairline.
  const bounds = p
    ? [p.p10, p.p25, p.p50, p.p75].filter(b => b > yMin && b < yMax)
    : []

  // Étiquettes de dates : au plus ~6, réparties.
  const step = Math.ceil(series.length / 6)
  const shortDate = (iso: string): string => {
    const d = new Date(`${iso}T00:00:00`)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-CA', { month: 'short', year: '2-digit' })
  }

  const lastX = px(series.length - 1)
  const lastY = py(values[values.length - 1])
  // Étiquette du dernier point : bornée à droite (le point touche le bord) et
  // basculée sous le point s'il est collé en haut (sinon le texte sort du viewBox).
  const lastLabelX = Math.min(lastX, W - 24)
  const lastLabelAbove = lastY - 20 >= 0
  const lastLabelY = lastLabelAbove ? lastY - 9 : lastY + 20

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${className}`} style={{ height: 'auto' }} role="img"
      aria-label="Progression du VO2max dans le temps, avec les zones de catégories en fond.">
      {/* Bandes de zones. */}
      {bands.map(b => (
        <rect key={b.key} x={L} y={b.y} width={plotW} height={b.h} fill={b.hex} opacity={0.14} />
      ))}

      {/* Bornes de zones : hairline + valeur. */}
      {bounds.map(b => (
        <g key={b}>
          <line x1={L} y1={py(b)} x2={L + plotW} y2={py(b)} stroke="#001331" strokeOpacity={0.12} strokeWidth={0.75} />
          <text x={L - 4} y={py(b) + 3} textAnchor="end" fontSize={9} fill="#001331" fillOpacity={0.4}>
            {b.toLocaleString('fr-CA', { maximumFractionDigits: 0 })}
          </text>
        </g>
      ))}

      {/* Aire + ligne. */}
      <path d={area} fill="#001331" fillOpacity={0.05} />
      <path d={line} fill="none" stroke="#001331" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Points ; dernier en or. */}
      {series.map((s, i) => {
        const isLast = i === series.length - 1
        return <circle key={i} cx={px(i)} cy={py(s.vo2max)} r={isLast ? 4.5 : 3}
          fill={isLast ? '#c9a77a' : '#001331'} stroke="#fff" strokeWidth={isLast ? 1.5 : 1} />
      })}

      {/* Valeur du dernier point. */}
      <text x={lastLabelX} y={lastLabelY} textAnchor="middle" fontSize={11} fontWeight={700} fill="#001331">
        {values[values.length - 1].toLocaleString('fr-CA', { maximumFractionDigits: 1 })}
      </text>

      {/* Dates. */}
      {series.map((s, i) => (i % step === 0 || i === series.length - 1) ? (
        <text key={i} x={px(i)} y={H - 10} textAnchor="middle" fontSize={9} fill="#001331" fillOpacity={0.45}>
          {shortDate(s.date)}
        </text>
      ) : null)}
    </svg>
  )
}
