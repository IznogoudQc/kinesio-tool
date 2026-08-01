import {
  healthRisk,
  healthRiskExplanation,
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
  const nuance = muscularCaveat(r)

  return (
    <div className={className}>
      <p className="text-base text-marine/70">
        <span className="text-marine/45">Risque pour la santé</span>{' '}
        <span className="font-semibold" style={{ color: HEALTH_RISK_HEX[r.risk] }}>
          {HEALTH_RISK_LABELS[r.risk]}
        </span>
      </p>
      <p className="text-marine/45 text-xs mt-1">
        {healthRiskExplanation(r)} {HEALTH_RISK_SOURCE}.
      </p>
      {/* Nuance du guide pour un client musclé à IMC de surpoids mais tour de
          taille sous la limite. Détachée de la ligne d'explication : c'est une
          réserve sur la lecture du risque, pas un complément de calcul. */}
      {nuance && (
        <p className="text-amber-800/90 text-xs mt-1.5 pl-2 border-l-2 border-amber-300 leading-snug">{nuance}</p>
      )}
    </div>
  )
}
