import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { formatBilanMonth } from '../bilanFields'
import { getPopulationAverage, type TestKey } from '../../../lib/norms'
import { computeBilan, type BilanProfile } from '../../../lib/bilan-computed'
import { DeltaIndicator } from '../../../components/DeltaIndicator'

/** `'overall'` est recalculé ; les autres clés sont lues telles quelles dans BilanData. */
type MetricKey = 'overall' | keyof BilanData

type MetricGroup = 'Vue d’ensemble' | 'Composition' | 'Cardio' | 'Musculosquelettique'

interface Metric {
  key: MetricKey
  label: string
  unit: string
  group: MetricGroup
  /** Trace la ligne « moyenne population » quand la norme publie des percentiles. */
  testKey?: TestKey
  /** Une baisse est une amélioration (% gras, IMC, tour de taille, FC, PA). */
  lowerIsBetter?: boolean
}

const METRICS: Metric[] = [
  { key: 'overall', label: 'Score global', unit: '/ 4', group: 'Vue d’ensemble' },

  { key: 'poids_kg', label: 'Poids', unit: 'kg', group: 'Composition' },
  { key: 'imc', label: 'IMC', unit: 'kg/m²', group: 'Composition', testKey: 'bmi', lowerIsBetter: true },
  { key: 'pourcentage_gras', label: '% de gras', unit: '%', group: 'Composition', testKey: 'bodyFat', lowerIsBetter: true },
  { key: 'tour_taille_cm', label: 'Tour de taille', unit: 'cm', group: 'Composition', testKey: 'waistCircumference', lowerIsBetter: true },
  { key: 'tour_hanche_cm', label: 'Tour de hanche', unit: 'cm', group: 'Composition', lowerIsBetter: true },

  { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min', group: 'Cardio', testKey: 'vo2max' },
  { key: 'met_equivalent', label: 'MET équivalent', unit: 'MET', group: 'Cardio' },
  { key: 'fc_repos', label: 'FC de repos', unit: 'bpm', group: 'Cardio', testKey: 'restingHeartRate', lowerIsBetter: true },
  { key: 'pa_systolique', label: 'Pression systolique', unit: 'mmHg', group: 'Cardio', testKey: 'bloodPressureSystolic', lowerIsBetter: true },
  { key: 'pa_diastolique', label: 'Pression diastolique', unit: 'mmHg', group: 'Cardio', testKey: 'bloodPressureDiastolic', lowerIsBetter: true },

  { key: 'pushups', label: 'Push-ups', unit: 'reps', group: 'Musculosquelettique', testKey: 'pushups' },
  { key: 'situps', label: 'Sit-ups', unit: 'reps', group: 'Musculosquelettique', testKey: 'situps' },
  { key: 'saut_vertical_cm', label: 'Saut vertical', unit: 'cm', group: 'Musculosquelettique', testKey: 'verticalJump' },
  { key: 'puissance_jambes_watts', label: 'Puissance des jambes', unit: 'W', group: 'Musculosquelettique', testKey: 'legPower' },
  { key: 'flexion_tronc_cm', label: 'Flexion du tronc', unit: 'cm', group: 'Musculosquelettique', testKey: 'trunkFlexion' },
  { key: 'endurance_dos_sec', label: 'Endurance du dos', unit: 's', group: 'Musculosquelettique', testKey: 'backEndurance' }
]

const GROUP_ORDER: MetricGroup[] = ['Vue d’ensemble', 'Composition', 'Cardio', 'Musculosquelettique']

/** Les reps/W n'ont pas de décimale utile ; l'IMC et le % de gras si. */
const fmt = (v: number): string => v.toLocaleString('fr-CA', { maximumFractionDigits: 1 })

/** Valeur d'un bilan pour la métrique affichée (le score global se recalcule). */
function metricValue(bilan: Bilan, metric: MetricKey, profile: BilanProfile): number | null {
  if (metric === 'overall') return computeBilan(bilan.data, profile).overall.score
  const raw = bilan.data[metric]
  return typeof raw === 'number' && !Number.isNaN(raw) ? raw : null
}

interface ProgressionChartProps {
  bilans: Bilan[]
  profile: BilanProfile
  /** Si fourni, le point correspondant à ce bilan est mis en évidence (gold, plus gros). */
  activeBilanId?: string
  /** Objectif de % de gras (module nutrition) → trajectoire projetée sur la courbe « % gras ». */
  bodyFatTarget?: number | null
  /** Libellé de l'échéance (ex. « mars 2027 ») — point final de la projection. */
  bodyFatGoalLabel?: string | null
  /** Bilan de référence, choisi par le sélecteur global du Dashboard. */
  compareBilan?: Bilan | null
  /** Nom court du bilan comparé, pour l'étiquette de la ligne (« 10 juin 2024 »). */
  compareLabel?: string | null
}

export function ProgressionChart({
  bilans,
  profile,
  activeBilanId,
  bodyFatTarget,
  bodyFatGoalLabel,
  compareBilan,
  compareLabel
}: ProgressionChartProps) {
  const [metric, setMetric] = useState<MetricKey>('vo2max')

  // Ne proposer que ce qui a été mesuré chez ce client — sinon la liste offre
  // une dizaine de courbes vides.
  const available = useMemo(
    () =>
      METRICS.filter(
        m => m.key === 'overall' || bilans.some(b => typeof b.data[m.key as keyof BilanData] === 'number')
      ),
    [bilans]
  )
  // La métrique choisie peut disparaître (changement de client) → repli sur la 1re.
  const current = available.find(m => m.key === metric) ?? available[0] ?? METRICS[0]

  const metricKey = current.key

  const data = useMemo(() => {
    const chrono = [...bilans].reverse()
    return chrono.map(b => ({
      label: formatBilanMonth(b.date),
      value: metricValue(b, metricKey, profile),
      isActive: b.id === activeBilanId
    }))
  }, [bilans, metricKey, profile, activeBilanId])

  const compareValue = compareBilan ? metricValue(compareBilan, metricKey, profile) : null

  // Valeur « courante » pour l'écart : le bilan mis en évidence, sinon le plus récent.
  const currentValue = useMemo(() => {
    const active = bilans.find(b => b.id === activeBilanId)
    if (active) return metricValue(active, metricKey, profile)
    const chrono = [...bilans].reverse()
    for (let i = chrono.length - 1; i >= 0; i--) {
      const v = metricValue(chrono[i], metricKey, profile)
      if (v !== null) return v
    }
    return null
  }, [bilans, activeBilanId, metricKey, profile])

  // Trajectoire projetée : uniquement sur la courbe « % gras » quand un objectif
  // est défini. Ligne pointillée du dernier % gras réel vers la cible à l'échéance.
  const showProjection =
    metricKey === 'pourcentage_gras' && typeof bodyFatTarget === 'number' && Boolean(bodyFatGoalLabel)
  const chartData = useMemo(() => {
    const base = data.map(d => ({ ...d, projected: null as number | null }))
    if (!showProjection) return base
    let lastActual = -1
    for (let i = 0; i < base.length; i++) if (base[i].value !== null) lastActual = i
    if (lastActual < 0) return base
    base[lastActual] = { ...base[lastActual], projected: base[lastActual].value }
    base.push({ label: bodyFatGoalLabel as string, value: null, isActive: false, projected: bodyFatTarget as number })
    return base
  }, [data, showProjection, bodyFatTarget, bodyFatGoalLabel])

  // Moyenne population (P50) — affichée en pointillé pour comparaison continue.
  const populationAverage = useMemo(() => {
    if (!current.testKey || profile.age === null || profile.sex === null) return null
    return getPopulationAverage(current.testKey, profile.age, profile.sex, profile.norms)
  }, [current, profile])

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-gold-dark" />
          <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Progression dans le temps</h3>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-marine/55">
          <span>Mesure</span>
          <select
            value={current.key as string}
            onChange={e => setMetric(e.target.value as MetricKey)}
            className="rounded-md border border-cream-dark bg-cream/60 px-2 py-1 text-xs font-medium text-marine hover:bg-cream-dark focus:outline-none focus:ring-2 focus:ring-gold/50"
            title="Mesure tracée dans le temps — seules celles mesurées chez ce client sont proposées"
          >
            {GROUP_ORDER.filter(g => available.some(m => m.group === g)).map(g => (
              <optgroup key={g} label={g}>
                {available
                  .filter(m => m.group === g)
                  .map(m => (
                    <option key={m.key as string} value={m.key as string}>
                      {m.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {compareBilan && (
        <div className="flex items-center gap-2 flex-wrap mb-3 text-xs">
          {compareValue === null ? (
            <span className="text-marine/40">
              Pas de {current.label.toLowerCase()} mesuré sur le {compareLabel ?? 'bilan de référence'}.
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-marine/55">
              <span>
                Référence ({compareLabel}) : {fmt(compareValue)} {current.unit}
              </span>
              <span className="text-marine/25">·</span>
              <DeltaIndicator
                current={currentValue}
                previous={compareValue}
                unit={current.unit}
                lowerIsBetter={current.lowerIsBetter}
              />
            </span>
          )}
        </div>
      )}

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="rgba(10, 28, 94, 0.08)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 11 }} stroke="rgba(10, 28, 94, 0.15)" />
            <YAxis
              tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 11 }}
              stroke="rgba(10, 28, 94, 0.15)"
              width={46}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #d4a574',
                borderRadius: 8,
                color: '#0a1c5e',
                fontSize: 13
              }}
              formatter={(v: unknown) => [`${typeof v === 'number' ? fmt(v) : v} ${current.unit}`, current.label]}
            />
            {populationAverage !== null && (
              <ReferenceLine
                y={populationAverage}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{
                  value: `Moyenne ${profile.sex === 'M' ? 'H' : 'F'} ${Math.floor((profile.age ?? 0) / 10) * 10}-${Math.floor((profile.age ?? 0) / 10) * 10 + 9}`,
                  fill: '#64748b',
                  fontSize: 11,
                  position: 'right'
                }}
              />
            )}
            {compareBilan && compareValue !== null && (
              <ReferenceLine
                y={compareValue}
                stroke="#0a1c5e"
                strokeDasharray="6 3"
                strokeOpacity={0.55}
                label={{
                  value: compareLabel ?? 'Référence',
                  fill: '#0a1c5e',
                  fontSize: 11,
                  position: 'insideTopLeft'
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#b8834a"
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; payload?: { isActive?: boolean }; index?: number }) => {
                const { cx, cy, payload, index = 0 } = props
                if (cx === undefined || cy === undefined) return <g key={`dot-${index}`} />
                const isActive = payload?.isActive
                return (
                  <circle
                    key={`dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={isActive ? 6 : 4}
                    fill={isActive ? '#d4a574' : '#b8834a'}
                    stroke={isActive ? '#0a1c5e' : 'none'}
                    strokeWidth={isActive ? 2 : 0}
                  />
                )
              }}
              activeDot={{ r: 7 }}
              connectNulls
              isAnimationActive
            />
            {showProjection && (
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#0a1c5e"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 3.5, fill: '#0a1c5e' }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
