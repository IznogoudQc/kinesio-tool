import { useEffect, useRef } from 'react'

/** Petite explosion de confettis en plein écran, sans dépendance (canvas + rAF).
 *  Se déclenche une seule fois par `token` et par session (sessionStorage), et
 *  reste silencieux si l'utilisateur a désactivé les animations (accessibilité). */
export function Confetti({ token }: { token: string }): React.JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const key = 'kwins-fired:' + token
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* sessionStorage indisponible — on tire quand même */
    }

    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const colors = ['#d4a574', '#b8834a', '#e8c99e', '#22c55e', '#15803d', '#0a1c5e', '#f5c542']
    const N = 110
    const parts = Array.from({ length: N }, (_, i) => ({
      x: W * (0.15 + 0.7 * ((i % 11) / 10)),
      y: H * 0.28 + ((i * 7) % 40),
      vx: (((i * 53) % 100) / 100 - 0.5) * 9,
      vy: -7 - (((i * 31) % 100) / 100) * 7,
      g: 0.24 + (((i * 17) % 100) / 100) * 0.1,
      size: 5 + (((i * 13) % 100) / 100) * 6,
      rot: (((i * 29) % 100) / 100) * Math.PI,
      vr: (((i * 41) % 100) / 100 - 0.5) * 0.35,
      color: colors[i % colors.length]
    }))

    let raf = 0
    let start = -1
    const draw = (now: number): void => {
      if (start < 0) start = now
      const elapsed = now - start
      ctx.clearRect(0, 0, W, H)
      let alive = false
      const alpha = Math.max(0, 1 - elapsed / 2600)
      for (const p of parts) {
        p.vy += p.g
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.vx *= 0.99
        if (p.y < H + 20 && alpha > 0) alive = true
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (alive && elapsed < 2800) raf = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [token])

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-40 h-full w-full" aria-hidden="true" />
}
