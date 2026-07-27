import { useEffect, useState } from 'react'
import { TableProperties, Trophy } from 'lucide-react'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getCategorization,
  getDeltaVsAverage,
  getNextCategoryTarget,
  getNormPercentiles,
  getPercentile,
  type Category,
  type NormPercentiles,
  type NormsType,
  type TestKey
} from '../../../lib/norms'
import { CategoryRangeBar } from '../../../components/CategoryRangeBar'
import { DeltaIndicator } from '../../../components/DeltaIndicator'
import { Sparkline } from '../../../components/Sparkline'
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
  /** Historique complet du champ, du plus ancien au plus récent → mini-courbe. */
  history?: (number | null)[]
  /** Affiche un bouton « Barème » qui déplie la table des catégories (percentiles
   *  ACSM par âge/sexe) avec la catégorie du client surlignée. */
  bareme?: boolean
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
  compareLabel,
  history,
  bareme = false
}: StatCardXLProps) {
  const hasValue = typeof value === 'number' && !Number.isNaN(value)
  const animValue = useCountUp(hasValue ? (value as number) : null)
  const sparkPoints = history?.filter(v => v !== null).length ?? 0

  const baremeKey = test ? `kinesio.stat.${test}.bareme` : null
  const [showBareme, setShowBareme] = useState<boolean>(
    () => typeof window !== 'undefined' && !!baremeKey && window.localStorage.getItem(baremeKey) === '1'
  )
  useEffect(() => {
    if (typeof window !== 'undefined' && baremeKey) window.localStorage.setItem(baremeKey, showBareme ? '1' : '0')
  }, [showBareme, baremeKey])

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

  const baremeEnabled = bareme && !!rangeInfo && !rangeInfo.lowerIsBetter

  const card = (
    <div className="h-full bg-gradient-to-br from-white to-cream/40 border border-cream-dark/30 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <p className="dash-eyebrow text-gold-dark">{label}</p>
        {baremeEnabled && (
          <button
            type="button"
            onClick={() => setShowBareme(b => !b)}
            aria-pressed={showBareme}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 ${
              showBareme ? 'bg-gold/15 text-gold-dark hover:bg-gold/25' : 'bg-cream/70 text-marine/70 hover:bg-cream-dark hover:text-marine'
            }`}
            title={`Afficher le barème ${label} (percentiles ACSM par âge et sexe)`}
          >
            <TableProperties size={13} />
            Barème
          </button>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 mt-1.5">
        <span className="dash-display text-marine text-5xl font-bold leading-none tabular-nums">
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

      {sparkPoints >= 2 && (
        <div
          className="mt-2.5"
          title={`Évolution du ${label.toLowerCase()} sur ${sparkPoints} bilans (du plus ancien au plus récent).`}
        >
          <Sparkline values={history as (number | null)[]} lowerIsBetter={lowerIsBetter} />
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

      {baremeEnabled && showBareme && rangeInfo && (
        <NormBareme
          title={label}
          percentiles={rangeInfo.percentiles}
          unit={unit}
          ageBracket={ageBracket}
          activeCategory={category}
        />
      )}
    </div>
  )

  if (selectionKey && selectionData) {
    return (
      <MetricSelectable selectionKey={selectionKey} data={selectionData} available={hasValue} className="h-full">
        {card}
      </MetricSelectable>
    )
  }
  return card
}

/** Ordre d'affichage du barème : meilleure catégorie en haut. */
const CAT_ORDER: Category[] = ['EXCELLENT', 'TRES_BIEN', 'BIEN', 'ACCEPTABLE', 'A_AMELIORER']

/** Table des catégories (percentiles ACSM) pour un test « plus haut = mieux »
 *  (VO2max) : chaque ligne = catégorie + plage de valeurs, celle du client
 *  surlignée. Les seuils P10/P25/P50/P75 délimitent les cinq cotes. */
function NormBareme({
  title,
  percentiles: p,
  unit,
  ageBracket,
  activeCategory
}: {
  title: string
  percentiles: NormPercentiles
  unit?: string
  ageBracket?: string
  activeCategory: Category | null
}) {
  const nf = (n: number): string => n.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
  const u = unit ? ` ${unit}` : ''
  const ranges: Record<Category, string> = {
    EXCELLENT: `≥ ${nf(p.p75)}${u}`,
    TRES_BIEN: `${nf(p.p50)} – ${nf(p.p75)}${u}`,
    BIEN: `${nf(p.p25)} – ${nf(p.p50)}${u}`,
    ACCEPTABLE: `${nf(p.p10)} – ${nf(p.p25)}${u}`,
    A_AMELIORER: `< ${nf(p.p10)}${u}`
  }
  return (
    <div className="mt-4 pt-4 border-t border-cream-dark/40">
      <p className="text-marine/70 text-xs font-medium mb-2">
        Barème {title}
        {ageBracket ? ` · ${ageBracket}` : ''}
        <span className="text-marine/40 font-normal"> · votre catégorie est surlignée</span>
      </p>
      <div className="space-y-1">
        {CAT_ORDER.map(cat => {
          const active = cat === activeCategory
          return (
            <div
              key={cat}
              className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-xs ${
                active ? 'bg-gold/15 ring-1 ring-gold/40' : ''
              }`}
            >
              <span className={`font-medium ${CATEGORY_COLORS[cat]}`}>{CATEGORY_LABELS[cat]}</span>
              <span className="tabular-nums text-marine/70">{ranges[cat]}</span>
            </div>
          )
        })}
      </div>
      <p className="text-marine/40 text-[11px] mt-2">
        Percentiles ACSM par âge et sexe ; la cote provient de ces seuils.
      </p>
    </div>
  )
}
