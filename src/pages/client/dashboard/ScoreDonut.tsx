import { CATEGORY_COLORS, CATEGORY_LABELS, type Category } from '../../../lib/norms'

interface ScoreDonutProps {
  /** Score 0-5 (CSEP). `null` = pas de donnée → donut grisé. */
  score: number | null
  /** Catégorie associée — détermine la couleur de l'arc. */
  category: Category | null
  /** Libellé sous le donut (ex: "Score global"). */
  label: string
  /** Score du bilan précédent — pour afficher le delta. */
  previousScore?: number | null
  /** Diamètre en pixels. Par défaut : 200. */
  size?: number
}

const ARC_COLORS: Record<Category, string> = {
  A_AMELIORER: '#ef4444',
  ACCEPTABLE: '#f97316',
  BIEN: '#ca8a04',
  TRES_BIEN: '#22c55e',
  EXCELLENT: '#15803d'
}

export function ScoreDonut({ score, category, label, previousScore, size = 200 }: ScoreDonutProps) {
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = score === null ? 0 : Math.max(0, Math.min(1, score / 5))
  const dash = ratio * circumference
  const color = category ? ARC_COLORS[category] : '#94a3b8'
  const delta = score !== null && typeof previousScore === 'number' ? score - previousScore : null

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${score?.toFixed(1) ?? '—'} sur 5`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5dccb"
            strokeWidth={stroke}
            fill="none"
          />
          {score !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 600ms ease-out, stroke 300ms ease-out' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-marine text-5xl font-bold leading-none">
            {score === null ? <span className="text-marine/30">—</span> : score.toFixed(1)}
          </div>
          <div className="text-marine/45 text-xs mt-1.5 uppercase tracking-wide">/ 5</div>
        </div>
      </div>
      <p className="text-marine/55 text-xs uppercase tracking-wide mt-3">{label}</p>
      {category && (
        <p className={`text-base font-semibold mt-1 ${CATEGORY_COLORS[category]}`}>
          {CATEGORY_LABELS[category]}
        </p>
      )}
      {delta !== null && Math.abs(delta) >= 0.05 && (
        <p className={`text-sm mt-1 font-medium ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} vs précédent
        </p>
      )}
    </div>
  )
}
