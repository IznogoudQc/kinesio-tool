import { formatBilanDate } from '../pages/client/bilanFields'

interface MeasureDeltaProps {
  current: number | null | undefined
  previous: number | null | undefined
  /** Date ISO de la mesure précédente — affichée après le delta. */
  previousDate?: string
  unit?: string
  /** Pour tour de taille / hanche / abdomen / IMC / % gras : baisse = bien. */
  lowerIsBetter?: boolean
  /** Tolérance pour « stable » (en unités, pas en %). Par défaut : 0.05. */
  epsilon?: number
  /** Thème — `light` (défaut, fond cream) ou `dark` (fond marine). */
  theme?: 'light' | 'dark'
}

/**
 * Affichage compact « ▲ +2 cm depuis 10 sept 2025 (−1.9 %) ».
 *
 *   - Pas de précédent → `Première mesure` en gris pâle.
 *   - |delta| < epsilon → `= stable`.
 *   - Amélioration → ▲/▼ vert + signe + valeur + (pourcentage).
 *   - Régression → ▲/▼ rouge.
 *
 * Le sens de la flèche (▲▼) suit le sens *réel* du delta (positif = ▲, négatif = ▼).
 * La couleur (vert/rouge) suit le sens de la **performance** (avec `lowerIsBetter`).
 */
export function MeasureDelta({
  current,
  previous,
  previousDate,
  unit,
  lowerIsBetter = false,
  epsilon = 0.05,
  theme = 'light'
}: MeasureDeltaProps) {
  const isDark = theme === 'dark'
  const mutedMain = isDark ? 'text-cream/45' : 'text-marine/35'
  const mutedSub = isDark ? 'text-cream/40' : 'text-marine/40'
  const mutedSuffix = isDark ? 'text-cream/35' : 'text-marine/35'
  const dateSuffix = isDark ? 'text-cream/40' : 'text-marine/40'
  const greenColor = isDark ? 'text-green-300' : 'text-green-600'
  const redColor = isDark ? 'text-red-300' : 'text-red-500'

  if (typeof current !== 'number' || Number.isNaN(current)) return null

  if (typeof previous !== 'number' || Number.isNaN(previous)) {
    return <p className={`${mutedMain} text-xs mt-1`}>Première mesure</p>
  }

  const delta = current - previous
  if (Math.abs(delta) < epsilon) {
    return (
      <p className={`${mutedSub} text-xs mt-1`}>
        = stable
        {previousDate && (
          <span className={mutedSuffix}> depuis {formatBilanDate(previousDate)}</span>
        )}
      </p>
    )
  }

  const improved = lowerIsBetter ? delta < 0 : delta > 0
  const color = improved ? greenColor : redColor
  const arrow = delta > 0 ? '▲' : '▼'
  const abs = Math.abs(delta)
  const absLabel = abs >= 10 ? Math.round(abs).toString() : abs.toFixed(1)
  const sign = delta > 0 ? '+' : '−'
  const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null

  return (
    <p className={`text-xs mt-1 font-medium ${color}`}>
      {arrow} {sign}
      {absLabel}
      {unit ? ` ${unit}` : ''}
      {pct !== null && (
        <span className="font-normal">
          {' '}
          ({pct > 0 ? '+' : '−'}
          {Math.abs(pct).toFixed(1)} %)
        </span>
      )}
      {previousDate && (
        <span className={`${dateSuffix} font-normal`}> · depuis {formatBilanDate(previousDate)}</span>
      )}
    </p>
  )
}
