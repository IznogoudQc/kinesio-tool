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

/**
 * Barre segmentée des zones de pression artérielle (Optimale → Hypertension 2,
 * seuils OMS/JNC), avec un repère à la valeur du client. Systolique ou
 * diastolique selon `kind`. Partagée : dashboard + document client.
 *
 * ── Le repère « après l'effort » ────────────────────────────────────────────
 * `recoveryValue` ajoute un **second repère** sur la même barre plutôt qu'une
 * barre séparée. Ce n'est pas qu'une économie de place : les zones de cette
 * échelle sont des normes de PA **au repos**. Une systolique de 136 juste après
 * un effort est parfaitement normale, mais posée sur sa propre barre elle
 * tomberait dans « Pré-hypertension » et le client lirait un problème
 * inexistant.
 *
 * Le second repère montre donc l'écart sans que la catégorie affichée
 * (« Optimale », « Normale »…) ne qualifie autre chose que la valeur de repos.
 */
export function BloodPressureBar({
  value,
  kind,
  recoveryValue = null,
  className = ''
}: {
  value: number | null | undefined
  kind: BpKind
  /** Valeur relevée après l'effort — second repère, non coté. */
  recoveryValue?: number | null
  className?: string
}): React.JSX.Element | null {
  const bar = bloodPressureBar(value, kind)
  if (!bar) return null
  const { zones, scaleMin, scaleMax, current, markerRatio } = bar
  const span = scaleMax - scaleMin
  const widthOf = (z: (typeof zones)[number]) => ((z.max - z.min) / span) * 100
  const markerPct = markerRatio === null ? null : markerRatio * 100
  const bounds = zones.slice(1).map(z => z.min) // bornes internes = seuils cliniques
  // Le repère de récupération est placé sur le MÊME axe, borné à ses extrémités
  // pour rester visible même si la valeur sort de l'échelle.
  const recPct =
    typeof recoveryValue === 'number' && Number.isFinite(recoveryValue)
      ? Math.max(0, Math.min(100, ((recoveryValue - scaleMin) / span) * 100))
      : null

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

        {/* Repère + valeur du client, au repos. */}
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

        {/* Étiquette de l'après-effort sur sa PROPRE ligne : les deux valeurs
            sont souvent proches, et superposées elles deviendraient illisibles. */}
        {recPct !== null && (
          // h-5 et non h-4 : à 16 px la ligne était trop courte pour le texte,
          // qui débordait sur la barre juste en dessous.
          <div className="relative h-5">
            <div
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-center leading-none"
              style={{ left: `${Math.max(12, Math.min(88, recPct))}%` }}
            >
              <span className="text-[11px] tabular-nums text-marine/55">{recoveryValue} après l’effort</span>
            </div>
          </div>
        )}

        {/* Barre segmentée. */}
        <div className="relative h-3 w-full overflow-hidden rounded-full">
          <div className="flex h-full w-full">
            {zones.map(z => (
              <div key={z.label} style={{ width: `${widthOf(z)}%`, background: CAT_HEX[z.category] }} />
            ))}
          </div>
          {/* Repère de l'après-effort : creux et plus discret que celui du
              repos, pour qu'on voie tout de suite lequel est coté. */}
          {recPct !== null && (
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-marine/45"
              style={{ left: `${recPct}%` }}
              aria-hidden="true"
            />
          )}
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
