import { BODY_REGIONS, cyclePain, type BodyRegion, type PainSeverity } from '../../lib/sante'

/**
 * Silhouette cliquable (face + dos) pour marquer les zones de tension/douleur.
 * Chaque zone cycle rien → jaune (tension) → rouge (douleur) → rien au clic.
 * `value` = { idRégion → sévérité }. Purement contrôlé par le parent.
 */

const FILL: Record<PainSeverity, string> = {
  jaune: 'rgba(245, 200, 60, 0.78)',
  rouge: 'rgba(224, 70, 70, 0.80)'
}

const FACE_REGIONS = BODY_REGIONS.filter(r => r.view === 'face')
const DOS_REGIONS = BODY_REGIONS.filter(r => r.view === 'dos')

/** Contour de la silhouette (capsules) — identique face et dos. */
function Silhouette() {
  const p = { fill: '#dfe3ee', stroke: '#b9c0d6', strokeWidth: 1.5 }
  return (
    <g>
      <circle cx={80} cy={30} r={20} {...p} />
      <rect x={72} y={46} width={16} height={12} rx={5} {...p} />
      <path d="M44 60 Q80 52 116 60 L112 150 Q80 160 48 150 Z" {...p} />
      <rect x={28} y={64} width={15} height={120} rx={7.5} {...p} />
      <rect x={117} y={64} width={15} height={120} rx={7.5} {...p} />
      <path d="M50 150 Q80 158 110 150 L108 210 Q80 218 52 210 Z" {...p} />
      <rect x={55} y={205} width={18} height={150} rx={9} {...p} />
      <rect x={87} y={205} width={18} height={150} rx={9} {...p} />
      <ellipse cx={60} cy={360} rx={12} ry={8} {...p} />
      <ellipse cx={100} cy={360} rx={12} ry={8} {...p} />
    </g>
  )
}

function Figure({
  title,
  regions,
  value,
  onToggle,
  readOnly
}: {
  title: string
  regions: BodyRegion[]
  value: Record<string, PainSeverity>
  onToggle: (id: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-marine/60 text-xs font-semibold mb-1">{title}</p>
      <svg viewBox="0 0 160 380" className="w-[150px] h-auto select-none" role="group" aria-label={title}>
        <Silhouette />
        {regions.map(r => {
          const sev = value[r.id]
          return (
            <ellipse
              key={r.id}
              cx={r.cx}
              cy={r.cy}
              rx={r.rx}
              ry={r.ry}
              fill={sev ? FILL[sev] : 'transparent'}
              stroke={sev ? 'none' : '#c2c9dd'}
              strokeWidth={0.7}
              strokeDasharray={sev ? undefined : '2.5 2.5'}
              style={{ cursor: readOnly ? 'default' : 'pointer' }}
              onClick={readOnly ? undefined : () => onToggle(r.id)}
            >
              <title>{r.label}</title>
            </ellipse>
          )
        })}
      </svg>
    </div>
  )
}

export function BodyPainMap({
  value,
  onChange,
  readOnly
}: {
  value: Record<string, PainSeverity>
  onChange?: (next: Record<string, PainSeverity>) => void
  readOnly?: boolean
}) {
  function toggle(id: string) {
    if (!onChange) return
    const next = { ...value }
    const nx = cyclePain(value[id])
    if (nx) next[id] = nx
    else delete next[id]
    onChange(next)
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-6 mb-2 text-xs text-marine/70">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full" style={{ background: FILL.jaune }} /> Tension légère
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full" style={{ background: FILL.rouge }} /> Douleur
        </span>
        {!readOnly && <span className="text-marine/40">Clic : rien → jaune → rouge</span>}
      </div>
      <div className="flex items-start justify-center gap-6 flex-wrap">
        <Figure title="Face (avant)" regions={FACE_REGIONS} value={value} onToggle={toggle} readOnly={readOnly} />
        <Figure title="Dos (arrière)" regions={DOS_REGIONS} value={value} onToggle={toggle} readOnly={readOnly} />
      </div>
    </div>
  )
}
