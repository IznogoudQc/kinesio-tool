import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown, ChevronRight, Ruler, TrendingUp } from 'lucide-react'
import { formatBilanDate, formatBilanMonth } from '../bilanFields'
import { kgToWeightInput, weightUnitLabel } from '../../../lib/units'

/** Section « Mesures corporelles » du Bilan complet — **alimentée uniquement par
 *  les bilans** (chaque bilan = une prise), pas par l'onglet Mesures. Reprend le
 *  système de l'onglet Mesures : détail dépliable + évolution (pills + périodes). */

type Group = 'circ' | 'weights' | 'composition'
type PeriodFilter = 'all' | '30d' | '90d' | '6m' | '1y'

interface Metric {
  key: string
  label: string
  unit: string
  group: Group
  digits: number
  lowerIsBetter: boolean
  /** Lit la valeur (unité d'affichage) depuis les données d'un bilan. */
  read: (d: BilanData) => number | null
}

const GROUP_LABEL: Record<Group, string> = {
  circ: 'Circonférences',
  weights: 'Poids & ratios',
  composition: 'Composition corporelle'
}

const PERIOD_LABEL: Record<PeriodFilter, string> = { '30d': '30 j', '90d': '90 j', '6m': '6 mois', '1y': '1 an', all: 'Tout' }
const PERIOD_DAYS: Record<PeriodFilter, number | null> = { '30d': 30, '90d': 90, '6m': 183, '1y': 365, all: null }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function daysSince(iso: string, today: number): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return 0
  const d = Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
  return Math.max(0, Math.floor((today - d) / 86_400_000))
}

function imcOf(d: BilanData): number | null {
  const direct = num(d.imc)
  if (direct !== null) return direct
  const p = num(d.poids_kg)
  const t = num(d.taille_cm)
  if (p === null || t === null || t <= 0) return null
  return Math.round((p / (t / 100) ** 2) * 10) / 10
}

function ratioTH(d: BilanData): number | null {
  const t = num(d.tour_taille_cm)
  const h = num(d.tour_hanche_cm)
  if (t === null || h === null || h <= 0) return null
  return Math.round((t / h) * 100) / 100
}

function somme4Plis(d: BilanData): number | null {
  const p = [d.pli_triceps, d.pli_biceps, d.pli_sous_scap, d.pli_iliaque].map(num)
  return p.every(v => v !== null) ? (p as number[]).reduce((a, b) => a + b, 0) : null
}

const nf = (n: number | null, digits: number): string =>
  n === null ? '—' : n.toLocaleString('fr-CA', { maximumFractionDigits: digits })

