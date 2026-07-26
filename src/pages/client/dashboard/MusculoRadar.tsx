import { useEffect, useMemo, useState } from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Activity, BarChart3, Radar as RadarIcon } from 'lucide-react'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getCategorization,
  getCpaflaRange,
  getPercentile,
  type Category,
  type NormsType,
  type TestKey
} from '../../../lib/norms'
import { TableProperties } from 'lucide-react'
import { CategoryBadge } from '../../../components/CategoryBadge'
import { DeltaIndicator } from '../../../components/DeltaIndicator'
import { MetricSelectable } from '../../../components/MetricSelectable'

interface MusculoRadarProps {
  current: BilanData
  age: number | null
  sex: 'F' | 'M' | null
  norms: NormsType
  /** Bilan de référence, choisi par le sélecteur global du Dashboard. */
  compare?: BilanData
  /** Nom du bilan comparé (« bilan précédent », « bilan du 4 sept. 2025 »). */
  compareLabel?: string | null
}

interface Axis {
  label: string
  key: keyof BilanData
  test: TestKey
  unit: string
}

const AXES: Axis[] = [
  { label: 'Push-ups', key: 'pushups', test: 'pushups', unit: 'reps' },
  { label: 'Sit-ups', key: 'situps', test: 'situps', unit: 'reps' },
  { label: 'Saut vertical', key: 'saut_vertical_cm', test: 'verticalJump', unit: 'cm' },
  { label: 'Puissance jambes', key: 'puissance_jambes_watts', test: 'legPower', unit: 'W' },
  { label: 'Flexion tronc', key: 'flexion_tronc_cm', test: 'trunkFlexion', unit: 'cm' },
  { label: 'Endurance dos', key: 'endurance_dos_sec', test: 'backEndurance', unit: 's' }
]

/** Couleur de remplissage de la barre selon la catégorie. */
const BAR_COLOR: Record<Category, string> = {
  A_AMELIORER: 'bg-red-500',
  ACCEPTABLE: 'bg-orange-500',
  BIEN: 'bg-yellow-500',
  TRES_BIEN: 'bg-green-500',
  EXCELLENT: 'bg-green-700'
}

const VIEW_STORAGE_KEY = 'kinesio.musculo.view'
const BAREME_STORAGE_KEY = 'kinesio.musculo.bareme'
type ViewMode = 'bars' | 'radar'

function loadView(): ViewMode {
  if (typeof window === 'undefined') return 'bars'
  const v = window.localStorage.getItem(VIEW_STORAGE_KEY)
  return v === 'radar' ? 'radar' : 'bars'
}

function loadBareme(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(BAREME_STORAGE_KEY) === '1'
}

function pctFor(data: BilanData, axis: Axis, age: number | null, sex: 'F' | 'M' | null, norms: NormsType): number | null {
  const v = data[axis.key]
  if (typeof v !== 'number' || age === null || sex === null) return null
  return getPercentile(axis.test, v, age, sex, norms)
}

function valueFor(data: BilanData, axis: Axis): number | null {
  const v = data[axis.key]
  return typeof v === 'number' ? v : null
}

function catFor(value: number | null, axis: Axis, age: number | null, sex: 'F' | 'M' | null, norms: NormsType): Category | null {
  if (value === null || age === null || sex === null) return null
  return getCategorization(axis.test, value, age, sex, norms)
}

