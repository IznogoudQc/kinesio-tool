import {
  WHO_RISK_COLORS,
  WAIST_RISK_LABELS,
  WHO_RISK_LABELS,
  calculateRiskBarPosition,
  getRatioRisk,
  getWaistRisk,
  type WhoRiskLevel
} from '../lib/norms/who'

interface WaistRiskBarProps {
  value: number | null | undefined
  sex: 'F' | 'M' | null
  /** Champ à évaluer : tour de taille (cm) ou ratio T/H. */
  type: 'waist' | 'ratio'
}

/**
 * Libellé, infobulle et source dépendent de la mesure : les deux n'ont plus le
 * même référentiel depuis le 2026-08-04. Le tour de taille suit le barème de
 * l'ancien logiciel de Marie, le ratio reste sur l'OMS.
 */
const HABILLAGE = {
  waist: {
    labels: WAIST_RISK_LABELS,
    // Aucune source affichée pour le tour de taille : le libellé se suffit.
    source: null,
    tooltip:
      'Tour de taille — hommes : moins de 94 cm Excellent, moins de 102 Risque potentiel, ' +
      'au-delà Risque considérable. Femmes : 80 et 90 cm.'
  },
  ratio: {
    labels: WHO_RISK_LABELS,
    source: 'OMS',
    tooltip: 'OMS — Tour de taille et risque métabolique (WHO 2008)'
  }
} as const

/**
 * Barre de risque cardio-métabolique à 3 segments pour le tour de taille ou le
 * ratio T/H. Couleurs vert / jaune / rouge, marqueur ▲ positionné selon la
 * valeur. Les libellés diffèrent selon la mesure — voir `HABILLAGE`.
 */
export function WaistRiskBar({ value, sex, type }: WaistRiskBarProps) {
  if (sex === null || typeof value !== 'number' || !Number.isFinite(value)) return null

  const risk = type === 'waist' ? getWaistRisk(value, sex) : getRatioRisk(value, sex)
  if (!risk) return null

  const position = calculateRiskBarPosition(value, risk.thresholds)
  const hab = HABILLAGE[type]
  const levelLabel = hab.labels[risk.level]
  const levelColor = colorClassForLevel(risk.level)

  return (
    <div className="mt-1.5" title={hab.tooltip}>
      <div className="relative">
        <div className="flex h-2 rounded-full overflow-hidden">
          <div className="flex-1" style={{ backgroundColor: WHO_RISK_COLORS.low.bg }} />
          <div className="flex-1" style={{ backgroundColor: WHO_RISK_COLORS.high.bg }} />
          <div className="flex-1" style={{ backgroundColor: WHO_RISK_COLORS.very_high.bg }} />
        </div>
        <div
          className="absolute -top-0.5 transition-all duration-500 ease-out"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          <span className="text-marine text-[10px] leading-none">▲</span>
        </div>
      </div>
      <p className={`text-[10px] uppercase tracking-wide font-semibold mt-1 ${levelColor}`}>
        {levelLabel}
        {hab.source && <span className="text-marine/40 font-normal normal-case"> · {hab.source}</span>}
      </p>
    </div>
  )
}

function colorClassForLevel(level: WhoRiskLevel): string {
  if (level === 'low') return 'text-green-700'
  if (level === 'high') return 'text-yellow-700'
  return 'text-red-600'
}
