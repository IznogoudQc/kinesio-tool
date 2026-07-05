import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis
} from 'recharts'
import { Trophy, Target } from 'lucide-react'
import { clientsService } from '../services/clients'
import { bilansService } from '../services/bilans'
import { settingsService } from '../services/settings'
import { formatBilanDate, formatBilanMonth } from './client/bilanFields'
import { CategoryRangeBar } from '../components/CategoryRangeBar'
import {
  CATEGORY_LABELS,
  computeAge,
  getCategorization,
  getNextCategoryTarget,
  getNormPercentiles,
  getPercentile,
  type Category,
  type NormsType,
  type TestKey
} from '../lib/norms'
import { BILAN_TO_TEST_KEY } from '../lib/norms/bilan-keys'
import { classifyBloodPressure } from '../lib/norms/clinical'
import { computeSynthesis, type BilanProfile, type CompositeScore } from '../lib/norms/scoring'
import { computeBilan, type BilanComputed } from '../lib/bilan-computed'
import { formatMmSs } from '../lib/vo2max-calculator'
import { hasRecoveryData, aerobicProtocolLabel } from '../lib/report-helpers'
import logo from '../assets/logo.png'
import bodyMale from '../assets/body-male.png'
import bodyFemale from '../assets/body-female.png'
import '../print.css'

// ── Palette imprimable ───────────────────────────────────────────────────────
const MARINE = '#0a1c5e'
const GOLD = '#b8834a'
const GOLD_SOFT = '#d4a574'
const CREAM = '#faf6ec'
const GRID = '#e5e0d2'
const AXIS = '#9a9486'
const INK_SOFT = '#6b6555'

/** Couleur de fond / texte par catégorie — alignée sur `CategoryRangeBar`. */
const CAT_BG: Record<Category, string> = {
  A_AMELIORER: '#E24B4A',
  ACCEPTABLE: '#EF9F27',
  BIEN: '#FAC775',
  TRES_BIEN: '#97C459',
  EXCELLENT: '#3B6D11'
}
const CAT_FG: Record<Category, string> = {
  A_AMELIORER: '#ffffff',
  ACCEPTABLE: '#ffffff',
  BIEN: '#0a1c5e',
  TRES_BIEN: '#0a1c5e',
  EXCELLENT: '#ffffff'
}

const SEX_LABEL: Record<string, string> = { F: 'Femme', M: 'Homme' }

declare global {
  interface Window {
    /** Posé par ReportPage une fois polices + graphiques rendus — lu par `printToPDF()`. */
    __REPORT_READY__?: boolean
  }
}