export function MusculoRadar({
  current,
  age,
  sex,
  norms,
  compare: compareData,
  compareLabel = null
}: MusculoRadarProps) {
  const [view, setView] = useState<ViewMode>(() => loadView())
  const [showBareme, setShowBareme] = useState<boolean>(() => loadBareme())

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_STORAGE_KEY, view)
  }, [view])
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(BAREME_STORAGE_KEY, showBareme ? '1' : '0')
  }, [showBareme])

  // Le barème (bornes par catégorie) n'a de sens que sous CPAFLA, où les cotes
  // sont des intervalles ; sous ACSM (percentiles), on ne propose pas le tableau.
  const canShowBareme = norms === 'cpafla' && age !== null && (sex === 'M' || sex === 'F')

  const rows = useMemo(
    () =>
      AXES.map(axis => {
        const value = valueFor(current, axis)
        const previousValue = compareData ? valueFor(compareData, axis) : null
        return {
          axis,
          value,
          previousValue,
          percentile: pctFor(current, axis, age, sex, norms),
          previousPercentile: compareData ? pctFor(compareData, axis, age, sex, norms) : null,
          category: catFor(value, axis, age, sex, norms)
        }
      }),
    [current, compareData, age, sex, norms]
  )

  const anyData = rows.some(r => r.value !== null)

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-gold-dark" />
          <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">
            Profil musculosquelettique
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {canShowBareme && view === 'bars' && (
            <button
              type="button"
              onClick={() => setShowBareme(b => !b)}
              aria-pressed={showBareme}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                showBareme
                  ? 'bg-gold/15 text-gold-dark hover:bg-gold/25'
                  : 'bg-cream/70 text-marine/70 hover:bg-cream-dark hover:text-marine'
              }`}
              title="Afficher le barème CPAFLA pour la tranche d'âge du client"
            >
              <TableProperties size={13} />
              Barème
            </button>
          )}
          <button
            type="button"
            onClick={() => setView(v => (v === 'bars' ? 'radar' : 'bars'))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-cream/70 text-marine/70 hover:bg-cream-dark hover:text-marine transition-colors"
            title={view === 'bars' ? 'Basculer en vue radar' : 'Basculer en vue barres'}
          >
            {view === 'bars' ? <RadarIcon size={13} /> : <BarChart3 size={13} />}
            {view === 'bars' ? 'Vue radar' : 'Vue barres'}
          </button>
        </div>
      </div>

      {!anyData ? (
        <p className="text-marine/45 text-sm py-12 text-center">
          Aucune donnée musculosquelettique catégorisable dans ce bilan.
        </p>
      ) : view === 'bars' ? (
        <>
          <BarsView rows={rows} compareLabel={compareLabel} />
          {canShowBareme && showBareme && (
            <BaremeTable age={age as number} sex={sex as 'F' | 'M'} rows={rows} />
          )}
        </>
      ) : (
        <RadarView rows={rows} compare={compareData} compareLabel={compareLabel} />
      )}
    </div>
  )
}

interface Row {
  axis: Axis
  value: number | null
  previousValue: number | null
  percentile: number | null
  previousPercentile: number | null
  category: Category | null
}

function BarsView({ rows, compareLabel }: { rows: Row[]; compareLabel: string | null }) {
  return (
    <>
      {compareLabel && (
        <p className="text-marine/45 text-xs mb-3">Les écarts (▲ ▼) sont calculés vs le {compareLabel}.</p>
      )}
      <div className="space-y-2.5">
        {rows.map(r => (
          <BarRow key={r.axis.key} row={r} />
        ))}
      </div>
    </>
  )
}

function BarRow({ row }: { row: Row }) {
  const { axis, value, previousValue, percentile, category } = row
  const color = category ? BAR_COLOR[category] : 'bg-cream-dark'
  const width = percentile === null ? 0 : Math.max(0, Math.min(100, percentile))

  // Sous 640 px, la barre (`order-last w-full`) passe seule sur une deuxième
  // ligne : sinon les colonnes fixes l'écrasent à zéro et l'écart déborde.
  const inner = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-1 px-1">
      <div className="min-w-0 flex-1 text-sm text-marine font-medium sm:w-28 sm:flex-none">{axis.label}</div>
      <div className="order-last w-full bg-cream-dark/30 rounded-full h-7 relative overflow-hidden sm:order-none sm:w-auto sm:flex-1">
        {percentile !== null && (
          <div
            className={`h-full rounded-full ${color} transition-all duration-500 ease-out`}
            style={{ width: `${width}%` }}
            title={`${Math.round(percentile)}e percentile`}
          />
        )}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-marine">
          {value === null ? '—' : `${value} ${axis.unit}`}
        </span>
      </div>
      <div className="shrink-0 text-right sm:w-24">
        {category ? (
          <span className={`text-xs font-medium ${CATEGORY_COLORS[category]}`} title={CATEGORY_LABELS[category]}>
            {CATEGORY_LABELS[category]}
          </span>
        ) : (
          <CategoryBadge category={null} variant="compact" />
        )}
      </div>
      <div className="shrink-0 text-right sm:w-20">
        {/* Les 6 tests musculo sont tous « higher = better » — pas de lowerIsBetter. */}
        <DeltaIndicator current={value} previous={previousValue} unit={axis.unit} />
      </div>
    </div>
  )

  return (
    <MetricSelectable
      selectionKey={`musculo:${axis.key as string}`}
      data={{
        key: `musculo:${axis.key as string}`,
        label: axis.label,
        value: value ?? '—',
        unit: axis.unit,
        category: category ? CATEGORY_LABELS[category] : undefined,
        percentile: percentile ?? undefined
      }}
      available={value !== null}
    >
      {inner}
    </MetricSelectable>
  )
}

/** Tableau du barème CPAFLA pour la tranche d'âge + sexe du client. Reconstruit les
 *  intervalles à partir des bornes basses de catégorie (p10/p25/p50/p75 = Acceptable/
 *  Bien/Très bien/Excellent) — exactement comme le guide. La cellule de la cote du
 *  client est surlignée : Marie voit d'un coup pourquoi le résultat tombe dans sa case. */
const BAREME_CATS: Category[] = ['A_AMELIORER', 'ACCEPTABLE', 'BIEN', 'TRES_BIEN', 'EXCELLENT']

function BaremeTable({ age, sex, rows }: { age: number; sex: 'F' | 'M'; rows: Row[] }) {
  const catByTest = new Map<TestKey, Category | null>(rows.map(r => [r.axis.test, r.category]))
  const built = AXES.map(axis => {
    const range = getCpaflaRange(axis.test, age, sex)
    if (!range) return null
    const p = range.percentiles
    const cells: Record<Category, string> = {
      A_AMELIORER: `≤ ${p.p10 - 1}`,
      ACCEPTABLE: `${p.p10}–${p.p25 - 1}`,
      BIEN: `${p.p25}–${p.p50 - 1}`,
      TRES_BIEN: `${p.p50}–${p.p75 - 1}`,
      EXCELLENT: `≥ ${p.p75}`
    }
    return { axis, cells, ageMin: range.ageMin, ageMax: range.ageMax, current: catByTest.get(axis.test) ?? null }
  }).filter((b): b is NonNullable<typeof b> => b !== null)

  if (built.length === 0) {
    return (
      <p className="mt-4 pt-4 border-t border-cream-dark/40 text-marine/50 text-xs">
        Aucun barème CPAFLA pour cet âge (tables 15 à 69 ans).
      </p>
    )
  }

  const band = `${built[0].ageMin}–${built[0].ageMax}`
  return (
    <div className="mt-4 pt-4 border-t border-cream-dark/40">
      <p className="text-marine/70 text-xs font-medium mb-2">
        Barème CPAFLA — {sex === 'F' ? 'femmes' : 'hommes'} {band} ans
        <span className="text-marine/40 font-normal"> · la case surlignée = la cote du client</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="text-left font-semibold text-marine/50 py-1.5 pr-3 whitespace-nowrap">Test</th>
              {BAREME_CATS.map(c => (
                <th key={c} className={`text-center font-semibold py-1.5 px-2 whitespace-nowrap ${CATEGORY_COLORS[c]}`}>
                  {CATEGORY_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {built.map(b => (
              <tr key={b.axis.key as string} className="border-t border-cream-dark/30">
                <td className="text-marine font-medium py-1.5 pr-3 whitespace-nowrap">
                  {b.axis.label} <span className="text-marine/40 font-normal">({b.axis.unit})</span>
                </td>
                {BAREME_CATS.map(c => {
                  const active = b.current === c
                  return (
                    <td
                      key={c}
                      className={`text-center py-1.5 px-2 tabular-nums whitespace-nowrap ${
                        active ? `font-bold ${CATEGORY_COLORS[c]} bg-cream/80 rounded` : 'text-marine/70'
                      }`}
                    >
                      {b.cells[c]}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RadarView({
  rows,
  compare,
  compareLabel
}: {
  rows: Row[]
  compare?: BilanData
  compareLabel: string | null
}) {
  const data = rows.map(r => ({
    axis: r.axis.label,
    current: r.percentile ?? 0,
    previous: r.previousPercentile ?? 0
  }))

  return (
    <>
      <p className="text-marine/45 text-xs mb-3">
        Percentiles 0-100 par axe
        {compareLabel ? ` — comparaison ce bilan vs le ${compareLabel}` : ''}
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="rgba(10, 28, 94, 0.15)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: 'rgba(10, 28, 94, 0.75)', fontSize: 11 }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'rgba(10, 28, 94, 0.35)', fontSize: 10 }}
              tickCount={5}
            />
            {compare && (
              <Radar
                name={compareLabel ? compareLabel.replace(/^bilan /, 'Bilan ') : 'Précédent'}
                dataKey="previous"
                stroke="#d4a574"
                strokeDasharray="4 3"
                fill="#d4a574"
                fillOpacity={0.1}
              />
            )}
            <Radar
              name="Ce bilan"
              dataKey="current"
              stroke="#0a1c5e"
              fill="#0a1c5e"
              fillOpacity={0.25}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #d4a574',
                borderRadius: 8,
                fontSize: 12
              }}
              formatter={(v: unknown) => [`${Math.round(typeof v === 'number' ? v : 0)}e percentile`, '']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
