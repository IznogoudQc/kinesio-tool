import { useEffect, useMemo, useState } from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Activity, BarChart3, Radar as RadarIcon } from 'lucide-react'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getCategorization,
  getPercentile,
  type Category,
  type NormsType,
  type TestKey
} from '../../../lib/norms'
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
type ViewMode = 'bars' | 'radar'

function loadView(): ViewMode {
  if (typeof window === 'undefined') return 'bars'
  const v = window.localStorage.getItem(VIEW_STORAGE_KEY)
  return v === 'radar' ? 'radar' : 'bars'
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

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_STORAGE_KEY, view)
  }, [view])

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

      {!anyData ? (
        <p className="text-marine/45 text-sm py-12 text-center">
          Aucune donnée musculosquelettique catégorisable dans ce bilan.
        </p>
      ) : view === 'bars' ? (
        <BarsView rows={rows} compareLabel={compareLabel} />
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

  const inner = (
    <div className="flex items-center gap-3 py-1 px-1">
      <div className="w-28 shrink-0 text-sm text-marine font-medium">{axis.label}</div>
      <div className="flex-1 bg-cream-dark/30 rounded-full h-7 relative overflow-hidden">
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
      <div className="w-24 shrink-0 text-right">
        {category ? (
          <span className={`text-xs font-medium ${CATEGORY_COLORS[category]}`} title={CATEGORY_LABELS[category]}>
            {CATEGORY_LABELS[category]}
          </span>
        ) : (
          <CategoryBadge category={null} variant="compact" />
        )}
      </div>
      <div className="w-20 shrink-0 text-right">
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
