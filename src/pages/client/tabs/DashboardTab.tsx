import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, FileUp, Mail, TrendingUp } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useClient } from '../ClientDetailLayout'
import { bilansService } from '../../../services/bilans'
import { settingsService } from '../../../services/settings'
import { SendBilanModal } from '../SendBilanModal'
import { BilanForm } from '../BilanForm'
import { compareField, type ValueComparison } from '../../../lib/bilan-comparison'
import { formatBilanDate, formatBilanMonth } from '../bilanFields'

// ── Palette graphiques (cohérente avec @theme dans src/styles/main.css) ─────────
const COLORS = {
  gold: '#d4a574',
  goldDark: '#b8834a',
  goldLight: '#e8c99e',
  marineSoft: '#7d8fc7',
  green: '#9ec9a3',
  cream: '#f5f1e8'
}
const AXIS_TICK = { fill: 'rgba(245, 241, 232, 0.6)', fontSize: 12 }
const AXIS_STROKE = 'rgba(245, 241, 232, 0.25)'
const GRID_STROKE = 'rgba(245, 241, 232, 0.12)'
const TOOLTIP_STYLE = {
  background: '#f5f1e8',
  border: '1px solid #d4a574',
  borderRadius: 8,
  color: '#0a1c5e',
  fontSize: 13
}
const LEGEND_STYLE = { color: 'rgba(245, 241, 232, 0.75)', fontSize: 12, paddingTop: 8 }

interface CardProps {
  title?: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
  className?: string
}

function Card({ title, icon: Icon, children, className }: CardProps) {
  return (
    <section className={['bg-marine-light/95 border border-gold/20 rounded-xl p-6 text-cream', className ?? ''].join(' ')}>
      {title && (
        <div className="flex items-center gap-2.5 mb-4">
          {Icon && <Icon size={18} className="text-gold" />}
          <h2 className="text-cream font-semibold text-lg">{title}</h2>
        </div>
      )}
      {children}
    </section>
  )
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
}

interface StatCardProps {
  label: string
  subtitle: string
  value: number | string | undefined
  unit?: string
  /** Comparaison vs bilan précédent ; `null` = pas de précédent / valeur manquante ; `undefined` = ne pas afficher de zone delta. */
  comparison?: ValueComparison | null
}

function StatCard({ label, subtitle, value, unit, comparison }: StatCardProps) {
  const hasValue = value !== undefined && value !== '' && !(typeof value === 'number' && Number.isNaN(value))
  return (
    <div className="bg-marine-light/95 border border-gold/20 rounded-xl p-6">
      <p className="text-cream/60 text-sm">{label}</p>
      <p className="text-3xl font-bold text-cream mt-1 leading-tight">
        {hasValue ? (typeof value === 'number' ? formatNumber(value) : value) : <span className="text-cream/30">—</span>}
        {hasValue && unit && <span className="text-base font-medium text-cream/45 ml-1.5">{unit}</span>}
      </p>
      <p className="text-cream/45 text-xs mt-1">{subtitle}</p>
      {comparison === undefined ? null : comparison === null ? (
        <p className="text-cream/30 text-xs mt-3">Pas de bilan précédent</p>
      ) : comparison.arrow === '=' ? (
        <p className="text-cream/40 text-xs mt-3">= stable vs précédent</p>
      ) : (
        <p className={`text-sm mt-3 font-semibold ${comparison.isImprovement ? 'text-green-400' : 'text-red-400'}`}>
          {comparison.arrow} {formatNumber(Math.abs(comparison.delta))}
          {comparison.percent !== 0 && (
            <span className="font-medium"> · {formatNumber(Math.abs(comparison.percent))} %</span>
          )}
          <span className="text-cream/40 font-normal"> vs précédent</span>
        </p>
      )}
    </div>
  )
}

interface ChartPoint {
  date: string
  label: string
  vo2max: number | null
  poids: number | null
  gras: number | null
  pushups: number | null
  situps: number | null
  enduranceDos: number | null
  tourTaille: number | null
  tourHanche: number | null
  imc: number | null
  score: number | null
}

function num(v: number | undefined): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null
}

