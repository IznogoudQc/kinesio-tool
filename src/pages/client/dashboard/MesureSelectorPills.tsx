import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Sparkles, Star } from 'lucide-react'
import { formatBilanDate } from '../bilanFields'

interface UnifiedDate {
  date: string
  hasCirc: boolean
  hasPlis: boolean
}

interface MesureSelectorPillsProps {
  /** Dates unifiées (union circ + plis), triées du plus récent au plus ancien. */
  dates: UnifiedDate[]
  /** `null` ou `'synthesis'` = mode synthèse virtuel. Sinon une date ISO. */
  selectedKey: string | null
  /** Reçoit `null` pour basculer en synthèse, ou une date ISO. */
  onSelect: (key: string | null) => void
  /** Date la plus récente ayant contribué à la synthèse (pour le sous-titre). */
  synthesisLatestDate?: string | null
}

function shortDate(iso: string): { line1: string; line2: string } {
  // Découpe la date FR « 15 juillet 2025 » en deux lignes pour économiser la largeur.
  const formatted = formatBilanDate(iso)
  const m = /^(\d+ \S+) (\d{4})$/.exec(formatted)
  return m ? { line1: m[1], line2: m[2] } : { line1: formatted, line2: '' }
}

/** Point coloré indiquant la présence d'un dataset à une date donnée. */
function DatasetDot({ color, label }: { color: string; label: string }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} aria-label={label} />
}

export function MesureSelectorPills({
  dates,
  selectedKey,
  onSelect,
  synthesisLatestDate
}: MesureSelectorPillsProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const isSynthesisMode = selectedKey === null || selectedKey === 'synthesis'

  // Auto-scroll vers le pill actif si hors viewport (utile après navigation).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [selectedKey])

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const step = el.clientWidth * 0.7
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' })
  }

  const showArrows = dates.length > 6

  return (
    <section className="bg-white border border-cream-dark/30 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <p className="text-marine/55 text-xs uppercase tracking-wide font-medium shrink-0">Mesure affichée</p>
        {showArrows && (
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label="Défiler vers les prises plus récentes"
            className="shrink-0 p-1 rounded-md text-marine/55 hover:text-marine hover:bg-cream/60 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scroll-smooth flex-1 py-1 -my-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          {/* Pill spécial : synthèse virtuelle des dernières valeurs disponibles
              champ par champ. Toujours en première position. */}
          <button
            key="__synthesis__"
            ref={isSynthesisMode ? activeRef : null}
            type="button"
            onClick={() => onSelect(null)}
            title="Mesures synthétisées à partir des valeurs les plus récentes disponibles dans toutes les prises"
            className={[
              'shrink-0 rounded-lg px-3 py-2 text-left transition-all duration-200 border min-w-[105px]',
              isSynthesisMode
                ? 'bg-gradient-to-br from-marine to-marine-light text-cream border-gold shadow-md ring-2 ring-gold/40'
                : 'bg-gold/5 text-marine border-gold/30 hover:border-gold hover:bg-gold/10 hover:shadow-sm hover:-translate-y-0.5'
            ].join(' ')}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <Sparkles
                size={11}
                className={isSynthesisMode ? 'text-gold' : 'text-gold-dark'}
                aria-hidden
              />
              <span
                className={`text-[10px] uppercase tracking-wide font-semibold ${
                  isSynthesisMode ? 'text-gold' : 'text-gold-dark'
                }`}
              >
                synthèse
              </span>
            </div>
            <p
              className={`text-sm font-semibold leading-tight ${
                isSynthesisMode ? 'text-cream' : 'text-marine'
              }`}
            >
              Synthèse
            </p>
            <p
              className={`text-xs leading-tight ${
                isSynthesisMode ? 'text-cream/65' : 'text-marine/55'
              }`}
            >
              {synthesisLatestDate ? `MAJ ${formatBilanDate(synthesisLatestDate)}` : 'Dernières valeurs'}
            </p>
          </button>

          {dates.map((d, i) => {
            const isActive = d.date === selectedKey
            const isLatest = i === 0
            const { line1, line2 } = shortDate(d.date)
            const datasets = [d.hasCirc && 'circonférences', d.hasPlis && 'plis cutanés']
              .filter(Boolean)
              .join(' + ')
            return (
              <button
                key={d.date}
                ref={isActive ? activeRef : null}
                type="button"
                onClick={() => onSelect(d.date)}
                title={`Prise du ${formatBilanDate(d.date)} (${datasets})`}
                className={[
                  'shrink-0 rounded-lg px-3 py-2 text-left transition-all duration-200 border min-w-[105px]',
                  isActive
                    ? 'bg-marine text-cream border-gold shadow-md'
                    : 'bg-cream/40 text-marine border-cream-dark/40 hover:border-gold/50 hover:bg-cream hover:shadow-sm hover:-translate-y-0.5'
                ].join(' ')}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  {isLatest && (
                    <Star
                      size={11}
                      className={isActive ? 'text-gold fill-gold' : 'text-gold-dark fill-gold-dark'}
                      aria-label="Prise la plus récente"
                    />
                  )}
                  <span className={`text-[10px] uppercase tracking-wide font-semibold ${
                    isLatest
                      ? isActive ? 'text-gold' : 'text-gold-dark'
                      : isActive ? 'text-cream/60' : 'text-marine/45'
                  }`}>
                    {isLatest ? 'récent' : `il y a ${i}`}
                  </span>
                </div>
                <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-cream' : 'text-marine'}`}>
                  {line1}
                </p>
                {line2 && (
                  <p className={`text-xs leading-tight ${isActive ? 'text-cream/65' : 'text-marine/55'}`}>
                    {line2}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  {d.hasCirc && <DatasetDot color="bg-marine-light" label="Circonférences" />}
                  {d.hasPlis && <DatasetDot color="bg-gold" label="Plis cutanés" />}
                </div>
              </button>
            )
          })}
        </div>
        {showArrows && (
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label="Défiler vers les prises plus anciennes"
            className="shrink-0 p-1 rounded-md text-marine/55 hover:text-marine hover:bg-cream/60 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </section>
  )
}
