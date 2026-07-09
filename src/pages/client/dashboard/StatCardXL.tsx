import { Trophy } from 'lucide-react'
import {
  CATEGORY_LABELS,
  getCategorization,
  getDeltaVsAverage,
  getNextCategoryTarget,
  getNormPercentiles,
  getPercentile,
  type NormsType,
  type TestKey
} from '../../../lib/norms'
import { CategoryRangeBar } from '../../../components/CategoryRangeBar'
import { DeltaIndicator } from '../../../components/DeltaIndicator'
import { MetricSelectable } from '../../../components/MetricSelectable'
import { formatBilanDate } from '../bilanFields'
import { useCountUp } from '../../../lib/useCountUp'

interface StatCardXLProps {
  label: string
  /** Très gros chiffre principal. */
  value: number | undefined
  unit?: string
  /** Pour le percentile + delta (optionnel). */
  test?: TestKey
  age?: number | null
  sex?: 'F' | 'M' | null
  norms?: NormsType
  /** En mode Synthèse : date ISO du bilan d'où provient cette valeur (chaque
   *  champ peut venir d'un bilan différent). Affiche un rappel « du … ». */
  originDate?: string
  /** Valeur du bilan de comparaison choisi → écart ▲▼ sous le grand chiffre. */
  previousValue?: number | undefined
  /** % gras, IMC, tour de taille : une baisse est une amélioration. */
  lowerIsBetter?: boolean
  /** Nom du bilan comparé (« bilan précédent », « bilan du 4 sept. 2025 »). */
  compareLabel?: string | null
}

function suffixe(p: number): string {
  return Math.round(p) === 1 ? 'er' : 'e'
}

export function StatCardXL({
  label,
  value,
  unit,
  test,
  age,
  sex,
  norms = 'acsm',
  originDate,
  previousValue,
  lowerIsBetter = false,
  compareLabel
}: StatCardXLProps) {
  const hasValue = typeof value === 'number' && !Number.isNaN(value)
  const animValue = useCountUp(hasValue ? (value as number) : null)

  const percentile =
    test && hasValue && typeof age === 'number' && sex
      ? getPercentile(test, value as number, age, sex, norms)
      : null
  const delta =
    test && hasValue && typeof age === 'number' && sex
      ? getDeltaVsAverage(test, value as number, age, sex, norms)
      : null

  const nextTarget =
    test && hasValue && typeof age === 'number' && sex
      ? getNextCategoryTarget(test, value as number, age, sex, norms)
      : null

  const rangeInfo =
    test && hasValue && typeof age === 'number' && sex
      ? getNormPercentiles(test, age, sex, norms)
      : null
  const ageBracket = typeof age === 'number'
    ? `${sex === 'M' ? 'H' : 'F'} ${Math.floor(age / 10) * 10}-${Math.floor(age / 10) * 10 + 9} ans`
    : undefined

  const category =
    test && hasValue && typeof age === 'number' && sex
      ? getCategorization(test, value as number, age, sex, norms)
      : null

  const selectionKey = test ? `stat:${test}` : null
  const selectionData = selectionKey
    ? {
        key: selectionKey,
        label,
        value: hasValue ? (value as number) : '—',
        unit,
        category: category ? CATEGORY_LABELS[category] : undefined,
        percentile: percentile ?? undefined,
        deltaPct: delta?.deltaPct
      }
    : null

  const card = (
    <div className="bg-gradient-to-br from-white to-cream/40 border border-cream-dark/30 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <p className="text-marine/55 text-xs uppercase tracking-wide font-medium">{label}</p>

      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-marine text-5xl font-bold leading-none tabular-nums">
          {hasValue ? (animValue ?? (value as number)).toLocaleString('fr-CA', { maximumFractionDigits: 1 }) : <span className="text-marine/25">—</span>}
        </span>
        {hasValue && unit && <span className="text-marine/45 text-base font-medium">{unit}</span>}
      </div>

      {hasValue && originDate && (
        <p className="text-marine/40 text-[10px] mt-1" title={`Valeur la plus récente disponible pour ${label}, mesurée le ${formatBilanDate(originDate)}.`}>
          du {formatBilanDate(originDate)}
        </p>
      )}

      {hasValue && typeof previousValue === 'number' && (
        <div className="mt-1.5" title={compareLabel ? `Écart vs le ${compareLabel}` : undefined}>
          <DeltaIndicator
            current={value as number}
            previous={previousValue}
            unit={unit}
            lowerIsBetter={lowerIsBetter}
          />
        </div>
      )}

      {percentile !== null && (
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span className="font-semibold text-marine">
            {Math.round(percentile)}
            <sup>{suffixe(percentile)}</sup> perc.
          </span>
          {delta && (
            <span className={`font-medium ${delta.isBetter ? 'text-green-600' : 'text-red-500'}`}>
              {delta.deltaPct >= 0 ? '+' : ''}
              {delta.deltaPct.toFixed(0)} %
            </span>
          )}
        </div>
      )}

      {rangeInfo && hasValue && (
        <div className="mt-3">
          <CategoryRangeBar
            value={value as number}
            percentiles={rangeInfo.percentiles}
            unit={unit}
            ageRange={ageBracket}
            lowerIsBetter={rangeInfo.lowerIsBetter}
            variant="compact"
          />
        </div>
      )}

      {nextTarget && (
        <div className="mt-3 pt-3 border-t border-cream-dark/30">
          {nextTarget.isAtTop ? (
            <div className="flex items-center gap-1.5">
              <Trophy size={13} className="text-gold-dark shrink-0" aria-hidden />
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium text-marine/55">
                  Objectif
                </p>
                <p className="text-marine text-xs font-semibold leading-tight">
                  Niveau maximal atteint
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wide font-medium text-marine/55">
                Objectif niveau suivant
              </p>
              <p className="text-marine text-xs mt-0.5 leading-tight">
                <span className="font-semibold tabular-nums">
                  {nextTarget.delta >= 0 ? '+' : ''}
                  {nextTarget.delta.toLocaleString('fr-CA', { maximumFractionDigits: 1 })}
                  {unit ? ` ${unit}` : ''}
                </span>
                <span className="text-marine/55"> pour atteindre </span>
                <span className="font-semibold">{CATEGORY_LABELS[nextTarget.nextCategory]}</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )

  if (selectionKey && selectionData) {
    return (
      <MetricSelectable selectionKey={selectionKey} data={selectionData} available={hasValue}>
        {card}
      </MetricSelectable>
    )
  }
  return card
}
