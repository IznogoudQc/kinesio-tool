import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  Calculator,
  ChevronDown,
  ChevronRight,
  ClipboardEdit,
  Plus,
  Ruler,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { useClient } from '../ClientDetailLayout'
import { bilansService } from '../../../services/bilans'
import { mesuresService } from '../../../services/mesures'
import { formatBilanDate, formatBilanMonth } from '../bilanFields'
import { MesureSelectorPills } from './MesureSelectorPills'
import {
  buildPreviousSynthesisCirc,
  buildSynthesisCirc,
  buildUnifiedDates,
  findCircAtOrBefore,
  findLatestPlis,
  findPlisAtOrBefore,
  findPreviousPlis
} from '../../../lib/synthesisMesures'
import {
  cmToLengthInput,
  kgToWeightInput,
  lengthUnitLabel,
  weightUnitLabel
} from '../../../lib/units'
import { MeasureDelta } from '../../../components/MeasureDelta'
import { WaistRiskBar } from '../../../components/WaistRiskBar'
import { MetricSelectable } from '../../../components/MetricSelectable'
import { getWaistRisk, getRatioRisk, WHO_RISK_LABELS } from '../../../lib/norms/who'

type PeriodFilter = 'all' | '30d' | '90d' | '6m' | '1y'

/** Toutes les métriques affichables dans le graphique d'évolution. Le groupe
 *  pilote l'affichage des pills en 3 sections. */
type MetricKey =
  | 'cou' | 'epaule' | 'bicepsG' | 'bicepsD' | 'poitrine'
  | 'taille' | 'abdomen' | 'hanche' | 'cuisseG' | 'cuisseD'
  | 'molletG' | 'molletD'
  | 'poidsKg' | 'ratioTH' | 'imc'
  | 'pourcentageGrasSiri' | 'sommePlis'
  | 'pliTriceps' | 'pliBiceps' | 'pliSousscap' | 'pliIliaque'

type MetricGroup = 'circ' | 'weights' | 'composition'

interface MetricDef {
  key: MetricKey
  label: string
  /** Unité affichée à l'utilisatrice (cm/in/kg/lb/mm/%/kg/m²/ratio). */
  unit: string
  /** Source temporelle : la timeline utilise les dates de ce dataset. */
  source: 'circ' | 'plis'
  group: MetricGroup
  /** Lit la valeur brute (DB units) dans une paire circ + plis du même axe temporel. */
  accessor: (circ: MesureCirconferences | null, plis: MesurePlisCutanes | null) => number | null
  /** Si défini, convertit la valeur brute en unité d'affichage. */
  convert?: (raw: number) => number
  lowerIsBetter: boolean
}

const METRIC_GROUP_LABEL: Record<MetricGroup, string> = {
  circ: 'Circonférences',
  weights: 'Poids & ratios',
  composition: 'Composition corporelle'
}

const METRIC_STORAGE_KEY = 'dashboard.mesures.selectedMetric'

function loadSelectedMetric(): MetricKey {
  if (typeof window === 'undefined') return 'taille'
  const v = window.localStorage.getItem(METRIC_STORAGE_KEY)
  return (v as MetricKey | null) ?? 'taille'
}

const PERIOD_LABEL: Record<PeriodFilter, string> = {
  '30d': '30 j',
  '90d': '90 j',
  '6m': '6 mois',
  '1y': '1 an',
  all: 'Tout'
}

const PERIOD_DAYS: Record<PeriodFilter, number | null> = {
  '30d': 30,
  '90d': 90,
  '6m': 183,
  '1y': 365,
  all: null
}

function num(v: number | null | undefined): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null
}

function avgGD(a: number | null, b: number | null): number | null {
  const vals = [a, b].filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null
}

/** Nombre de jours pleins entre aujourd'hui et une date ISO. Pour l'engagement. */
function daysSince(iso: string): number {
  const today = new Date()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return 0
  const d = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)))
  return Math.max(0, Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)))
}

function withinDays(iso: string, days: number): boolean {
  return daysSince(iso) <= days
}

