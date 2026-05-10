import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { clientsService } from '../services/clients'
import { bilansService } from '../services/bilans'
import { mesuresService } from '../services/mesures'
import { settingsService } from '../services/settings'
import { BILAN_FIELD_GROUPS, formatBilanDate, formatBilanMonth } from './client/bilanFields'
import logo from '../assets/logo.png'

// Palette imprimable : pas de fond marine (économie d'encre), texte marine, accents gold-dark.
const MARINE = '#0a1c5e'
const GOLD = '#b8834a'
const GOLD_SOFT = '#d4a574'
const GRID = '#e5e0d2'
const AXIS = '#9a9486'
const INK_SOFT = '#6b6555'
const INK_MUTED = '#4a4636'

const SEX_LABEL: Record<string, string> = { F: 'Femme', M: 'Homme' }

declare global {
  interface Window {
    /** Posé par ReportPage une fois la mise en page terminée — lu par `printToPDF()`. */
    __REPORT_READY__?: boolean
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function fmt(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
}

function reportDateLabel(): string {
  return new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [bilans, setBilans] = useState<Bilan[]>([])
  const [circ, setCirc] = useState<MesureCirconferences[]>([])
  const [plis, setPlis] = useState<MesurePlisCutanes[]>([])
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) {
        setError('Client introuvable.')
        setLoading(false)
        return
      }
      try {
        const [all, bs, cs, ps, profile] = await Promise.all([
          clientsService.list(),
          bilansService.getBilansForClient(id),
          mesuresService.circonferences.list(id),
          mesuresService.plis.list(id),
          settingsService.getProfile()
        ])
        if (cancelled) return
        const found = all.find(c => c.id === id) ?? null
        if (!found) {
          setError('Client introuvable.')
        } else {
          setClient(found)
          setBilans(bs)
          setCirc(cs)
          setPlis(ps)
          setCoachName(profile.name)
        }
      } catch {
        if (!cancelled) setError('Impossible de charger les données du client.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  // Laisse les graphiques (ResponsiveContainer) se mettre en page puis signale
  // à `printToPDF()` que le rapport peut être capturé.
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => {
      window.__REPORT_READY__ = true
    }, 700)
    return () => clearTimeout(t)
  }, [loading])

  const chrono = useMemo(() => [...bilans].reverse(), [bilans]) // du plus ancien au plus récent
  const circChrono = useMemo(() => [...circ].reverse(), [circ])
  const plisChrono = useMemo(() => [...plis].reverse(), [plis])

  const bilanChart = useMemo(
    () =>
      chrono.map(b => ({
        label: formatBilanMonth(b.date),
        vo2max: num(b.data.vo2max),
        poids: num(b.data.poids_kg),
        gras: num(b.data.pourcentage_gras),
        taille: num(b.data.tour_taille_cm),
        hanche: num(b.data.tour_hanche_cm)
      })),
    [chrono]
  )
  const grasChart = useMemo(
    () => plisChrono.map(p => ({ label: formatBilanMonth(p.date), gras: num(p.pourcentageGrasSiri) })),
    [plisChrono]
  )
  const circChart = useMemo(
    () => circChrono.map(c => ({ label: formatBilanMonth(c.date), taille: num(c.taille), hanche: num(c.hanche) })),
    [circChrono]
  )

  if (loading) return <div className="p-10 text-base" style={{ color: MARINE }}>Préparation du rapport…</div>
  if (error || !client) return <div className="p-10 text-base" style={{ color: '#b91c1c' }}>{error ?? 'Client introuvable.'}</div>

  const latest = bilans[0] ?? null
  const hasBilanSeries = bilanChart.length >= 2
  const hasGrasSeries = grasChart.length >= 2
  const hasCircSeries = circChart.length >= 2

  return (
    <div className="report-root">
      <style>{`
        @page { size: Letter; margin: 14mm; }
        html, body, #root { background: #ffffff !important; }
        .report-root { background:#ffffff; color:${MARINE}; }
        .report-section { break-inside: avoid; page-break-inside: avoid; }
        .report-table { width:100%; border-collapse:collapse; }
        .report-table td, .report-table th { padding:6px 10px; font-size:12px; }
        .report-table thead th { text-align:left; color:${INK_SOFT}; text-transform:uppercase; letter-spacing:.04em; font-size:10px; border-bottom:1px solid ${GRID}; }
        .report-table tbody tr { border-bottom:1px solid ${GRID}; }
      `}</style>

      <div className="max-w-[760px] mx-auto px-2 py-1">
        {/* En-tête */}
        <header className="report-section flex items-center gap-4 border-b-2 pb-4 mb-6" style={{ borderColor: GOLD_SOFT }}>
          <img src={logo} alt="Kinésio Outils" className="h-14 w-auto" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: GOLD }}>Kinésio Outils</p>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: MARINE }}>Bilan de progression</h1>
            <p className="text-sm mt-0.5" style={{ color: MARINE }}>{client.name}</p>
          </div>
          <div className="text-right text-xs" style={{ color: INK_SOFT }}>
            <p>Rapport généré le</p>
            <p className="font-medium" style={{ color: MARINE }}>{reportDateLabel()}</p>
          </div>
        </header>

        {/* Profil */}
        <section className="report-section mb-6">
          <SectionTitle>Profil</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Field label="Nom" value={client.name} />
            <Field label="Courriel" value={client.email} />
            {client.birthdate && <Field label="Date de naissance" value={formatBilanDate(client.birthdate)} />}
            {client.sex && <Field label="Sexe" value={SEX_LABEL[client.sex] ?? client.sex} />}
          </div>
        </section>

        {/* Dernier bilan */}
        <section className="report-section mb-6">
          <SectionTitle>{latest ? `Dernier bilan — ${formatBilanDate(latest.date)}` : 'Dernier bilan'}</SectionTitle>
          {latest ? (
            <div className="space-y-4">
              {BILAN_FIELD_GROUPS.map(group => {
                const rows = group.fields.filter(f => {
                  const v = latest.data[f.key]
                  return v !== undefined && v !== ''
                })
                if (rows.length === 0) return null
                return (
                  <div key={group.title} className="report-section">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: GOLD }}>{group.title}</p>
                    <table className="report-table">
                      <tbody>
                        {rows.map(f => (
                          <tr key={f.key}>
                            <td style={{ color: INK_MUTED, width: '62%' }}>
                              {f.label}
                              {f.unit ? ` (${f.unit})` : ''}
                            </td>
                            <td style={{ color: MARINE, fontWeight: 600, textAlign: 'right' }}>{String(latest.data[f.key])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: INK_SOFT }}>Aucun bilan enregistré pour ce client.</p>
          )}
        </section>

        {/* Évolution dans le temps */}
        {(hasBilanSeries || hasGrasSeries || hasCircSeries) && (
          <section className="mb-6">
            <SectionTitle>Évolution dans le temps</SectionTitle>
            <div className="space-y-6">
              {hasBilanSeries && (
                <ChartBlock title="VO2max (ml/kg/min)">
                  <LineChart data={bilanChart} margin={{ top: 6, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} />
                    <YAxis tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} width={42} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="vo2max" name="VO2max" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3.5, fill: GOLD }} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ChartBlock>
              )}
              {hasBilanSeries && (
                <ChartBlock title="Composition corporelle">
                  <ComposedChart data={bilanChart} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} />
                    <YAxis yAxisId="poids" tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} width={42} />
                    <YAxis yAxisId="gras" orientation="right" tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} width={38} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11, color: INK_MUTED }} />
                    <Bar yAxisId="poids" dataKey="poids" name="Poids (kg)" fill={GOLD_SOFT} radius={[2, 2, 0, 0]} barSize={22} isAnimationActive={false} />
                    <Line yAxisId="gras" type="monotone" dataKey="gras" name="% de gras" stroke={MARINE} strokeWidth={2.5} dot={{ r: 3, fill: MARINE }} isAnimationActive={false} connectNulls />
                  </ComposedChart>
                </ChartBlock>
              )}
              {(hasCircSeries || hasBilanSeries) && (
                <ChartBlock title="Mesures corporelles (cm)">
                  <LineChart data={hasCircSeries ? circChart : bilanChart} margin={{ top: 6, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} />
                    <YAxis tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} width={42} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11, color: INK_MUTED }} />
                    <Line type="monotone" dataKey="taille" name="Tour de taille" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3, fill: GOLD }} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="hanche" name="Tour de hanche" stroke={MARINE} strokeWidth={2.5} dot={{ r: 3, fill: MARINE }} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ChartBlock>
              )}
              {hasGrasSeries && (
                <ChartBlock title="% de gras corporel (plis cutanés — Siri)">
                  <LineChart data={grasChart} margin={{ top: 6, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} />
                    <YAxis tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} width={42} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="gras" name="% de gras (Siri)" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3.5, fill: GOLD }} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ChartBlock>
              )}
            </div>
          </section>
        )}

        {/* Historique des bilans */}
        {bilans.length > 0 && (
          <section className="report-section mb-8">
            <SectionTitle>Historique des bilans</SectionTitle>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>VO2max</th>
                  <th style={{ textAlign: 'right' }}>IMC</th>
                  <th style={{ textAlign: 'right' }}>% gras</th>
                  <th style={{ textAlign: 'right' }}>Tour taille</th>
                  <th style={{ textAlign: 'right' }}>Score global</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {bilans.map(b => (
                  <tr key={b.id}>
                    <td style={{ color: MARINE, fontWeight: 600 }}>{formatBilanDate(b.date)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(num(b.data.vo2max))}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(num(b.data.imc))}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(num(b.data.pourcentage_gras))}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(num(b.data.tour_taille_cm))}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(num(b.data.score_global))}</td>
                    <td style={{ color: INK_SOFT }}>{b.source === 'import_docx' ? 'Importé' : 'Manuel'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Pied de page */}
        <footer
          className="report-section border-t pt-3 mt-2 text-xs flex items-center justify-between"
          style={{ borderColor: GRID, color: INK_SOFT }}
        >
          <span>Rapport généré par Kinésio Outils — {coachName || 'Marie-Eve'}</span>
          <span>{reportDateLabel()}</span>
        </footer>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-base font-bold uppercase tracking-wide mb-2.5 pb-1 border-b"
      style={{ color: MARINE, borderColor: GRID }}
    >
      {children}
    </h2>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>{label}</span>
      <p className="text-sm" style={{ color: MARINE }}>{value}</p>
    </div>
  )
}

function ChartBlock({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="report-section">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: GOLD }}>{title}</p>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
