import { useEffect, useRef, useState } from 'react'

/** `true` si l'utilisateur préfère réduire les animations (accessibilité). */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Anime une valeur numérique vers `target` : de 0 au montage, puis de l'ancienne
 * valeur vers la nouvelle à chaque changement (easeOutCubic). Renvoie la valeur
 * courante à afficher. `null` → `null`. Respecte `prefers-reduced-motion`
 * (renvoie la cible instantanément). Uniquement pour l'UI interactive — le PDF
 * ne doit pas l'utiliser (rendu statique).
 */
export function useCountUp(target: number | null, durationMs = 700): number | null {
  const reduced = prefersReducedMotion()
  const [value, setValue] = useState<number | null>(reduced ? target : target === null ? null : 0)
  const fromRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (target === null) {
      setValue(null)
      return
    }
    if (reduced) {
      setValue(target)
      fromRef.current = target
      return
    }
    const from = fromRef.current
    const start = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs, reduced])

  return value
}
