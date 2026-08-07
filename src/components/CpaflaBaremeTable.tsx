import {
  cpaflaCompositionBareme,
  USE_CALF_SKINFOLD,
  type CpaflaCompositionDetail
} from '../lib/norms/cpafla-composition'

/**
 * Barème CPAFLA de la composition corporelle (Fig. 7-4 / 7-5), pour un sexe.
 *
 * Deux surfaces l'affichent : la carte du dashboard, qui surligne la ligne et
 * les cases du client, et l'écran des barèmes dans les paramètres, qui le montre
 * à vide. C'était la même table écrite deux fois — la façon exacte dont
 * « IMC et tour de taille » a fini par mentir pendant deux versions.
 *
 * `detail` absent (ou `null`) = aucun surlignage.
 */
export function CpaflaBaremeTable({
  sex,
  detail = null,
  titre
}: {
  sex: 'F' | 'M'
  detail?: CpaflaCompositionDetail | null
  /** Remplace l'intitulé par défaut. */
  titre?: string
}) {
  const rows = cpaflaCompositionBareme(sex)

  return (
    <div>
      <p className="text-marine/70 text-xs font-medium mb-2">
        {titre ?? `Barème CPAFLA — ${sex === 'F' ? 'femmes' : 'hommes'}`}
        {detail && (
          <span className="text-marine/40 font-normal">
            {' '}· la ligne et les cases surlignées sont celles du client
          </span>
        )}
      </p>
      {/* Le guide donne aussi une colonne « somme des 5 plis ». Elle n'est pas
          affichée quand le pli du mollet n'est pas mesuré : elle n'entrerait
          dans aucun calcul, et la montrer laissait croire qu'elle comptait. */}
      {!USE_CALF_SKINFOLD && (
        <p className="text-marine/40 text-xs mb-2">
          Le guide prévoit aussi une colonne « somme des 5 plis ». Elle n’est pas reprise ici : le pli du mollet
          n’étant pas mesuré, elle n’entre dans aucun calcul.
        </p>
      )}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const activeBand = detail !== null && i === detail.imcIndex
          return (
            <div
              key={r.imcLabel}
              className={`rounded-lg border px-3 py-2 text-xs ${
                activeBand ? 'border-gold/50 bg-gold/10' : 'border-cream-dark/40 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-marine">IMC {r.imcLabel}</span>
                <span className="text-marine/45">· IMC seul : {r.a} pt{r.a > 1 ? 's' : ''}</span>
              </div>
              <BaremeLine
                title="Tour de taille"
                cells={r.ct}
                activeIndex={activeBand ? (detail?.ctIndex ?? null) : null}
              />
              {USE_CALF_SKINFOLD && (
                <BaremeLine
                  title="Somme 5 plis"
                  cells={r.s5pc}
                  activeIndex={activeBand ? (detail?.s5pcIndex ?? null) : null}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BaremeLine({
  title,
  cells,
  activeIndex
}: {
  title: string
  cells: { range: string; pts: number }[]
  activeIndex: number | null
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-marine/45 w-24 shrink-0">{title}</span>
      {cells.map((c, i) => (
        <span
          key={c.range}
          className={`tabular-nums rounded px-1.5 py-0.5 ${
            i === activeIndex ? 'bg-marine text-cream font-semibold' : 'text-marine/70'
          }`}
        >
          {c.range} → {c.pts}
        </span>
      ))}
    </div>
  )
}
