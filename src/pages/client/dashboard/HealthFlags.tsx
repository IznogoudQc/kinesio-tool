import { AlertTriangle, ShieldAlert } from 'lucide-react'
import type { HealthFlag } from '../../../lib/health-flags'

/** Carte « Signaux à surveiller » — n'apparaît que si au moins un seuil est franchi. */
export function HealthFlags({ flags }: { flags: HealthFlag[] }): React.JSX.Element | null {
  if (flags.length === 0) return null

  const alerts = flags.filter(f => f.level === 'alert').length

  return (
    <section
      className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm"
      aria-label="Signaux à surveiller"
    >
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert size={16} className={alerts > 0 ? 'text-red-500' : 'text-amber-500'} />
        <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Signaux à surveiller</h3>
      </div>
      <p className="text-marine/45 text-xs mb-3">
        Seuils cliniques absolus, indépendants des percentiles. Ce ne sont pas des diagnostics.
      </p>

      <ul className="space-y-2">
        {flags.map(f => {
          const isAlert = f.level === 'alert'
          return (
            <li
              key={f.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                isAlert ? 'border-red-500/25 bg-red-50/60' : 'border-amber-500/25 bg-amber-50/50'
              }`}
            >
              <AlertTriangle
                size={16}
                className={`shrink-0 mt-0.5 ${isAlert ? 'text-red-500' : 'text-amber-500'}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-marine font-semibold text-sm">{f.title}</span>
                  <span
                    className={`text-sm font-bold tabular-nums ${isAlert ? 'text-red-600' : 'text-amber-600'}`}
                  >
                    {f.value}
                  </span>
                  <span className="text-marine/40 text-xs">({f.threshold})</span>
                </div>
                <p className="text-marine/70 text-xs mt-0.5 leading-snug">{f.why}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
