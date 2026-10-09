import { useState } from 'react'
import { BODY_REGIONS, cyclePain, type BodyRegion, type PainSeverity, type ZoneMark } from '../../lib/sante'
import { BODY_CONTOURS } from './body-silhouettes'

const FILL: Record<PainSeverity, string> = { jaune: 'rgba(245, 200, 60, 0.78)', rouge: 'rgba(224, 70, 70, 0.80)' }
type Appearance = keyof typeof BODY_CONTOURS
interface FigureProps {
  view: BodyRegion['view']
  appearance: Appearance
  value: Record<string, ZoneMark>
  onToggle: (id: string) => void
  readOnly: boolean
}

function Figure({ view, appearance, value, onToggle, readOnly }: FigureProps) {
  const front = view === 'face'
  const title = front ? 'Face (avant)' : 'Dos (arrière)'
  return (
    <div className="flex min-w-0 flex-col items-center">
      <p className="text-marine text-xs font-semibold mb-1">{title}</p>
      <div className="flex w-full max-w-[175px] justify-between px-5 text-[10px] text-marine/60" aria-hidden="true">
        <span>{front ? 'Droit' : 'Gauche'}</span><span>{front ? 'Gauche' : 'Droit'}</span>
      </div>
      <svg viewBox="0 0 160 391" className="w-full max-w-[175px] h-auto select-none" role="group" aria-label={title}>
        <ellipse cx={80} cy={383} rx={32} ry={3} fill="#23365c" opacity={0.06} />
        <g fill="#dbe4f2" stroke="#506b94" strokeWidth={1.3} strokeLinejoin="round">
          <path d={BODY_CONTOURS[appearance]} />
          <path d="M66 24 Q65 7 80 7 Q95 7 94 24 L93 35 Q91 48 80 49 Q69 48 67 35Z" />
        </g>
        <path d={front ? 'M69 62Q80 68 91 62 M79 149h2' : 'M80 64V147 M58 198Q69 208 80 198Q91 208 102 198'}
          fill="none" stroke="#506b94" opacity={0.45} strokeLinecap="round" />
        {BODY_REGIONS.filter(r => r.view === view).map(r => {
          const severity = value[r.id]?.severity
          const status = severity === 'jaune' ? 'tension légère' : severity === 'rouge' ? 'douleur' : 'non signalée'
          return (
            <ellipse key={r.id} cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry}
              fill={severity ? FILL[severity] : 'transparent'}
              stroke={severity === 'rouge' ? '#c63333' : severity === 'jaune' ? '#bd900c' : '#849abb'}
              strokeOpacity={severity ? 1 : 0.4} strokeWidth={0.8}
              strokeDasharray={severity ? undefined : '2 3'}
              className={readOnly ? '' : 'cursor-pointer hover:stroke-marine hover:stroke-[1.5] focus:stroke-marine focus:stroke-[1.5] focus:outline-none'}
              role={readOnly ? 'img' : 'button'} tabIndex={readOnly ? undefined : 0}
              aria-label={`${r.label} (${view}), ${status}`} aria-pressed={readOnly ? undefined : Boolean(severity)}
              onClick={readOnly ? undefined : () => onToggle(r.id)}
              onKeyDown={readOnly ? undefined : e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(r.id) }
              }}>
              <title>{r.label} — {status}</title>
            </ellipse>
          )
        })}
      </svg>
    </div>
  )
}

interface BodyPainMapProps {
  value: Record<string, ZoneMark>
  onChange?: (next: Record<string, ZoneMark>) => void
  readOnly?: boolean
  sex?: 'F' | 'M' | null
}

/**
 * La silhouette suit le sexe de la fiche. Le choix manuel n'apparaît que si le sexe est
 * absent ; il est visuel et ne modifie aucune donnée du questionnaire.
 */
export function BodyPainMap({ value, onChange, readOnly = false, sex }: BodyPainMapProps) {
  const [override, setOverride] = useState<Appearance | null>(null)
  const knownSex = sex === 'F' || sex === 'M'
  const appearance = knownSex ? (sex === 'F' ? 'female' : 'male') : (override ?? 'male')
  const disabled = readOnly || !onChange
  function toggle(id: string) {
    if (disabled || !onChange) return
    const next = { ...value }
    const severity = cyclePain(value[id]?.severity)
    if (severity) next[id] = { ...value[id], severity }
    else delete next[id]
    onChange(next)
  }
  return (
    <div>
      {!knownSex && (
        <div className="flex justify-center mb-4" role="group" aria-label="Apparence de la silhouette">
          <div className="inline-flex gap-1 rounded-lg bg-marine/5 p-1">
            {(['male', 'female'] as const).map(option => (
              <button key={option} type="button" aria-pressed={appearance === option} onClick={() => setOverride(option)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold text-marine focus-visible:outline-2 focus-visible:outline-marine ${appearance === option ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}>
                {option === 'male' ? 'Homme' : 'Femme'}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-3 text-xs text-marine/70">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: FILL.jaune }} />Tension légère</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: FILL.rouge }} />Douleur</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mx-auto max-w-[380px]">
        <Figure view="face" appearance={appearance} value={value} onToggle={toggle} readOnly={disabled} />
        <Figure view="dos" appearance={appearance} value={value} onToggle={toggle} readOnly={disabled} />
      </div>
      <p className="text-center text-xs text-marine/60 mt-2">Gauche et droite correspondent aux côtés de la personne.</p>
      {!disabled && <p className="text-center text-xs text-marine/50 mt-1">Clic : tension → douleur → effacer</p>}
    </div>
  )
}
