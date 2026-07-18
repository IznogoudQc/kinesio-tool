import { CategoryBadge } from './CategoryBadge'
import type { BilanComputed, CompositeScore } from '../lib/bilan-computed'

interface BilanSynthesisCardsProps {
  /** Synthèse du bilan en cours. */
  computed: Pick<BilanComputed, 'composition' | 'bodyFat' | 'aerobic' | 'backHealth' | 'musculoGlobal' | 'overall'>
  /** Synthèse du bilan précédent — pour les indicateurs ▲▼. Si absent, pas de comparaison. */
  previous?: Pick<BilanComputed, 'composition' | 'bodyFat' | 'aerobic' | 'backHealth' | 'musculoGlobal' | 'overall'>
  /** Variante de fond — `light` (modal) ou `marine` (dashboard). */
  variant?: 'light' | 'marine'
  /** Message à afficher quand AUCUN score n'est calculable (saisie vierge). */
  emptyHint?: string
}

interface CardSpec {
  title: string
  subtitle: string
  current: CompositeScore
  previous: CompositeScore | null
}

const GAUGE_LEVELS = 4

function Gauge({ score, variant }: { score: number | null; variant: 'light' | 'marine' }) {
  const filled = score === null ? 0 : Math.min(GAUGE_LEVELS, Math.max(0, Math.round(score)))
  const filledClass = variant === 'light' ? 'bg-gold' : 'bg-gold'
  const emptyClass = variant === 'light' ? 'bg-cream-dark' : 'bg-marine-light/40'
  return (
    <div className="flex items-center gap-1 mt-1.5" role="meter" aria-label={`Score ${score?.toFixed(1) ?? '—'} sur 4`}>
      {Array.from({ length: GAUGE_LEVELS }).map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i < filled ? filledClass : emptyClass}`}
        />
      ))}
    </div>
  )
}

function DeltaArrow({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.05) {
    return <span className="text-xs text-marine/40">= stable</span>
  }
  const improved = diff > 0
  const arrow = improved ? '▲' : '▼'
  const color = improved ? 'text-green-600' : 'text-red-500'
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {arrow} {Math.abs(diff).toFixed(1)}
    </span>
  )
}

export function BilanSynthesisCards({
  computed,
  previous,
  variant = 'light',
  emptyHint
}: BilanSynthesisCardsProps) {
  const cards: CardSpec[] = [
    {
      title: 'Composition corporelle',
      subtitle: 'IMC + % gras + tour de taille',
      current: computed.composition,
      previous: previous?.composition ?? null
    },
    {
      title: '% gras corporel',
      subtitle: 'Composition fine',
      current: computed.bodyFat,
      previous: previous?.bodyFat ?? null
    },
    { title: 'Aérobie', subtitle: 'VO2max', current: computed.aerobic, previous: previous?.aerobic ?? null },
    {
      title: 'Indice santé du dos',
      subtitle: 'Flexion + endurance + sit-ups',
      current: computed.backHealth,
      previous: previous?.backHealth ?? null
    },
    {
      title: 'Musculo global',
      subtitle: '6 tests musculo',
      current: computed.musculoGlobal,
      previous: previous?.musculoGlobal ?? null
    }
  ]

  const allEmpty = cards.every(c => c.current.score === null) && computed.overall.score === null

  const isLight = variant === 'light'
  const cardClass = isLight
    ? 'bg-white border border-cream-dark rounded-lg p-4 transition-all duration-300'
    : 'bg-marine-light/60 border border-gold/20 rounded-lg p-4 transition-all duration-300'
  const titleClass = isLight ? 'text-marine font-medium text-sm' : 'text-cream font-medium text-sm'
  const subtitleClass = isLight ? 'text-marine/45 text-xs mt-0.5' : 'text-cream/45 text-xs mt-0.5'
  const valueClass = isLight ? 'text-marine font-bold text-3xl text-center' : 'text-cream font-bold text-3xl text-center'
  const muted = isLight ? 'text-marine/30 text-3xl text-center' : 'text-cream/30 text-3xl text-center'
  const emptyClass = isLight ? 'text-marine/45 text-sm' : 'text-cream/45 text-sm'

  if (allEmpty && emptyHint) {
    return (
      <div className={isLight ? 'bg-white border border-dashed border-cream-dark rounded-lg p-5 text-center' : 'bg-marine-light/40 border border-dashed border-gold/30 rounded-lg p-5 text-center'}>
        <p className={emptyClass}>{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.title} className={cardClass}>
            <p className={titleClass}>{c.title}</p>
            <p className={subtitleClass}>{c.subtitle}</p>
            <p className={c.current.score === null ? muted : valueClass}>
              {c.current.score === null ? '—' : c.current.score.toFixed(1)}
            </p>
            <div className="flex justify-center">
              <Gauge score={c.current.score} variant={variant} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <CategoryBadge
                category={c.current.category}
                variant="compact"
                emptyClassName={isLight ? 'text-marine/30 text-xs' : 'text-cream/30 text-xs'}
              />
              <DeltaArrow current={c.current.score} previous={c.previous?.score ?? null} />
            </div>
          </div>
        ))}
      </div>

      <div
        className={
          isLight
            ? 'bg-gold/10 border border-gold/40 rounded-lg p-4 flex items-center justify-between gap-4'
            : 'bg-gold/15 border border-gold/40 rounded-lg p-4 flex items-center justify-between gap-4'
        }
      >
        <div>
          <p className={titleClass}>Santé et condition physique globale</p>
          <p className={subtitleClass}>Moyenne pondérée — composition / aérobie / dos / musculo</p>
        </div>
        <div className="text-right">
          <p className={computed.overall.score === null ? muted : valueClass}>
            {computed.overall.score === null ? '—' : `${computed.overall.score.toFixed(1)} / 4`}
          </p>
          <div className="flex items-center justify-end gap-3 mt-1">
            <CategoryBadge
              category={computed.overall.category}
              emptyClassName={isLight ? 'text-marine/30 text-xs' : 'text-cream/30 text-xs'}
            />
            <DeltaArrow current={computed.overall.score} previous={previous?.overall.score ?? null} />
          </div>
        </div>
      </div>
    </div>
  )
}