// ── Métriques suivies (ordre des pages détaillées) ───────────────────────────
interface MetricDef {
  key: keyof BilanData
  label: string
  unit: string
}
const METRICS: MetricDef[] = [
  { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min' },
  { key: 'pourcentage_gras', label: '% de gras corporel', unit: '%' },
  { key: 'imc', label: 'IMC', unit: 'kg/m²' },
  { key: 'tour_taille_cm', label: 'Tour de taille', unit: 'cm' },
  { key: 'pa_systolique', label: 'Pression artérielle systolique', unit: 'mmHg' },
  { key: 'pa_diastolique', label: 'Pression artérielle diastolique', unit: 'mmHg' },
  { key: 'fc_repos', label: 'Fréquence cardiaque au repos', unit: 'bpm' },
  { key: 'pushups', label: 'Pompes', unit: 'reps' },
  { key: 'situps', label: 'Redressements assis', unit: 'reps' },
  { key: 'saut_vertical_cm', label: 'Saut vertical', unit: 'cm' },
  { key: 'puissance_jambes_watts', label: 'Puissance des jambes', unit: 'W' },
  { key: 'flexion_tronc_cm', label: 'Flexion du tronc', unit: 'cm' },
  { key: 'endurance_dos_sec', label: 'Endurance des muscles du dos', unit: 's' }
]

/** Recommandations courtes génériques, par métrique — section Forces & axes. */
const RECO: Partial<Record<keyof BilanData, string>> = {
  vo2max: 'Intégrez 2 à 3 séances de cardio par semaine (continu ou par intervalles).',
  pourcentage_gras: 'Associez un léger déficit calorique à de la musculation pour préserver la masse maigre.',
  imc: 'Visez une perte de poids progressive (≈ 0,5 kg/semaine) par l’alimentation et l’activité.',
  tour_taille_cm: 'Le tour de taille répond bien au cardio régulier et à la réduction des sucres ajoutés.',
  pushups: 'Travaillez les pompes 3×/semaine en séries courtes, en progressant graduellement.',
  situps: 'Renforcez la sangle abdominale en alternant redressements et gainage.',
  saut_vertical_cm: 'Ajoutez des exercices de pliométrie (sauts, fentes sautées) à votre routine.',
  puissance_jambes_watts: 'Les squats et le travail explosif des jambes amélioreront votre puissance.',
  flexion_tronc_cm: 'Étirez quotidiennement les ischio-jambiers et le bas du dos pour gagner en souplesse.',
  endurance_dos_sec: 'Le gainage dorsal (Sorensen, superman) renforce l’endurance des muscles du dos.',
  pa_systolique: 'Réduisez le sel, gérez le stress et restez actif pour faire baisser la pression.',
  pa_diastolique: 'Activité régulière, sommeil et modération de l’alcool aident à abaisser la diastolique.',
  fc_repos: 'Un cœur entraîné bat plus lentement au repos — le cardio régulier le renforce.'
}

/** Phrase explicative affichée sous chaque métrique, une par catégorie. */
const EXPLANATION_BY_CATEGORY: Record<Category, string> = {
  A_AMELIORER: 'Marge de progression importante — voir les recommandations.',
  ACCEPTABLE: 'Dans la fourchette basse — un travail régulier ferait une vraie différence.',
  BIEN: 'Au-dessus de la moyenne, bon niveau de base.',
  TRES_BIEN: 'Très bon niveau, proche du tiers supérieur des normes.',
  EXCELLENT: 'Au sommet des normes pour votre âge — maintenir l’entraînement.'
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function fmt(v: number | null, decimals = 1): string {
  return v === null ? '—' : v.toLocaleString('fr-CA', { maximumFractionDigits: decimals })
}
function reportDateLabel(): string {
  return new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}
function isoToTime(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : 0
}
function yearsBetween(a: string, b: string): number {
  return Math.abs(isoToTime(b) - isoToTime(a)) / (365.25 * 864e5)
}

/** Catégorisation complète d'une métrique du bilan, si elle a un barème. */
interface MetricNorm {
  testKey: TestKey
  category: Category | null
  percentile: number | null
  lowerIsBetter: boolean
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number } | null
  next: ReturnType<typeof getNextCategoryTarget>
}
function metricNorm(key: keyof BilanData, value: number, profile: BilanProfile): MetricNorm | null {
  const testKey = BILAN_TO_TEST_KEY[key]
  if (!testKey || profile.age === null || profile.sex === null) return null
  const { age, sex, norms } = profile
  const range = getNormPercentiles(testKey, age, sex, norms)
  return {
    testKey,
    category: getCategorization(testKey, value, age, sex, norms),
    percentile: getPercentile(testKey, value, age, sex, norms),
    lowerIsBetter: range?.lowerIsBetter ?? false,
    percentiles: range?.percentiles ?? null,
    next: getNextCategoryTarget(testKey, value, age, sex, norms)
  }
}

// ── Composant principal ──────────────────────────────────────────────────────
export function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [bilans, setBilans] = useState<Bilan[]>([])
  const [coachName, setCoachName] = useState('')
  const [signature, setSignature] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [norms, setNorms] = useState<NormsType>('acsm')
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
        const [all, bs, profile, activeNorms] = await Promise.all([
          clientsService.list(),
          bilansService.getBilansForClient(id),
          settingsService.getProfile(),
          settingsService.getCategorizationNorms().catch(() => 'acsm' as NormsType)
        ])
        if (cancelled) return
        const found = all.find(c => c.id === id) ?? null
        if (!found) {
          setError('Client introuvable.')
          return
        }
        setClient(found)
        setBilans(bs)
        setCoachName(profile.name)
        setSignature(profile.signature)
        setNorms(activeNorms)
        // Couverture : avatar carré (focus visage) — pas la version plein corps.
        const avatarFile = found.avatarFilename
        if (avatarFile) {
          const url = await clientsService.getAvatarUrl(avatarFile).catch(() => null)
          if (!cancelled) setAvatarUrl(url)
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

  // Attend que les polices soient chargées et que les graphiques se posent
  // avant de signaler à `printToPDF()` que le rapport peut être capturé.
  useEffect(() => {
    if (loading) return
    let cancelled = false
    async function signalReady() {
      try {
        await document.fonts.ready
      } catch {
        // best effort — on génère quand même
      }
      await new Promise(resolve => setTimeout(resolve, 600))
      if (!cancelled) window.__REPORT_READY__ = true
    }
    signalReady()
    return () => {
      cancelled = true
    }
  }, [loading])

  const profile = useMemo<BilanProfile>(
    () => ({ age: computeAge(client?.birthdate), sex: client?.sex ?? null, norms }),
    [client, norms]
  )
  // Du plus ancien au plus récent.
  const chrono = useMemo(() => [...bilans].reverse(), [bilans])
  const syntheses = useMemo(
    () => chrono.map(b => computeSynthesis(b.data, profile)),
    [chrono, profile]
  )

  if (loading) {
    return <div className="report-body p-10 text-base" style={{ color: MARINE }}>Préparation du rapport…</div>
  }
  if (error || !client) {
    return <div className="report-body p-10 text-base" style={{ color: '#b91c1c' }}>{error ?? 'Client introuvable.'}</div>
  }

  const latest = bilans[0] ?? null
  const latestSynth = latest ? computeSynthesis(latest.data, profile) : null
  const latestComputed = latest ? computeBilan(latest.data, profile) : null

  if (!latest || !latestSynth) {
    return (
      <article className="report-body" style={{ color: MARINE, background: '#fff' }}>
        <CoverPage client={client} latest={null} coachName={coachName} totalBilans={0} avatarUrl={avatarUrl} overall={null} />
      </article>
    )
  }

  return (
    <article className="report-body" style={{ color: MARINE, background: '#fff' }}>
      <CoverPage
        client={client}
        latest={latest}
        coachName={coachName}
        totalBilans={bilans.length}
        avatarUrl={avatarUrl}
        overall={latestSynth.overall.score}
        overallCategory={latestSynth.overall.category}
      />
      <ParcoursPage client={client} bilans={bilans} chrono={chrono} syntheses={syntheses} profile={profile} />
      <SynthesePage synth={latestSynth} bilanDate={latest.date} />
      {latestComputed && <CompositionPage latest={latest} computed={latestComputed} />}
      <ProgressionChartsPage chrono={chrono} syntheses={syntheses} />
      <MetricDetailsPages latest={latest} bilans={bilans} profile={profile} />
      <RecuperationEtNotesPage latest={latest} />
      <ForcesEtAxesPage latest={latest} profile={profile} coachName={coachName} signature={signature} />
    </article>
  )
}

// ── Wrapper de section : une page A4 ─────────────────────────────────────────
function ReportSection({
  children,
  title,
  sectionNumber,
  pad = true
}: {
  children: React.ReactNode
  title?: string
  sectionNumber?: string
  pad?: boolean
}) {
  return (
    <section
      className="report-page"
      style={{
        width: '210mm',
        minHeight: '293mm',
        margin: '0 auto',
        padding: pad ? '16mm 17mm' : 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff'
      }}
    >
      {title && (
        <header className="flex items-end justify-between" style={{ marginBottom: '9mm' }}>
          <h1 className="report-display" style={{ fontWeight: 600, fontSize: '28pt', color: MARINE, lineHeight: 1.05 }}>
            {title}
          </h1>
          {sectionNumber && (
            <span style={{ color: '#bcb6a4', fontSize: '9pt', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {sectionNumber}
            </span>
          )}
        </header>
      )}
      <div style={{ flex: 1 }}>{children}</div>
    </section>
  )
}

// ── Section 1 — Couverture ───────────────────────────────────────────────────
function CoverPage({
  client,
  latest,
  coachName,
  totalBilans,
  avatarUrl,
  overall,
  overallCategory
}: {
  client: Client
  latest: Bilan | null
  coachName: string
  totalBilans: number
  avatarUrl: string | null
  overall: number | null
  overallCategory?: Category | null
}) {
  const age = computeAge(client.birthdate)
  const subtitle = [age !== null ? `${age} ans` : null, client.sex ? SEX_LABEL[client.sex] : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <ReportSection pad={false}>
      <div style={{ padding: '20mm 20mm 16mm', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* En-tête */}
        <div className="flex items-start justify-between">
          <img src={logo} alt="Kinésio Outils" style={{ height: '16mm', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '8pt', letterSpacing: '0.16em', textTransform: 'uppercase', color: INK_SOFT }}>
              Bilan de progression
            </p>
            {latest && (
              <p style={{ fontSize: '10pt', color: MARINE, marginTop: '1mm' }}>{formatBilanDate(latest.date)}</p>
            )}
          </div>
        </div>

        {/* Centre — avatar + identité */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: '62mm',
              height: '62mm',
              borderRadius: '50%',
              background: CREAM,
              border: `2px solid ${GOLD_SOFT}`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : client.sex ? (
              <img
                src={client.sex === 'M' ? bodyMale : bodyFemale}
                alt=""
                style={{ width: '78%', height: '78%', objectFit: 'contain' }}
              />
            ) : null}
          </div>
          <h1
            className="report-display"
            style={{ fontWeight: 600, fontSize: '40pt', color: MARINE, marginTop: '9mm', textAlign: 'center', lineHeight: 1.05 }}
          >
            {client.name}
          </h1>
          {subtitle && (
            <p style={{ fontSize: '12pt', color: INK_SOFT, marginTop: '2mm' }}>{subtitle}</p>
          )}

          {/* Score global */}
          <p style={{ marginTop: '12mm', fontSize: '8.5pt', letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD }}>
            Condition physique globale
          </p>
          <div style={{ marginTop: '2mm' }}>
            <ScoreRing score={overall} />
          </div>
          {overallCategory && (
            <div style={{ marginTop: '3mm' }}>
              <CategoryPill category={overallCategory} />
            </div>
          )}
        </div>

        {/* Pied */}
        <p style={{ textAlign: 'center', fontSize: '9.5pt', color: INK_SOFT }}>
          {totalBilans > 0 ? `Bilan nº ${totalBilans} · ` : ''}
          {latest ? `${formatBilanDate(latest.date)} · ` : ''}
          Préparé par {coachName || 'Marie-Eve Bélanger'}
        </p>
      </div>
    </ReportSection>
  )
}

/** Anneau de score 0-5 en SVG (arc doré proportionnel). */
function ScoreRing({ score }: { score: number | null }) {
  const size = 200
  const r = 84
  const cx = size / 2
  const circ = 2 * Math.PI * r
  const frac = score === null ? 0 : Math.max(0, Math.min(1, score / 5))
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '46mm', height: '46mm' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={GRID} strokeWidth={14} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={GOLD}
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={`${circ * frac} ${circ}`}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text
        x={cx}
        y={cx - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        className="report-display"
        style={{ fontSize: '64px', fontWeight: 700, fill: MARINE }}
      >
        {score === null ? '—' : score.toFixed(1)}
      </text>
      <text x={cx} y={cx + 34} textAnchor="middle" style={{ fontSize: '20px', fill: INK_SOFT }}>
        sur 5
      </text>
    </svg>
  )
}

// ── Section 2 — Votre parcours ───────────────────────────────────────────────
function ParcoursPage({
  client,
  bilans,
  chrono,
  syntheses,
  profile
}: {
  client: Client
  bilans: Bilan[]
  chrono: Bilan[]
  syntheses: ReturnType<typeof computeSynthesis>[]
  profile: BilanProfile
}) {
  const oldest = chrono[0]
  const latest = chrono[chrono.length - 1]
  const single = bilans.length < 2

  // Métrique héros : plus grande amélioration relative entre 1er et dernier bilan.
  const hero = useMemo(() => {
    if (single) return null
    let best: { label: string; unit: string; from: number; to: number; pct: number } | null = null
    for (const m of METRICS) {
      const from = num(oldest.data[m.key])
      const to = num(latest.data[m.key])
      if (from === null || to === null || from === 0) continue
      const norm = metricNorm(m.key, to, profile)
      const lower = norm?.lowerIsBetter ?? false
      const improvement = lower ? from - to : to - from
      const pct = (improvement / Math.abs(from)) * 100
      if (pct > 0 && (best === null || pct > best.pct)) {
        best = { label: m.label, unit: m.unit, from, to, pct }
      }
    }
    return best
  }, [single, oldest, latest, profile])

  // Avant / après — jusqu'à 6 métriques renseignées aux deux bornes.
  const beforeAfter = useMemo(() => {
    if (single) return []
    const rows: { label: string; unit: string; from: number; to: number; lower: boolean }[] = []
    for (const m of METRICS) {
      const from = num(oldest.data[m.key])
      const to = num(latest.data[m.key])
      if (from === null || to === null) continue
      const lower = metricNorm(m.key, to, profile)?.lowerIsBetter ?? false
      rows.push({ label: m.label, unit: m.unit, from, to, lower })
    }
    return rows.slice(0, 6)
  }, [single, oldest, latest, profile])

  const years = single ? 0 : yearsBetween(oldest.date, latest.date)
  const durationLabel =
    years >= 1 ? `${years.toFixed(years >= 3 ? 0 : 1)} années de suivi` : `${Math.round(years * 12)} mois de suivi`

  return (
    <ReportSection title="Votre parcours" sectionNumber="Section 2">
      {single ? (
        <div
          style={{
            border: `1px dashed ${GOLD_SOFT}`,
            borderRadius: '4mm',
            padding: '14mm',
            textAlign: 'center',
            background: CREAM
          }}
        >
          <p className="report-display" style={{ fontSize: '20pt', color: MARINE, fontWeight: 600 }}>
            Premier bilan
          </p>
          <p style={{ fontSize: '11pt', color: INK_SOFT, marginTop: '3mm', maxWidth: '120mm', margin: '3mm auto 0' }}>
            La progression de {client.name.split(' ')[0]} deviendra visible dès le prochain bilan. Ce
            document présente l’état actuel comme point de départ.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '11pt', color: INK_SOFT, marginTop: '-4mm', marginBottom: '8mm' }}>
            Du {formatBilanDate(oldest.date)} à aujourd’hui — {durationLabel}.
          </p>

          {/* Bloc 1 — métrique héros */}
          {hero && (
            <div
              style={{
                background: CREAM,
                borderRadius: '4mm',
                padding: '9mm 11mm',
                marginBottom: '9mm',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '8mm'
              }}
            >
              <div>
                <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD }}>
                  Votre plus belle progression
                </p>
                <p className="report-display" style={{ fontSize: '22pt', fontWeight: 600, color: MARINE, marginTop: '1mm' }}>
                  {hero.label}
                </p>
                <p className="report-display" style={{ fontSize: '34pt', fontWeight: 700, color: MARINE, lineHeight: 1.1 }}>
                  {fmt(hero.from)} → {fmt(hero.to)}
                  <span style={{ fontSize: '14pt', color: INK_SOFT, fontWeight: 500 }}> {hero.unit}</span>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="report-display" style={{ fontSize: '40pt', fontWeight: 700, color: GOLD }}>
                  +{Math.round(hero.pct)} %
                </p>
                <p style={{ fontSize: '10pt', color: INK_SOFT }}>
                  en {years >= 1 ? `${years.toFixed(years >= 3 ? 0 : 1)} ans` : `${Math.round(years * 12)} mois`}
                </p>
              </div>
            </div>
          )}

          {/* Bloc 2 — timeline */}
          <JourneyTimeline chrono={chrono} syntheses={syntheses} />

          {/* Bloc 3 — avant / après */}
          {beforeAfter.length > 0 && (
            <div style={{ marginTop: '10mm' }}>
              <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, marginBottom: '2mm' }}>
                Avant / après
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
                <thead>
                  <tr style={{ color: INK_SOFT, fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ textAlign: 'left', padding: '2mm 0' }}>Métrique</th>
                    <th style={{ textAlign: 'right', padding: '2mm 0' }}>{formatBilanMonth(oldest.date)}</th>
                    <th style={{ textAlign: 'right', padding: '2mm 0' }}>{formatBilanMonth(latest.date)}</th>
                    <th style={{ textAlign: 'right', padding: '2mm 0' }}>Évolution</th>
                  </tr>
                </thead>
                <tbody>
                  {beforeAfter.map(r => {
                    const delta = r.to - r.from
                    const improved = r.lower ? delta < 0 : delta > 0
                    const pct = r.from !== 0 ? Math.round((delta / Math.abs(r.from)) * 100) : 0
                    const arrow = delta < 0 ? '▼' : delta > 0 ? '▲' : '='
                    return (
                      <tr key={r.label} style={{ borderTop: `1px solid ${GRID}` }}>
                        <td style={{ padding: '2.6mm 0', color: MARINE }}>{r.label}</td>
                        <td style={{ textAlign: 'right', color: INK_SOFT }}>
                          {fmt(r.from)} {r.unit}
                        </td>
                        <td style={{ textAlign: 'right', color: MARINE, fontWeight: 600 }}>
                          {fmt(r.to)} {r.unit}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: delta === 0 ? INK_SOFT : improved ? '#2f7d32' : '#c0392b'
                          }}
                        >
                          {arrow} {delta > 0 ? '+' : ''}
                          {fmt(delta)} {r.unit} ({pct > 0 ? '+' : ''}
                          {pct} %)
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ReportSection>
  )
}

/** Frise horizontale : 1 point par bilan, espacés selon les dates réelles. */
function JourneyTimeline({
  chrono,
  syntheses
}: {
  chrono: Bilan[]
  syntheses: ReturnType<typeof computeSynthesis>[]
}) {
  const W = 1000
  const H = 150
  const padX = 40
  const y = 78
  // Espacement RÉGULIER (par index), pas selon la date réelle : sinon des bilans
  // rapprochés dans le temps (ex. 10 bilans récents + 1 ancien) se chevauchent.
  const n = chrono.length
  const pts = chrono.map((b, i) => ({
    x: n <= 1 ? W / 2 : padX + (i / (n - 1)) * (W - 2 * padX),
    date: b.date,
    score: syntheses[i]?.overall.score ?? null
  }))
  // Anti-chevauchement des dates : au-delà de 8 points, on n'affiche qu'une
  // étiquette sur deux (le premier et le dernier restent toujours visibles).
  const labelStep = n > 8 ? 2 : 1
  const showLabel = (i: number) => i === 0 || i === n - 1 || i % labelStep === 0

  return (
    <div>
      <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, marginBottom: '1mm' }}>
        Vos {chrono.length} bilans
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '32mm' }}>
        {/* Segments colorés selon la tendance du score global */}
        {pts.slice(1).map((p, i) => {
          const prev = pts[i]
          const a = prev.score
          const b = p.score
          const color = a === null || b === null ? GRID : b >= a - 0.05 ? '#97C459' : '#E24B4A'
          return <line key={i} x1={prev.x} y1={y} x2={p.x} y2={y} stroke={color} strokeWidth={5} strokeLinecap="round" />
        })}
        {pts.map((p, i) => {
          const isLast = i === pts.length - 1
          return (
            <g key={i}>
              <circle cx={p.x} cy={y} r={isLast ? 11 : 8} fill={isLast ? GOLD : '#fff'} stroke={isLast ? GOLD : MARINE} strokeWidth={3} />
              {showLabel(i) && (
                <text
                  x={p.x}
                  y={y + 32}
                  textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}
                  style={{ fontSize: '17px', fill: INK_SOFT }}
                >
                  {formatBilanMonth(p.date)}
                </text>
              )}
              {isLast && p.score !== null && (
                <>
                  <circle cx={p.x} cy={y - 40} r={20} fill={GOLD} />
                  <text
                    x={p.x}
                    y={y - 40}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="report-display"
                    style={{ fontSize: '21px', fontWeight: 700, fill: '#fff' }}
                  >
                    {p.score.toFixed(1)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Section 3 — Synthèse ─────────────────────────────────────────────────────
function SynthesePage({
  synth,
  bilanDate
}: {
  synth: ReturnType<typeof computeSynthesis>
  bilanDate: string
}) {
  const cards: { title: string; score: CompositeScore; blurb: string }[] = [
    {
      title: 'Composition corporelle',
      score: synth.composition,
      blurb: 'Combine l’IMC et le tour de taille — un repère du risque métabolique.'
    },
    {
      title: 'Aptitude aérobie',
      score: synth.aerobic,
      blurb: 'Capacité cardio-respiratoire mesurée par le VO2max.'
    },
    {
      title: 'Aptitude musculosquelettique',
      score: synth.musculoGlobal,
      blurb: 'Force et puissance globales des principaux groupes musculaires.'
    },
    {
      title: 'Santé du dos',
      score: synth.backHealth,
      blurb: 'Souplesse et endurance des muscles qui soutiennent la colonne.'
    }
  ]
  return (
    <ReportSection title="Synthèse" sectionNumber="Section 3">
      <p style={{ fontSize: '11pt', color: INK_SOFT, marginTop: '-4mm', marginBottom: '9mm' }}>
        Vue d’ensemble au {formatBilanDate(bilanDate)}.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7mm' }}>
        {cards.map(c => (
          <div
            key={c.title}
            style={{ border: `1px solid ${GRID}`, borderRadius: '4mm', padding: '7mm 7mm 8mm', background: '#fff' }}
          >
            <p className="report-display" style={{ fontSize: '15pt', fontWeight: 600, color: MARINE }}>
              {c.title}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2mm', margin: '2mm 0 1mm' }}>
              <span className="report-display" style={{ fontSize: '34pt', fontWeight: 700, color: MARINE }}>
                {c.score.score === null ? '—' : c.score.score.toFixed(1)}
              </span>
              <span style={{ fontSize: '11pt', color: INK_SOFT }}>/ 5</span>
              {c.score.category && (
                <span style={{ marginLeft: 'auto' }}>
                  <CategoryPill category={c.score.category} />
                </span>
              )}
            </div>
            <ScoreBar score={c.score.score} />
            <p style={{ fontSize: '9.5pt', color: INK_SOFT, marginTop: '5mm' }}>{c.blurb}</p>
          </div>
        ))}
      </div>
      <ColorLegend />
    </ReportSection>
  )
}

/** Barre 5 segments pour un score composite 0-5. */
function ScoreBar({ score }: { score: number | null }) {
  const segs: Category[] = ['A_AMELIORER', 'ACCEPTABLE', 'BIEN', 'TRES_BIEN', 'EXCELLENT']
  const pos = score === null ? null : Math.max(0, Math.min(100, (score / 5) * 100))
  return (
    <div style={{ position: 'relative', paddingTop: pos !== null ? '5mm' : 0 }}>
      {pos !== null && (
        <div style={{ position: 'absolute', top: 0, left: `${pos}%`, transform: 'translateX(-50%)', fontSize: '9pt', color: MARINE }}>
          ▼
        </div>
      )}
      <div style={{ display: 'flex', height: '4mm', borderRadius: '1.5mm', overflow: 'hidden' }}>
        {segs.map(s => (
          <div key={s} style={{ flex: 1, background: CAT_BG[s] }} />
        ))}
      </div>
    </div>
  )
}

function CategoryPill({ category, label }: { category: Category; label?: string }) {
  return (
    <span
      style={{
        background: CAT_BG[category],
        color: CAT_FG[category],
        fontSize: '8pt',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        padding: '1mm 2.5mm',
        borderRadius: '2mm',
        whiteSpace: 'nowrap'
      }}
    >
      {label ?? CATEGORY_LABELS[category]}
    </span>
  )
}

/** Légende du code couleur des barèmes (5 zones À améliorer → Excellent). */
function ColorLegend() {
  const cats: Category[] = ['A_AMELIORER', 'ACCEPTABLE', 'BIEN', 'TRES_BIEN', 'EXCELLENT']
  return (
    <div style={{ marginTop: '10mm', paddingTop: '5mm', borderTop: `1px solid ${GRID}` }}>
      <p style={{ fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: INK_SOFT, marginBottom: '2.5mm' }}>
        Comment lire les couleurs
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5mm' }}>
        {cats.map(c => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
            <span style={{ width: '4mm', height: '4mm', borderRadius: '1mm', background: CAT_BG[c], display: 'inline-block' }} />
            <span style={{ fontSize: '9pt', color: MARINE }}>{CATEGORY_LABELS[c]}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '8.5pt', color: AXIS, marginTop: '2.5mm' }}>
        Chaque barre situe votre résultat sur cette échelle, selon les normes ACSM pour votre âge et votre sexe.
      </p>
    </div>
  )
}

// ── Section 4 — Composition corporelle & zones d'entraînement ────────────────
function CompositionPage({ latest, computed }: { latest: Bilan; computed: BilanComputed }) {
  const d = latest.data as Record<string, unknown>
  const plis: { label: string; key: string }[] = [
    { label: 'Triceps', key: 'pli_triceps' },
    { label: 'Biceps', key: 'pli_biceps' },
    { label: 'Sous-scapulaire', key: 'pli_sous_scap' },
    { label: 'Crête iliaque', key: 'pli_iliaque' },
    { label: 'Mollet', key: 'pli_mollet' },
    { label: 'Cuisse', key: 'pli_cuisse' }
  ]
  const plisPresents = plis.map(p => ({ ...p, value: num(d[p.key]) })).filter(p => p.value !== null)
  const durnin4 = ['pli_triceps', 'pli_biceps', 'pli_sous_scap', 'pli_iliaque'].map(k => num(d[k]))
  const sommePlis = durnin4.every(v => v !== null) ? (durnin4 as number[]).reduce((a, b) => a + b, 0) : null

  // Tension artérielle au repos — zones cliniques nommées (Optimale → HTA 2).
  const sys = num(d.pa_systolique)
  const dia = num(d.pa_diastolique)
  const sysClass = sys !== null ? classifyBloodPressure(sys, 'systolic') : null
  const diaClass = dia !== null ? classifyBloodPressure(dia, 'diastolic') : null
  const bpRows = [
    { label: 'Systolique', value: sys, cls: sysClass },
    { label: 'Diastolique', value: dia, cls: diaClass }
  ].filter(r => r.value !== null)

  const stats: { label: string; value: string; hint?: string }[] = [
    { label: 'IMC', value: computed.imc === null ? '—' : `${fmt(computed.imc)} kg/m²` },
    { label: 'Tour de taille', value: num(d.tour_taille_cm) === null ? '—' : `${fmt(num(d.tour_taille_cm))} cm` },
    {
      label: 'Ratio taille / hanche',
      value: computed.ratioTailleHanche === null ? '—' : fmt(computed.ratioTailleHanche, 2)
    },
    {
      label: 'Poids optimal max',
      value: computed.poidsOptimalMaxKg === null ? '—' : `${fmt(computed.poidsOptimalMaxKg)} kg`,
      hint: 'Poids pour un IMC de 25'
    },
    {
      label: '% de gras',
      value: computed.pourcentageGrasDurnin === null ? '—' : `${fmt(computed.pourcentageGrasDurnin)} %`,
      hint: 'Méthode Durnin-Womersley (4 plis)'
    },
    { label: 'Somme des 4 plis', value: sommePlis === null ? '—' : `${fmt(sommePlis)} mm` }
  ]

  const zones = computed.fcZones
  const zoneRows = zones
    ? [
        { pct: '60 %', bpm: zones.z60, libelle: 'Échauffement' },
        { pct: '65 %', bpm: zones.z65, libelle: 'Endurance de base' },
        { pct: '70 %', bpm: zones.z70, libelle: 'Endurance' },
        { pct: '75 %', bpm: zones.z75, libelle: 'Aérobie' },
        { pct: '80 %', bpm: zones.z80, libelle: 'Seuil' },
        { pct: '85 %', bpm: zones.z85, libelle: 'Anaérobie' },
        { pct: '90 %', bpm: zones.z90, libelle: 'VO2max' }
      ]
    : []

  return (
    <ReportSection title="Composition corporelle" sectionNumber="Section 4">
      <p style={{ fontSize: '11pt', color: INK_SOFT, marginTop: '-4mm', marginBottom: '8mm' }}>
        Vos mesures anthropométriques au {formatBilanDate(latest.date)}.
      </p>

      {/* Chiffres clés */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5mm', marginBottom: '10mm' }}>
        {stats.map(s => (
          <div key={s.label} style={{ border: `1px solid ${GRID}`, borderRadius: '3mm', padding: '5mm 6mm' }}>
            <p style={{ fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_SOFT }}>
              {s.label}
            </p>
            <p className="report-display" style={{ fontSize: '20pt', fontWeight: 700, color: MARINE, marginTop: '1mm' }}>
              {s.value}
            </p>
            {s.hint && <p style={{ fontSize: '8pt', color: AXIS, marginTop: '0.5mm' }}>{s.hint}</p>}
          </div>
        ))}
      </div>

      {/* Détail des plis cutanés */}
      {plisPresents.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '10mm' }}>
          <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, marginBottom: '3mm' }}>
            Plis cutanés (mm)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4mm' }}>
            {plisPresents.map(p => (
              <div
                key={p.key}
                style={{ background: CREAM, borderRadius: '2mm', padding: '3mm 5mm', minWidth: '30mm' }}
              >
                <span style={{ fontSize: '9pt', color: INK_SOFT }}>{p.label} </span>
                <span style={{ fontSize: '11pt', fontWeight: 600, color: MARINE }}>{fmt(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tension artérielle au repos — zones cliniques nommées */}
      {bpRows.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '10mm' }}>
          <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, marginBottom: '2mm' }}>
            Tension artérielle au repos
          </p>
          <p style={{ fontSize: '9.5pt', color: INK_SOFT, marginBottom: '4mm' }}>
            Classée selon les seuils cliniques : Optimale · Normale · Pré-hypertension · Hypertension 1 · Hypertension 2
            (OMS / JNC).
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
            <tbody>
              {bpRows.map(r => (
                <tr key={r.label} style={{ borderBottom: `1px solid ${GRID}` }}>
                  <td style={{ padding: '3mm', color: INK_SOFT }}>{r.label}</td>
                  <td style={{ padding: '3mm', color: MARINE, fontWeight: 700 }}>{fmt(r.value, 0)} mmHg</td>
                  <td style={{ padding: '3mm', textAlign: 'right' }}>
                    {r.cls && <CategoryPill category={r.cls.category} label={r.cls.zone} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Zones d'entraînement cardiaque */}
      {zoneRows.length > 0 && (
        <div className="break-inside-avoid">
          <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, marginBottom: '2mm' }}>
            Zones d'entraînement cardiaque
          </p>
          <p style={{ fontSize: '9.5pt', color: INK_SOFT, marginBottom: '4mm' }}>
            Fréquences cibles selon votre FC maximale prédite
            {computed.fcMaxPredite !== null ? ` (${computed.fcMaxPredite} bpm, formule de Tanaka)` : ''}. Pour développer
            l'endurance, visez 60-75 % ; au-delà de 80 %, l'effort devient intense.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${GRID}`, color: INK_SOFT, fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ textAlign: 'left', padding: '2.5mm 3mm' }}>% FC max</th>
                <th style={{ textAlign: 'left', padding: '2.5mm 3mm' }}>Zone</th>
                <th style={{ textAlign: 'right', padding: '2.5mm 3mm' }}>Fréquence cible</th>
              </tr>
            </thead>
            <tbody>
              {zoneRows.map(z => (
                <tr key={z.pct} style={{ borderBottom: `1px solid ${GRID}` }}>
                  <td style={{ padding: '2.6mm 3mm', color: MARINE, fontWeight: 600 }}>{z.pct}</td>
                  <td style={{ padding: '2.6mm 3mm', color: INK_SOFT }}>{z.libelle}</td>
                  <td style={{ textAlign: 'right', padding: '2.6mm 3mm', color: MARINE, fontWeight: 600 }}>{z.bpm} bpm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportSection>
  )
}

// ── Section 5 — Graphiques de progression ────────────────────────────────────
interface ChartPoint {
  label: string
  value: number | null
}
function ProgressionChartsPage({
  chrono,
  syntheses
}: {
  chrono: Bilan[]
  syntheses: ReturnType<typeof computeSynthesis>[]
}) {
  const series = (key: keyof BilanData): ChartPoint[] =>
    chrono.map(b => ({ label: formatBilanMonth(b.date), value: num(b.data[key]) }))
  const scoreSeries = (pick: (s: ReturnType<typeof computeSynthesis>) => CompositeScore): ChartPoint[] =>
    chrono.map((b, i) => ({ label: formatBilanMonth(b.date), value: syntheses[i] ? pick(syntheses[i]).score : null }))

  const dual = (a: keyof BilanData, b: keyof BilanData) =>
    chrono.map(x => ({ label: formatBilanMonth(x.date), a: num(x.data[a]), b: num(x.data[b]) }))

  return (
    <>
      <ReportSection title="Votre progression" sectionNumber="Section 5 · 1/2">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm' }}>
          <ChartCard title="VO2max (ml/kg/min)">
            <SingleLineChart data={series('vo2max')} color={GOLD} />
          </ChartCard>
          <ChartCard title="% de gras corporel">
            <SingleLineChart data={series('pourcentage_gras')} color={MARINE} />
          </ChartCard>
          <ChartCard title="Poids (kg)">
            <SingleLineChart data={series('poids_kg')} color={GOLD} />
          </ChartCard>
          <ChartCard title="IMC (kg/m²)">
            <SingleLineChart data={series('imc')} color={MARINE} />
          </ChartCard>
        </div>
      </ReportSection>
      <ReportSection title="Votre progression" sectionNumber="Section 5 · 2/2">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm' }}>
          <ChartCard title="Score musculosquelettique (/ 5)">
            <SingleBarChart data={scoreSeries(s => s.musculoGlobal)} />
          </ChartCard>
          <ChartCard title="Score santé du dos (/ 5)">
            <SingleLineChart data={scoreSeries(s => s.backHealth)} color={MARINE} scoreAxis />
          </ChartCard>
          <ChartCard title="Pompes & redressements (reps)">
            <DualLineChart data={dual('pushups', 'situps')} nameA="Pompes" nameB="Redressements" />
          </ChartCard>
          <ChartCard title="Saut vertical & puissance">
            <DualLineChart data={dual('saut_vertical_cm', 'puissance_jambes_watts')} nameA="Saut (cm)" nameB="Puissance (W)" />
          </ChartCard>
        </div>
      </ReportSection>
    </>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div style={{ background: CREAM, borderRadius: '3mm', padding: '5mm 5mm 3mm' }}>
      <p style={{ fontSize: '9.5pt', fontWeight: 600, color: MARINE, marginBottom: '2mm' }}>{title}</p>
      <div style={{ width: '100%', height: '80mm' }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Étiquette de valeur affichée UNIQUEMENT sur le dernier point (le plus récent)
 *  — évite le chevauchement des labels quand il y a beaucoup de bilans. Recharts
 *  clone cet élément en injectant x / y / value / index. */
function EndpointValueLabel({
  x,
  y,
  value,
  index,
  lastIdx,
  dy = -8
}: {
  x?: number
  y?: number
  value?: number | string
  index?: number
  lastIdx: number
  dy?: number
}) {
  if (index !== lastIdx) return null
  const v = num(value)
  if (v === null) return null
  return (
    <text x={x} y={(y ?? 0) + dy} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600, fill: MARINE }}>
      {fmt(v)}
    </text>
  )
}

function SingleLineChart({
  data,
  color,
  scoreAxis = false
}: {
  data: ChartPoint[]
  color: string
  /** Force l'axe Y sur l'échelle de score 0-5 (ticks entiers). */
  scoreAxis?: boolean
}) {
  return (
    <LineChart data={data} margin={{ top: 18, right: 34, bottom: 4, left: -8 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis
        dataKey="label"
        interval="preserveStartEnd"
        minTickGap={30}
        tickMargin={6}
        tick={{ fill: AXIS, fontSize: 10 }}
        stroke={GRID}
      />
      <YAxis
        tick={{ fill: AXIS, fontSize: 10 }}
        stroke={GRID}
        width={40}
        domain={scoreAxis ? [0, 5] : ['auto', 'auto']}
        ticks={scoreAxis ? [0, 1, 2, 3, 4, 5] : undefined}
      />
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3.5, fill: color }} isAnimationActive={false} connectNulls>
        <LabelList content={<EndpointValueLabel lastIdx={data.length - 1} />} />
      </Line>
    </LineChart>
  )
}

function SingleBarChart({ data }: { data: ChartPoint[] }) {
  return (
    <BarChart data={data} margin={{ top: 18, right: 34, bottom: 4, left: -8 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis
        dataKey="label"
        interval="preserveStartEnd"
        minTickGap={30}
        tickMargin={6}
        tick={{ fill: AXIS, fontSize: 10 }}
        stroke={GRID}
      />
      <YAxis tick={{ fill: AXIS, fontSize: 10 }} stroke={GRID} width={40} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
      <Bar dataKey="value" fill={GOLD_SOFT} radius={[2, 2, 0, 0]} barSize={26} isAnimationActive={false}>
        <LabelList content={<EndpointValueLabel lastIdx={data.length - 1} dy={-4} />} />
      </Bar>
    </BarChart>
  )
}

function DualLineChart({
  data,
  nameA,
  nameB
}: {
  data: { label: string; a: number | null; b: number | null }[]
  nameA: string
  nameB: string
}) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 34, bottom: 4, left: -8 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis
        dataKey="label"
        interval="preserveStartEnd"
        minTickGap={30}
        tickMargin={6}
        tick={{ fill: AXIS, fontSize: 10 }}
        stroke={GRID}
      />
      <YAxis tick={{ fill: AXIS, fontSize: 10 }} stroke={GRID} width={40} domain={['auto', 'auto']} />
      <Legend wrapperStyle={{ fontSize: 9.5 }} />
      <Line type="monotone" dataKey="a" name={nameA} stroke={GOLD} strokeWidth={2.5} dot={{ r: 3, fill: GOLD }} isAnimationActive={false} connectNulls />
      <Line type="monotone" dataKey="b" name={nameB} stroke={MARINE} strokeWidth={2.5} dot={{ r: 3, fill: MARINE }} isAnimationActive={false} connectNulls />
    </LineChart>
  )
}

// ── Section 5 — Pages détaillées par métrique ────────────────────────────────
function MetricDetailsPages({
  latest,
  bilans,
  profile
}: {
  latest: Bilan
  bilans: Bilan[]
  profile: BilanProfile
}) {
  // Métriques renseignées dans le dernier bilan.
  const present = METRICS.filter(m => num(latest.data[m.key]) !== null)
  // Pagination équilibrée : max 3 cartes/page (une carte « haute » — sparkline +
  // objectif + phrase — tient à 3 par page A4). On répartit uniformément pour
  // éviter une dernière page avec une seule carte orpheline (ex. 13 → 3,3,3,2,2).
  const MAX_PER_PAGE = 3
  const pageCount = Math.max(1, Math.ceil(present.length / MAX_PER_PAGE))
  const base = Math.floor(present.length / pageCount)
  const extra = present.length % pageCount
  const pages: MetricDef[][] = []
  let cursor = 0
  for (let p = 0; p < pageCount; p++) {
    const size = base + (p < extra ? 1 : 0)
    pages.push(present.slice(cursor, cursor + size))
    cursor += size
  }
  // Bilans du plus récent au plus ancien — 4 derniers pour la sparkline.
  const recent = bilans.slice(0, 4)

  return (
    <>
      {pages.map((page, pi) => (
        <ReportSection
          key={pi}
          title="En détail"
          sectionNumber={`Section 6 · ${pi + 1}/${pages.length}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6mm' }}>
            {page.map(m => (
              <MetricBlock key={m.key} metric={m} latest={latest} recent={recent} profile={profile} />
            ))}
          </div>
        </ReportSection>
      ))}
    </>
  )
}

function MetricBlock({
  metric,
  latest,
  recent,
  profile
}: {
  metric: MetricDef
  latest: Bilan
  recent: Bilan[]
  profile: BilanProfile
}) {
  const value = num(latest.data[metric.key])
  if (value === null) return null
  const norm = metricNorm(metric.key, value, profile)
  // Pour le VO2max : rappel du protocole utilisé et de son paramètre brut.
  const protocol = metric.key === 'vo2max' ? aerobicProtocolLabel(latest.data as Record<string, unknown>, formatMmSs) : null
  const spark = recent
    .slice()
    .reverse()
    .map(b => num(b.data[metric.key]))
    .filter((v): v is number => v !== null)

  // Phrase explicative — une par catégorie ; aucune si la métrique n'est pas catégorisée.
  const blurb = norm?.category ? EXPLANATION_BY_CATEGORY[norm.category] : null

  return (
    <div
      className="break-inside-avoid"
      style={{ border: `1px solid ${GRID}`, borderRadius: '3mm', padding: '5mm 6mm' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="report-display" style={{ fontSize: '15pt', fontWeight: 600, color: MARINE }}>
          {metric.label}
        </h2>
        {norm?.category && <CategoryPill category={norm.category} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8mm', marginTop: '2mm' }}>
        <div style={{ flexShrink: 0 }}>
          <span className="report-display" style={{ fontSize: '30pt', fontWeight: 700, color: MARINE }}>
            {fmt(value)}
          </span>
          <span style={{ fontSize: '11pt', color: INK_SOFT, marginLeft: '1.5mm' }}>{metric.unit}</span>
          {norm?.percentile !== null && norm?.percentile !== undefined && (
            <p style={{ fontSize: '9pt', color: INK_SOFT }}>{Math.round(norm.percentile)}ᵉ percentile</p>
          )}
          {protocol && <p style={{ fontSize: '8.5pt', color: AXIS, marginTop: '0.5mm' }}>Estimé via {protocol}</p>}
        </div>
        {spark.length >= 2 && (
          <div style={{ flexShrink: 0 }}>
            <MiniSpark values={spark} />
            <p style={{ fontSize: '7.5pt', color: AXIS, textAlign: 'center' }}>4 derniers bilans</p>
          </div>
        )}
        <div style={{ flex: 1 }}>
          {norm?.percentiles ? (
            <CategoryRangeBar
              value={value}
              percentiles={norm.percentiles}
              unit={metric.unit}
              lowerIsBetter={norm.lowerIsBetter}
              variant="compact"
            />
          ) : (
            <p style={{ fontSize: '9pt', color: AXIS }}>Pas de barème normatif pour cette mesure.</p>
          )}
        </div>
      </div>
      {norm?.next && !norm.next.isAtTop && (
        <p style={{ fontSize: '9.5pt', color: MARINE, marginTop: '3mm' }}>
          <Target size={11} style={{ display: 'inline', verticalAlign: '-1px', color: GOLD }} />{' '}
          Pour atteindre <strong>{CATEGORY_LABELS[norm.next.nextCategory]}</strong> :{' '}
          {norm.lowerIsBetter ? '≤' : '≥'} {fmt(norm.next.targetValue)} {metric.unit}
          {norm.next.delta !== 0 && (
            <span style={{ color: INK_SOFT }}>
              {' '}({norm.next.delta >= 0 ? '+' : ''}
              {fmt(norm.next.delta)} {metric.unit})
            </span>
          )}
        </p>
      )}
      {norm?.next?.isAtTop && (
        <p style={{ fontSize: '9.5pt', color: '#2f7d32', marginTop: '3mm' }}>
          <Trophy size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> Niveau maximal atteint.
        </p>
      )}
      {blurb && <p style={{ fontSize: '9pt', color: INK_SOFT, marginTop: '2mm' }}>{blurb}</p>}
    </div>
  )
}

/** Sparkline SVG minimaliste. */
function MiniSpark({ values }: { values: number[] }) {
  const W = 120
  const H = 34
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - 6) + 3
    const y = H - 4 - ((v - min) / span) * (H - 8)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '26mm', height: '8mm' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => {
        const [x, y] = p.split(',')
        return <circle key={i} cx={x} cy={y} r={2.4} fill={i === pts.length - 1 ? MARINE : GOLD} />
      })}
    </svg>
  )
}

// ── Section 7 — Récupération post-effort ─────────────────────────────────────
/** Rendue seulement si des données de récupération sont présentes (sinon `null`,
 *  aucune page ajoutée). Les notes de la kinésiologue vivent désormais dans le
 *  « mot du kinésiologue » (Section 8), plus dans une section séparée. */
function RecuperationEtNotesPage({ latest }: { latest: Bilan }) {
  const data = latest.data as Record<string, unknown>
  if (!hasRecoveryData(data)) return null

  const intervals = [
    { label: '1 min', sys: 'recup_1min_pa_sys', dia: 'recup_1min_pa_dia', fc: 'recup_1min_fc' },
    { label: '3 min', sys: 'recup_3min_pa_sys', dia: 'recup_3min_pa_dia', fc: 'recup_3min_fc' },
    { label: '5 min', sys: 'recup_5min_pa_sys', dia: 'recup_5min_pa_dia', fc: 'recup_5min_fc' }
  ]
  const thStyle: React.CSSProperties = {
    textAlign: 'right',
    padding: '2.5mm 3mm',
    fontSize: '8.5pt',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: INK_SOFT
  }
  const tdStyle: React.CSSProperties = { textAlign: 'right', padding: '3mm', color: MARINE, fontWeight: 600 }

  return (
    <ReportSection title="Récupération post-effort" sectionNumber="Section 7">
      <div className="break-inside-avoid">
        <p style={{ fontSize: '10pt', color: INK_SOFT, marginTop: '-4mm', marginBottom: '5mm', maxWidth: '150mm' }}>
          Le retour de la fréquence cardiaque et de la pression artérielle vers les valeurs de repos après l’effort
          est un indicateur de la santé cardiovasculaire.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${GRID}` }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>Après l’effort</th>
              <th style={thStyle}>FC (bpm)</th>
              <th style={thStyle}>PA systolique (mmHg)</th>
              <th style={thStyle}>PA diastolique (mmHg)</th>
            </tr>
          </thead>
          <tbody>
            {intervals.map(iv => (
              <tr key={iv.label} style={{ borderBottom: `1px solid ${GRID}` }}>
                <td style={{ padding: '3mm', color: MARINE, fontWeight: 600 }}>{iv.label}</td>
                <td style={tdStyle}>{fmt(num(data[iv.fc]), 0)}</td>
                <td style={tdStyle}>{fmt(num(data[iv.sys]), 0)}</td>
                <td style={tdStyle}>{fmt(num(data[iv.dia]), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportSection>
  )
}

// ── Section 7 — Forces & axes de progression ─────────────────────────────────
function ForcesEtAxesPage({
  latest,
  profile,
  coachName,
  signature
}: {
  latest: Bilan
  profile: BilanProfile
  coachName: string
  signature: string
}) {
  const SCORE_OF: Record<Category, number> = {
    A_AMELIORER: 1,
    ACCEPTABLE: 2,
    BIEN: 3,
    TRES_BIEN: 4,
    EXCELLENT: 5
  }
  const ranked = METRICS.map(m => {
    const value = num(latest.data[m.key])
    if (value === null) return null
    const norm = metricNorm(m.key, value, profile)
    if (!norm?.category) return null
    return {
      metric: m,
      value,
      category: norm.category,
      percentile: norm.percentile,
      next: norm.next,
      lowerIsBetter: norm.lowerIsBetter
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  const forces = ranked
    .filter(r => r.category === 'EXCELLENT' || r.category === 'TRES_BIEN')
    .sort((a, b) => SCORE_OF[b.category] - SCORE_OF[a.category])
    .slice(0, 3)
  const axes = ranked
    .filter(r => r.category === 'A_AMELIORER' || r.category === 'ACCEPTABLE')
    .sort((a, b) => SCORE_OF[a.category] - SCORE_OF[b.category])
    .slice(0, 3)

  const notes = typeof latest.data.notes === 'string' ? latest.data.notes.trim() : ''
  const signOff = signature.trim() || `${coachName || 'Marie-Eve Bélanger'}\nKinésiologue`

  return (
    <ReportSection title="Vos forces et votre plan d’action" sectionNumber="Section 8">
      {/* Forces */}
      <div style={{ marginTop: '2mm', marginBottom: '9mm' }}>
        <p className="report-display" style={{ fontSize: '15pt', fontWeight: 600, color: MARINE, marginBottom: '4mm' }}>
          <Trophy size={16} style={{ display: 'inline', verticalAlign: '-2px', color: GOLD }} /> Vos forces
        </p>
        {forces.length === 0 ? (
          <p style={{ fontSize: '10pt', color: INK_SOFT }}>
            Continuez vos efforts — vos forces apparaîtront à mesure que vos résultats progressent.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5mm' }}>
            {forces.map(f => (
              <div key={f.metric.key as string} style={{ border: `1px solid ${GRID}`, borderRadius: '3mm', padding: '4mm 5mm' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '1mm' }}>
                  <span style={{ fontSize: '10.5pt', fontWeight: 600, color: MARINE }}>{f.metric.label}</span>
                  <CategoryPill category={f.category} />
                </div>
                <p style={{ fontSize: '9.5pt', color: INK_SOFT }}>
                  {fmt(f.value)} {f.metric.unit}
                  {f.percentile !== null && ` · ${Math.round(f.percentile)}ᵉ perc.`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan d'action — priorités numérotées avec objectif chiffré */}
      <div>
        <p className="report-display" style={{ fontSize: '15pt', fontWeight: 600, color: MARINE, marginBottom: '4mm' }}>
          <Target size={16} style={{ display: 'inline', verticalAlign: '-2px', color: GOLD }} /> Votre plan d’action
        </p>
        {axes.length === 0 ? (
          <p style={{ fontSize: '10pt', color: INK_SOFT }}>
            Aucun point faible marqué — beau travail ! Maintenez vos habitudes actuelles et vos résultats.
          </p>
        ) : (
          axes.map((a, i) => (
            <div key={a.metric.key as string} style={{ display: 'flex', gap: '4mm', marginBottom: '5mm' }} className="break-inside-avoid">
              <div
                style={{
                  flexShrink: 0,
                  width: '8mm',
                  height: '8mm',
                  borderRadius: '50%',
                  background: GOLD,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '11pt'
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '11pt', fontWeight: 600, color: MARINE }}>{a.metric.label}</span>
                  <CategoryPill category={a.category} />
                </div>
                <p style={{ fontSize: '9.5pt', color: INK_SOFT, marginTop: '0.5mm' }}>
                  {RECO[a.metric.key] ?? 'Discutez d’un plan ciblé avec votre kinésiologue.'}
                </p>
                {a.next && !a.next.isAtTop && (
                  <p style={{ fontSize: '9.5pt', color: MARINE, marginTop: '1mm', fontWeight: 600 }}>
                    Objectif : {a.lowerIsBetter ? '≤' : '≥'} {fmt(a.next.targetValue)} {a.metric.unit}{' '}
                    <span style={{ color: INK_SOFT, fontWeight: 400 }}>
                      pour atteindre « {CATEGORY_LABELS[a.next.nextCategory]} »
                      {a.next.delta !== 0 && ` (${a.next.delta >= 0 ? '+' : ''}${fmt(a.next.delta)} ${a.metric.unit})`}
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mot du kinésiologue — message personnalisé (notes du bilan) + signature */}
      <div style={{ marginTop: '12mm', background: CREAM, borderRadius: '4mm', padding: '8mm 10mm' }}>
        <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD, marginBottom: '3mm' }}>
          Le mot de votre kinésiologue
        </p>
        {notes !== '' && (
          <p style={{ fontSize: '10.5pt', color: MARINE, lineHeight: 1.55, whiteSpace: 'pre-line', marginBottom: '5mm' }}>
            {notes}
          </p>
        )}
        <p style={{ fontSize: '10.5pt', color: MARINE, lineHeight: 1.4, whiteSpace: 'pre-line', fontStyle: notes !== '' ? 'italic' : 'normal' }}>
          {signOff}
        </p>
      </div>

      <p style={{ marginTop: 'auto', paddingTop: '10mm', fontSize: '8pt', color: AXIS, textAlign: 'center' }}>
        Rapport généré par Kinésio Outils — {reportDateLabel()}
      </p>
    </ReportSection>
  )
}
