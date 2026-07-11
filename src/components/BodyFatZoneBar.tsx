import { bodyFatScale, BF_TONE_HEX } from '../lib/body-fat-zones'

/** Barre graduée des zones de % de gras (InBody Canada, ajustées à l'âge), avec un repère à la valeur du
 *  client et le nom de sa zone. Repère de santé — complémentaire de la catégorie
 *  ACSM (percentiles) affichée ailleurs. Partagée : document client + Dashboard. */
export function BodyFatZoneBar({
  pct,
  sex,
  age,
  className = ''
}: {
  pct: number | null | undefined
  sex: 'F' | 'M' | null
  age: number | null
  className?: string
}): React.JSX.Element | null {
  const scale = bodyFatScale(pct, sex, age)
  if (!scale) return null
  const { zones, scaleMax, current, markerRatio } = scale
  const markerPct = markerRatio === null ? null : markerRatio * 100
  // Bornes internes à étiqueter sous la barre (début de chaque zone sauf la 1re).
  const bounds = zones.slice(1).map(z => z.min)

  return (
    <div className={className}>
      {current && (
        <p className="text-sm text-marine/60">
          Zone santé :{' '}
          <span className="font-semibold" style={{ color: BF_TONE_HEX[current.tone] }}>
            {current.label}
          </span>{' '}
          <span className="text-marine/40">pour votre âge et votre sexe</span>
        </p>
      )}

      <div className="mt-2.5">
        {/* Repère + valeur du client, au-dessus de la barre. */}
        <div className="relative h-5">
          {markerPct !== null && typeof pct === 'number' && (
            <div
              className="absolute -translate-x-1/2 whitespace-nowrap text-center"
              style={{ left: `${Math.max(7, Math.min(93, markerPct))}%` }}
            >
              <span className="text-xs font-bold tabular-nums text-marine">
                {pct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %
              </span>
            </div>
          )}
        </div>

        {/* Barre segmentée par zone, largeurs proportionnelles à l'échelle. */}
        <div className="relative h-3 w-full overflow-hidden rounded-full">
          <div className="flex h-full w-full">
            {zones.map(z => {
              const zMax = z.max ?? scaleMax
              const w = ((zMax - z.min) / scaleMax) * 100
              return <div key={z.key} style={{ width: `${w}%`, background: BF_TONE_HEX[z.tone] }} />
            })}
          </div>
          {/* Trait repère du client. */}
          {markerPct !== null && (
            <div
              className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-marine"
              style={{ left: `${markerPct}%`, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9)' }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Bornes chiffrées sous la barre. */}
        <div className="relative mt-1 h-4">
          {bounds.map(b => (
            <span
              key={b}
              className="absolute -translate-x-1/2 text-[10px] tabular-nums text-marine/40"
              style={{ left: `${(b / scaleMax) * 100}%` }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-1 text-[11px] text-marine/40">
        Zones de % de gras, ajustées selon l’âge — référence : InBody Canada.
      </p>
    </div>
  )
}
