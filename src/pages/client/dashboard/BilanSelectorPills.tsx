import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Sparkles, Star } from 'lucide-react'
import { countFilledFields, formatBilanDate } from '../bilanFields'

interface BilanSelectorPillsProps {
  /** Liste triée du plus récent au plus ancien. */
  bilans: Bilan[]
  /** `null` ou `'synthesis'` = mode synthèse virtuel. Sinon ID d'un bilan. */
  selectedId: string | null
  /** Reçoit `null` pour basculer en mode synthèse, ou un ID de bilan. */
  onSelect: (id: string | null) => void
  /** Date la plus récente ayant contribué au mode synthèse (pour le sous-titre). */
  synthesisLatestDate?: string | null
}

/** Seuil sous lequel un bilan est jugé « partiel » (champs renseignés). */
const PARTIAL_THRESHOLD = 10

function shortDate(iso: string): { line1: string; line2: string } {
  // Découpe la date FR « 4 septembre 2025 » en deux lignes pour économiser la largeur.
  const formatted = formatBilanDate(iso)
  const m = /^(\d+ \S+) (\d{4})$/.exec(formatted)
  return m ? { line1: m[1], line2: m[2] } : { line1: formatted, line2: '' }
}

export function BilanSelectorPills({
  bilans,
  selectedId,
  onSelect,
  synthesisLatestDate
}: BilanSelectorPillsProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const isSynthesisMode = selectedId === null || selectedId === 'synthesis'

  // Auto-scroll vers le pill actif si hors viewport (utile après navigation).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [selectedId])

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const step = el.clientWidth * 0.7
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' })
  }

  const showArrows = bilans.length > 6

  return (
    <section className="bg-white border border-cream-dark/30 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <p className="text-marine/55 text-xs uppercase tracking-wide font-medium shrink-0">Bilan affiché</p>
        {showArrows && (
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label="Défiler vers les bilans plus récents"
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
          {/* Pill spécial : bilan virtuel construit à partir des derniers
              champs non-null disponibles. Toujours en première position. */}
          <button
            key="__synthesis__"
            ref={isSynthesisMode ? activeRef : null}
            type="button"
            onClick={() => onSelect(null)}
            title="Bilan synthétisé à partir des valeurs les plus récentes disponibles dans tous les bilans"
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
                à jour
              </span>
            </div>
            <p
              className={`text-sm font-semibold leading-tight ${
                isSynthesisMode ? 'text-cream' : 'text-marine'
              }`}
            >
              Dernières valeurs
            </p>
            <p
              className={`text-xs leading-tight ${
                isSynthesisMode ? 'text-cream/65' : 'text-marine/55'
              }`}
            >
              {synthesisLatestDate
                ? `MAJ ${formatBilanDate(synthesisLatestDate).replace(/^(\d+) /, '$1 ')}`
                : 'de tous vos bilans'}
            </p>
          </button>

          {bilans.map((b, i) => {
            const isActive = b.id === selectedId
            const isLatest = i === 0
            const filled = countFilledFields(b.data)
            const isPartial = filled < PARTIAL_THRESHOLD
            const { line1, line2 } = shortDate(b.date)
            return (
              <button
                key={b.id}
                ref={isActive ? activeRef : null}
                type="button"
                onClick={() => onSelect(b.id)}
                title={`Bilan du ${formatBilanDate(b.date)} (${filled} champs renseignés)`}
                className={[
                  'shrink-0 rounded-lg px-3 py-2 text-left transition-all duration-200 border min-w-[105px]',
                  isActive
                    ? 'bg-marine text-cream border-gold shadow-md'
                    : 'bg-cream/40 text-marine border-cream-dark/40 hover:border-gold/50 hover:bg-cream hover:shadow-sm hover:-translate-y-0.5',
                  isPartial && !isActive ? 'opacity-70' : ''
                ].join(' ')}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  {isLatest && (
                    <Star
                      size={11}
                      className={isActive ? 'text-gold fill-gold' : 'text-gold-dark fill-gold-dark'}
                      aria-label="Bilan le plus récent"
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
                {isPartial && (
                  <span className={`inline-block mt-1 text-[9px] uppercase tracking-wide font-semibold ${
                    isActive ? 'text-cream/70' : 'text-marine/50'
                  }`}>
                    partiel
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {showArrows && (
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label="Défiler vers les bilans plus anciens"
            className="shrink-0 p-1 rounded-md text-marine/55 hover:text-marine hover:bg-cream/60 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </section>
  )
}
