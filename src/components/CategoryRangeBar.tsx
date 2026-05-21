import type { NormPercentiles } from '../lib/norms'
import { calculatePosition } from '../lib/range-bar-position'

export { calculatePosition }

interface CategoryRangeBarProps {
  /** Valeur actuelle du client. `null`/`undefined` → barre sans marqueur. */
  value: number | null | undefined
  /** Percentiles P10/P25/P50/P75/P90 (issus de `NormRange`). */
  percentiles: NormPercentiles
  /** Unité affichée au-dessus du marqueur (ex: `ml/kg/min`, `%`, `reps`). */
  unit?: string
  /** Tranche d'âge / population à afficher en haut à droite (ex: `Hommes 40-49 ans`). */
  ageRange?: string
  /** Pour `% gras`, IMC, tour de taille, FC repos : baisse = amélioration. */
  lowerIsBetter?: boolean
  /** `full` (par défaut) avec labels + seuils. `compact` pour cards denses. */
  variant?: 'compact' | 'full'
  /** Étiquette sous le marqueur (par défaut « TOI »). */
  markerLabel?: string
}

interface SegmentSpec {
  label: string
  fromPct: number
  toPct: number
  bg: string
  /** Couleur du texte sur le segment (pour contraste). */
  text: string
}

/** Segments worst → best (gauche → droite). Pour `lowerIsBetter`, seul l'axe
 *  des valeurs s'inverse — la position est exprimée en *percentile de
 *  performance* (0 = pire 10 %, 100 = meilleur 10 %), donc red→green from left
 *  reste l'orientation correcte dans les deux cas. */
const SEGMENTS: SegmentSpec[] = [
  { label: 'À améliorer', fromPct: 0, toPct: 20, bg: '#E24B4A', text: '#ffffff' },
  { label: 'Acceptable', fromPct: 20, toPct: 40, bg: '#EF9F27', text: '#ffffff' },
  { label: 'Bien', fromPct: 40, toPct: 60, bg: '#FAC775', text: '#0a1c5e' },
  { label: 'Très bien', fromPct: 60, toPct: 80, bg: '#97C459', text: '#0a1c5e' },
  { label: 'Excellent', fromPct: 80, toPct: 100, bg: '#3B6D11', text: '#ffffff' }
]

export function CategoryRangeBar({
  value,
  percentiles,
  unit,
  ageRange,
  lowerIsBetter = false,
  variant = 'full',
  markerLabel = 'TOI'
}: CategoryRangeBarProps) {
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  const position = hasValue ? calculatePosition(value as number, percentiles, lowerIsBetter) : null
  const isCompact = variant === 'compact'

  // Les seuils numériques sous la barre (aux jonctions P10, P25, P50, P75).
  const thresholdMarks = [
    { pct: 20, val: percentiles.p10 },
    { pct: 40, val: percentiles.p25 },
    { pct: 60, val: percentiles.p50 },
    { pct: 80, val: percentiles.p75 }
  ]

  const barHeight = isCompact ? 'h-2.5' : 'h-7'
  const containerSpacing = isCompact ? '' : 'pt-6 pb-8'

  return (
    <div className={`w-full ${containerSpacing}`}>
      {ageRange && !isCompact && (
        <div className="flex justify-end mb-1">
          <span className="text-marine/55 text-xs">{ageRange}</span>
        </div>
      )}

      <div className="relative">
        {/* Marqueur de position — au-dessus de la barre */}
        {position !== null && !isCompact && (
          <div
            className="absolute -top-7 transition-all duration-500 ease-out"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            <div className="flex flex-col items-center">
              <span className="text-marine text-sm font-bold tabular-nums leading-none">
                {value}
                {unit && <span className="text-marine/55 text-xs font-medium ml-0.5">{unit}</span>}
              </span>
              <span className="text-marine text-xs leading-none mt-0.5">▼</span>
            </div>
          </div>
        )}

        {/* La barre — 5 segments colorés flex-1 */}
        <div className={`flex ${barHeight} rounded-md overflow-hidden`} role="presentation">
          {SEGMENTS.map(seg => (
            <div
              key={seg.label}
              className="flex-1 flex items-center justify-center"
              style={{ backgroundColor: seg.bg }}
              title={seg.label}
            >
              {!isCompact && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide truncate px-1"
                  style={{ color: seg.text }}
                >
                  {seg.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Marqueur compact — un triangle pointu sous la barre */}
        {position !== null && isCompact && (
          <div
            className="absolute -bottom-1.5 transition-all duration-500 ease-out"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-marine text-xs leading-none">▲</span>
          </div>
        )}

        {/* Seuils numériques sous la barre (variant full) */}
        {!isCompact && (
          <div className="relative h-5 mt-1">
            {thresholdMarks.map(t => (
              <span
                key={t.pct}
                className="absolute text-marine/55 text-[11px] tabular-nums"
                style={{ left: `${t.pct}%`, transform: 'translateX(-50%)' }}
              >
                {t.val}
              </span>
            ))}
          </div>
        )}

        {/* Étiquette « TOI » sous le marqueur (variant full) */}
        {position !== null && !isCompact && (
          <div
            className="absolute -bottom-6 transition-all duration-500 ease-out"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-marine/70 text-[10px] uppercase tracking-wide font-semibold">
              {markerLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
