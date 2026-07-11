import { bodyFatRiskZones, BF_RISK_HEX, optimalBodyFatMax } from '../lib/body-fat-risk'

/** Courbe de progression du % de gras dans le temps, avec les **zones de risque
 *  en fond** (mêmes couleurs que la barre) et la ligne « Optimal » en pointillé.
 *  Donne la trajectoire du client par rapport aux zones. Rendu vide sous 2 points. */
export function BodyFatTrend({
  series,
  sex,
  className = ''
}: {
  /** Du plus ancien au plus récent. */
  series: { date: string; pct: number }[]
  sex: 'F' | 'M'
  className?: string
}): React.JSX.Element | null {
  if (series.length < 2) return null

  const zones = bodyFatRiskZones(sex)
  const targetBf = optimalBodyFatMax(sex)
  const values = series.map(s => s.pct)

  // Domaine Y : les données + une marge, borné pour rester lisible.
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  let yMin = Math.max(0, Math.floor(dataMin - 4))
  let yMax = Math.ceil(dataMax + 4)
  if (yMax - yMin < 12) {
    const mid = (yMin + yMax) / 2
    yMin = Math.max(0, mid - 6)
    yMax = mid + 6
  }

  const W = 640
  const H = 210
  const L = 30 // gouttière gauche (valeurs %)
  const R = 14
  const T = 12
  const B = 30 // gouttière bas (dates)
  const plotW = W - L - R
  const plotH = H - T - B

  const px = (i: number): number => L + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW)
  const py = (v: number): number => T + (1 - (v - yMin) / (yMax - yMin)) * plotH

  const line = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(s.pct).toFixed(1)}`).join(' ')
  const area = `${line} L ${px(series.length - 1).toFixed(1)} ${(T + plotH).toFixed(1)} L ${px(0).toFixed(1)} ${(T + plotH).toFixed(1)} Z`

  // Bandes de zones intersectées avec le domaine visible.
  const bands = zones
    .map(z => {
      const zTop = z.max ?? yMax
      const top = Math.min(yMax, zTop)
      const bottom = Math.max(yMin, z.min)
      if (top <= bottom) return null
      return { key: z.key, y: py(top), h: py(bottom) - py(top) }
    })
    .filter((b): b is { key: (typeof zones)[number]['key']; y: number; h: number } => b !== null)

  // Bornes internes visibles → étiquettes de gouttière + hairline.
  const bounds = zones.slice(1).map(z => z.min).filter(b => b > yMin && b < yMax)

  // Étiquettes de dates : au plus ~6, réparties.
  const step = Math.ceil(series.length / 6)
  const shortDate = (iso: string): string => {
    const d = new Date(`${iso}T00:00:00`)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-CA', { month: 'short', year: '2-digit' })
  }

  const lastX = px(series.length - 1)
  const lastY = py(values[values.length - 1])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${className}`} style={{ height: 'auto' }} role="img"
      aria-label="Progression du pourcentage de gras dans le temps, avec les zones de risque en fond.">
      {/* Bandes de zones. */}
      {bands.map(b => (
        <rect key={b.key} x={L} y={b.y} width={plotW} height={b.h} fill={BF_RISK_HEX[b.key]} opacity={0.14} />
      ))}

      {/* Bornes de zones : hairline + valeur. */}
      {bounds.map(b => (
        <g key={b}>
          <line x1={L} y1={py(b)} x2={L + plotW} y2={py(b)} stroke="#001331" strokeOpacity={0.12} strokeWidth={0.75} />
          <text x={L - 4} y={py(b) + 3} textAnchor="end" fontSize={9} fill="#001331" fillOpacity={0.4}>{b}</text>
        </g>
      ))}

      {/* Ligne « Optimal ≤ cible » en pointillé. */}
      {targetBf > yMin && targetBf < yMax && (
        <line x1={L} y1={py(targetBf)} x2={L + plotW} y2={py(targetBf)} stroke={BF_RISK_HEX.optimal}
          strokeWidth={1.2} strokeDasharray="4 3" />
      )}

      {/* Aire + ligne. */}
      <path d={area} fill="#001331" fillOpacity={0.05} />
      <path d={line} fill="none" stroke="#001331" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Points ; dernier en or. */}
      {series.map((s, i) => {
        const isLast = i === series.length - 1
        return <circle key={i} cx={px(i)} cy={py(s.pct)} r={isLast ? 4.5 : 3}
          fill={isLast ? '#c9a77a' : '#001331'} stroke="#fff" strokeWidth={isLast ? 1.5 : 1} />
      })}

      {/* Valeur du dernier point. */}
      <text x={lastX} y={lastY - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill="#001331">
        {values[values.length - 1].toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %
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
