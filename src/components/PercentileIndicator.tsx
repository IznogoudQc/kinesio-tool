import { getDeltaVsAverage, getPercentile, getPopulationAverage, type NormsType, type TestKey } from '../lib/norms'

interface PercentileIndicatorProps {
  test: TestKey
  value: number | null | undefined
  age: number | null
  sex: 'F' | 'M' | null
  norms: NormsType
  /** Bracket d'âge affiché dans le texte (ex: "45-54"). Calculé si absent. */
  bracketLabel?: string
  variant?: 'light' | 'marine'
  /** Affichage compact (sans mini-barre) pour les hero stats. */
  compact?: boolean
}

function suffixe(n: number): string {
  const r = Math.round(n)
  return r === 1 ? 'er' : 'e'
}

function bracketFor(age: number): string {
  const low = Math.floor(age / 10) * 10
  const high = low + 9
  return `${low}-${high}`
}

export function PercentileIndicator({
  test,
  value,
  age,
  sex,
  norms,
  bracketLabel,
  variant = 'light',
  compact = false
}: PercentileIndicatorProps) {
  if (typeof value !== 'number' || Number.isNaN(value) || age === null || sex === null) return null

  const percentile = getPercentile(test, value, age, sex, norms)
  const delta = getDeltaVsAverage(test, value, age, sex, norms)
  const average = getPopulationAverage(test, age, sex, norms)
  if (percentile === null) return null

  const bracket = bracketLabel ?? bracketFor(age)
  const sexLabel = sex === 'M' ? 'H' : 'F'
  const isLight = variant === 'light'
  const baseText = isLight ? 'text-marine/55' : 'text-cream/55'
  const tooltip =
    `${Math.round(percentile)}${suffixe(percentile)} percentile : ${Math.round(percentile)} % des ${sexLabel === 'H' ? 'hommes' : 'femmes'} de ${bracket} ans ` +
    `ont un résultat inférieur au vôtre. ` +
    (average !== null ? `Moyenne population (P50) ≈ ${average}. ` : '') +
    `Source : ACSM Guidelines 11e édition.`

  // Mini-barre 0-100 avec marqueur P50 et position du client.
  const clientPos = Math.max(0, Math.min(100, percentile))
  const deltaColor = delta?.isBetter
    ? (isLight ? 'text-green-600' : 'text-green-400')
    : (isLight ? 'text-red-600' : 'text-red-400')
  const dotColor = delta?.isBetter ? 'bg-green-600' : 'bg-red-500'

  return (
    <div className={`${baseText} text-xs mt-1`} title={tooltip}>
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {Math.round(percentile)}
          <sup>{suffixe(percentile)}</sup> percentile
        </span>
        {delta && (
          <span className={`font-medium ${deltaColor}`}>
            {delta.deltaPct >= 0 ? '+' : ''}
            {delta.deltaPct} %
          </span>
        )}
        <span className={isLight ? 'text-marine/40' : 'text-cream/40'}>
          vs moyenne {sexLabel} {bracket}
        </span>
      </div>
      {!compact && (
        <div className={`relative h-1.5 rounded-full mt-1.5 ${isLight ? 'bg-cream-dark' : 'bg-marine-light/40'}`}>
          {/* Marqueur P50 */}
          <span
            className={`absolute top-0 w-px h-1.5 ${isLight ? 'bg-marine/40' : 'bg-cream/40'}`}
            style={{ left: '50%' }}
            aria-hidden
          />
          {/* Position du client */}
          <span
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${dotColor} border border-white shadow`}
            style={{ left: `${clientPos}%` }}
            aria-hidden
          />
        </div>
      )}
    </div>
  )
}
