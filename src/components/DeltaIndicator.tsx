interface DeltaIndicatorProps {
  /** Valeur actuelle. `null` ou `undefined` → affichage neutre `—`. */
  current: number | null | undefined
  /** Valeur du bilan précédent. `null` ou `undefined` → pas de comparaison. */
  previous: number | null | undefined
  /** Unité affichée à la suite (`reps`, `cm`, `kg`, etc.). */
  unit?: string
  /** Si true, baisse = amélioration (% gras, IMC, tour de taille, FC repos). */
  lowerIsBetter?: boolean
  /** Tolérance pour considérer « stable ». Par défaut : 0.05 (unités). */
  epsilon?: number
  /** Variante d'affichage compacte (text-xs vs text-sm). */
  size?: 'xs' | 'sm'
}

/**
 * Affiche le delta `current - previous` avec une flèche colorée :
 *   • Pas de précédent → `—` en gris pâle (pas de comparaison possible)
 *   • |delta| < epsilon → `= stable` en gris
 *   • Amélioration → ▲ +X unit en vert
 *   • Régression → ▼ −X unit en rouge
 *
 * Pour `lowerIsBetter` (% gras, IMC, tour de taille…), le sens est inversé :
 * une baisse devient une amélioration (▼ −X unit en vert).
 */
export function DeltaIndicator({
  current,
  previous,
  unit,
  lowerIsBetter = false,
  epsilon = 0.05,
  size = 'xs'
}: DeltaIndicatorProps) {
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-xs'

  if (typeof current !== 'number' || typeof previous !== 'number') {
    return <span className={`${sizeClass} text-marine/30`}>—</span>
  }

  const delta = current - previous

  if (Math.abs(delta) < epsilon) {
    return <span className={`${sizeClass} text-marine/40`}>= stable</span>
  }

  // Sens visuel : pour les tests « plus = mieux » (push-ups, VO2max…), un delta
  // positif est une amélioration. Pour les tests « moins = mieux » (% gras,
  // IMC, tour de taille…), un delta négatif est une amélioration.
  const improved = lowerIsBetter ? delta < 0 : delta > 0
  const color = improved ? 'text-green-600' : 'text-red-500'
  const arrow = delta > 0 ? '▲' : '▼'
  const signedAbs = Math.abs(delta)
  const label = signedAbs >= 10 ? Math.round(signedAbs).toString() : signedAbs.toFixed(1)
  const sign = delta > 0 ? '+' : '−'

  return (
    <span className={`${sizeClass} font-semibold ${color}`}>
      {arrow} {sign}
      {label}
      {unit ? ` ${unit}` : ''}
    </span>
  )
}
