import { CategoryBadge } from '../../../components/CategoryBadge'
import type { CompositeScore } from '../../../lib/bilan-computed'
import { useCountUp } from '../../../lib/useCountUp'

interface CompositeMiniCardProps {
  title: string
  subtitle?: string
  current: CompositeScore
  previous?: CompositeScore | null
  /** Si fourni, la carte devient un bouton qui fait défiler jusqu'à cet élément. */
  targetId?: string
}

/** Fait défiler en douceur jusqu'à une section du Dashboard (respecte le
 *  réglage « réduire les animations »). */
function scrollToId(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

const GAUGE_LEVELS = 4

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

export function CompositeMiniCard({ title, subtitle, current, previous, targetId }: CompositeMiniCardProps) {
  const animScore = useCountUp(current.score)
  const delta =
    current.score !== null && previous && previous.score !== null
      ? current.score - previous.score
      : null

  const clickable = !!targetId
  const Tag = clickable ? 'button' : 'div'

  return (
    <Tag
      {...(clickable
        ? { type: 'button' as const, onClick: () => scrollToId(targetId as string) }
        : {})}
      className={`group block w-full text-left bg-white border border-cream-dark/30 rounded-xl p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${clickable ? 'cursor-pointer hover:border-gold/50' : ''}`}
    >
      <p className="dash-eyebrow text-gold-dark flex items-center gap-1.5">
        {title}
        {clickable && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-marine/20 transition-transform duration-200 group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        )}
      </p>
      {subtitle && <p className="text-marine/35 text-[10px] mt-0.5">{subtitle}</p>}
      <p className={current.score === null ? 'dash-display text-marine/25 text-3xl font-bold mt-1.5' : 'dash-display text-marine text-3xl font-bold mt-1.5 tabular-nums'}>
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
    </Tag>
  )
}
