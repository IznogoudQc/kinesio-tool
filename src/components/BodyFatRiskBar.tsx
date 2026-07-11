import { bodyFatRisk, BF_RISK_HEX } from '../lib/body-fat-risk'

/** Barre des zones de **risque** du % de gras (grille de Marie, palier « moins de
 *  70 ans »), avec un repère à la valeur du client et le nom de sa zone. Cinq
 *  zones : risque aux deux extrémités, favorables au centre. Partagée : document
 *  client + Dashboard. Repère de santé — distinct du percentile ACSM. */
export function BodyFatRiskBar({
  pct,
  sex,
  className = ''
}: {
  pct: number | null | undefined
  sex: 'F' | 'M' | null
  className?: string
}): React.JSX.Element | null {
  const scale = bodyFatRisk(pct, sex)
  if (!scale) return null
  const { zones, scaleMax, current, markerRatio } = scale
  const markerPct = markerRatio === null ? null : markerRatio * 100
  // Bornes internes à étiqueter sous la barre (début de chaque zone sauf la 1re).
  const bounds = zones.slice(1).map(z => z.min)
  const widthOf = (z: (typeof zones)[number]) => (((z.max ?? scaleMax) - z.min) / scaleMax) * 100

  return (
    <div className={className}>
      {current && (
        <p className="text-sm text-marine/60">
          Votre zone :{' '}
          <span className="font-semibold" style={{ color: BF_RISK_HEX[current.key] }}>
            {current.label}
          </span>{' '}
          <span className="text-marine/40">pour votre sexe</span>
        </p>
      )}

      <div className="mt-3">
        {/* Noms des zones, au-dessus de la barre (esprit de l'ancien tableau). */}
        <div className="flex">
          {zones.map(z => (
            <span
              key={z.key}
              className="px-0.5 text-center text-[9px] uppercase leading-tight tracking-wide text-marine/40"
              style={{ width: `${widthOf(z)}%` }}
            >
              {z.label}
            </span>
          ))}
        </div>

        {/* Repère + valeur du client, au-dessus de la barre. */}
        <div className="relative mt-1.5 h-5">
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
            {zones.map(z => (
              <div key={z.key} style={{ width: `${widthOf(z)}%`, background: BF_RISK_HEX[z.key] }} />
            ))}
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
              {b.toLocaleString('fr-CA', { maximumFractionDigits: 1 })}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-1 text-[11px] text-marine/40">
        Grille de référence du % de gras — palier « moins de 70 ans ». Vert = zones favorables.
      </p>
    </div>
  )
}
