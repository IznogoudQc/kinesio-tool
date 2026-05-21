import { Heart } from 'lucide-react'
import type { FcZones } from '../../../lib/bilan-computed'

interface TrainingZonesProps {
  fcMax: number | null
  fcZones: FcZones | null
}

interface ZoneSpec {
  name: string
  description: string
  /** Indices vers les bornes inférieure et supérieure dans FcZones. */
  fromKey: keyof FcZones
  toKey: keyof FcZones | 'max'
  /** Tailwind colour classes (background + text). */
  bg: string
  text: string
}

const ZONES: ZoneSpec[] = [
  { name: 'Zone 1', description: 'Échauffement', fromKey: 'z60', toKey: 'z65', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { name: 'Zone 2', description: 'Endurance fondamentale', fromKey: 'z65', toKey: 'z70', bg: 'bg-emerald-100/80', text: 'text-emerald-800' },
  { name: 'Zone 3', description: 'Aérobie', fromKey: 'z70', toKey: 'z80', bg: 'bg-yellow-100/80', text: 'text-yellow-800' },
  { name: 'Zone 4', description: 'Seuil lactique', fromKey: 'z80', toKey: 'z90', bg: 'bg-orange-100/80', text: 'text-orange-800' },
  { name: 'Zone 5', description: 'VO2max', fromKey: 'z90', toKey: 'max', bg: 'bg-red-100/80', text: 'text-red-800' }
]

export function TrainingZones({ fcMax, fcZones }: TrainingZonesProps) {
  if (fcZones === null || fcMax === null) {
    return (
      <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Heart size={16} className="text-gold-dark" />
          <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Zones d'entraînement</h3>
        </div>
        <p className="text-marine/45 text-sm">
          Date de naissance requise pour calculer la FC max prédite (Tanaka).
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Heart size={16} className="text-gold-dark" />
        <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Zones d'entraînement</h3>
      </div>
      <p className="text-marine/45 text-xs mb-3">
        FC max prédite : <span className="text-marine font-semibold">{fcMax} bpm</span> · Tanaka (208 − 0.7 × âge)
      </p>

      <div className="space-y-1.5">
        {ZONES.map(z => {
          const from = fcZones[z.fromKey]
          const to = z.toKey === 'max' ? fcMax : fcZones[z.toKey]
          return (
            <div key={z.name} className={`${z.bg} rounded-md px-3 py-2 flex items-center justify-between`}>
              <div>
                <p className={`${z.text} text-sm font-semibold leading-tight`}>{z.name}</p>
                <p className={`${z.text} opacity-75 text-xs leading-tight`}>{z.description}</p>
              </div>
              <p className={`${z.text} text-sm font-mono font-medium tabular-nums`}>
                {from}–{to} bpm
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