export function MesuresOverview() {
  // Tous les hooks DOIVENT être appelés inconditionnellement, dans le même
  // ordre à chaque render. Les early returns sont placés *après* le dernier hook.
  const client = useClient() as Client | undefined
  const navigate = useNavigate()

  const [circList, setCircList] = useState<MesureCirconferences[] | null>(null)
  const [plisList, setPlisList] = useState<MesurePlisCutanes[] | null>(null)
  /** Hauteur corporelle du client (cm), tirée du bilan le plus récent qui en a une.
   *  Sert au calcul de l'IMC : circ stocke `poidsKg` mais pas la taille corporelle. */
  const [bodyHeightCm, setBodyHeightCm] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(loadSelectedMetric)
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [showDetails, setShowDetails] = useState(false)

  // La mesure affichée vit dans l'URL (`?mesure=synthesis|<date-ISO>`) — le
  // bookmark, le retour navigateur et la navigation inter-onglets marchent
  // gratuitement. Absence du paramètre = mode Synthèse (le défaut).
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedMesureKey = searchParams.get('mesure')
  const isSynthesisMode = selectedMesureKey === null || selectedMesureKey === 'synthesis'

  const setSelectedMesureKey = useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(searchParams)
      if (key) next.set('mesure', key)
      else next.delete('mesure')
      setSearchParams(next, { replace: false })
    },
    [searchParams, setSearchParams]
  )

  // Persistance du choix de métrique (par défaut, pas par client — Marie-Eve
  // bascule souvent sur la même donnée pour tous ses clients).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(METRIC_STORAGE_KEY, selectedMetric)
    }
  }, [selectedMetric])

  const clientId = client?.id
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      mesuresService.circonferences.list(clientId),
      mesuresService.plis.list(clientId),
      bilansService.list(clientId)
    ])
      .then(([circ, plis, bilans]) => {
        if (cancelled) return
        setCircList(circ)
        setPlisList(plis)
        // Cherche la hauteur la plus récente disponible dans les bilans (triés desc).
        const latestHeight = bilans.find(b => typeof b.data.taille_cm === 'number')?.data.taille_cm
        setBodyHeightCm(typeof latestHeight === 'number' ? latestHeight : null)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les mesures.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const unitLength = client?.unitLength ?? 'cm'
  const unitWeight = client?.unitWeight ?? 'kg'
  const lenLabel = lengthUnitLabel(unitLength)
  const wLabel = weightUnitLabel(unitWeight)

  // Liste unifiée des dates (union circ + plis) pour le sélecteur de pills.
  const unifiedDates = useMemo(
    () => buildUnifiedDates(circList ?? [], plisList ?? []),
    [circList, plisList]
  )

  // Synthèse virtuelle des circonférences (latest non-null champ par champ).
  const synthesisCirc = useMemo(
    () => (circList ? buildSynthesisCirc(circList) : null),
    [circList]
  )
  const previousSynthesisCirc = useMemo(
    () => (circList ? buildPreviousSynthesisCirc(circList) : null),
    [circList]
  )

  // Vue active : synthèse virtuelle, ou snapshot temporel strict d'une date.
  // En mode date, circ et plis sont cherchés indépendamment (≤ date cible) —
  // ils peuvent donc venir de jours différents (cf. ADR 0010).
  const activeView = useMemo(() => {
    if (!circList) return null
    if (isSynthesisMode) {
      return {
        circ: (synthesisCirc?.data ?? {}) as Partial<MesureCirconferences>,
        plis: findLatestPlis(plisList ?? []),
        previousCirc: (previousSynthesisCirc?.data ?? {}) as Partial<MesureCirconferences>,
        previousPlis: findPreviousPlis(plisList ?? []),
        circDate: synthesisCirc?.latestContributionDate ?? null,
        plisDate: plisList?.[0]?.date ?? null,
        mode: 'synthesis' as const
      }
    }
    // Mode date spécifique : snapshot temporel strict (option A de l'ADR 0010).
    const target = selectedMesureKey!
    const circ = findCircAtOrBefore(circList, target)
    const plis = findPlisAtOrBefore(plisList ?? [], target)
    // « Précédent » = la session immédiatement avant celle active dans la liste.
    const circIdxInList = circ ? circList.findIndex(c => c.id === circ.id) : -1
    const plisIdxInList = plis && plisList ? plisList.findIndex(p => p.id === plis.id) : -1
    return {
      circ: (circ ?? {}) as Partial<MesureCirconferences>,
      plis: plis ?? null,
      previousCirc: ((circIdxInList >= 0 ? circList[circIdxInList + 1] : null) ?? {}) as Partial<MesureCirconferences>,
      previousPlis: (plisIdxInList >= 0 && plisList ? plisList[plisIdxInList + 1] : null) ?? null,
      circDate: circ?.date ?? null,
      plisDate: plis?.date ?? null,
      mode: 'date' as const
    }
  }, [isSynthesisMode, selectedMesureKey, circList, plisList, synthesisCirc, previousSynthesisCirc])

  const METRICS_DEFS: MetricDef[] = useMemo(() => {
    const convertLen = (raw: number) => cmToLengthInput(raw, unitLength)
    const convertWeight = (raw: number) => kgToWeightInput(raw, unitWeight)
    const heightM = bodyHeightCm ? bodyHeightCm / 100 : null
    return [
      // ── Circonférences (12) ──────────────────────────────────────────────
      { key: 'cou', label: 'Cou', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.cou ?? null, convert: convertLen, lowerIsBetter: false },
      { key: 'epaule', label: 'Épaule', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.epaule ?? null, convert: convertLen, lowerIsBetter: false },
      { key: 'bicepsG', label: 'Biceps G', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.bicepsG ?? null, convert: convertLen, lowerIsBetter: false },
      { key: 'bicepsD', label: 'Biceps D', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.bicepsD ?? null, convert: convertLen, lowerIsBetter: false },
      { key: 'poitrine', label: 'Poitrine', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.poitrine ?? null, convert: convertLen, lowerIsBetter: false },
      { key: 'taille', label: 'Tour de taille', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.taille ?? null, convert: convertLen, lowerIsBetter: true },
      { key: 'abdomen', label: 'Abdomen', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.abdomen ?? null, convert: convertLen, lowerIsBetter: true },
      { key: 'hanche', label: 'Hanche', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.hanche ?? null, convert: convertLen, lowerIsBetter: true },
      { key: 'cuisseG', label: 'Cuisse G', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.cuisseG ?? null, convert: convertLen, lowerIsBetter: false },
      { key: 'cuisseD', label: 'Cuisse D', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.cuisseD ?? null, convert: convertLen, lowerIsBetter: false },
      { key: 'molletG', label: 'Mollet G', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.molletG ?? null, convert: convertLen, lowerIsBetter: false },
      { key: 'molletD', label: 'Mollet D', unit: lenLabel, source: 'circ', group: 'circ', accessor: c => c?.molletD ?? null, convert: convertLen, lowerIsBetter: false },
      // ── Poids & ratios (3) ───────────────────────────────────────────────
      { key: 'poidsKg', label: 'Poids', unit: wLabel, source: 'circ', group: 'weights', accessor: c => c?.poidsKg ?? null, convert: convertWeight, lowerIsBetter: true },
      {
        key: 'ratioTH',
        label: 'Ratio T/H',
        unit: '',
        source: 'circ',
        group: 'weights',
        accessor: c => {
          if (!c || typeof c.taille !== 'number' || typeof c.hanche !== 'number' || c.hanche <= 0) return null
          return Math.round((c.taille / c.hanche) * 100) / 100
        },
        lowerIsBetter: true
      },
      {
        key: 'imc',
        label: 'IMC',
        unit: 'kg/m²',
        source: 'circ',
        group: 'weights',
        accessor: c => {
          if (!c || typeof c.poidsKg !== 'number' || heightM === null || heightM <= 0) return null
          return Math.round((c.poidsKg / (heightM * heightM)) * 10) / 10
        },
        lowerIsBetter: true
      },
      // ── Composition corporelle (6) ───────────────────────────────────────
      { key: 'pourcentageGrasSiri', label: '% Gras Siri', unit: '%', source: 'plis', group: 'composition', accessor: (_, p) => p?.pourcentageGrasSiri ?? null, lowerIsBetter: true },
      { key: 'sommePlis', label: 'Somme 4 plis', unit: 'mm', source: 'plis', group: 'composition', accessor: (_, p) => p?.somme4Plis ?? null, lowerIsBetter: true },
      { key: 'pliTriceps', label: 'Triceps', unit: 'mm', source: 'plis', group: 'composition', accessor: (_, p) => p?.triceps ?? null, lowerIsBetter: true },
      { key: 'pliBiceps', label: 'Biceps (pli)', unit: 'mm', source: 'plis', group: 'composition', accessor: (_, p) => p?.biceps ?? null, lowerIsBetter: true },
      { key: 'pliSousscap', label: 'Sous-scap', unit: 'mm', source: 'plis', group: 'composition', accessor: (_, p) => p?.sousscapulaire ?? null, lowerIsBetter: true },
      { key: 'pliIliaque', label: 'Iliaque', unit: 'mm', source: 'plis', group: 'composition', accessor: (_, p) => p?.iliaque ?? null, lowerIsBetter: true }
    ]
  }, [lenLabel, wLabel, unitLength, unitWeight, bodyHeightCm])

  // Métrique courante — fallback sur 'taille' si la clé persistée n'existe plus.
  const activeMetric: MetricDef = useMemo(
    () => METRICS_DEFS.find(m => m.key === selectedMetric) ?? METRICS_DEFS[5],
    [METRICS_DEFS, selectedMetric]
  )

  /** Pour chaque métrique, est-elle disponible (au moins 1 valeur non-null) ? */
  const availableMetrics = useMemo<Set<MetricKey>>(() => {
    const set = new Set<MetricKey>()
    for (const def of METRICS_DEFS) {
      const rows = def.source === 'circ' ? circList ?? [] : plisList ?? []
      const has = rows.some(r =>
        def.source === 'circ'
          ? def.accessor(r as MesureCirconferences, null) !== null
          : def.accessor(null, r as MesurePlisCutanes) !== null
      )
      if (has) set.add(def.key)
    }
    return set
  }, [METRICS_DEFS, circList, plisList])

  // ── Données du graphique d'évolution (selon métrique + période) ──────────
  // Chaque point porte aussi `previousValue` + `previousDate` pour le tooltip
  // enrichi (delta vs précédent dans la fenêtre).
  const chartData = useMemo(() => {
    const days = PERIOD_DAYS[period]
    const rows = activeMetric.source === 'circ' ? circList ?? [] : plisList ?? []
    const filtered = days === null ? rows : rows.filter(r => withinDays(r.date, days))
    // Ordre chronologique pour le tracé.
    const chrono = [...filtered].reverse()
    const points = chrono.map(r => {
      const raw =
        activeMetric.source === 'circ'
          ? activeMetric.accessor(r as MesureCirconferences, null)
          : activeMetric.accessor(null, r as MesurePlisCutanes)
      const value = raw === null ? null : activeMetric.convert ? activeMetric.convert(raw) : raw
      return { label: formatBilanMonth(r.date), date: r.date, value }
    })
    // Précédent = point juste avant dans l'ordre chronologique, avec valeur.
    return points.map((p, i) => {
      let previousValue: number | null = null
      let previousDate: string | undefined
      for (let j = i - 1; j >= 0; j--) {
        if (points[j].value !== null) {
          previousValue = points[j].value
          previousDate = points[j].date
          break
        }
      }
      return { ...p, previousValue, previousDate }
    })
  }, [activeMetric, circList, plisList, period])

  // ── Données pour la mini-évolution du % gras (section Plis) ──────────────
  const plisChartData = useMemo(() => {
    if (!plisList) return []
    return [...plisList].reverse().map(p => ({
      label: formatBilanMonth(p.date),
      value: p.pourcentageGrasSiri
    }))
  }, [plisList])

  // ── Tendance 90 jours (pour la bannière d'engagement) ────────────────────
  // Sur la métrique active du graphique : compare la valeur la + ancienne dans
  // la fenêtre 90j à la + récente. Tient compte de `lowerIsBetter` pour qualifier
  // la tendance comme « amélioration » ou « régression ».
  const trend90 = useMemo<'up' | 'down' | 'flat' | null>(() => {
    const rows = activeMetric.source === 'circ' ? circList ?? [] : plisList ?? []
    const recent = rows.filter(r => withinDays(r.date, 90))
    if (recent.length < 2) return null
    const sortedAsc = [...recent].reverse()
    const first = sortedAsc[0]
    const last = sortedAsc[sortedAsc.length - 1]
    const a =
      activeMetric.source === 'circ'
        ? activeMetric.accessor(first as MesureCirconferences, null)
        : activeMetric.accessor(null, first as MesurePlisCutanes)
    const b =
      activeMetric.source === 'circ'
        ? activeMetric.accessor(last as MesureCirconferences, null)
        : activeMetric.accessor(null, last as MesurePlisCutanes)
    if (a === null || b === null) return null
    const delta = b - a
    if (Math.abs(delta) < 0.1) return 'flat'
    return delta < 0 ? 'down' : 'up'
  }, [activeMetric, circList, plisList])

  // ─── Tous les hooks ont été appelés — early returns autorisés à partir d'ici.

  if (!client) {
    return <div className="p-8 text-marine/60 text-base">Chargement du client…</div>
  }
  if (loading) {
    return <div className="p-8 text-marine/50 text-base">Chargement…</div>
  }
  if (error) {
    return <div className="p-8 text-red-600 text-base">{error}</div>
  }

  const hasAnyMeasure = (circList?.length ?? 0) > 0 || (plisList?.length ?? 0) > 0

  if (!hasAnyMeasure) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-cream-dark/30 rounded-xl shadow-sm">
          <Ruler size={48} className="text-marine/25 mb-4" />
          <h2 className="text-marine font-semibold text-xl">Aucune mesure enregistrée pour {client.name}</h2>
          <p className="text-marine/50 text-base mt-2 max-w-md">
            Saisissez une première prise de mesures (circonférences et/ou plis cutanés) pour suivre l'évolution.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/clients/${client.id}/mesures`)}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors shadow-sm"
          >
            <ClipboardEdit size={17} />
            Saisir une mesure
          </button>
        </div>
      </div>
    )
  }

  // ── Helpers locaux pour lire la vue active (synthèse ou snapshot date) ────
  const lastDate = activeView?.circDate ?? activeView?.plisDate ?? null
  const lastDays = lastDate ? daysSince(lastDate) : null
  const totalSessions = (circList?.length ?? 0) + (plisList?.length ?? 0)

  /** Pour un champ circ : valeur active (convertie dans l'unité d'affichage)
   *  et précédente. La « précédente » vient directement de `activeView` :
   *  en synthèse c'est la 2e valeur non-null du champ, en mode date c'est la
   *  session juste avant. */
  function circValue(
    getter: (r: Partial<MesureCirconferences>) => number | null,
    convert: (v: number) => number = (v) => v
  ): { value: number | null; previous: number | undefined; previousDate?: string } {
    if (!activeView) return { value: null, previous: undefined }
    const rawCurr = getter(activeView.circ)
    const rawPrev = getter(activeView.previousCirc)
    return {
      value: rawCurr === null ? null : convert(rawCurr),
      previous: rawPrev === null ? undefined : convert(rawPrev),
      previousDate: activeView.previousCirc.date
    }
  }

  const taille = circValue(r => num(r.taille), v => cmToLengthInput(v, unitLength))
  const hanche = circValue(r => num(r.hanche), v => cmToLengthInput(v, unitLength))
  const poids = circValue(r => num(r.poidsKg), v => kgToWeightInput(v, unitWeight))
  const activeTailleCm = num(activeView?.circ.taille)
  const previousCircDate = activeView?.previousCirc.date

  // Biceps moy et Cuisse moy : moyenne G/D sur la circ active et la précédente.
  const bicepsAvgActive = activeView ? avgGD(num(activeView.circ.bicepsG), num(activeView.circ.bicepsD)) : null
  const bicepsAvgPrev = activeView
    ? avgGD(num(activeView.previousCirc.bicepsG), num(activeView.previousCirc.bicepsD))
    : null
  const cuisseAvgActive = activeView ? avgGD(num(activeView.circ.cuisseG), num(activeView.circ.cuisseD)) : null
  const cuisseAvgPrev = activeView
    ? avgGD(num(activeView.previousCirc.cuisseG), num(activeView.previousCirc.cuisseD))
    : null

  // Ratio Taille / Hanche — en cm (indépendant de l'unité d'affichage).
  function ratioOf(r: Partial<MesureCirconferences> | null | undefined): number | null {
    if (!r) return null
    if (typeof r.taille !== 'number' || typeof r.hanche !== 'number' || r.hanche <= 0) return null
    return Math.round((r.taille / r.hanche) * 100) / 100
  }
  const ratioCurrent = ratioOf(activeView?.circ)
  const ratioPrev = ratioOf(activeView?.previousCirc)

  // ── Bannière d'engagement ────────────────────────────────────────────────
  // L'interprétation « amélioration / régression » suit le sens performance :
  // pour `lowerIsBetter` (taille, % gras, IMC), une baisse = amélioration.
  // Pour les métriques où monter est bon (biceps, mollet) — l'inverse.
  const trendLabel = (() => {
    if (trend90 === null) return null
    if (trend90 === 'flat') return '→ stable'
    const isImprovement = activeMetric.lowerIsBetter ? trend90 === 'down' : trend90 === 'up'
    const arrow = trend90 === 'down' ? '▼' : '▲'
    return `${arrow} ${isImprovement ? 'amélioration' : 'régression'}`
  })()
  const trendColor = (() => {
    if (trend90 === null || trend90 === 'flat') return 'text-marine/45'
    const isImprovement = activeMetric.lowerIsBetter ? trend90 === 'down' : trend90 === 'up'
    return isImprovement ? 'text-green-600' : 'text-red-500'
  })()

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-marine/45 text-xs uppercase tracking-wide font-medium">Dernière prise</p>
          <p className="text-marine text-lg font-semibold mt-0.5">
            {lastDate ? formatBilanDate(lastDate) : '—'}
          </p>
          <p className="text-marine/45 text-xs mt-1">
            {totalSessions} prise{totalSessions > 1 ? 's' : ''} depuis le début
            {lastDays !== null && (
              <span> · Dernière il y a {lastDays === 0 ? 'aujourd\'hui' : `${lastDays} jour${lastDays > 1 ? 's' : ''}`}</span>
            )}
            {trendLabel && (
              <span> · Tendance 90j : <span className={`${trendColor} font-semibold`}>{trendLabel}</span></span>
            )}
          </p>
          {activeView?.mode === 'synthesis' && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-gold-dark text-sm">
              <Sparkles size={13} />
              <span className="font-medium">Dernières valeurs disponibles</span>
              <span className="text-marine/55">
                · MAJ {activeView.circDate ? formatBilanDate(activeView.circDate) : '—'}
                {' '}· {totalSessions} mesures agrégées
              </span>
            </div>
          )}
          {activeView?.mode === 'date' &&
            activeView.circDate &&
            activeView.plisDate &&
            activeView.circDate !== activeView.plisDate && (
              <div className="mt-2 inline-flex items-center gap-3 text-marine/55 text-xs">
                <span>Circonférences du {formatBilanDate(activeView.circDate)}</span>
                <span>•</span>
                <span>Plis du {formatBilanDate(activeView.plisDate)}</span>
              </div>
            )}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/clients/${client.id}/mesures`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors shadow-sm"
        >
          <Plus size={15} />
          Nouvelle prise
        </button>
      </header>

      {/* ── Sélecteur de prise (Synthèse + une pill par date) ──────────── */}
      {unifiedDates.length > 0 && (
        <MesureSelectorPills
          dates={unifiedDates}
          selectedKey={selectedMesureKey}
          onSelect={setSelectedMesureKey}
          synthesisLatestDate={synthesisCirc?.latestContributionDate ?? null}
        />
      )}

      {/* ── 2 cards principales ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BigStatCard
          title="Tour de taille"
          value={taille.value}
          unit={lenLabel}
          previousValue={taille.previous}
          previousDate={taille.previousDate}
          lowerIsBetter
          selectionKey="mesures:tour_taille"
          selectionCategory={
            activeTailleCm !== null && client.sex
              ? (() => {
                  const r = getWaistRisk(activeTailleCm, client.sex)
                  return r ? `${WHO_RISK_LABELS[r.level]} (OMS)` : undefined
                })()
              : undefined
          }
          extra={
            activeTailleCm !== null && client.sex ? (
              <WaistRiskBar value={activeTailleCm} sex={client.sex} type="waist" />
            ) : null
          }
        />
        <BigStatCard
          title="% Gras corporel"
          value={activeView?.plis?.pourcentageGrasSiri ?? null}
          unit="%"
          previousValue={activeView?.previousPlis?.pourcentageGrasSiri}
          previousDate={activeView?.previousPlis?.date}
          lowerIsBetter
          selectionKey="mesures:pourcentage_gras"
          extra={
            activeView?.plis ? (
              <p className="text-marine/45 text-xs mt-2 flex items-center gap-1">
                <Calculator size={11} />
                Siri · Brozek {activeView.plis.pourcentageGrasBrozek.toFixed(1)} % · Durnin-Womersley
              </p>
            ) : null
          }
        />
      </div>

      {/* ── Stats secondaires : 4 + Ratio T/H ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniStatCard
          label="Tour de hanche"
          value={hanche.value}
          unit={lenLabel}
          previousValue={hanche.previous}
          previousDate={hanche.previousDate}
          lowerIsBetter
          selectionKey="mesures:hanche"
        />
        <MiniStatCard
          label="Biceps moy."
          value={bicepsAvgActive !== null ? cmToLengthInput(bicepsAvgActive, unitLength) : null}
          unit={lenLabel}
          previousValue={bicepsAvgPrev !== null ? cmToLengthInput(bicepsAvgPrev, unitLength) : undefined}
          previousDate={previousCircDate}
          selectionKey="mesures:biceps_moy"
        />
        <MiniStatCard
          label="Cuisse moy."
          value={cuisseAvgActive !== null ? cmToLengthInput(cuisseAvgActive, unitLength) : null}
          unit={lenLabel}
          previousValue={cuisseAvgPrev !== null ? cmToLengthInput(cuisseAvgPrev, unitLength) : undefined}
          previousDate={previousCircDate}
          selectionKey="mesures:cuisse_moy"
        />
        <MiniStatCard
          label="Poids"
          value={poids.value}
          unit={wLabel}
          previousValue={poids.previous}
          previousDate={poids.previousDate}
          lowerIsBetter
          selectionKey="mesures:poids"
        />
        <RatioTHCard
          value={ratioCurrent}
          previousValue={ratioPrev ?? undefined}
          previousDate={previousCircDate}
          sex={client.sex}
        />
      </div>

      {/* ── Voir détails de toutes les mesures ───────────────────────── */}
      {activeView && Object.keys(activeView.circ).length > 0 && (
        <div className="bg-white border border-cream-dark/30 rounded-xl shadow-sm">
          <button
            type="button"
            onClick={() => setShowDetails(v => !v)}
            className="w-full px-5 py-3 flex items-center gap-2 text-marine font-medium text-sm hover:bg-cream/30 transition-colors rounded-xl"
          >
            {showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Voir toutes les mesures détaillées (12 circonférences + plis)
          </button>
          {showDetails && (
            <div className="px-5 pb-5">
              <AllMeasuresDetails
                circ={activeView.circ}
                previousCirc={activeView.previousCirc}
                previousCircDate={activeView.previousCirc.date}
                plis={activeView.plis}
                previousPlis={activeView.previousPlis}
                unitLength={unitLength}
                unitWeight={unitWeight}
                lenLabel={lenLabel}
                wLabel={wLabel}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Graphique d'évolution avec sélecteur de métrique + période ── */}
      <EvolutionChart
        chartData={chartData}
        activeMetric={activeMetric}
        onSelectMetric={setSelectedMetric}
        period={period}
        setPeriod={setPeriod}
        allMetrics={METRICS_DEFS}
        availableMetrics={availableMetrics}
      />

      {/* ── Plis cutanés section ──────────────────────────────────────── */}
      {activeView?.plis && (
        <PlisCutanesSection
          latestPlis={activeView.plis}
          previousPlis={activeView.previousPlis}
          chartData={plisChartData}
        />
      )}
    </div>
  )
}

// ── Sous-composants ─────────────────────────────────────────────────────────

interface BigStatCardProps {
  title: string
  value: number | null
  unit?: string
  previousValue?: number
  previousDate?: string
  lowerIsBetter?: boolean
  extra?: React.ReactNode
  /** Si fourni, la card devient cochable en mode Conseils IA. */
  selectionKey?: string
  selectionCategory?: string
}

function BigStatCard({
  title,
  value,
  unit,
  previousValue,
  previousDate,
  lowerIsBetter,
  extra,
  selectionKey,
  selectionCategory
}: BigStatCardProps) {
  const inner = (
    <div className="bg-gradient-to-br from-white to-cream/40 border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <p className="text-marine/55 text-xs uppercase tracking-wide font-medium">{title}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-marine text-4xl font-bold leading-none">
          {value === null ? <span className="text-marine/25">—</span> : value.toFixed(1)}
        </span>
        {value !== null && unit && <span className="text-marine/55 text-base font-medium">{unit}</span>}
      </div>
      <MeasureDelta
        current={value}
        previous={previousValue}
        previousDate={previousDate}
        unit={unit}
        lowerIsBetter={lowerIsBetter}
      />
      {extra}
    </div>
  )
  if (!selectionKey) return inner
  return (
    <MetricSelectable
      selectionKey={selectionKey}
      data={{ key: selectionKey, label: title, value: value ?? '—', unit, category: selectionCategory }}
      available={value !== null}
    >
      {inner}
    </MetricSelectable>
  )
}

interface MiniStatCardProps {
  label: string
  value: number | null
  unit?: string
  previousValue?: number
  previousDate?: string
  lowerIsBetter?: boolean
  selectionKey?: string
}

function MiniStatCard({
  label,
  value,
  unit,
  previousValue,
  previousDate,
  lowerIsBetter,
  selectionKey
}: MiniStatCardProps) {
  const inner = (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-4 shadow-sm">
      <p className="text-marine/55 text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className="text-marine text-2xl font-bold mt-1 leading-none tabular-nums">
        {value === null ? <span className="text-marine/25">—</span> : value.toFixed(1)}
        {value !== null && unit && <span className="text-marine/45 text-sm font-medium ml-1">{unit}</span>}
      </p>
      <MeasureDelta
        current={value}
        previous={previousValue}
        previousDate={previousDate}
        unit={unit}
        lowerIsBetter={lowerIsBetter}
      />
    </div>
  )
  if (!selectionKey) return inner
  return (
    <MetricSelectable
      selectionKey={selectionKey}
      data={{ key: selectionKey, label, value: value ?? '—', unit }}
      available={value !== null}
    >
      {inner}
    </MetricSelectable>
  )
}

interface RatioTHCardProps {
  value: number | null
  previousValue?: number
  previousDate?: string
  sex: 'F' | 'M' | null
}

function RatioTHCard({ value, previousValue, previousDate, sex }: RatioTHCardProps) {
  const inner = (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-4 shadow-sm">
      <p className="text-marine/55 text-xs uppercase tracking-wide font-medium">Ratio taille/hanche</p>
      <p className="text-marine text-2xl font-bold mt-1 leading-none tabular-nums">
        {value === null ? <span className="text-marine/25">—</span> : value.toFixed(2)}
      </p>
      <MeasureDelta
        current={value}
        previous={previousValue}
        previousDate={previousDate}
        lowerIsBetter
      />
      <WaistRiskBar value={value} sex={sex} type="ratio" />
    </div>
  )
  const risk = value !== null && sex ? getRatioRisk(value, sex) : null
  return (
    <MetricSelectable
      selectionKey="mesures:ratioTH"
      data={{
        key: 'mesures:ratioTH',
        label: 'Ratio taille/hanche',
        value: value ?? '—',
        category: risk ? WHO_RISK_LABELS[risk.level] + ' (OMS)' : undefined
      }}
      available={value !== null}
    >
      {inner}
    </MetricSelectable>
  )
}

interface ChartPoint {
  label: string
  date: string
  value: number | null
  previousValue: number | null
  previousDate?: string
}

interface EvolutionChartProps {
  chartData: ChartPoint[]
  activeMetric: MetricDef
  onSelectMetric: (m: MetricKey) => void
  period: PeriodFilter
  setPeriod: (p: PeriodFilter) => void
  allMetrics: MetricDef[]
  availableMetrics: Set<MetricKey>
}

function EvolutionChart({
  chartData,
  activeMetric,
  onSelectMetric,
  period,
  setPeriod,
  allMetrics,
  availableMetrics
}: EvolutionChartProps) {
  const chartEnabled = chartData.filter(p => p.value !== null).length >= 2

  // Groupage par section. L'ordre dans `allMetrics` fait foi pour l'ordre d'affichage.
  const groups: Record<MetricGroup, MetricDef[]> = { circ: [], weights: [], composition: [] }
  for (const m of allMetrics) groups[m.group].push(m)

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-gold-dark" />
        <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">
          Évolution dans le temps
        </h3>
      </div>

      {/* Sélecteur de métrique — 3 sections de pills */}
      <div className="space-y-3 mb-4">
        {(Object.keys(groups) as MetricGroup[]).map(group => (
          <div key={group}>
            <p className="text-marine/55 text-xs uppercase tracking-wide font-medium mb-1.5">
              {METRIC_GROUP_LABEL[group]}
            </p>
            <div className="flex flex-wrap gap-2">
              {groups[group].map(m => {
                const isActive = m.key === activeMetric.key
                const disabled = !availableMetrics.has(m.key)
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectMetric(m.key)}
                    className={[
                      'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                      isActive
                        ? 'bg-marine text-cream border-marine'
                        : disabled
                          ? 'bg-cream-dark/20 text-marine/30 border-cream-dark/30 opacity-40 cursor-not-allowed'
                          : 'bg-cream-dark/30 text-marine border-cream-dark hover:bg-cream-dark/50'
                    ].join(' ')}
                    title={disabled ? 'Aucune donnée pour ce client' : undefined}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Filtres de période */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3 pt-3 border-t border-cream-dark/30">
        <p className="text-marine/55 text-xs uppercase tracking-wide font-medium mr-1">Période</p>
        {(Object.keys(PERIOD_LABEL) as PeriodFilter[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              period === p
                ? 'bg-marine text-cream'
                : 'border border-cream-dark text-marine/65 hover:border-gold/60 hover:text-marine'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {chartEnabled ? (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="rgba(10, 28, 94, 0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 11 }}
                stroke="rgba(10, 28, 94, 0.15)"
              />
              <YAxis
                tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 11 }}
                stroke="rgba(10, 28, 94, 0.15)"
                width={40}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<EvolutionTooltip metric={activeMetric} />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#b8834a"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#b8834a' }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-marine/45 text-sm py-10 text-center">
          Pas assez de données pour cette période — essayez « Tout » ou ajoutez une mesure.
        </p>
      )}
    </div>
  )
}

/** Tooltip enrichi : label métrique + valeur + unité + date + delta vs précédent. */
function EvolutionTooltip({
  active,
  payload,
  metric
}: {
  active?: boolean
  payload?: { payload: ChartPoint }[]
  metric: MetricDef
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  if (p.value === null) return null
  const sign = (() => {
    if (p.previousValue === null) return null
    const delta = p.value - p.previousValue
    if (Math.abs(delta) < 0.05) return { text: '= stable', color: 'text-marine/45' }
    const improved = metric.lowerIsBetter ? delta < 0 : delta > 0
    const arrow = delta > 0 ? '▲' : '▼'
    const signStr = delta > 0 ? '+' : '−'
    const abs = Math.abs(delta)
    const label = abs >= 10 ? Math.round(abs).toString() : abs.toFixed(1)
    return {
      text: `${arrow} ${signStr}${label} ${metric.unit}`,
      color: improved ? 'text-green-600' : 'text-red-500'
    }
  })()
  return (
    <div className="bg-white border border-gold/40 rounded-md shadow-md px-3 py-2 text-marine">
      <p className="font-semibold text-sm">{metric.label}</p>
      <p className="text-base font-bold tabular-nums mt-0.5">
        {p.value.toFixed(metric.unit === '' || metric.key === 'ratioTH' ? 2 : 1)}
        {metric.unit && <span className="text-marine/45 text-sm font-medium ml-1">{metric.unit}</span>}
      </p>
      <p className="text-marine/55 text-xs mt-1">{formatBilanDate(p.date)}</p>
      {sign && (
        <p className={`text-xs font-medium mt-0.5 ${sign.color}`}>
          {sign.text}
          {p.previousDate && (
            <span className="text-marine/45 font-normal"> · vs {formatBilanDate(p.previousDate)}</span>
          )}
        </p>
      )}
    </div>
  )
}

interface PlisCutanesSectionProps {
  latestPlis: MesurePlisCutanes
  previousPlis: MesurePlisCutanes | null
  chartData: { label: string; value: number }[]
}

function PlisCutanesSection({ latestPlis, previousPlis, chartData }: PlisCutanesSectionProps) {
  const PLIS = [
    { key: 'triceps' as const, label: 'Triceps' },
    { key: 'biceps' as const, label: 'Biceps' },
    { key: 'sousscapulaire' as const, label: 'Sous-scap' },
    { key: 'iliaque' as const, label: 'Iliaque' }
  ]
  const showChart = chartData.filter(p => typeof p.value === 'number').length >= 2

  return (
    <section className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Calculator size={16} className="text-gold-dark" />
        <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Plis cutanés</h3>
        <span className="text-marine/45 text-xs ml-auto">{formatBilanDate(latestPlis.date)}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div>
          {/* 4 plis + somme */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {PLIS.map(p => (
              <MiniStatCard
                key={p.key}
                label={p.label}
                value={latestPlis[p.key]}
                unit="mm"
                previousValue={previousPlis?.[p.key]}
                previousDate={previousPlis?.date}
                lowerIsBetter
              />
            ))}
          </div>
          <div className="mt-3 bg-gradient-to-br from-white to-cream/40 border border-cream-dark/30 rounded-xl p-4">
            <p className="text-marine/55 text-xs uppercase tracking-wide font-medium">Somme des 4 plis</p>
            <p className="text-marine text-2xl font-bold mt-1 leading-none tabular-nums">
              {latestPlis.somme4Plis.toFixed(1)}
              <span className="text-marine/45 text-sm font-medium ml-1">mm</span>
            </p>
            <MeasureDelta
              current={latestPlis.somme4Plis}
              previous={previousPlis?.somme4Plis}
              previousDate={previousPlis?.date}
              unit="mm"
              lowerIsBetter
            />
          </div>
        </div>

        <div>
          <p className="text-marine/55 text-xs uppercase tracking-wide font-medium mb-1.5">
            Évolution % gras (Siri)
          </p>
          {showChart ? (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="rgba(10, 28, 94, 0.08)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 10 }}
                    stroke="rgba(10, 28, 94, 0.15)"
                  />
                  <YAxis
                    tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 10 }}
                    stroke="rgba(10, 28, 94, 0.15)"
                    width={34}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #d4a574', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => [`${typeof v === 'number' ? v.toFixed(1) : v} %`, '% gras']}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#d4a574"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#d4a574' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-marine/40 text-sm">
              Au moins 2 prises de plis sont nécessaires pour tracer la courbe.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

interface AllMeasuresDetailsProps {
  /** Circonférences de la vue active (synthèse virtuelle ou snapshot date). */
  circ: Partial<MesureCirconferences>
  /** Circonférences de comparaison (2e valeur synthèse, ou session précédente). */
  previousCirc: Partial<MesureCirconferences>
  /** Date de la comparaison circ — absente en mode synthèse. */
  previousCircDate?: string
  plis: MesurePlisCutanes | null
  previousPlis: MesurePlisCutanes | null
  unitLength: 'cm' | 'in'
  unitWeight: 'kg' | 'lb'
  lenLabel: string
  wLabel: string
}

function AllMeasuresDetails({
  circ,
  previousCirc,
  previousCircDate,
  plis,
  previousPlis,
  unitLength,
  unitWeight,
  lenLabel,
  wLabel
}: AllMeasuresDetailsProps) {
  const ALL_CIRC: { key: keyof MesureCirconferences; label: string }[] = [
    { key: 'cou', label: 'Cou' },
    { key: 'epaule', label: 'Épaule' },
    { key: 'bicepsG', label: 'Biceps G' },
    { key: 'bicepsD', label: 'Biceps D' },
    { key: 'poitrine', label: 'Poitrine' },
    { key: 'taille', label: 'Tour de taille' },
    { key: 'abdomen', label: 'Abdomen' },
    { key: 'hanche', label: 'Tour de hanche' },
    { key: 'cuisseG', label: 'Cuisse G' },
    { key: 'cuisseD', label: 'Cuisse D' },
    { key: 'molletG', label: 'Mollet G' },
    { key: 'molletD', label: 'Mollet D' }
  ]
  const LOWER_BETTER_KEYS = new Set(['taille', 'hanche', 'abdomen'])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2 pt-2 border-t border-cream-dark/30">
        {ALL_CIRC.map(f => {
          const rawCurr = circ[f.key]
          const rawPrev = previousCirc[f.key]
          const curr = typeof rawCurr === 'number' ? cmToLengthInput(rawCurr, unitLength) : null
          const prevConv = typeof rawPrev === 'number' ? cmToLengthInput(rawPrev, unitLength) : undefined
          return (
            <DetailRow
              key={f.key as string}
              label={f.label}
              value={curr}
              unit={lenLabel}
              previousValue={prevConv}
              previousDate={previousCircDate}
              lowerIsBetter={LOWER_BETTER_KEYS.has(f.key as string)}
            />
          )
        })}
        {(() => {
          const curr = typeof circ.poidsKg === 'number' ? kgToWeightInput(circ.poidsKg, unitWeight) : null
          const prevConv =
            typeof previousCirc.poidsKg === 'number'
              ? kgToWeightInput(previousCirc.poidsKg, unitWeight)
              : undefined
          return (
            <DetailRow
              label="Poids"
              value={curr}
              unit={wLabel}
              previousValue={prevConv}
              previousDate={previousCircDate}
              lowerIsBetter
            />
          )
        })()}
      </div>

      {plis && (
        <div className="pt-3 border-t border-cream-dark/30">
          <p className="text-marine/55 text-xs uppercase tracking-wide font-medium mb-2">
            Plis cutanés ({formatBilanDate(plis.date)})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2">
            {(['triceps', 'biceps', 'sousscapulaire', 'iliaque'] as const).map(k => (
              <DetailRow
                key={k}
                label={k === 'sousscapulaire' ? 'Sous-scapulaire' : k.charAt(0).toUpperCase() + k.slice(1)}
                value={plis[k]}
                unit="mm"
                previousValue={previousPlis?.[k]}
                previousDate={previousPlis?.date}
                lowerIsBetter
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: number | null
  unit: string
  previousValue?: number
  previousDate?: string
  lowerIsBetter?: boolean
}

function DetailRow({ label, value, unit, previousValue, previousDate, lowerIsBetter }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-marine/65 text-sm">{label}</span>
      <div className="text-right">
        <span className="text-marine text-base font-semibold tabular-nums">
          {value === null ? <span className="text-marine/30">—</span> : value.toFixed(1)}
          {value !== null && <span className="text-marine/45 text-xs font-medium ml-1">{unit}</span>}
        </span>
        <MeasureDelta
          current={value}
          previous={previousValue}
          previousDate={previousDate}
          unit={unit}
          lowerIsBetter={lowerIsBetter}
        />
      </div>
    </div>
  )
}
