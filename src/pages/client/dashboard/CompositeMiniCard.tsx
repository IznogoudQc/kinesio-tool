import { CategoryBadge } from '../../../components/CategoryBadge'
import type { CompositeScore } from '../../../lib/bilan-computed'
import { useCountUp } from '../../../lib/useCountUp'

interface CompositeMiniCardProps {
  title: string
  subtitle?: string
  current: CompositeScore
  previous?: CompositeScore | null
}

const GAUGE_LEVELS = 5

function Gauge({ score }: { score: number | null }) {
  const filled = score === null ? 0 : Math.min(GAUGE_LEVELS, Math.max(0, Math.round(score)))
  return (
    <div className="flex items-center gap-1 mt-1.5">
      {Array.from({ length: GAUGE_LEVELS }).map((_, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < filled ? 'bg-gold' : 'bg-cream-dark'}`} />
      ))}
    </div>
  )
}

export function CompositeMiniCard({ title, subtitle, current, previous }: CompositeMiniCardProps) {
  const animScore = useCountUp(current.score)
  const delta =
    current.score !== null && previous && previous.score !== null
      ? current.score - previous.score
      : null

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 shadow-sm">
      <p className="text-marine/55 text-xs uppercase tracking-wide font-medium">{title}</p>
      {subtitle && <p className="text-marine/35 text-[10px] mt-0.5">{subtitle}</p>}
      <p className={current.score === null ? 'text-marine/25 text-3xl font-bold mt-1' : 'text-marine text-3xl font-bold mt-1 tabular-nums'}>
        {current.score === null ? '—' : (animScore ?? current.score).toFixed(1)}
      </p>
      <Gauge score={current.score} />
      <div className="flex items-center justify-between mt-1.5">
        <CategoryBadge category={current.category} variant="compact" />
        {delta !== null && Math.abs(delta) >= 0.05 && (
          <span className={`text-[11px] font-semibold ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}
