import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
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
import type { BilanProfile, CompositeScore } from '../lib/norms/scoring'
import { buildSynthesisBilan } from '../lib/synthesisBilan'
import { computeBilan, type BilanComputed } from '../lib/bilan-computed'
import { bodyFatRisk, BF_RISK_HEX } from '../lib/body-fat-risk'
import { PRINCIPES } from '../lib/principes'
import { bodyFatGoal, estimateMacros, weeksToGoal, dailyDeficitForRate, weeklyLossFromDeficit, DEFAULT_RATE_KG_PER_WEEK } from '../lib/nutrition'
import { fitnessAge } from '../lib/fitness-age'
import { kgToLb } from '../lib/units'
import { dualWeight, estimatedGoalDate } from '../lib/objectif-format'
import { formatMmSs } from '../lib/vo2max-calculator'
import { hasRecoveryData, aerobicProtocolLabel } from '../lib/report-helpers'
import logo from '../assets/logo.png'
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
const SCORE_OF: Record<Category, number> = {
  A_AMELIORER: 1,
  ACCEPTABLE: 2,
  BIEN: 3,
  TRES_BIEN: 4,
  EXCELLENT: 5
}

const SEX_LABEL: Record<string, string> = { F: 'Femme', M: 'Homme' }

declare global {
  interface Window {
    /** Posé par ReportPage une fois polices + graphiques rendus — lu par `printToPDF()`. */
    __REPORT_READY__?: boolean
  }
}

// ── Métriques suivies ────────────────────────────────────────────────────────
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
const METRIC_BY_KEY: Partial<Record<keyof BilanData, MetricDef>> = Object.fromEntries(
  METRICS.map(m => [m.key, m])
)

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
/** Format compact d'un seuil : entier si rond, sinon 1 décimale. */
function fmtThreshold(n: number): string {
  return fmt(n, Number.isInteger(n) ? 0 : 1)
}
/** Teinte translucide d'une couleur hex (pour surligner la cellule du client). */
function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
/** Plage numérique d'une catégorie pour un test donné (barème de référence). */
function categoryRange(p: { p10: number; p25: number; p50: number; p75: number }, lowerIsBetter: boolean, cat: Category): string {
  const f = fmtThreshold
  if (!lowerIsBetter) {
    switch (cat) {
      case 'A_AMELIORER': return `< ${f(p.p10)}`
      case 'ACCEPTABLE': return `${f(p.p10)}–${f(p.p25)}`
      case 'BIEN': return `${f(p.p25)}–${f(p.p50)}`
      case 'TRES_BIEN': return `${f(p.p50)}–${f(p.p75)}`
      case 'EXCELLENT': return `≥ ${f(p.p75)}`
    }
  }
  switch (cat) {
    case 'A_AMELIORER': return `≥ ${f(p.p10)}`
    case 'ACCEPTABLE': return `${f(p.p25)}–${f(p.p10)}`
    case 'BIEN': return `${f(p.p50)}–${f(p.p25)}`
    case 'TRES_BIEN': return `${f(p.p75)}–${f(p.p50)}`
    case 'EXCELLENT': return `< ${f(p.p75)}`
  }
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
      await new Promise(resolve => setTimeout(resolve, 700))
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
  const syntheses = useMemo(() => chrono.map(b => computeBilan(b.data, profile)), [chrono, profile])

  if (loading) {
    return <div className="report-body p-10 text-base" style={{ color: MARINE }}>Préparation du rapport…</div>
  }
  if (error || !client) {
    return <div className="report-body p-10 text-base" style={{ color: '#b91c1c' }}>{error ?? 'Client introuvable.'}</div>
  }

  // « Bilan courant » = SYNTHÈSE (dernière valeur non-null de chaque champ sur
  // tous les bilans) — identique au mode par défaut du Dashboard, pour que le
  // score global et les composites du PDF correspondent exactement à l'écran.
  // La progression (frise, avant/après) utilise `chrono` = les vrais bilans.
  const synthResult = bilans.length ? buildSynthesisBilan(bilans) : null
  const latest: Bilan | null = synthResult
    ? {
        id: 'synthesis',
        clientId: client.id,
        date: synthResult.latestContributionDate ?? bilans[0].date,
        data: synthResult.data,
        source: 'manuel',
        createdAt: bilans[0].createdAt
      }
    : null
  const latestComputed = latest ? computeBilan(latest.data, profile) : null

  if (!latest || !latestComputed) {
    return (
      <article className="report-body" style={{ color: MARINE, background: '#fff' }}>
        <CoverPage client={client} latest={null} coachName={coachName} totalBilans={0} avatarUrl={avatarUrl} overall={null} />
      </article>
    )
  }

  const shared = { latest, bilans, chrono, syntheses, profile, weightUnit: client.unitWeight }

  return (
    <article className="report-body" style={{ color: MARINE, background: '#fff' }}>
      <CoverPage
        client={client}
        latest={latest}
        coachName={coachName}
        totalBilans={bilans.length}
        avatarUrl={avatarUrl}
        overall={latestComputed.overall.score}
        overallCategory={latestComputed.overall.category}
      />
      <OverviewSection client={client} synth={latestComputed} {...shared} />
      <CompositionSection {...shared} computed={latestComputed} />
      <CardioSection {...shared} computed={latestComputed} />
      <ForceSection {...shared} />
      <DosSection {...shared} />
      <ForcesEtPlanSection latest={latest} profile={profile} coachName={coachName} signature={signature} />
    </article>
  )
}

// ── Wrappers de section ──────────────────────────────────────────────────────
/** Section « page » : tient sur une seule page A4 (couverture, vue d'ensemble, plan). */
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
        minHeight: '250mm',
        margin: '0 auto',
        // Padding VERTICAL = 0 : la marge haut/bas vient de la page PDF (printToPDF,
        // constante sur toutes les pages). Seul le padding HORIZONTAL reste ici.
        padding: pad ? '0 16mm' : 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff'
      }}
    >
      {title && <SectionHeader title={title} sectionNumber={sectionNumber} />}
      <div style={{ flex: 1 }}>{children}</div>
    </section>
  )
}

/** Section « flow » : peut s'étaler sur plusieurs pages A4 (sections par domaine). */
function ReportFlowSection({
  children,
  title,
  sectionNumber,
  intro
}: {
  children: React.ReactNode
  title: string
  sectionNumber: string
  intro?: string
}) {
  return (
    <section
      className="report-flow"
      style={{ width: '210mm', minHeight: '250mm', margin: '0 auto', padding: '0 16mm', boxSizing: 'border-box', background: '#fff' }}
    >
      <SectionHeader title={title} sectionNumber={sectionNumber} />
      {intro && (
        <p style={{ fontSize: '11pt', lineHeight: 1.55, color: INK_SOFT, maxWidth: '160mm', marginTop: '-5mm', marginBottom: '9mm' }}>
          {intro}
        </p>
      )}
      {children}
    </section>
  )
}

function SectionHeader({ title, sectionNumber }: { title: string; sectionNumber?: string }) {
  return (
    <header className="flex items-end justify-between" style={{ marginBottom: '9mm' }}>
      <h1 className="report-display" style={{ fontWeight: 600, fontSize: '27pt', color: MARINE, lineHeight: 1.05 }}>
        {title}
      </h1>
      {sectionNumber && (
        <span style={{ color: '#bcb6a4', fontSize: '9pt', letterSpacing: '0.2em', textTransform: 'uppercase', whiteSpace: 'nowrap', marginLeft: '6mm' }}>
          {sectionNumber}
        </span>
      )}
    </header>
  )
}

/** Titre de bloc (eyebrow doré) à l'intérieur d'une section. `break-after: avoid`
 *  + `break-inside: avoid` : le titre ne se retrouve jamais orphelin en bas de
 *  page, il migre avec le contenu qui le suit. */
function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, fontWeight: 700, margin: '0 0 4mm', breakAfter: 'avoid', breakInside: 'avoid' }}>
      {children}
    </p>
  )
}

