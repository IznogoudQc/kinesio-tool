import { bloodPressureBar, type BpKind } from '../lib/norms/clinical'
import type { Category } from '../lib/norms'

/** Couleurs des catégories (rouge → vert foncé) — mêmes que le reste de l'app. */
const CAT_HEX: Record<Category, string> = {
  A_AMELIORER: '#dc2626',
  ACCEPTABLE: '#ea580c',
  BIEN: '#ca8a04',
  TRES_BIEN: '#16a34a',
  EXCELLENT: '#15803d'
}

/** Barre segmentée des zones de pression artérielle (Optimale → Hypertension 2,
 *  seuils OMS/JNC), avec un repère à la valeur du client. Systolique ou
 *  diastolique selon `kind`. Partagée : document client. */
export function BloodPressureBar({
  value,
  kind,
  className = ''
}: {
  value: number | null | undefined
  kind: BpKind
  className?: string
}): React.JSX.Element | null {
  const bar = bloodPressureBar(value, kind)
  if (!bar) return null
  const { zones, scaleMin, scaleMax, current, markerRatio } = bar
  const span = scaleMax - scaleMin
  const widthOf = (z: (typeof zones)[number]) => ((z.max - z.min) / span) * 100
  const markerPct = markerRatio === null ? null : markerRatio * 100
  const bounds = zones.slice(1).map(z => z.min) // bornes internes = seuils cliniques

  return (
    <div className={className}>
      <p className="text-sm text-marine/60">
        {kind === 'systolic' ? 'Systolique' : 'Diastolique'}
        {current && (
          <>
            {' · '}
            <span className="font-semibold" style={{ color: CAT_HEX[current.category] }}>{current.label}</span>
          </>
        )}
      </p>

      <div className="mt-2">
        {/* Noms des zones, au-dessus de la barre. */}
        <div className="flex">
          {zones.map(z => (
            <span
              key={z.label}
              className="px-0.5 text-center text-[8.5px] uppercase leading-tight tracking-wide text-marine/40"
              style={{ width: `${widthOf(z)}%` }}
            >
              {z.label}
            </span>
          ))}
        </div>

        {/* Repère + valeur du client. */}
        <div className="relative mt-1.5 h-5">
          {markerPct !== null && typeof value === 'number' && (
            <div
              className="absolute -translate-x-1/2 whitespace-nowrap text-center"
              style={{ left: `${Math.max(7, Math.min(93, markerPct))}%` }}
            >
              <span className="text-xs font-bold tabular-nums text-marine">{value} mmHg</span>
            </div>
          )}
        </div>

        {/* Barre segmentée. */}
        <div className="relative h-3 w-full overflow-hidden rounded-full">
          <div className="flex h-full w-full">
            {zones.map(z => (
              <div key={z.label} style={{ width: `${widthOf(z)}%`, background: CAT_HEX[z.category] }} />
            ))}
          </div>
          {markerPct !== null && (
            <div
              className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-marine"
              style={{ left: `${markerPct}%`, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9)' }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Seuils chiffrés sous la barre. */}
        <div className="relative mt-1 h-4">
          {bounds.map(b => (
            <span
              key={b}
              className="absolute -translate-x-1/2 text-[10px] tabular-nums text-marine/40"
              style={{ left: `${((b - scaleMin) / span) * 100}%` }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
