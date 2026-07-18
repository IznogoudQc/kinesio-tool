import { BODY_REGIONS, cyclePain, type BodyRegion, type PainSeverity, type ZoneMark } from '../../lib/sante'

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

// Contour anatomique (tête + corps d'un seul tenant) — identique face et dos.
const BODY_PATH =
  'M 74 48 L 66 55 L 52 58 L 43 72 L 39 104 L 37 138 L 35 165 L 34 182 L 37 191 L 44 188 L 46 166 L 48 140 L 50 98 L 57 150 L 51 186 L 54 206 L 56 250 L 58 298 L 59 338 L 56 361 L 52 373 L 72 374 L 73 360 L 75 300 L 77 216 L 80 207 L 83 216 L 85 300 L 87 360 L 88 374 L 108 373 L 104 361 L 101 338 L 102 298 L 104 250 L 106 206 L 109 186 L 103 150 L 110 98 L 112 140 L 114 166 L 116 188 L 123 191 L 126 182 L 125 165 L 123 138 L 121 104 L 117 72 L 108 58 L 94 55 L 86 48 Z'

function Silhouette() {
  const p = { fill: '#dfe3ee', stroke: '#b9c0d6', strokeWidth: 1.5 }
  return (
    <g>
      <ellipse cx={80} cy={27} rx={16} ry={19} {...p} />
      <path d={BODY_PATH} strokeLinejoin="round" {...p} />
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
  value: Record<string, ZoneMark>
  onToggle: (id: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-marine/60 text-xs font-semibold mb-1">{title}</p>
      <svg viewBox="0 0 160 380" className="w-[150px] h-auto select-none" role="group" aria-label={title}>
        <Silhouette />
        {regions.map(r => {
          const sev = value[r.id]?.severity
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
  value: Record<string, ZoneMark>
  onChange?: (next: Record<string, ZoneMark>) => void
  readOnly?: boolean
}) {
  function toggle(id: string) {
    if (!onChange) return
    const next = { ...value }
    const nx = cyclePain(value[id]?.severity)
    if (nx) next[id] = { ...value[id], severity: nx }
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