export function BilanMeasuresOverview({
  bilans,
  unitWeight = 'kg'
}: {
  /** Du plus récent au plus ancien (ordre de `bilansService.list`). */
  bilans: Bilan[]
  unitWeight?: 'kg' | 'lb'
}) {
  const wLabel = weightUnitLabel(unitWeight)

  const METRICS = useMemo<Metric[]>(
    () => [
      { key: 'taille', label: 'Tour de taille', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: true, read: d => num(d.tour_taille_cm) },
      { key: 'hanche', label: 'Hanche', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: false, read: d => num(d.tour_hanche_cm) },
      { key: 'biceps', label: 'Biceps fléchi', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: false, read: d => num(d.circ_biceps_flechi_cm) },
      { key: 'cuisse', label: 'Cuisse (2 po du genou)', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: false, read: d => num(d.circ_cuisse_cm) },
      { key: 'epaule', label: 'Épaules et pec', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: false, read: d => num(d.circ_epaules_pec_cm) },
      { key: 'poids', label: 'Poids', unit: wLabel, group: 'weights', digits: 1, lowerIsBetter: false, read: d => { const p = num(d.poids_kg); return p === null ? null : kgToWeightInput(p, unitWeight) } },
      { key: 'ratio', label: 'Ratio taille / hanche', unit: '', group: 'weights', digits: 2, lowerIsBetter: true, read: ratioTH },
      { key: 'imc', label: 'IMC', unit: 'kg/m²', group: 'weights', digits: 1, lowerIsBetter: true, read: imcOf },
      { key: 'gras', label: '% de gras', unit: '%', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pourcentage_gras) },
      { key: 'somme4', label: 'Somme des 4 plis', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: somme4Plis },
      { key: 'triceps', label: 'Pli triceps', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pli_triceps) },
      { key: 'biceps_pli', label: 'Pli biceps', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pli_biceps) },
      { key: 'sousscap', label: 'Pli sous-scapulaire', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pli_sous_scap) },
      { key: 'iliaque', label: 'Pli crête iliaque', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pli_iliaque) }
    ],
    [wLabel, unitWeight]
  )

  const [selected, setSelected] = useState<string>('taille')
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [showDetails, setShowDetails] = useState(false)

  // Bilans du plus ancien au plus récent (pour le tracé).
  const chrono = useMemo(() => [...bilans].reverse(), [bilans])
  const latest = bilans[0]
  const previous = bilans[1]

  const available = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    for (const m of METRICS) if (chrono.some(b => m.read(b.data) !== null)) s.add(m.key)
    return s
  }, [METRICS, chrono])

  const activeMetric = METRICS.find(m => m.key === selected && available.has(m.key)) ?? METRICS.find(m => available.has(m.key)) ?? METRICS[0]

  const chartData = useMemo(() => {
    const days = PERIOD_DAYS[period]
    const today = Date.now()
    const rows = days === null ? chrono : chrono.filter(b => daysSince(b.date, today) <= days)
    return rows
      .map(b => ({ label: formatBilanMonth(b.date), value: activeMetric.read(b.data) }))
      .filter(p => p.value !== null)
  }, [chrono, period, activeMetric])

  if (!latest) {
    return (
      <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Ruler size={16} className="text-gold-dark" />
          <h3 className="dash-eyebrow text-gold-dark">Mesures corporelles</h3>
        </div>
        <p className="text-marine/45 text-sm">Aucun bilan pour ce client.</p>
      </div>
    )
  }

  const detailByGroup = (['circ', 'weights', 'composition'] as Group[]).map(g => ({
    group: g,
    metrics: METRICS.filter(m => m.group === g && m.read(latest.data) !== null)
  })).filter(x => x.metrics.length > 0)

  const groupsForPills: Group[] = ['circ', 'weights', 'composition']

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Ruler size={16} className="text-gold-dark" />
        <h3 className="dash-eyebrow text-gold-dark">Mesures corporelles</h3>
      </div>
      <p className="text-marine/45 text-xs mb-4">Prises lors des bilans · dernier : {formatBilanDate(latest.date)}</p>

      {/* Détail dépliable — mesures du dernier bilan + écart vs bilan précédent. */}
      <button
        type="button"
        onClick={() => setShowDetails(s => !s)}
        className="w-full flex items-center gap-1.5 text-marine font-medium text-sm hover:text-gold-dark transition-colors"
      >
        {showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Voir toutes les mesures du bilan
      </button>

      {showDetails && (
        <div className="mt-3 space-y-4">
          {detailByGroup.map(({ group, metrics }) => (
            <div key={group}>
              <p className="text-marine/45 text-[11px] uppercase tracking-wide font-semibold mb-1.5">{GROUP_LABEL[group]}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {metrics.map(m => {
                  const cur = m.read(latest.data)
                  const prev = previous ? m.read(previous.data) : null
                  const delta = cur !== null && prev !== null ? cur - prev : null
                  const improved = delta !== null && (m.lowerIsBetter ? delta < 0 : delta > 0)
                  return (
                    <div key={m.key} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-marine/55">{m.label}</span>
                      <span className="ml-auto text-marine font-semibold tabular-nums">
                        {nf(cur, m.digits)}{m.unit && <span className="text-marine/40 font-normal"> {m.unit}</span>}
                      </span>
                      {delta !== null && Math.abs(delta) >= (m.digits === 2 ? 0.01 : 0.05) ? (
                        <span className={`text-xs font-medium tabular-nums w-16 text-right ${improved ? 'text-green-600' : 'text-red-500'}`}>
                          {delta > 0 ? '▲ +' : '▼ '}{nf(delta, m.digits)}
                        </span>
                      ) : (
                        <span className="w-16 text-right text-marine/30 text-xs">{prev === null ? '1ʳᵉ' : '='}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Évolution dans le temps. */}
      <div className="mt-5 pt-4 border-t border-cream-dark/40">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} className="text-gold-dark" />
          <p className="dash-eyebrow text-gold-dark">Évolution dans le temps</p>
        </div>

        {groupsForPills.map(g => {
          const metrics = METRICS.filter(m => m.group === g && available.has(m.key))
          if (metrics.length === 0) return null
          return (
            <div key={g} className="mb-2">
              <p className="text-marine/40 text-[10px] uppercase tracking-wide font-semibold mb-1">{GROUP_LABEL[g]}</p>
              <div className="flex flex-wrap gap-1.5">
                {metrics.map(m => {
                  const active = m.key === activeMetric.key
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelected(m.key)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        active ? 'bg-marine text-cream border-marine' : 'bg-white text-marine/70 border-cream-dark hover:border-gold/50'
                      }`}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
          {(['30d', '90d', '6m', '1y', 'all'] as PeriodFilter[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                period === p ? 'bg-gold/20 text-gold-dark border-gold/40' : 'bg-white text-marine/55 border-cream-dark hover:border-gold/40'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,28,94,0.08)" />
              <XAxis dataKey="label" tick={{ fill: 'rgba(10,28,94,0.45)', fontSize: 11 }} tickMargin={8} />
              <YAxis tick={{ fill: 'rgba(10,28,94,0.35)', fontSize: 10 }} width={44} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #d4a574', borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [`${nf(typeof v === 'number' ? v : null, activeMetric.digits)} ${activeMetric.unit}`.trim(), activeMetric.label]}
              />
              <Line type="monotone" dataKey="value" stroke="#c9a77a" strokeWidth={2.5} dot={{ r: 3, fill: '#001331' }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-marine/45 text-sm py-8 text-center">
            Pas assez de bilans avec « {activeMetric.label} » sur cette période pour tracer une évolution.
          </p>
        )}
      </div>
    </div>
  )
}
