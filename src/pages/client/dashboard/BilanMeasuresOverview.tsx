import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown, ChevronRight, Ruler, TrendingUp } from 'lucide-react'
import { formatBilanDate, formatBilanMonth } from '../bilanFields'
import { kgToWeightInput, weightUnitLabel } from '../../../lib/units'

/** Section « Mesures corporelles » du Bilan complet — **alimentée uniquement par
 *  les bilans** (chaque bilan = une prise), pas par l'onglet Mesures. Reprend le
 *  système de l'onglet Mesures : détail dépliable + évolution (pills + périodes). */

type Group = 'circ' | 'weights' | 'composition'

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

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

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
  current,
  compare,
  compareLabel,
  unitWeight = 'kg',
  weightLossGoal = true
}: {
  /** Du plus récent au plus ancien (ordre de `bilansService.list`). */
  bilans: Bilan[]
  /** Bilan affiché — celui choisi dans la frise du dashboard. Ce bloc lisait
   *  `bilans[0]` en dur : il montrait toujours le dernier bilan, même quand
   *  Marie en consultait un ancien. */
  current: Bilan
  /** Bilan de référence choisi dans « Comparer à ». `null` = aucune comparaison
   *  demandée. Auparavant figé sur `bilans[1]`, donc le sélecteur n'avait aucun
   *  effet ici : la ligne annonçait « Référence (bilan précédent) » quoi qu'il
   *  arrive. */
  compare: Bilan | null
  /** Libellé du bilan de référence (« Bilan précédent », « 4 sept. 2025 »). */
  compareLabel?: string | null
  unitWeight?: 'kg' | 'lb'
  /** Objectif du client : `true` = perdre du poids (baisse = vert), `false` = prendre
   *  (hausse = vert). Défaut `true` (le cas courant). */
  weightLossGoal?: boolean
}) {
  const wLabel = weightUnitLabel(unitWeight)

  const METRICS = useMemo<Metric[]>(
    () => [
      { key: 'taille', label: 'Tour de taille', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: true, read: d => num(d.tour_taille_cm) },
      { key: 'hanche', label: 'Hanche', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: false, read: d => num(d.tour_hanche_cm) },
      { key: 'biceps', label: 'Biceps fléchi', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: false, read: d => num(d.circ_biceps_flechi_cm) },
      { key: 'cuisse', label: 'Cuisse (2 po du genou)', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: false, read: d => num(d.circ_cuisse_cm) },
      { key: 'epaule', label: 'Épaules et pec', unit: 'cm', group: 'circ', digits: 1, lowerIsBetter: false, read: d => num(d.circ_epaules_pec_cm) },
      { key: 'poids', label: 'Poids', unit: wLabel, group: 'weights', digits: 1, lowerIsBetter: weightLossGoal, read: d => { const p = num(d.poids_kg); return p === null ? null : kgToWeightInput(p, unitWeight) } },
      { key: 'ratio', label: 'Ratio taille / hanche', unit: '', group: 'weights', digits: 2, lowerIsBetter: true, read: ratioTH },
      { key: 'imc', label: 'IMC', unit: 'kg/m²', group: 'weights', digits: 1, lowerIsBetter: true, read: imcOf },
      { key: 'gras', label: '% de gras', unit: '%', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pourcentage_gras) },
      { key: 'somme4', label: 'Somme des 4 plis', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: somme4Plis },
      { key: 'triceps', label: 'Pli triceps', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pli_triceps) },
      { key: 'biceps_pli', label: 'Pli biceps', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pli_biceps) },
      { key: 'sousscap', label: 'Pli sous-scapulaire', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pli_sous_scap) },
      { key: 'iliaque', label: 'Pli crête iliaque', unit: 'mm', group: 'composition', digits: 1, lowerIsBetter: true, read: d => num(d.pli_iliaque) }
    ],
    [wLabel, unitWeight, weightLossGoal]
  )

  const [selected, setSelected] = useState<string>('taille')
  const [showDetails, setShowDetails] = useState(false)

  // Bilans du plus ancien au plus récent (pour le tracé).
  const chrono = useMemo(() => [...bilans].reverse(), [bilans])
  const latest = current
  const previous = compare
  const referenceLabel = compareLabel ?? 'bilan précédent'

  const available = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    for (const m of METRICS) if (chrono.some(b => m.read(b.data) !== null)) s.add(m.key)
    return s
  }, [METRICS, chrono])

  const activeMetric = METRICS.find(m => m.key === selected && available.has(m.key)) ?? METRICS.find(m => available.has(m.key)) ?? METRICS[0]

  const chartData = useMemo(
    () => chrono.map((b, i) => ({ label: formatBilanMonth(b.date), value: activeMetric.read(b.data), isLast: i === chrono.length - 1 })),
    [chrono, activeMetric]
  )
  // Référence = le bilan choisi dans « Comparer à » ; delta = affiché − référence.
  const latestVal = activeMetric.read(latest?.data ?? {})
  const prevVal = previous ? activeMetric.read(previous.data) : null
  const pointsCount = chartData.filter(p => p.value !== null).length

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

  // Détail : les **circonférences** de Marie sont toujours affichées toutes (« — »
  // si non prise ce bilan-là) — c'est son set fixe. Les autres groupes n'affichent
  // que les mesures présentes.
  const detailByGroup = (['circ', 'weights', 'composition'] as Group[]).map(g => ({
    group: g,
    metrics: METRICS.filter(m => m.group === g && (g === 'circ' || m.read(latest.data) !== null))
  })).filter(x => x.metrics.length > 0)

  const pillGroups: Group[] = ['circ', 'weights', 'composition']

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Ruler size={16} className="text-gold-dark" />
        <h3 className="dash-eyebrow text-gold-dark">Mesures corporelles</h3>
      </div>
      <p className="text-marine/45 text-xs mb-4">
        Prises lors des bilans · bilan du {formatBilanDate(latest.date)}
        {previous && <> · comparé au {referenceLabel.toLowerCase()}</>}
      </p>

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
              <p className="text-marine text-sm uppercase tracking-wide font-bold mb-1.5">{GROUP_LABEL[group]}</p>
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
                      {cur === null ? (
                        <span className="w-16 text-right text-marine/25 text-xs">non prise</span>
                      ) : delta !== null && Math.abs(delta) >= (m.digits === 2 ? 0.01 : 0.05) ? (
                        <span className={`text-xs font-medium tabular-nums w-16 text-right ${improved ? 'text-green-600' : 'text-red-500'}`}>
                          {delta > 0 ? '▲ +' : '▼ '}{nf(delta, m.digits)}
                        </span>
                      ) : (
                        <span className="w-16 text-right text-marine/30 text-xs">
                          {/* « 1ʳᵉ » = cette mesure n'existe pas dans le bilan de
                              référence. À ne pas afficher quand AUCUNE référence
                              n'est demandée : toutes les lignes annonceraient une
                              première mesure, ce qui serait faux. */}
                          {previous === null ? '' : prev === null ? '1ʳᵉ' : '='}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progression dans le temps — menu déroulant « Mesure » + ligne de référence
          « Bilan précédent » (même style que la section Bilan/Progression). */}
      <div className="mt-5 pt-4 border-t border-cream-dark/40">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-gold-dark" />
            <p className="dash-eyebrow text-gold-dark">Progression dans le temps</p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-marine/55">
            <span>Mesure</span>
            <select
              value={activeMetric.key}
              onChange={e => setSelected(e.target.value)}
              className="rounded-md border border-cream-dark bg-cream/60 px-2 py-1 text-xs font-medium text-marine hover:bg-cream-dark focus:outline-none focus:ring-2 focus:ring-gold/50"
              title="Mesure tracée dans le temps — seules celles prises en bilan sont proposées"
            >
              {pillGroups
                .filter(g => METRICS.some(m => m.group === g && available.has(m.key)))
                .map(g => (
                  <optgroup key={g} label={GROUP_LABEL[g]}>
                    {METRICS.filter(m => m.group === g && available.has(m.key)).map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </label>
        </div>

        {prevVal !== null && (
          <p className="text-marine/55 text-xs mb-3">
            Référence ({referenceLabel.toLowerCase()}) :{' '}
            <span className="font-semibold text-marine tabular-nums">{nf(prevVal, activeMetric.digits)} {activeMetric.unit}</span>
            {latestVal !== null && (() => {
              const d = latestVal - prevVal
              if (Math.abs(d) < (activeMetric.digits === 2 ? 0.01 : 0.05)) return <span className="text-marine/40"> · = stable</span>
              const improved = activeMetric.lowerIsBetter ? d < 0 : d > 0
              return (
                <span className={improved ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                  {' · '}{d > 0 ? '▲ +' : '▼ '}{nf(d, activeMetric.digits)} {activeMetric.unit}
                </span>
              )
            })()}
          </p>
        )}

        {pointsCount >= 2 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="rgba(10,28,94,0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'rgba(10,28,94,0.55)', fontSize: 11 }} stroke="rgba(10,28,94,0.15)" />
              <YAxis tick={{ fill: 'rgba(10,28,94,0.55)', fontSize: 11 }} stroke="rgba(10,28,94,0.15)" width={46} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #d4a574', borderRadius: 8, color: '#0a1c5e', fontSize: 13 }}
                formatter={(v: unknown) => [`${nf(typeof v === 'number' ? v : null, activeMetric.digits)} ${activeMetric.unit}`.trim(), activeMetric.label]}
              />
              {prevVal !== null && (
                <ReferenceLine
                  y={prevVal}
                  stroke="#0a1c5e"
                  strokeDasharray="6 3"
                  strokeOpacity={0.55}
                  label={{ value: referenceLabel, fill: '#0a1c5e', fontSize: 11, position: 'insideTopLeft' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#b8834a"
                strokeWidth={2.5}
                dot={(props: { cx?: number; cy?: number; payload?: { isLast?: boolean }; index?: number }) => {
                  const { cx, cy, payload, index = 0 } = props
                  if (cx === undefined || cy === undefined) return <g key={`d-${index}`} />
                  const last = payload?.isLast
                  return (
                    <circle key={`d-${index}`} cx={cx} cy={cy} r={last ? 6 : 4} fill={last ? '#d4a574' : '#b8834a'}
                      stroke={last ? '#0a1c5e' : 'none'} strokeWidth={last ? 2 : 0} />
                  )
                }}
                activeDot={{ r: 7 }}
                connectNulls
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-marine/45 text-sm py-8 text-center">
            Pas assez de bilans avec « {activeMetric.label} » pour tracer une progression.
          </p>
        )}
      </div>
    </div>
  )
}
