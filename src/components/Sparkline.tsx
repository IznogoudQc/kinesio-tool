/** Mini-courbe d'historique, en SVG pur (pas de recharts : 4 points, aucun axe).
 *  Les `null` sont ignorés ; le dernier point est marqué. Rendu vide sous 2 points. */
export function Sparkline({
  values,
  lowerIsBetter = false,
  className = ''
}: {
  /** Valeurs du plus ancien au plus récent. Les trous (`null`) sont sautés. */
  values: (number | null)[]
  /** Colore la tendance : baisse = amélioration pour % gras, IMC, tour de taille. */
  lowerIsBetter?: boolean
  className?: string
}): React.JSX.Element | null {
  const points = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null)
  if (points.length < 2) return null

  const W = 100
  const H = 24
  const PAD = 2
  const xs = points.map(p => p.i)
  const ys = points.map(p => p.v)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX || 1
  // Série plate : on la centre au lieu de diviser par zéro.
  const spanY = maxY - minY || 1

  const px = (i: number): number => PAD + ((i - minX) / spanX) * (W - 2 * PAD)
  const py = (v: number): number =>
    maxY === minY ? H / 2 : H - PAD - ((v - minY) / spanY) * (H - 2 * PAD)

  const d = points.map((p, k) => `${k === 0 ? 'M' : 'L'} ${px(p.i).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' ')

  const first = points[0].v
  const last = points[points.length - 1].v
  const improved = lowerIsBetter ? last < first : last > first
  const flat = Math.abs(last - first) < 1e-9
  const stroke = flat ? '#94a3b8' : improved ? '#16a34a' : '#ef4444'

  const lastX = px(points[points.length - 1].i)
  const lastY = py(last)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`w-full h-6 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Point final : une marque à trait non-scalé — un <circle> deviendrait une
          ellipse à cause de preserveAspectRatio="none". */}
      <line
        x1={lastX}
        y1={lastY}
        x2={lastX}
        y2={lastY}
        stroke={stroke}
        strokeWidth={4.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
