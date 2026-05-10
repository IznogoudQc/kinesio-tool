import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

interface AvatarCropperProps {
  /** Image source à recadrer (data URL ou URL chargeable dans un `<img>`). */
  imageSrc: string
  /** Appelé avec le PNG carré recadré, prêt à être envoyé au main process. */
  onCropDone: (croppedBlob: Blob) => void | Promise<void>
  onCancel: () => void
  /** `true` pendant l'enregistrement — désactive les contrôles. */
  busy?: boolean
}

/**
 * Éditeur de cadrage modal : Marie-Eve fait glisser la photo et ajuste le zoom
 * pour bien centrer le visage dans le cercle, puis on récupère le blob recadré.
 * Le redimensionnement final (512×512, WebP) reste fait côté main via sharp.
 */
export function AvatarCropper({ imageSrc, onCropDone, onCancel, busy = false }: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function handleSave() {
    if (!croppedAreaPixels || busy) return
    setError(null)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)
      await onCropDone(blob)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de recadrer la photo.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="bg-marine rounded-2xl p-6 w-[600px] max-w-[90vw] shadow-2xl">
        <h3 className="text-cream text-lg font-semibold mb-4">Cadrer la photo</h3>

        {error && (
          <div className="text-red-100 text-sm bg-red-900/40 border border-red-400/30 rounded-md px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <div className="relative w-full h-[360px] bg-marine-light rounded-lg overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-4">
          <label className="block text-cream/80 text-sm mb-1.5">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            disabled={busy}
            className="w-full accent-gold"
          />
        </div>

        <p className="text-cream/50 text-xs mt-3">
          Faites glisser la photo et ajustez le zoom pour bien centrer le visage dans le cercle.
        </p>

        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-cream/70 hover:text-cream text-base transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !croppedAreaPixels}
            className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// L'avatar final fait 512×512 (resize côté main) — inutile d'envoyer plus gros.
const MAX_OUTPUT_PX = 1024

/**
 * Recadre `imageSrc` selon `area` (coordonnées en pixels de l'image source) et
 * renvoie un PNG carré (≤ 1024 px). Le redimensionnement final / la conversion
 * WebP sont faits côté main process.
 */
async function getCroppedImageBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const size = Math.min(MAX_OUTPUT_PX, Math.max(1, Math.round(area.width)))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de préparer le recadrage.')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Échec du recadrage.'))), 'image/png')
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () => reject(new Error("Impossible de charger l'image.")))
    img.src = src
  })
}
