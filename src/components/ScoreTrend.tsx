/** Courbe de progression d'un **score composite 0-4** dans le temps, avec les
 *  cinq zones de catégories en fond (À améliorer → Excellent, rouge → vert) et le
 *  dernier point mis en valeur. Même facture que `BodyFatTrend`. Rendu vide < 2 points. */

interface Band {
  lo: number
  hi: number
  hex: string
}

// Zones de catégories (bornes de `scoreToCategory` : 0,5 / 1,5 / 2,5 / 3,5).
const BANDS: Band[] = [
  { lo: 0, hi: 0.5, hex: '#c0392b' }, // À améliorer
  { lo: 0.5, hi: 1.5, hex: '#d97706' }, // Acceptable
  { lo: 1.5, hi: 2.5, hex: '#caa53a' }, // Bien
  { lo: 2.5, hi: 3.5, hex: '#3f9a63' }, // Très bien
  { lo: 3.5, hi: 4, hex: '#1b7a3f' } // Excellent
]

export function ScoreTrend({
  series,
  ariaLabel = 'Progression du score dans le temps.',
  className = ''
}: {
  /** Du plus ancien au plus récent. Score 0-4. */
  series: { date: string; score: number }[]
  ariaLabel?: string
  className?: string
}): React.JSX.Element | null {
  if (series.length < 2) return null

  const yMin = 0
  const yMax = 4

  const W = 640
  const H = 210
  const L = 26
  const R = 14
  const T = 12
  const B = 30
  const plotW = W - L - R
  const plotH = H - T - B

  const px = (i: number): number => L + (i / (series.length - 1)) * plotW
  const py = (v: number): number => T + (1 - (v - yMin) / (yMax - yMin)) * plotH

  const values = series.map(s => s.score)
  const line = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(s.score).toFixed(1)}`).join(' ')
  const area = `${line} L ${px(series.length - 1).toFixed(1)} ${(T + plotH).toFixed(1)} L ${px(0).toFixed(1)} ${(T + plotH).toFixed(1)} Z`

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
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${className}`} style={{ height: 'auto' }} role="img" aria-label={ariaLabel}>
      {/* Zones de catégories. */}
      {BANDS.map(b => (
        <rect key={b.lo} x={L} y={py(b.hi)} width={plotW} height={py(b.lo) - py(b.hi)} fill={b.hex} opacity={0.14} />
      ))}

      {/* Repères 1 / 2 / 3 (hairline + valeur). */}
      {[1, 2, 3].map(v => (
        <g key={v}>
          <line x1={L} y1={py(v)} x2={L + plotW} y2={py(v)} stroke="#001331" strokeOpacity={0.12} strokeWidth={0.75} />
          <text x={L - 4} y={py(v) + 3} textAnchor="end" fontSize={9} fill="#001331" fillOpacity={0.4}>{v}</text>
        </g>
      ))}

      {/* Aire + ligne. */}
      <path d={area} fill="#001331" fillOpacity={0.05} />
      <path d={line} fill="none" stroke="#001331" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Points ; dernier en or. */}
      {series.map((s, i) => {
        const isLast = i === series.length - 1
        return <circle key={i} cx={px(i)} cy={py(s.score)} r={isLast ? 4.5 : 3}
          fill={isLast ? '#c9a77a' : '#001331'} stroke="#fff" strokeWidth={isLast ? 1.5 : 1} />
      })}

      {/* Valeur du dernier point. */}
      <text x={lastLabelX} y={lastLabelY} textAnchor="middle" fontSize={11} fontWeight={700} fill="#001331">
        {values[values.length - 1].toLocaleString('fr-CA', { maximumFractionDigits: 1 })} / 4
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