// ── Couverture ───────────────────────────────────────────────────────────────
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
      <div style={{ padding: '6mm 20mm 12mm', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="flex items-start justify-between">
          <img src={logo} alt="Kinésio Outils" style={{ height: '16mm', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '8pt', letterSpacing: '0.16em', textTransform: 'uppercase', color: INK_SOFT }}>
              Bilan de progression
            </p>
            {latest && <p style={{ fontSize: '10pt', color: MARINE, marginTop: '1mm' }}>{formatBilanDate(latest.date)}</p>}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Photo du client uniquement — pas de silhouette générique en repli
              (on n'affiche rien sans vraie photo). */}
          {avatarUrl && (
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
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <h1 className="report-display" style={{ fontWeight: 600, fontSize: '40pt', color: MARINE, marginTop: avatarUrl ? '9mm' : '0', textAlign: 'center', lineHeight: 1.05 }}>
            {client.name}
          </h1>
          {subtitle && <p style={{ fontSize: '12pt', color: INK_SOFT, marginTop: '2mm' }}>{subtitle}</p>}

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
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={GOLD} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${circ * frac} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`} />
      <text x={cx} y={cx - 4} textAnchor="middle" dominantBaseline="middle" className="report-display" style={{ fontSize: '64px', fontWeight: 700, fill: MARINE }}>
        {score === null ? '—' : score.toFixed(1)}
      </text>
      <text x={cx} y={cx + 34} textAnchor="middle" style={{ fontSize: '20px', fill: INK_SOFT }}>
        sur 5
      </text>
    </svg>
  )
}

// ── Section 1 — Vue d'ensemble (score + composites + parcours) ────────────────
/** Encadré « Votre objectif » en tête de la Vue d'ensemble. Toujours affiche le
 *  texte libre s'il existe ; si le module nutrition est activé pour le client et
 *  que le % de gras + poids sont disponibles, ajoute la cible chiffrée (livres à
 *  perdre, poids visé), l'échéance estimée et des repères nutritionnels. */
function ObjectifBlock({
  objectif,
  client,
  latest,
  chrono,
  profile
}: {
  objectif: string
  client: Client
  latest: Bilan
  chrono: Bilan[]
  profile: BilanProfile
}) {
  const computed = computeBilan(latest.data, profile)
  const weightKg = num(latest.data.poids_kg)
  const bodyFatPct =
    computed.pourcentageGrasDurnin ??
    (typeof latest.data.pourcentage_gras === 'number' ? latest.data.pourcentage_gras : null)
  const target = client.nutritionEnabled ? client.nutritionTargetBodyFat : null
  const goal = bodyFatGoal(weightKg, bodyFatPct, target)
  const rate = client.nutritionEnabled ? client.nutritionRateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK : null
  const macros =
    goal && client.nutritionEnabled && client.nutritionActivityLevel
      ? estimateMacros({
          weightKg,
          heightCm: num(latest.data.taille_cm),
          age: profile.age,
          sex: profile.sex,
          activity: client.nutritionActivityLevel,
          leanKg: goal.leanKg,
          dailyDeficitKcal: dailyDeficitForRate(rate),
          proteinPerLbLean: client.nutritionProteinPerLbLean,
          fatMaxG: client.nutritionFatMaxG,
          targetKcalOverride: client.nutritionTargetKcal
        })
      : null

  if (objectif === '' && goal === null) return null

  const unit = client.unitWeight
  const w = (kg: number) => dualWeight(kg, unit)
  const atGoal = goal !== null && goal.toLoseKg <= 0.3

  // Rythme effectif : si les calories sont fixées manuellement, on le DÉDUIT du
  // déficit réel (TDEE − calories manuelles) pour que l'échéance colle aux macros ;
  // sinon on prend le rythme choisi par Marie.
  const manualKcal = client.nutritionEnabled ? client.nutritionTargetKcal : null
  const effectiveRate =
    manualKcal !== null && macros !== null ? weeklyLossFromDeficit(macros.tdee - macros.targetKcal) : rate
  const noDeficit = manualKcal !== null && macros !== null && effectiveRate === null

  const weeks = goal ? weeksToGoal(goal.toLoseKg, effectiveRate) : null
  const goalDate = weeks !== null ? estimatedGoalDate(latest.date, weeks) : null
  const rateDisplay =
    effectiveRate === null
      ? ''
      : unit === 'lb'
        ? `${kgToLb(effectiveRate).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} lb/sem`
        : `${effectiveRate.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} kg/sem`

  // Trajectoire projetée du poids : historique réel (plein) + segment pointillé
  // du poids actuel vers le poids-cible, à l'échéance estimée.
  const toUnit = (kg: number) => Math.round((unit === 'lb' ? kgToLb(kg) : kg) * 10) / 10
  const weightHistory =
    goal !== null && !atGoal
      ? chrono
          .map(b => ({ label: formatBilanMonth(b.date), kg: num(b.data.poids_kg) }))
          .filter((h): h is { label: string; kg: number } => h.kg !== null)
      : []
  const projectionData =
    goal !== null && !atGoal && weeks !== null && weightHistory.length >= 1
      ? [
          ...weightHistory.map((h, i) => ({
            label: h.label,
            actual: toUnit(h.kg),
            projected: i === weightHistory.length - 1 ? toUnit(h.kg) : null
          })),
          { label: goalDate ?? 'Objectif', actual: null as number | null, projected: toUnit(goal.goalKg) }
        ]
      : null

  return (
    <>
    <div
      className="break-inside-avoid"
      style={{ background: CREAM, borderRadius: '4mm', borderLeft: `2mm solid ${GOLD}`, padding: '6mm 8mm' }}
    >
      <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD, fontWeight: 700, marginBottom: '2.5mm' }}>
        Votre objectif
      </p>

      {objectif !== '' && (
        <p style={{ fontSize: '13pt', lineHeight: 1.5, color: MARINE, fontStyle: 'italic', marginBottom: goal ? '5mm' : '0' }}>
          «&nbsp;{objectif}&nbsp;»
        </p>
      )}

      {goal !== null && bodyFatPct !== null && target !== null && (
        <div style={{ background: '#fff', borderRadius: '3mm', padding: '5mm 6mm' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6mm', flexWrap: 'wrap' }}>
            <ObjStat label="% de gras actuel" value={`${bodyFatPct.toFixed(1)} %`} />
            <span style={{ fontSize: '16pt', color: GOLD }}>→</span>
            <ObjStat label="% de gras visé" value={`${target} %`} accent />
          </div>

          {atGoal ? (
            <p style={{ fontSize: '12pt', color: MARINE, marginTop: '4mm', fontWeight: 600 }}>
              🎉&nbsp;Objectif de composition atteint — on maintient&nbsp;!
            </p>
          ) : (
            <>
              <p style={{ fontSize: '11pt', color: INK_SOFT, marginTop: '4mm', lineHeight: 1.5 }}>
                Pour l'atteindre&nbsp;: viser une perte d'environ{' '}
                <span style={{ fontSize: '14pt', fontWeight: 700, color: MARINE }}>{w(goal.toLoseKg)}</span> (poids visé&nbsp;:{' '}
                <strong style={{ color: MARINE }}>{w(goal.goalKg)}</strong>, en préservant la masse musculaire).
              </p>
              {weeks !== null && (
                <>
                  <p style={{ fontSize: '10pt', color: INK_SOFT, marginTop: '2.5mm', lineHeight: 1.5 }}>
                    <strong style={{ color: MARINE }}>{w(goal.toLoseKg)}</strong> à perdre au rythme de{' '}
                    <strong style={{ color: MARINE }}>{rateDisplay}</strong>&nbsp;: environ{' '}
                    <strong style={{ color: MARINE }}>{Math.round(weeks)} semaines</strong> (~{Math.round(weeks / 4.33)}&nbsp;mois)
                    {goalDate !== null && (
                      <>
                        {' '}· échéance estimée <strong style={{ color: MARINE }}>{goalDate}</strong>
                      </>
                    )}
                    .
                  </p>
                  {/* Le chiffre a l'air d'une promesse s'il n'est pas relativisé. */}
                  <p style={{ fontSize: '9pt', color: AXIS, marginTop: '1.5mm', lineHeight: 1.45 }}>
                    Il s'agit d'une <strong style={{ color: INK_SOFT }}>estimation</strong>, pas d'une garantie&nbsp;: le rythme
                    réel varie selon la régularité, le sommeil, l'entraînement et le métabolisme, et ralentit souvent près de
                    la cible. L'échéance est recalculée à chaque bilan.
                  </p>
                </>
              )}
              {noDeficit && (
                <p style={{ fontSize: '10pt', color: INK_SOFT, marginTop: '2.5mm', lineHeight: 1.5 }}>
                  Les calories choisies ne créent pas de déficit&nbsp;: aucune perte de poids n'est projetée à ce niveau.
                </p>
              )}
            </>
          )}

          {macros !== null && !atGoal && (
            <div style={{ marginTop: '5mm', borderTop: `0.3mm solid ${GRID}`, paddingTop: '4mm' }}>
              <p style={{ fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, fontWeight: 700, marginBottom: '3mm' }}>
                Repères nutritionnels quotidiens
              </p>
              <div style={{ display: 'flex', gap: '4mm', flexWrap: 'wrap' }}>
                <MacroChip label="Calories" value={`${macros.targetKcal}`} unit="kcal" />
                <MacroChip label="Protéines" value={`${macros.proteinG}`} unit="g" />
                <MacroChip label="Glucides" value={`${macros.carbsG}`} unit="g" />
                <MacroChip label="Lipides" value={`${macros.fatG}`} unit="g" />
              </div>
              <p style={{ fontSize: '8pt', color: INK_SOFT, fontStyle: 'italic', marginTop: '3mm', lineHeight: 1.45 }}>
                Estimation générale à titre indicatif. Pour un plan alimentaire personnalisé, consultez un(e)
                nutritionniste/diététiste.
              </p>
            </div>
          )}
        </div>
      )}
    </div>

    {projectionData !== null && (
      <BigChartCard title={`Trajectoire vers votre objectif (poids en ${unit === 'lb' ? 'lb' : 'kg'})`}>
        <WeightProjectionChart data={projectionData} />
      </BigChartCard>
    )}
    </>
  )
}

/** Graphique de trajectoire : ligne pleine (poids réel) + ligne pointillée
 *  (projection vers le poids-cible à l'échéance estimée). */
function WeightProjectionChart({
  data
}: {
  data: { label: string; actual: number | null; projected: number | null }[]
}) {
  return (
    <LineChart data={data} margin={{ top: 18, right: 40, bottom: 4, left: -6 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={20} tickMargin={6} tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} />
      <YAxis tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} width={42} domain={['auto', 'auto']} />
      <Legend wrapperStyle={{ fontSize: 10.5 }} />
      <Line type="monotone" dataKey="actual" name="Parcours réel" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3.5, fill: GOLD }} isAnimationActive={false} connectNulls>
        <LabelList content={<EndpointValueLabel lastIdx={data.length - 2} />} />
      </Line>
      <Line type="monotone" dataKey="projected" name="Trajectoire visée" stroke={MARINE} strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3.5, fill: MARINE }} isAnimationActive={false} connectNulls>
        <LabelList content={<EndpointValueLabel lastIdx={data.length - 1} />} />
      </Line>
    </LineChart>
  )
}

function ObjStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.08em', color: INK_SOFT, marginBottom: '1mm' }}>
        {label}
      </p>
      <p style={{ fontSize: '20pt', fontWeight: 700, color: accent ? GOLD : MARINE, lineHeight: 1 }}>{value}</p>
    </div>
  )
}

function MacroChip({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: '28mm', background: CREAM, borderRadius: '2.5mm', padding: '3mm 4mm', textAlign: 'center' }}>
      <p style={{ fontSize: '15pt', fontWeight: 700, color: MARINE, lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: '9pt', fontWeight: 500, color: INK_SOFT }}>&nbsp;{unit}</span>
      </p>
      <p style={{ fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_SOFT, marginTop: '1.5mm' }}>
        {label}
      </p>
    </div>
  )
}

function OverviewSection({
  client,
  bilans,
  chrono,
  syntheses,
  profile,
  synth,
  latest
}: {
  client: Client
  bilans: Bilan[]
  chrono: Bilan[]
  syntheses: BilanComputed[]
  profile: BilanProfile
  synth: BilanComputed
  /** Bilan « courant » = synthèse (mêmes valeurs que le Dashboard). */
  latest: Bilan
}) {
  const single = bilans.length < 2
  const oldest = chrono[0]
  // `latest` = synthèse (valeurs courantes) ; `oldest` = 1er vrai bilan (avant/après).
  const objectif = typeof latest.data.objectif === 'string' ? latest.data.objectif.trim() : ''

  const fitAge = fitnessAge(num(latest.data.vo2max), profile.sex)
  let fitAgeText = fitAge !== null
    ? `Votre capacité cardiovasculaire (VO2max) équivaut à celle d'une personne de ${fitAge} ans.`
    : ''
  if (fitAge !== null && profile.age !== null) {
    const d = profile.age - fitAge
    if (d > 0) {
      fitAgeText = `Votre capacité cardiovasculaire (VO2max) équivaut à celle d'une personne de ${fitAge} ans — soit ${d} an${d > 1 ? 's' : ''} de moins que votre âge réel (${profile.age} ans). Un excellent signe pour votre santé et votre longévité !`
    } else if (d < 0) {
      fitAgeText = `Votre capacité cardiovasculaire (VO2max) équivaut à celle d'une personne de ${fitAge} ans — soit ${-d} an${-d > 1 ? 's' : ''} de plus que votre âge réel (${profile.age} ans). Améliorer votre endurance est un levier puissant pour rajeunir ce chiffre.`
    } else {
      fitAgeText = `Votre capacité cardiovasculaire (VO2max) correspond exactement à votre âge réel (${profile.age} ans).`
    }
  }

  // `keys` = les sous-tests qui composent chaque score (alignés sur `computeSynthesis`).
  const cards: { title: string; score: CompositeScore; keys: (keyof BilanData)[] }[] = [
    { title: 'Composition corporelle', score: synth.composition, keys: ['imc', 'pourcentage_gras', 'tour_taille_cm'] },
    { title: 'Cœur et endurance', score: synth.aerobic, keys: ['vo2max'] },
    { title: 'Force musculaire', score: synth.musculoGlobal, keys: ['pushups', 'situps', 'saut_vertical_cm', 'puissance_jambes_watts'] },
    { title: 'Dos et souplesse', score: synth.backHealth, keys: ['flexion_tronc_cm', 'endurance_dos_sec', 'situps'] }
  ]

  const hero = useMemo(() => {
    if (single) return null
    let best: { label: string; unit: string; from: number; to: number; pct: number } | null = null
    for (const m of METRICS) {
      const from = num(oldest.data[m.key])
      const to = num(latest.data[m.key])
      if (from === null || to === null || from === 0) continue
      const lower = metricNorm(m.key, to, profile)?.lowerIsBetter ?? false
      const pct = ((lower ? from - to : to - from) / Math.abs(from)) * 100
      if (pct > 0 && (best === null || pct > best.pct)) best = { label: m.label, unit: m.unit, from, to, pct }
    }
    return best
  }, [single, oldest, latest, profile])

  const beforeAfter = useMemo(() => {
    if (single) return []
    // Toutes les métriques renseignées dans le bilan actuel (pas de limite). La
    // valeur « avant » peut manquer (bilan de départ partiel) → affichée « — ».
    const rows: { label: string; unit: string; from: number | null; to: number; lower: boolean }[] = []
    for (const m of METRICS) {
      const to = num(latest.data[m.key])
      if (to === null) continue
      const from = num(oldest.data[m.key])
      const lower = metricNorm(m.key, to, profile)?.lowerIsBetter ?? false
      rows.push({ label: m.label, unit: m.unit, from, to, lower })
    }
    return rows
  }, [single, oldest, latest, profile])

  const years = single ? 0 : yearsBetween(oldest.date, latest.date)

  return (
    <ReportFlowSection
      title="Votre bilan en un coup d'œil"
      sectionNumber="Section 1"
      intro="Ce bilan évalue votre condition physique sur quatre grands axes. Votre score global les résume sur une échelle de 1 à 5 — plus il est élevé, meilleure est votre santé physique globale."
    >
      <div className="report-stack">
      {/* Objectif du client — texte libre + (si activé) cible chiffrée & nutrition. */}
      <ObjectifBlock objectif={objectif} client={client} latest={latest} chrono={chrono} profile={profile} />

      {/* Âge en forme — VO2max traduit en âge physiologique. */}
      {fitAge !== null && (
        <div
          className="break-inside-avoid"
          style={{ display: 'flex', alignItems: 'center', gap: '7mm', background: CREAM, borderRadius: '4mm', padding: '6mm 8mm' }}
        >
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, fontWeight: 700, marginBottom: '1mm' }}>
              Âge en forme
            </p>
            <p className="report-display" style={{ fontSize: '34pt', fontWeight: 700, color: MARINE, lineHeight: 1 }}>
              {fitAge}
              <span style={{ fontSize: '13pt', color: INK_SOFT, fontWeight: 500 }}>&nbsp;ans</span>
            </p>
          </div>
          <p style={{ fontSize: '11pt', color: '#3a3f52', lineHeight: 1.55 }}>{fitAgeText}</p>
        </div>
      )}

      {/* Score + 4 composites */}
      <div className="break-inside-avoid" style={{ display: 'flex', gap: '9mm', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <ScoreRing score={synth.overall.score} />
          {synth.overall.category && (
            <div style={{ marginTop: '2mm' }}>
              <CategoryPill category={synth.overall.category} />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: '110mm', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5mm' }}>
          {cards.map(c => (
            <div key={c.title} style={{ border: `1px solid ${GRID}`, borderRadius: '3mm', padding: '5mm 6mm' }}>
              <p className="report-display" style={{ fontSize: '13pt', fontWeight: 600, color: MARINE }}>{c.title}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2mm', margin: '1.5mm 0 1mm' }}>
                <span className="report-display" style={{ fontSize: '26pt', fontWeight: 700, color: MARINE }}>
                  {c.score.score === null ? '—' : c.score.score.toFixed(1)}
                </span>
                <span style={{ fontSize: '10pt', color: INK_SOFT }}>/ 5</span>
                {c.score.category && (
                  <span style={{ marginLeft: 'auto' }}>
                    <CategoryPill category={c.score.category} />
                  </span>
                )}
              </div>
              <ScoreBar score={c.score.score} />
              <CompositeBreakdown keys={c.keys} latest={latest} profile={profile} />
            </div>
          ))}
        </div>
      </div>

      {/* Parcours : hero + timeline + avant/après */}
      {single ? (
        <div style={{ border: `1px dashed ${GOLD_SOFT}`, borderRadius: '4mm', padding: '12mm', textAlign: 'center', background: CREAM }}>
          <p className="report-display" style={{ fontSize: '18pt', color: MARINE, fontWeight: 600 }}>Premier bilan</p>
          <p style={{ fontSize: '11pt', color: INK_SOFT, maxWidth: '120mm', margin: '3mm auto 0' }}>
            La progression de {client.name.split(' ')[0]} deviendra visible dès le prochain bilan. Ce document présente
            l’état actuel comme point de départ.
          </p>
        </div>
      ) : (
        <>
          {hero && (
            <div className="break-inside-avoid" style={{ background: CREAM, borderRadius: '4mm', padding: '7mm 9mm', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8mm' }}>
              <div>
                <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD }}>Votre plus belle progression</p>
                <p className="report-display" style={{ fontSize: '18pt', fontWeight: 600, color: MARINE, marginTop: '1mm' }}>{hero.label}</p>
                <p className="report-display" style={{ fontSize: '30pt', fontWeight: 700, color: MARINE, lineHeight: 1.1 }}>
                  {fmt(hero.from)} → {fmt(hero.to)}
                  <span style={{ fontSize: '13pt', color: INK_SOFT, fontWeight: 500 }}> {hero.unit}</span>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="report-display" style={{ fontSize: '36pt', fontWeight: 700, color: GOLD }}>+{Math.round(hero.pct)} %</p>
                <p style={{ fontSize: '10pt', color: INK_SOFT }}>en {years >= 1 ? `${years.toFixed(years >= 3 ? 0 : 1)} ans` : `${Math.round(years * 12)} mois`}</p>
              </div>
            </div>
          )}
          <div className="break-inside-avoid">
            <JourneyTimeline chrono={chrono} syntheses={syntheses} />
          </div>
          {beforeAfter.length > 0 && (
            <div className="break-inside-avoid">
              <BlockTitle>Avant / après</BlockTitle>
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
                    const delta = r.from !== null ? r.to - r.from : null
                    const improved = delta !== null && (r.lower ? delta < 0 : delta > 0)
                    const pct = delta !== null && r.from !== null && r.from !== 0 ? Math.round((delta / Math.abs(r.from)) * 100) : 0
                    const arrow = delta === null ? '' : delta < 0 ? '▼' : delta > 0 ? '▲' : '='
                    return (
                      <tr key={r.label} style={{ borderTop: `1px solid ${GRID}` }}>
                        <td style={{ padding: '2.4mm 0', color: MARINE }}>{r.label}</td>
                        <td style={{ textAlign: 'right', color: INK_SOFT }}>{r.from === null ? '—' : `${fmt(r.from)} ${r.unit}`}</td>
                        <td style={{ textAlign: 'right', color: MARINE, fontWeight: 600 }}>{fmt(r.to)} {r.unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: delta === null || delta === 0 ? INK_SOFT : improved ? '#2f7d32' : '#c0392b' }}>
                          {delta === null ? '—' : `${arrow} ${delta > 0 ? '+' : ''}${fmt(delta)} ${r.unit} (${pct > 0 ? '+' : ''}${pct} %)`}
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
      <div className="break-inside-avoid">
        <ColorLegend />
      </div>
      </div>
    </ReportFlowSection>
  )
}

/** Frise horizontale : 1 point par bilan, espacement régulier. */
function JourneyTimeline({ chrono, syntheses }: { chrono: Bilan[]; syntheses: BilanComputed[] }) {
  const W = 1000
  const H = 150
  const padX = 40
  const y = 78
  const n = chrono.length
  const pts = chrono.map((b, i) => ({
    x: n <= 1 ? W / 2 : padX + (i / (n - 1)) * (W - 2 * padX),
    date: b.date,
    score: syntheses[i]?.overall.score ?? null
  }))
  const labelStep = n > 8 ? 2 : 1
  const showLabel = (i: number) => i === 0 || i === n - 1 || i % labelStep === 0

  return (
    <div>
      <BlockTitle>Vos {chrono.length} bilans</BlockTitle>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '32mm' }}>
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
                <text x={p.x} y={y + 32} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} style={{ fontSize: '17px', fill: INK_SOFT }}>
                  {formatBilanMonth(p.date)}
                </text>
              )}
              {isLast && p.score !== null && (
                <>
                  <circle cx={p.x} cy={y - 40} r={20} fill={GOLD} />
                  <text x={p.x} y={y - 40} textAnchor="middle" dominantBaseline="middle" className="report-display" style={{ fontSize: '21px', fontWeight: 700, fill: '#fff' }}>
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

/** Libellés courts pour le détail des sous-scores (cartes de la vue d'ensemble). */
const SHORT_LABEL: Partial<Record<keyof BilanData, string>> = {
  imc: 'IMC',
  tour_taille_cm: 'Tour de taille',
  vo2max: 'VO2max',
  pushups: 'Pompes',
  situps: 'Redressements',
  saut_vertical_cm: 'Saut vertical',
  puissance_jambes_watts: 'Puissance des jambes',
  flexion_tronc_cm: 'Flexion du tronc',
  endurance_dos_sec: 'Endurance du dos'
}

/** Détail des sous-tests d'un score composite (le « pourquoi » du chiffre) :
 *  chaque test avec sa cote colorée. Rendu sous la carte du score. */
function CompositeBreakdown({ keys, latest, profile }: { keys: (keyof BilanData)[]; latest: Bilan; profile: BilanProfile }) {
  const rows = keys
    .map(k => {
      const v = num(latest.data[k])
      if (v === null) return null
      const cat = metricNorm(k, v, profile)?.category
      return cat ? { key: k, label: SHORT_LABEL[k] ?? METRIC_BY_KEY[k]?.label ?? String(k), cat } : null
    })
    .filter((r): r is { key: keyof BilanData; label: string; cat: Category } => r !== null)
  if (rows.length === 0) return null
  return (
    <div style={{ marginTop: '3mm', paddingTop: '2.5mm', borderTop: `1px solid ${GRID}` }}>
      {rows.map(r => (
        <div key={r.key as string} style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', fontSize: '8pt', marginBottom: '1mm' }}>
          <span style={{ width: '2mm', height: '2mm', borderRadius: '50%', background: CAT_BG[r.cat], display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: INK_SOFT }}>{r.label}</span>
          <span style={{ marginLeft: 'auto', color: MARINE, fontWeight: 600 }}>{CATEGORY_LABELS[r.cat]}</span>
        </div>
      ))}
    </div>
  )
}

/** Barre 5 segments pour un score composite 0-5. */
function ScoreBar({ score }: { score: number | null }) {
  const segs: Category[] = ['A_AMELIORER', 'ACCEPTABLE', 'BIEN', 'TRES_BIEN', 'EXCELLENT']
  const pos = score === null ? null : Math.max(0, Math.min(100, (score / 5) * 100))
  return (
    <div style={{ position: 'relative', paddingTop: pos !== null ? '5mm' : 0 }}>
      {pos !== null && (
        <div style={{ position: 'absolute', top: 0, left: `${pos}%`, transform: 'translateX(-50%)', fontSize: '9pt', color: MARINE }}>▼</div>
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
    <span style={{ background: CAT_BG[category], color: CAT_FG[category], fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '1mm 2.5mm', borderRadius: '2mm', whiteSpace: 'nowrap' }}>
      {label ?? CATEGORY_LABELS[category]}
    </span>
  )
}

/** Légende du code couleur des barèmes (5 zones À améliorer → Excellent). */
function ColorLegend() {
  const cats: Category[] = ['A_AMELIORER', 'ACCEPTABLE', 'BIEN', 'TRES_BIEN', 'EXCELLENT']
  return (
    <div style={{ paddingTop: '5mm', borderTop: `1px solid ${GRID}` }}>
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

// ── Sections par domaine ─────────────────────────────────────────────────────
type ChartConfig =
  | { kind: 'line'; key: keyof BilanData; title: string; color: string; scoreAxis?: boolean }
  | { kind: 'dual'; a: keyof BilanData; b: keyof BilanData; title: string; nameA: string; nameB: string; dualAxis?: boolean }

interface DomainProps {
  latest: Bilan
  bilans: Bilan[]
  chrono: Bilan[]
  syntheses: BilanComputed[]
  profile: BilanProfile
  weightUnit: 'kg' | 'lb'
}

/** Corps commun d'une section domaine : intro, extras, résultats, graphiques, interprétation. */
function DomainSection({
  title,
  sectionNumber,
  intro,
  detailKeys,
  charts,
  composite,
  heroKey,
  domainWord,
  topExtra,
  bottomExtra,
  latest,
  bilans,
  chrono,
  profile,
  weightUnit
}: DomainProps & {
  title: string
  sectionNumber: string
  intro: string
  detailKeys: (keyof BilanData)[]
  charts: ChartConfig[]
  composite: CompositeScore
  heroKey: keyof BilanData
  domainWord: string
  topExtra?: React.ReactNode
  bottomExtra?: React.ReactNode
}) {
  const recent = bilans.slice(0, 4)
  const presentDetails = detailKeys.map(k => METRIC_BY_KEY[k]).filter((m): m is MetricDef => !!m && num(latest.data[m.key]) !== null)

  // Graphiques : on ne garde que ceux qui ont ≥ 2 points de données. Le graphique
  // de poids est converti dans l'unité du client (kg stocké → lb affiché).
  const chartData = charts
    .map(c => {
      if (c.kind === 'line') {
        const toLb = c.key === 'poids_kg' && weightUnit === 'lb'
        const data = chrono.map(b => {
          const v = num(b.data[c.key])
          return { label: formatBilanMonth(b.date), value: toLb && v !== null ? Math.round(kgToLb(v)) : v }
        })
        const count = data.filter(p => p.value !== null).length
        return count >= 2 ? { cfg: c, data, title: toLb ? 'Poids (lb)' : c.title } : null
      }
      const data = chrono.map(b => ({ label: formatBilanMonth(b.date), a: num(b.data[c.a]), b: num(b.data[c.b]) }))
      const count = data.filter(p => p.a !== null || p.b !== null).length
      return count >= 2 ? { cfg: c, data, title: c.title } : null
    })
    .filter(Boolean) as ({ cfg: Extract<ChartConfig, { kind: 'line' }>; data: ChartPoint[]; title: string } | { cfg: Extract<ChartConfig, { kind: 'dual' }>; data: { label: string; a: number | null; b: number | null }[]; title: string })[]

  const interp = domainInterpretation({ domainWord, composite, detailKeys, heroKey, chrono, latest, profile })

  return (
    <ReportFlowSection title={title} sectionNumber={sectionNumber} intro={intro}>
      {topExtra}

      {presentDetails.length > 0 && (
        <div style={{ marginBottom: '8mm', display: 'flex', flexDirection: 'column', gap: '5mm' }}>
          <BlockTitle>Vos résultats</BlockTitle>
          {presentDetails.map(m => (
            <MetricBlock key={m.key} metric={m} latest={latest} recent={recent} profile={profile} />
          ))}
        </div>
      )}

      <NormReferenceTable metrics={presentDetails} latest={latest} profile={profile} />

      {bottomExtra}

      {chartData.length > 0 && (
        <div style={{ marginTop: '2mm' }}>
          <BlockTitle>Évolution dans le temps</BlockTitle>
          {chartData.map((c, i) => (
            <BigChartCard key={i} title={c.title}>
              {c.cfg.kind === 'line' ? (
                <SingleLineChart data={c.data as ChartPoint[]} color={c.cfg.color} scoreAxis={c.cfg.scoreAxis} />
              ) : (
                <DualLineChart data={c.data as { label: string; a: number | null; b: number | null }[]} nameA={c.cfg.nameA} nameB={c.cfg.nameB} dualAxis={c.cfg.dualAxis} />
              )}
            </BigChartCard>
          ))}
        </div>
      )}

      {interp && (
        <div className="break-inside-avoid" style={{ background: CREAM, borderRadius: '4mm', padding: '7mm 9mm', marginTop: '12mm' }}>
          <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD, fontWeight: 700, marginBottom: '3mm' }}>
            Ce que ça veut dire pour vous
          </p>
          <p style={{ fontSize: '11pt', lineHeight: 1.6, color: '#3a3f52' }}>{interp}</p>
        </div>
      )}
    </ReportFlowSection>
  )
}

/** Texte d'interprétation par domaine — généré selon la catégorie composite,
 *  le point fort / à travailler et la tendance de la métrique phare. */
function domainInterpretation({
  domainWord,
  composite,
  detailKeys,
  heroKey,
  chrono,
  latest,
  profile
}: {
  domainWord: string
  composite: CompositeScore
  detailKeys: (keyof BilanData)[]
  heroKey: keyof BilanData
  chrono: Bilan[]
  latest: Bilan
  profile: BilanProfile
}): React.ReactNode {
  const parts: string[] = []

  if (composite.category) {
    parts.push(`Votre ${domainWord} est globalement ${CATEGORY_LABELS[composite.category].toLowerCase()}.`)
  }

  // Point fort / à travailler parmi les métriques du domaine.
  const rated = detailKeys
    .map(k => {
      const v = num(latest.data[k])
      if (v === null) return null
      const cat = metricNorm(k, v, profile)?.category
      const label = METRIC_BY_KEY[k]?.label
      return cat && label ? { label, cat } : null
    })
    .filter((x): x is { label: string; cat: Category } => x !== null)
  if (rated.length > 0) {
    const strong = [...rated].sort((a, b) => SCORE_OF[b.cat] - SCORE_OF[a.cat])[0]
    const weak = [...rated].sort((a, b) => SCORE_OF[a.cat] - SCORE_OF[b.cat])[0]
    if (SCORE_OF[strong.cat] >= 4) parts.push(`Votre point fort : ${strong.label.toLowerCase()} (${CATEGORY_LABELS[strong.cat].toLowerCase()}).`)
    if (weak.label !== strong.label && SCORE_OF[weak.cat] <= 2) {
      parts.push(`Le principal levier de progression : ${weak.label.toLowerCase()}.`)
    }
  }

  // Tendance de la métrique phare (premier → dernier bilan renseigné).
  const series = chrono.map(b => num(b.data[heroKey])).filter((v): v is number => v !== null)
  if (series.length >= 2) {
    const from = series[0]
    const to = series[series.length - 1]
    if (from !== to) {
      const lower = metricNorm(heroKey, to, profile)?.lowerIsBetter ?? false
      const improved = lower ? to < from : to > from
      const heroLabel = METRIC_BY_KEY[heroKey]?.label.toLowerCase() ?? 'votre indicateur clé'
      parts.push(
        improved
          ? `Bonne nouvelle : votre ${heroLabel} a progressé de ${fmt(from)} à ${fmt(to)} — continuez sur cette lancée.`
          : `Surveillez votre ${heroLabel}, passé de ${fmt(from)} à ${fmt(to)} sur la période.`
      )
    }
  }

  return parts.length > 0 ? parts.join(' ') : null
}

/** Grille de risque du % de gras (grille de Marie, palier « moins de 70 ans ») —
 *  version PDF, styles inline. Même logique partagée que le document client et le
 *  Dashboard (`bodyFatRisk`). */
function PdfBodyFatZones({ pct, sex }: { pct: number | null; sex: 'F' | 'M' | null }) {
  const s = bodyFatRisk(pct, sex)
  if (!s || s.current === null || s.markerRatio === null || pct === null) return null
  const { zones, scaleMax, current, markerRatio } = s
  const markerPct = markerRatio * 100
  const labelLeft = Math.max(6, Math.min(94, markerPct))
  const bounds = zones.slice(1).map(z => z.min)
  const widthOf = (z: (typeof zones)[number]) => (((z.max ?? scaleMax) - z.min) / scaleMax) * 100
  return (
    <div className="break-inside-avoid" style={{ marginTop: '6mm' }}>
      <p style={{ fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.08em', color: INK_SOFT, marginBottom: '2.5mm' }}>
        Zone de % de gras — vous êtes dans «&nbsp;<span style={{ color: BF_RISK_HEX[current.key], fontWeight: 700 }}>{current.label}</span>&nbsp;»
      </p>
      {/* Noms des zones au-dessus de la barre. */}
      <div style={{ display: 'flex', marginBottom: '1mm' }}>
        {zones.map(z => (
          <span key={z.key} style={{ width: `${widthOf(z)}%`, textAlign: 'center', fontSize: '6pt', textTransform: 'uppercase', letterSpacing: '0.02em', color: AXIS, lineHeight: 1.15, padding: '0 0.3mm' }}>
            {z.label}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', height: '4mm' }}>
        <span style={{ position: 'absolute', left: `${labelLeft}%`, transform: 'translateX(-50%)', fontSize: '8pt', fontWeight: 700, color: MARINE }}>
          {fmt(pct)}&nbsp;%
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', height: '3mm', borderRadius: '1.5mm', overflow: 'hidden' }}>
          {zones.map(z => (
            <div key={z.key} style={{ width: `${widthOf(z)}%`, background: BF_RISK_HEX[z.key] }} />
          ))}
        </div>
        <div style={{ position: 'absolute', top: 0, height: '3mm', left: `${markerPct}%`, width: '0.7mm', transform: 'translateX(-50%)', background: MARINE, boxShadow: '0 0 0 0.4mm #fff' }} />
      </div>
      <div style={{ position: 'relative', height: '4mm', marginTop: '1mm' }}>
        {bounds.map(b => (
          <span key={b} style={{ position: 'absolute', left: `${(b / scaleMax) * 100}%`, transform: 'translateX(-50%)', fontSize: '7pt', color: AXIS }}>
            {b.toLocaleString('fr-CA', { maximumFractionDigits: 1 })}
          </span>
        ))}
      </div>
      <p style={{ fontSize: '7.5pt', color: AXIS, marginTop: '0.5mm' }}>
        Grille de référence du % de gras — palier « moins de 70 ans ». Vert = zones favorables.
      </p>
    </div>
  )
}

// Composition — extras (chiffres clés + plis cutanés).
function CompositionExtras({ latest, computed, weightUnit, sex }: { latest: Bilan; computed: BilanComputed; weightUnit: 'kg' | 'lb'; sex: 'F' | 'M' | null }) {
  const d = latest.data as Record<string, unknown>
  const plis = [
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

  const stats: { label: string; value: string; hint?: string }[] = [
    { label: 'IMC', value: computed.imc === null ? '—' : `${fmt(computed.imc)} kg/m²` },
    { label: 'Tour de taille', value: num(d.tour_taille_cm) === null ? '—' : `${fmt(num(d.tour_taille_cm))} cm` },
    { label: 'Ratio taille / hanche', value: computed.ratioTailleHanche === null ? '—' : fmt(computed.ratioTailleHanche, 2) },
    { label: 'Poids optimal max', value: dualWeight(computed.poidsOptimalMaxKg, weightUnit), hint: 'Poids pour un IMC de 25' },
    { label: '% de gras', value: computed.pourcentageGrasDurnin === null ? '—' : `${fmt(computed.pourcentageGrasDurnin)} %`, hint: 'Méthode Durnin-Womersley (4 plis)' },
    { label: 'Somme des 4 plis', value: sommePlis === null ? '—' : `${fmt(sommePlis)} mm` }
  ]

  return (
    <div style={{ marginBottom: '8mm' }}>
      <BlockTitle>Vos mesures</BlockTitle>
      <div className="break-inside-avoid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5mm', marginBottom: plisPresents.length ? '6mm' : 0 }}>
        {stats.map(s => (
          <div key={s.label} style={{ border: `1px solid ${GRID}`, borderRadius: '3mm', padding: '5mm 6mm' }}>
            <p style={{ fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_SOFT }}>{s.label}</p>
            <p className="report-display" style={{ fontSize: '20pt', fontWeight: 700, color: MARINE, marginTop: '1mm' }}>{s.value}</p>
            {s.hint && <p style={{ fontSize: '8pt', color: AXIS, marginTop: '0.5mm' }}>{s.hint}</p>}
          </div>
        ))}
      </div>

      <PdfBodyFatZones
        pct={computed.pourcentageGrasDurnin ?? num(d.pourcentage_gras)}
        sex={sex}
      />
      {plisPresents.length > 0 && (
        <div className="break-inside-avoid">
          <p style={{ fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.08em', color: INK_SOFT, marginBottom: '2.5mm', breakAfter: 'avoid' }}>Plis cutanés (mm)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4mm' }}>
            {plisPresents.map(p => (
              <div key={p.key} style={{ background: CREAM, borderRadius: '2mm', padding: '3mm 5mm', minWidth: '30mm' }}>
                <span style={{ fontSize: '9pt', color: INK_SOFT }}>{p.label} </span>
                <span style={{ fontSize: '11pt', fontWeight: 600, color: MARINE }}>{fmt(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Cardio — extras (tension nommée + zones cardiaques + récupération).
function CardioExtras({ latest, computed }: { latest: Bilan; computed: BilanComputed }) {
  const d = latest.data as Record<string, unknown>
  const sys = num(d.pa_systolique)
  const dia = num(d.pa_diastolique)
  const bpRows = [
    { label: 'Systolique', value: sys, cls: sys !== null ? classifyBloodPressure(sys, 'systolic') : null },
    { label: 'Diastolique', value: dia, cls: dia !== null ? classifyBloodPressure(dia, 'diastolic') : null }
  ].filter(r => r.value !== null)

  const z = computed.fcZones
  const zoneRows = z
    ? [
        { pct: '60 %', bpm: z.z60, libelle: 'Échauffement' },
        { pct: '65 %', bpm: z.z65, libelle: 'Endurance de base' },
        { pct: '70 %', bpm: z.z70, libelle: 'Endurance' },
        { pct: '75 %', bpm: z.z75, libelle: 'Aérobie' },
        { pct: '80 %', bpm: z.z80, libelle: 'Seuil' },
        { pct: '85 %', bpm: z.z85, libelle: 'Anaérobie' },
        { pct: '90 %', bpm: z.z90, libelle: 'VO2max' }
      ]
    : []

  return (
    <>
      {bpRows.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '8mm' }}>
          <BlockTitle>Tension artérielle au repos</BlockTitle>
          <p style={{ fontSize: '9.5pt', color: INK_SOFT, marginBottom: '3mm' }}>
            Classée selon les seuils cliniques : Optimale · Normale · Pré-hypertension · Hypertension 1 · Hypertension 2 (OMS / JNC).
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
            <tbody>
              {bpRows.map(r => (
                <tr key={r.label} style={{ borderBottom: `1px solid ${GRID}` }}>
                  <td style={{ padding: '3mm', color: INK_SOFT }}>{r.label}</td>
                  <td style={{ padding: '3mm', color: MARINE, fontWeight: 700 }}>{fmt(r.value, 0)} mmHg</td>
                  <td style={{ padding: '3mm', textAlign: 'right' }}>{r.cls && <CategoryPill category={r.cls.category} label={r.cls.zone} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {zoneRows.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '8mm' }}>
          <BlockTitle>Zones d'entraînement cardiaque</BlockTitle>
          <p style={{ fontSize: '9.5pt', color: INK_SOFT, marginBottom: '3mm' }}>
            Fréquences cibles selon votre FC maximale prédite
            {computed.fcMaxPredite !== null ? ` (${computed.fcMaxPredite} bpm, formule de Tanaka)` : ''}. Pour développer l'endurance, visez 60-75 % ; au-delà de 80 %, l'effort devient intense.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '9mm' }}>
            {zoneRows.map(zr => (
              <div key={zr.pct} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2mm 0', borderBottom: `1px solid ${GRID}`, fontSize: '10.5pt' }}>
                <span>
                  <strong style={{ color: MARINE }}>{zr.pct}</strong> <span style={{ color: INK_SOFT, fontSize: '9.5pt' }}>{zr.libelle}</span>
                </span>
                <span style={{ color: MARINE, fontWeight: 600 }}>{zr.bpm} bpm</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RecoveryTable latest={latest} />
    </>
  )
}

function RecoveryTable({ latest }: { latest: Bilan }) {
  const data = latest.data as Record<string, unknown>
  if (!hasRecoveryData(data)) return null
  const intervals = [
    { label: '1 min', sys: 'recup_1min_pa_sys', dia: 'recup_1min_pa_dia', fc: 'recup_1min_fc' },
    { label: '3 min', sys: 'recup_3min_pa_sys', dia: 'recup_3min_pa_dia', fc: 'recup_3min_fc' },
    { label: '5 min', sys: 'recup_5min_pa_sys', dia: 'recup_5min_pa_dia', fc: 'recup_5min_fc' }
  ]
  const th: React.CSSProperties = { textAlign: 'right', padding: '2.5mm 3mm', fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.04em', color: INK_SOFT }
  const td: React.CSSProperties = { textAlign: 'right', padding: '3mm', color: MARINE, fontWeight: 600 }
  return (
    <div className="break-inside-avoid" style={{ marginBottom: '8mm' }}>
      <BlockTitle>Récupération post-effort</BlockTitle>
      <p style={{ fontSize: '9.5pt', color: INK_SOFT, marginBottom: '3mm' }}>
        Le retour de la fréquence cardiaque et de la pression artérielle vers les valeurs de repos après l'effort est un indicateur de la santé cardiovasculaire.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
        <thead>
          <tr style={{ borderBottom: `1.5px solid ${GRID}` }}>
            <th style={{ ...th, textAlign: 'left' }}>Après l'effort</th>
            <th style={th}>FC (bpm)</th>
            <th style={th}>PA systolique</th>
            <th style={th}>PA diastolique</th>
          </tr>
        </thead>
        <tbody>
          {intervals.map(iv => (
            <tr key={iv.label} style={{ borderBottom: `1px solid ${GRID}` }}>
              <td style={{ padding: '3mm', color: MARINE, fontWeight: 600 }}>{iv.label}</td>
              <td style={td}>{fmt(num(data[iv.fc]), 0)}</td>
              <td style={td}>{fmt(num(data[iv.sys]), 0)}</td>
              <td style={td}>{fmt(num(data[iv.dia]), 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompositionSection({ computed, ...props }: DomainProps & { computed: BilanComputed }) {
  return (
    <DomainSection
      {...props}
      title="Votre composition corporelle"
      sectionNumber="Section 2"
      domainWord="composition corporelle"
      intro="La composition corporelle décrit la répartition entre la masse grasse et la masse maigre de votre corps. Un excès de gras, surtout à la taille, augmente le risque de maladies cardiovasculaires et de diabète. On l'évalue par l'IMC, le tour de taille et le pourcentage de gras estimé à partir des plis cutanés."
      detailKeys={['imc', 'tour_taille_cm', 'pourcentage_gras']}
      heroKey="pourcentage_gras"
      composite={computeBilan(props.latest.data, props.profile).composition}
      charts={[
        { kind: 'line', key: 'pourcentage_gras', title: '% de gras corporel', color: MARINE },
        { kind: 'line', key: 'poids_kg', title: 'Poids (kg)', color: GOLD },
        { kind: 'line', key: 'imc', title: 'IMC (kg/m²)', color: MARINE },
        { kind: 'line', key: 'tour_taille_cm', title: 'Tour de taille (cm)', color: GOLD }
      ]}
      topExtra={<CompositionExtras latest={props.latest} computed={computed} weightUnit={props.weightUnit} sex={props.profile.sex} />}
    />
  )
}

function CardioSection({ computed, ...props }: DomainProps & { computed: BilanComputed }) {
  return (
    <DomainSection
      {...props}
      title="Votre cœur et votre endurance"
      sectionNumber="Section 3"
      domainWord="capacité cardiovasculaire"
      intro="Votre capacité cardiovasculaire reflète l'efficacité de votre cœur, de vos poumons et de vos muscles à utiliser l'oxygène pendant l'effort. C'est l'un des meilleurs prédicteurs de santé et de longévité. On la mesure par le VO2max, complété par votre tension et votre fréquence cardiaque au repos."
      detailKeys={['vo2max', 'fc_repos', 'pa_systolique', 'pa_diastolique']}
      heroKey="vo2max"
      composite={computeBilan(props.latest.data, props.profile).aerobic}
      charts={[
        { kind: 'line', key: 'vo2max', title: 'VO2max (ml/kg/min)', color: GOLD },
        { kind: 'line', key: 'fc_repos', title: 'Fréquence cardiaque au repos (bpm)', color: MARINE }
      ]}
      bottomExtra={<CardioExtras latest={props.latest} computed={computed} />}
    />
  )
}

function ForceSection(props: DomainProps) {
  return (
    <DomainSection
      {...props}
      title="Votre force musculaire"
      sectionNumber="Section 4"
      domainWord="force musculaire"
      intro="La force et l'endurance musculaires vous permettent de bouger, de porter et de rester autonome avec l'âge. On les évalue par des tests d'extension des bras, de redressements assis, de saut vertical et de puissance des jambes."
      detailKeys={['pushups', 'situps', 'saut_vertical_cm', 'puissance_jambes_watts']}
      heroKey="pushups"
      composite={computeBilan(props.latest.data, props.profile).musculoGlobal}
      charts={[
        { kind: 'dual', a: 'pushups', b: 'situps', title: 'Pompes & redressements (reps)', nameA: 'Pompes', nameB: 'Redressements' },
        { kind: 'dual', a: 'saut_vertical_cm', b: 'puissance_jambes_watts', title: 'Saut vertical & puissance', nameA: 'Saut (cm)', nameB: 'Puissance (W)', dualAxis: true }
      ]}
    />
  )
}

function DosSection(props: DomainProps) {
  return (
    <DomainSection
      {...props}
      title="Votre dos et votre souplesse"
      sectionNumber="Section 5"
      domainWord="santé du dos"
      intro="Un dos endurant et souple protège contre les douleurs lombaires, l'une des causes les plus fréquentes d'arrêt de travail. On mesure la souplesse par la flexion du tronc et l'endurance des muscles qui soutiennent la colonne."
      detailKeys={['flexion_tronc_cm', 'endurance_dos_sec']}
      heroKey="endurance_dos_sec"
      composite={computeBilan(props.latest.data, props.profile).backHealth}
      charts={[
        { kind: 'line', key: 'endurance_dos_sec', title: 'Endurance du dos (secondes)', color: GOLD },
        { kind: 'line', key: 'flexion_tronc_cm', title: 'Flexion du tronc (cm)', color: MARINE }
      ]}
    />
  )
}

// ── Graphiques ───────────────────────────────────────────────────────────────
interface ChartPoint {
  label: string
  value: number | null
}

/** Carte de graphique pleine largeur (grand format). */
function BigChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="break-inside-avoid" style={{ background: CREAM, borderRadius: '3mm', padding: '5mm 6mm 4mm', marginBottom: '10mm' }}>
      <p style={{ fontSize: '11pt', fontWeight: 600, color: MARINE, marginBottom: '3mm' }}>{title}</p>
      <div style={{ width: '100%', height: '72mm' }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Étiquette de valeur affichée uniquement sur le dernier point. */
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
    <text x={x} y={(y ?? 0) + dy} textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: MARINE }}>
      {fmt(v)}
    </text>
  )
}

function SingleLineChart({ data, color, scoreAxis = false }: { data: ChartPoint[]; color: string; scoreAxis?: boolean }) {
  return (
    <LineChart data={data} margin={{ top: 18, right: 34, bottom: 4, left: -6 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={34} tickMargin={6} tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} />
      <YAxis tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} width={42} domain={scoreAxis ? [0, 5] : ['auto', 'auto']} ticks={scoreAxis ? [0, 1, 2, 3, 4, 5] : undefined} />
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3.5, fill: color }} isAnimationActive={false} connectNulls>
        <LabelList content={<EndpointValueLabel lastIdx={data.length - 1} />} />
      </Line>
    </LineChart>
  )
}

function DualLineChart({
  data,
  nameA,
  nameB,
  dualAxis = false
}: {
  data: { label: string; a: number | null; b: number | null }[]
  nameA: string
  nameB: string
  dualAxis?: boolean
}) {
  // `dualAxis` : deux séries d'unités/échelles très différentes (ex. saut en cm
  // vs puissance en W) → un axe Y par série, sinon la petite série est écrasée à
  // plat sur le zéro. Axes colorés pour associer chaque courbe à son échelle.
  if (dualAxis) {
    return (
      <LineChart data={data} margin={{ top: 8, right: 6, bottom: 4, left: -6 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={34} tickMargin={6} tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} />
        <YAxis yAxisId="left" tick={{ fill: GOLD, fontSize: 11 }} stroke={GRID} width={42} domain={['auto', 'auto']} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: MARINE, fontSize: 11 }} stroke={GRID} width={48} domain={['auto', 'auto']} />
        <Legend wrapperStyle={{ fontSize: 10.5 }} />
        <Line yAxisId="left" type="monotone" dataKey="a" name={nameA} stroke={GOLD} strokeWidth={2.5} dot={{ r: 3, fill: GOLD }} isAnimationActive={false} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="b" name={nameB} stroke={MARINE} strokeWidth={2.5} dot={{ r: 3, fill: MARINE }} isAnimationActive={false} connectNulls />
      </LineChart>
    )
  }
  return (
    <LineChart data={data} margin={{ top: 8, right: 34, bottom: 4, left: -6 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={34} tickMargin={6} tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} />
      <YAxis tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} width={42} domain={['auto', 'auto']} />
      <Legend wrapperStyle={{ fontSize: 10.5 }} />
      <Line type="monotone" dataKey="a" name={nameA} stroke={GOLD} strokeWidth={2.5} dot={{ r: 3, fill: GOLD }} isAnimationActive={false} connectNulls />
      <Line type="monotone" dataKey="b" name={nameB} stroke={MARINE} strokeWidth={2.5} dot={{ r: 3, fill: MARINE }} isAnimationActive={false} connectNulls />
    </LineChart>
  )
}

// ── Bloc de détail par métrique (valeur + barème + objectif) ──────────────────
function MetricBlock({ metric, latest, recent, profile }: { metric: MetricDef; latest: Bilan; recent: Bilan[]; profile: BilanProfile }) {
  const value = num(latest.data[metric.key])
  if (value === null) return null
  const norm = metricNorm(metric.key, value, profile)
  const protocol = metric.key === 'vo2max' ? aerobicProtocolLabel(latest.data as Record<string, unknown>, formatMmSs) : null
  const spark = recent.slice().reverse().map(b => num(b.data[metric.key])).filter((v): v is number => v !== null)
  const blurb = norm?.category ? EXPLANATION_BY_CATEGORY[norm.category] : null

  return (
    <div className="break-inside-avoid" style={{ border: `1px solid ${GRID}`, borderRadius: '3mm', padding: '5mm 6mm' }}>
      <div className="flex items-center justify-between">
        <h2 className="report-display" style={{ fontSize: '15pt', fontWeight: 600, color: MARINE }}>{metric.label}</h2>
        {norm?.category && <CategoryPill category={norm.category} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8mm', marginTop: '2mm' }}>
        <div style={{ flexShrink: 0 }}>
          <span className="report-display" style={{ fontSize: '30pt', fontWeight: 700, color: MARINE }}>{fmt(value)}</span>
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
            <CategoryRangeBar value={value} percentiles={norm.percentiles} unit={metric.unit} lowerIsBetter={norm.lowerIsBetter} variant="compact" />
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
              {' '}({norm.next.delta >= 0 ? '+' : ''}{fmt(norm.next.delta)} {metric.unit})
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

/** Table de barème de référence ACSM : pour chaque test de la section, la plage
 *  numérique de chaque catégorie (À améliorer → Excellent) pour l'âge/sexe du
 *  client. La cellule de la catégorie actuelle du client est surlignée. */
function NormReferenceTable({ metrics, latest, profile }: { metrics: MetricDef[]; latest: Bilan; profile: BilanProfile }) {
  const cats: Category[] = ['A_AMELIORER', 'ACCEPTABLE', 'BIEN', 'TRES_BIEN', 'EXCELLENT']
  const rows = metrics
    .map(m => {
      const value = num(latest.data[m.key])
      const norm = value !== null ? metricNorm(m.key, value, profile) : null
      if (!norm?.percentiles) return null
      return { metric: m, percentiles: norm.percentiles, lowerIsBetter: norm.lowerIsBetter, current: norm.category }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  if (rows.length === 0) return null

  const age = profile.age
  const bracket = age !== null ? `${profile.sex === 'M' ? 'H' : 'F'} ${Math.floor(age / 10) * 10}-${Math.floor(age / 10) * 10 + 9} ans` : ''
  const th: React.CSSProperties = { padding: '2.5mm 2mm', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.03em', color: INK_SOFT, textAlign: 'right', fontWeight: 700 }

  return (
    <div className="break-inside-avoid" style={{ marginBottom: '8mm' }}>
      <BlockTitle>Barème de référence — ACSM{bracket ? ` · ${bracket}` : ''}</BlockTitle>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${GRID}` }}>
              <th style={{ ...th, textAlign: 'left' }}>Test</th>
              {cats.map(c => (
                <th key={c} style={th}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1mm' }}>
                    <span style={{ width: '2.5mm', height: '2.5mm', borderRadius: '0.5mm', background: CAT_BG[c], display: 'inline-block' }} />
                    {CATEGORY_LABELS[c]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.metric.key as string} style={{ borderBottom: `1px solid ${GRID}` }}>
                <td style={{ padding: '2.5mm 2mm', color: MARINE, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {r.metric.label} <span style={{ color: AXIS, fontWeight: 400 }}>({r.metric.unit})</span>
                </td>
                {cats.map(c => {
                  const isCurrent = r.current === c
                  return (
                    <td
                      key={c}
                      style={{
                        padding: '2.5mm 2mm',
                        textAlign: 'right',
                        color: MARINE,
                        fontWeight: isCurrent ? 700 : 400,
                        background: isCurrent ? tint(CAT_BG[c], 0.28) : 'transparent',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {categoryRange(r.percentiles, r.lowerIsBetter, c)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '8pt', color: AXIS, marginTop: '2mm' }}>
        Cellule surlignée = votre niveau actuel. Source : ACSM Guidelines, 11ᵉ édition.
      </p>
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

// ── Section 6 — Forces & plan d'action ───────────────────────────────────────
function ForcesEtPlanSection({ latest, profile, coachName, signature }: { latest: Bilan; profile: BilanProfile; coachName: string; signature: string }) {
  const ranked = METRICS.map(m => {
    const value = num(latest.data[m.key])
    if (value === null) return null
    const norm = metricNorm(m.key, value, profile)
    if (!norm?.category) return null
    return { metric: m, value, category: norm.category, percentile: norm.percentile, next: norm.next, lowerIsBetter: norm.lowerIsBetter }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  // Priorités auto retirées à la demande de Marie — on ne garde que les forces.
  const forces = ranked.filter(r => r.category === 'EXCELLENT' || r.category === 'TRES_BIEN').sort((a, b) => SCORE_OF[b.category] - SCORE_OF[a.category]).slice(0, 3)

  const notes = typeof latest.data.notes === 'string' ? latest.data.notes.trim() : ''
  const signOff = signature.trim() || `${coachName || 'Marie-Eve Bélanger'}\nKinésiologue`

  return (
    <ReportSection title="Vos forces" sectionNumber="Section 6">
      <div style={{ marginTop: '2mm', marginBottom: '9mm' }}>
        <p className="report-display" style={{ fontSize: '15pt', fontWeight: 600, color: MARINE, marginBottom: '4mm' }}>
          <Trophy size={16} style={{ display: 'inline', verticalAlign: '-2px', color: GOLD }} /> Vos forces
        </p>
        {forces.length === 0 ? (
          <p style={{ fontSize: '10pt', color: INK_SOFT }}>Continuez vos efforts — vos forces apparaîtront à mesure que vos résultats progressent.</p>
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


      <div style={{ marginTop: '12mm', background: CREAM, borderRadius: '4mm', padding: '8mm 10mm' }}>
        <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD, marginBottom: '3mm' }}>Le mot de votre kinésiologue</p>
        {notes !== '' && <p style={{ fontSize: '10.5pt', color: MARINE, lineHeight: 1.55, whiteSpace: 'pre-line', marginBottom: '5mm' }}>{notes}</p>}
        <p style={{ fontSize: '10.5pt', color: MARINE, lineHeight: 1.4, whiteSpace: 'pre-line', fontStyle: notes !== '' ? 'italic' : 'normal' }}>{signOff}</p>
      </div>

      {/* Cinq piliers de bien-être — clôture, identique au document interactif. */}
      <div className="break-inside-avoid" style={{ marginTop: '10mm', paddingTop: '6mm', borderTop: `1px solid ${GRID}` }}>
        <p style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD, marginBottom: '1.5mm' }}>L'équilibre au quotidien</p>
        <p className="report-display" style={{ fontSize: '14pt', fontWeight: 600, color: MARINE, marginBottom: '4mm' }}>Cinq principes essentiels</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4mm' }}>
          {PRINCIPES.map(p => (
            <div key={p.title} style={{ textAlign: 'center' }}>
              <p.icon size={18} color={GOLD} strokeWidth={1.6} style={{ marginBottom: '1.5mm' }} />
              <p style={{ fontSize: '9.5pt', fontWeight: 600, color: MARINE }}>{p.title}</p>
              <p style={{ fontSize: '8pt', color: INK_SOFT, marginTop: '0.5mm', lineHeight: 1.35 }}>{p.line}</p>
            </div>
          ))}
        </div>
      </div>

      <p style={{ marginTop: 'auto', paddingTop: '10mm', fontSize: '8pt', color: AXIS, textAlign: 'center' }}>
        Rapport généré par Kinésio Outils — {reportDateLabel()}
      </p>
    </ReportSection>
  )
}
