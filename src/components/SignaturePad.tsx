import { useEffect, useRef, useState } from 'react'
import { Eraser, PenLine } from 'lucide-react'

/**
 * Zone de signature manuscrite — souris, doigt ou stylet.
 *
 * `pointerdown/move/up` plutôt que les événements souris : ça couvre les trois
 * moyens de saisie d'un seul jeu d'événements, y compris l'écran tactile d'un
 * portable ou une tablette graphique, ce qui est le cas d'usage réel (le client
 * signe sur l'appareil de Marie).
 *
 * Le canevas est dessiné à la résolution de l'écran (`devicePixelRatio`) puis
 * exporté en PNG : un canevas 1× rendrait un tracé crénelé une fois imprimé.
 */
export function SignaturePad({
  onChange,
  disabled = false,
  height = 160
}: {
  /** Reçoit le PNG (data-URI) à chaque trait terminé, ou `null` si effacé. */
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [vide, setVide] = useState(true)

  // Redimensionne le canevas à sa taille réelle à l'écran. Sans ça, le tracé est
  // décalé par rapport au curseur dès que la largeur CSS diffère de l'attribut.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0a1c5e'
  }, [height])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    // Capture le pointeur : le trait continue même si le doigt sort du cadre,
    // au lieu de s'interrompre brutalement.
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (vide) setVide(false)
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(vide ? null : canvas.toDataURL('image/png'))
  }

  function effacer() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setVide(true)
    onChange(null)
  }

  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-cream-dark bg-white">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: 'none' }}
          className={`w-full rounded-lg ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'}`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {vide && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-marine/30">
            <PenLine size={16} />
            <span className="text-sm">Signez ici</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-marine/40 text-xs">Souris, doigt ou stylet.</p>
        <button
          type="button"
          onClick={effacer}
          disabled={disabled || vide}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-marine/65 hover:bg-cream-dark hover:text-marine transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eraser size={12} />
          Effacer
        </button>
      </div>
    </div>
  )
}