export function DashboardTab() {
  const client = useClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const printMode = searchParams.get('print') === '1'

  const [bilans, setBilans] = useState<Bilan[] | null>(null)
  const [stats, setStats] = useState<BilanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [smtpReady, setSmtpReady] = useState<boolean | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([bilansService.getBilansForClient(client.id), bilansService.getBilanStats(client.id)])
      .then(([list, st]) => {
        if (cancelled) return
        setBilans(list)
        setStats(st)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les bilans du client.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [client.id])

  useEffect(() => {
    if (printMode) return
    Promise.all([settingsService.getSmtpConfig(), settingsService.hasSmtpPassword()])
      .then(([cfg, hasPwd]) => setSmtpReady(Boolean(cfg && cfg.host && cfg.user && hasPwd)))
      .catch(() => setSmtpReady(false))
  }, [printMode])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Bilans du plus ancien au plus récent, pour les axes de graphiques.
  const chrono = useMemo(() => (bilans ? [...bilans].reverse() : []), [bilans])

  const chartData = useMemo<ChartPoint[]>(
    () =>
      chrono.map(b => ({
        date: b.date,
        label: formatBilanMonth(b.date),
        vo2max: num(b.data.vo2max),
        poids: num(b.data.poids_kg),
        gras: num(b.data.pourcentage_gras),
        pushups: num(b.data.pushups),
        situps: num(b.data.situps),
        enduranceDos: num(b.data.endurance_dos_sec),
        tourTaille: num(b.data.tour_taille_cm),
        tourHanche: num(b.data.tour_hanche_cm),
        imc: num(b.data.imc),
        score: num(b.data.score_global)
      })),
    [chrono]
  )

  if (loading) {
    return <div className="p-8 text-marine/50 text-base">Chargement…</div>
  }
  if (error) {
    return <div className="p-8 text-red-600 text-base">{error}</div>
  }

  const latest = stats?.latest ?? null
  const previous = stats?.previous ?? null
  const count = stats?.count ?? 0

  const sendDisabled = smtpReady === null || smtpReady === false
  const sendTooltip = smtpReady === false ? 'Configurez votre SMTP dans Paramètres' : undefined

  function goToBilans() {
    navigate(`/clients/${client.id}/bilans`)
  }

  // ── État A : aucun bilan ────────────────────────────────────────────────────
  if (count === 0 || !latest) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-marine-light/95 border border-gold/20 rounded-2xl flex items-center justify-center mb-5">
            <ClipboardList size={36} className="text-gold" />
          </div>
          <h2 className="text-marine font-semibold text-xl">Aucun bilan enregistré pour {client.name}</h2>
          <p className="text-marine/50 text-base mt-2 max-w-md">
            Importez un bilan <code className="text-marine/45">.doc</code> ou <code className="text-marine/45">.docx</code>{' '}
            pour afficher les statistiques et les graphiques de progression.
          </p>
          <button
            type="button"
            onClick={goToBilans}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors shadow-sm"
          >
            <FileUp size={17} />
            Importer un bilan (.doc, .docx)
          </button>
        </div>
      </div>
    )
  }

  const hasMultiple = count >= 2

  // Hero stats — comparaisons seulement s'il y a un bilan précédent.
  const cmp = (key: keyof BilanData): ValueComparison | null | undefined =>
    hasMultiple ? compareField(key, latest.data, previous?.data) : undefined

  const Header = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-marine font-semibold text-2xl">{client.name}</h1>
        <p className="text-marine/55 text-base mt-1">
          Dernier bilan : <span className="text-marine font-medium">{formatBilanDate(latest.date)}</span>
          {count > 1 && <span className="text-marine/40"> · {count} bilans au total</span>}
        </p>
      </div>
      {!printMode && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={sendDisabled}
          title={sendTooltip}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Mail size={17} />
          Envoyer ce dashboard
        </button>
      )}
    </div>
  )

  const HeroStats = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <StatCard
        label="VO2max"
        subtitle="Aptitude aérobie"
        value={latest.data.vo2max}
        unit="ml/kg/min"
        comparison={cmp('vo2max')}
      />
      <StatCard
        label="IMC"
        subtitle="Indice de masse corporelle"
        value={latest.data.imc}
        unit="kg/m²"
        comparison={cmp('imc')}
      />
      <StatCard
        label="% de gras corporel"
        subtitle="Composition corporelle"
        value={latest.data.pourcentage_gras}
        unit="%"
        comparison={cmp('pourcentage_gras')}
      />
      {latest.data.score_global !== undefined ? (
        <StatCard
          label="Score global"
          subtitle="Santé et condition physique"
          value={latest.data.score_global}
          comparison={cmp('score_global')}
        />
      ) : (
        <StatCard label="Date du bilan" subtitle="Dernière évaluation" value={formatBilanDate(latest.date)} comparison={undefined} />
      )}
    </div>
  )

  // ── État B : un seul bilan ──────────────────────────────────────────────────
  if (!hasMultiple) {
    return (
      <div className="p-8 max-w-5xl space-y-5">
        {Header}
        {HeroStats}
        <Card title="Dernier bilan complet" icon={ClipboardList} className="md:p-7">
          <BilanForm date={latest.date} data={latest.data} readOnly variant="marine" />
        </Card>
        <div className="bg-gold/10 border border-gold/30 rounded-xl px-5 py-4 text-marine/70 text-base">
          Importez d'autres bilans pour voir la progression dans le temps.
          <button type="button" onClick={goToBilans} className="ml-2 text-gold-dark hover:text-marine underline font-medium">
            Importer un bilan
          </button>
        </div>
        {showModal && (
          <SendBilanModal
            client={client}
            onCancel={() => setShowModal(false)}
            onSent={recipient => {
              setShowModal(false)
              setToast(`Bilan envoyé à ${recipient}`)
            }}
          />
        )}
        {toast && <Toast message={toast} />}
      </div>
    )
  }

  // ── État C : 2+ bilans → graphiques ─────────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl space-y-5">
      {Header}
      {HeroStats}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="VO2max au fil du temps" icon={TrendingUp}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} width={44} domain={['auto', 'auto']} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="vo2max"
                  name="VO2max (ml/kg/min)"
                  stroke={COLORS.gold}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: COLORS.gold }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Composition corporelle" icon={TrendingUp}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                <YAxis yAxisId="poids" tick={AXIS_TICK} stroke={AXIS_STROKE} width={44} />
                <YAxis yAxisId="gras" orientation="right" tick={AXIS_TICK} stroke={AXIS_STROKE} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar yAxisId="poids" dataKey="poids" name="Poids (kg)" fill={COLORS.marineSoft} radius={[3, 3, 0, 0]} barSize={28} />
                <Line
                  yAxisId="gras"
                  type="monotone"
                  dataKey="gras"
                  name="% de gras"
                  stroke={COLORS.goldLight}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: COLORS.goldLight }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Force et endurance" icon={TrendingUp}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} width={44} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Line type="monotone" dataKey="pushups" name="Extensions des bras" stroke={COLORS.gold} strokeWidth={2.5} dot={{ r: 3.5, fill: COLORS.gold }} connectNulls />
                <Line type="monotone" dataKey="situps" name="Redressements assis" stroke={COLORS.goldLight} strokeWidth={2.5} dot={{ r: 3.5, fill: COLORS.goldLight }} connectNulls />
                <Line type="monotone" dataKey="enduranceDos" name="Endurance du dos (s)" stroke={COLORS.green} strokeWidth={2.5} dot={{ r: 3.5, fill: COLORS.green }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Mesures corporelles" icon={TrendingUp}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} width={44} domain={['auto', 'auto']} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Line type="monotone" dataKey="tourTaille" name="Tour de taille (cm)" stroke={COLORS.gold} strokeWidth={2.5} dot={{ r: 3.5, fill: COLORS.gold }} connectNulls />
                <Line type="monotone" dataKey="tourHanche" name="Tour de hanche (cm)" stroke={COLORS.marineSoft} strokeWidth={2.5} dot={{ r: 3.5, fill: COLORS.marineSoft }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Tableau de progression" icon={ClipboardList}>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-base">
            <thead>
              <tr className="text-cream/55 text-sm uppercase tracking-wide">
                <th className="text-left font-medium px-3 py-2">Date</th>
                <th className="text-right font-medium px-3 py-2">VO2max</th>
                <th className="text-right font-medium px-3 py-2">IMC</th>
                <th className="text-right font-medium px-3 py-2">% gras</th>
                <th className="text-right font-medium px-3 py-2">Tour taille</th>
                <th className="text-right font-medium px-3 py-2">Score global</th>
              </tr>
            </thead>
            <tbody>
              {bilans!.map((b, i) => (
                <tr
                  key={b.id}
                  className={`border-t border-marine-light/40 ${i === 0 ? 'text-cream font-medium' : 'text-cream/75'}`}
                >
                  <td className="px-3 py-2.5">
                    {formatBilanDate(b.date)}
                    {i === 0 && <span className="ml-2 text-gold text-xs uppercase tracking-wide">récent</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">{cell(b.data.vo2max)}</td>
                  <td className="px-3 py-2.5 text-right">{cell(b.data.imc)}</td>
                  <td className="px-3 py-2.5 text-right">{cell(b.data.pourcentage_gras)}</td>
                  <td className="px-3 py-2.5 text-right">{cell(b.data.tour_taille_cm)}</td>
                  <td className="px-3 py-2.5 text-right">{cell(b.data.score_global)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <SendBilanModal
          client={client}
          onCancel={() => setShowModal(false)}
          onSent={recipient => {
            setShowModal(false)
            setToast(`Bilan envoyé à ${recipient}`)
          }}
        />
      )}
      {toast && <Toast message={toast} />}
    </div>
  )
}

function cell(v: number | undefined): React.ReactNode {
  return v === undefined ? <span className="text-cream/25">—</span> : formatNumber(v)
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-marine text-cream text-base font-medium px-5 py-3 rounded-lg shadow-2xl border border-marine-light/40">
      {message}
    </div>
  )
}
