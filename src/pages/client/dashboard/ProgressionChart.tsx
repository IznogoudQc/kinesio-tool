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
import { getPopulationAverage } from '../../../lib/norms'
import { computeBilan, type BilanProfile } from '../../../lib/bilan-computed'

type MetricKey = 'vo2max' | 'pourcentage_gras' | 'imc' | 'overall'

const METRICS: { key: MetricKey; label: string; unit: string; testKey?: 'vo2max' | 'bodyFat' | 'bmi' }[] = [
  { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min', testKey: 'vo2max' },
  { key: 'pourcentage_gras', label: '% gras', unit: '%', testKey: 'bodyFat' },
  { key: 'imc', label: 'IMC', unit: 'kg/m²', testKey: 'bmi' },
  { key: 'overall', label: 'Score global', unit: '/ 5' }
]

interface ProgressionChartProps {
  bilans: Bilan[]
  profile: BilanProfile
  /** Si fourni, le point correspondant à ce bilan est mis en évidence (gold, plus gros). */
  activeBilanId?: string
  /** Objectif de % de gras (module nutrition) → trajectoire projetée sur la courbe « % gras ». */
  bodyFatTarget?: number | null
  /** Libellé de l'échéance (ex. « mars 2027 ») — point final de la projection. */
  bodyFatGoalLabel?: string | null
}

export function ProgressionChart({
  bilans,
  profile,
  activeBilanId,
  bodyFatTarget,
  bodyFatGoalLabel
}: ProgressionChartProps) {
  const [metric, setMetric] = useState<MetricKey>('vo2max')

  const data = useMemo(() => {
    const chrono = [...bilans].reverse()
    return chrono.map(b => {
      const label = formatBilanMonth(b.date)
      const isActive = b.id === activeBilanId
      if (metric === 'overall') {
        const c = computeBilan(b.data, profile)
        return { label, value: c.overall.score, isActive }
      }
      const raw = b.data[metric]
      return { label, value: typeof raw === 'number' ? raw : null, isActive }
    })
  }, [bilans, metric, profile, activeBilanId])

  // Trajectoire projetée : uniquement sur la courbe « % gras » quand un objectif
  // est défini. Ligne pointillée du dernier % gras réel vers la cible à l'échéance.
  const showProjection =
    metric === 'pourcentage_gras' && typeof bodyFatTarget === 'number' && Boolean(bodyFatGoalLabel)
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
    const m = METRICS.find(x => x.key === metric)
    if (!m?.testKey || profile.age === null || profile.sex === null) return null
    return getPopulationAverage(m.testKey, profile.age, profile.sex, profile.norms)
  }, [metric, profile])

  const current = METRICS.find(m => m.key === metric)!

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-gold-dark" />
          <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Progression dans le temps</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                metric === m.key
                  ? 'bg-marine text-cream'
                  : 'bg-cream/60 text-marine/65 hover:bg-cream-dark hover:text-marine'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="rgba(10, 28, 94, 0.08)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 11 }} stroke="rgba(10, 28, 94, 0.15)" />
            <YAxis
              tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 11 }}
              stroke="rgba(10, 28, 94, 0.15)"
              width={36}
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
              formatter={(v: unknown) => [`${typeof v === 'number' ? v.toFixed(1) : v} ${current.unit}`, current.label]}
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
