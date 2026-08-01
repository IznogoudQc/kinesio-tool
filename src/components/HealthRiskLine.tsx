import {
  healthRisk,
  healthRiskExplanation,
  healthRiskFacts,
  healthRiskScale,
  muscularCaveat,
  HEALTH_RISK_HEX,
  HEALTH_RISK_LABELS,
  HEALTH_RISK_SOURCE
} from '../lib/norms/health-risk'

/**
 * Risque pour la santé associé à l'IMC **et au tour de taille** (tableau 4.4 du
 * Guide du conseiller, 3ᵉ éd.). Partagée : Dashboard + document HTML.
 *
 * Ce n'est pas une cote de condition physique et ça n'entre dans aucun score :
 * l'IMC et le tour de taille alimentent déjà la composition corporelle et
 * l'indice de santé du dos par les tables CPAFLA. C'est une lecture santé, au
 * même titre que la grille de % de gras.
 *
 * Les deux mesures sont toujours lues **ensemble**. Afficher le risque de l'IMC
 * seul sous-estimerait celui d'une personne d'IMC normal au tour de taille
 * élevé — précisément le cas que ce tableau existe pour attraper.
 *
 * ── Pourquoi un barème plutôt qu'un mot ─────────────────────────────────────
 * Le bloc n'affichait qu'un libellé et une phrase en petits caractères : il se
 * lisait comme une note de bas de page. Or « Accru » ne veut rien dire tant
 * qu'on ne voit pas qu'il y a un palier en dessous et trois au-dessus. L'échelle
 * situe, et les deux chiffres qui l'ont produite la rendent vérifiable.
 */
export function HealthRiskLine({
  imc,
  waist,
  sex,
  className = ''
}: {
  imc: number | null | undefined
  waist: number | null | undefined
  sex: 'F' | 'M' | null
  className?: string
}): React.JSX.Element | null {
  const r = healthRisk({ imc, waist, sex })
  if (!r) return null

  const cells = healthRiskScale(r)
  const faits = healthRiskFacts({ imc, waist, sex }, r)
  const nuance = muscularCaveat(r)
  const couleur = HEALTH_RISK_HEX[r.risk]

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h4 className="text-marine/45 text-xs font-semibold uppercase tracking-wide">Risque pour la santé</h4>
        <span className="font-bold text-lg leading-none" style={{ color: couleur }}>
          {HEALTH_RISK_LABELS[r.risk]}
        </span>
      </div>

      {/* Barème : les cinq paliers, celui du client mis en avant. Les autres
          restent lisibles — c'est ce qui donne sa mesure au palier atteint. */}
      <div className="mt-2 flex gap-1" role="img" aria-label={`Risque ${HEALTH_RISK_LABELS[r.risk]} sur cinq paliers`}>
        {cells.map(c => (
          <div key={c.risk} className="flex-1 min-w-0">
            <div
              className="h-1.5 rounded-full"
              style={{ backgroundColor: c.hex, opacity: c.active ? 1 : 0.22 }}
              aria-hidden
            />
            <p
              className="mt-1 text-[10px] leading-tight text-center truncate"
              style={{
                color: c.active ? c.hex : undefined,
                fontWeight: c.active ? 700 : 400
              }}
              title={c.label}
            >
              <span className={c.active ? '' : 'text-marine/35'}>{c.shortLabel}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Les deux chiffres qui ont produit le verdict — sans eux, le palier est
          à prendre ou à laisser. */}
      <p className="mt-2.5 text-marine/60 text-xs">
        <span className="font-medium text-marine/75">IMC {faits.imc}</span>
        <span className="text-marine/35"> (plage {faits.imcBand})</span>
        {faits.waist ? (
          <>
            <span className="text-marine/30"> · </span>
            <span className="font-medium text-marine/75">Tour de taille {faits.waist}</span>
            {faits.waistThreshold && <span className="text-marine/35"> (seuil {faits.waistThreshold})</span>}
          </>
        ) : (
          faits.waistThreshold && (
            <>
              <span className="text-marine/30"> · </span>
              <span className="text-amber-700/80">tour de taille non mesuré (seuil {faits.waistThreshold})</span>
            </>
          )
        )}
      </p>

      <p className="text-marine/45 text-xs mt-1">{healthRiskExplanation(r)}</p>

      {/* Nuance du guide pour un client musclé à IMC de surpoids mais tour de
          taille sous la limite. Détachée : c'est une réserve sur la lecture du
          risque, pas un complément de calcul. */}
      {nuance && (
        <p className="text-amber-800/90 text-xs mt-2 pl-2 border-l-2 border-amber-300 leading-snug">{nuance}</p>
      )}

      <p className="text-marine/30 text-[10px] mt-2">{HEALTH_RISK_SOURCE}.</p>
    </div>
  )
}
