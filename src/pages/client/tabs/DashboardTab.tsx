import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Calculator, FileText, FileUp, Info, Mail, PartyPopper, Ruler } from 'lucide-react'
import { useClient } from '../ClientDetailLayout'
import { ClientAvatar } from '../../../components/ClientAvatar'
import { bilansService } from '../../../services/bilans'
import { mesuresService } from '../../../services/mesures'
import { settingsService } from '../../../services/settings'
import { reportsService } from '../../../services/reports'
import { SendBilanModal } from '../SendBilanModal'
import { formatBilanDate } from '../bilanFields'
import { computeAge, type NormsType } from '../../../lib/norms'
import { computeBilan, type BilanComputed, type BilanProfile } from '../../../lib/bilan-computed'
import { fitnessAge } from '../../../lib/fitness-age'
import {
  bodyFatGoal,
  estimateMacros,
  weeksToGoal,
  dailyDeficitForRate,
  weeklyLossFromDeficit,
  DEFAULT_RATE_KG_PER_WEEK
} from '../../../lib/nutrition'
import { dualWeight, estimatedGoalDate } from '../../../lib/objectif-format'
import { gatherBilanMetrics } from '../../../lib/ai-metrics'
import { AIAnalysisPanel } from '../dashboard/AIAdvicePanel'
import { ScoreDonut } from '../dashboard/ScoreDonut'
import { StatCardXL } from '../dashboard/StatCardXL'
import { CompositeMiniCard } from '../dashboard/CompositeMiniCard'
import { ProgressionChart } from '../dashboard/ProgressionChart'
import { MusculoRadar } from '../dashboard/MusculoRadar'
import { TrainingZones } from '../dashboard/TrainingZones'
import { StrengthsAndWeaknesses } from '../dashboard/StrengthsAndWeaknesses'
import { BilanSelectorPills } from '../dashboard/BilanSelectorPills'
import { buildPreviousSynthesisBilan, buildSynthesisBilan } from '../../../lib/synthesisBilan'
import { detectWins } from '../../../lib/dashboard-wins'
import { Confetti } from '../../../components/Confetti'

function formatNumber(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return n.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
}

export function DashboardTab() {
  const client = useClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const printMode = searchParams.get('print') === '1'
  // L'ID du bilan affiché vit dans l'URL (`?bilan=<id>`) — bookmark, retour
  // navigateur et navigation inter-onglets fonctionnent gratuitement.
  const selectedBilanIdFromUrl = searchParams.get('bilan')

  const [bilans, setBilans] = useState<Bilan[] | null>(null)
  const [circList, setCircList] = useState<MesureCirconferences[]>([])
  const [plisList, setPlisList] = useState<MesurePlisCutanes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [smtpReady, setSmtpReady] = useState<boolean | null>(null)
  const [norms, setNorms] = useState<NormsType>('acsm')
  const [showModal, setShowModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const setSelectedBilanId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams)
      if (id) next.set('bilan', id)
      else next.delete('bilan')
      setSearchParams(next, { replace: false })
    },
    [searchParams, setSearchParams]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      bilansService.getBilansForClient(client.id),
      mesuresService.circonferences.list(client.id),
      mesuresService.plis.list(client.id)
    ])
      .then(([list, circ, plis]) => {
        if (cancelled) return
        setBilans(list)
        setCircList(circ)
        setPlisList(plis)
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
    settingsService.getCategorizationNorms().then(setNorms).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const age = useMemo(() => computeAge(client.birthdate), [client.birthdate])
  const profile = useMemo<BilanProfile>(() => ({ age, sex: client.sex, norms }), [age, client.sex, norms])

  // Mode synthèse : sentinel `'synthesis'` ou absence du paramètre `?bilan=`.
  // Marie-Eve atterrit dessus par défaut — c'est le plus utile pour consulter
  // un client dont les bilans sont partiels (cf. ADR 0009).
  const isSynthesisMode = selectedBilanIdFromUrl === null || selectedBilanIdFromUrl === 'synthesis'

  // Calcule le bilan synthétisé une seule fois (la valeur la plus récente
  // non-null pour chaque champ).
  const synthesisResult = useMemo(() => {
    if (!bilans || bilans.length === 0) return null
    return buildSynthesisBilan(bilans)
  }, [bilans])

  // Et son « précédent » virtuel — pour chaque champ, la 2e valeur la plus
  // récente non-null. Sert aux flèches ▲▼ champ par champ.
  const previousSynthesisResult = useMemo(() => {
    if (!bilans || bilans.length === 0) return null
    return buildPreviousSynthesisBilan(bilans)
  }, [bilans])

  const activeBilan = useMemo<Bilan | null>(() => {
    if (!bilans || bilans.length === 0) return null
    if (isSynthesisMode && synthesisResult) {
      // Bilan virtuel — id et createdAt fictifs, date = dernière contribution.
      return {
        id: 'synthesis',
        clientId: client.id,
        date: synthesisResult.latestContributionDate ?? bilans[0].date,
        data: synthesisResult.data,
        source: 'manuel',
        createdAt: new Date().toISOString()
      }
    }
    if (selectedBilanIdFromUrl) {
      const found = bilans.find(b => b.id === selectedBilanIdFromUrl)
      if (found) return found
    }
    return bilans[0]
  }, [bilans, isSynthesisMode, synthesisResult, selectedBilanIdFromUrl, client.id])

  // « Bilan précédent » :
  //  - en mode synthèse → bilan virtuel construit avec les 2e valeurs non-null
  //  - en mode classique → bilan chronologiquement précédent dans la liste
  const previousActiveBilan = useMemo<Bilan | null>(() => {
    if (!bilans) return null
    if (isSynthesisMode && previousSynthesisResult) {
      return {
        id: 'synthesis-previous',
        clientId: client.id,
        date: '',
        data: previousSynthesisResult.data,
        source: 'manuel',
        createdAt: new Date().toISOString()
      }
    }
    if (!activeBilan) return null
    const idx = bilans.findIndex(b => b.id === activeBilan.id)
    return idx >= 0 ? bilans[idx + 1] ?? null : null
  }, [bilans, isSynthesisMode, previousSynthesisResult, activeBilan, client.id])

  // Bilan de référence des « hero stats » (anneau, mini-cartes, cartes XL).
  // 'prev' = bilan précédent (défaut) · 'none' = aucune comparaison · sinon un id.
  const [heroCompareId, setHeroCompareId] = useState<string>('prev')
  useEffect(() => {
    setHeroCompareId('prev')
  }, [activeBilan?.id])

  if (loading) {
    return <div className="p-8 text-marine/50 text-base">Chargement…</div>
  }
  if (error) {
    return <div className="p-8 text-red-600 text-base">{error}</div>
  }

  const count = bilans?.length ?? 0
  const latest = bilans?.[0] ?? null

  const sendDisabled = smtpReady === null || smtpReady === false
  const sendTooltip = smtpReady === false ? 'Configurez votre SMTP dans Paramètres' : undefined

  function goToBilans() {
    navigate(`/clients/${client.id}/bilans`)
  }

  async function handleGenerateReport() {
    setGenerating(true)
    try {
      const path = await reportsService.generatePdfForClient(client.id)
      await reportsService.openPdf(path)
      setToast('Rapport PDF généré')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Erreur lors de la génération du rapport.')
    } finally {
      setGenerating(false)
    }
  }

  // ── État A : aucun bilan ──────────────────────────────────────────────────
  if (count === 0 || !latest) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClientAvatar client={client} size="xl" className="mb-5 shadow-sm" />
          <h2 className="text-marine font-semibold text-xl">Aucun bilan enregistré pour {client.name}</h2>
          <p className="text-marine/50 text-base mt-2 max-w-md">
            Importez un bilan <code className="text-marine/45">.doc</code> ou <code className="text-marine/45">.docx</code>{' '}
            — ou créez-en un manuellement — pour afficher les statistiques et la progression.
          </p>
          <button
            type="button"
            onClick={goToBilans}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors shadow-sm"
          >
            <FileUp size={17} />
            Commencer
          </button>
        </div>
      </div>
    )
  }

  // ── Calculs dérivés du bilan ACTIF (et non plus du « plus récent ») ──────
  const activeData = (activeBilan ?? latest)!.data
  const previousData = previousActiveBilan?.data
  const computed = computeBilan(activeData, profile)
  const previousComputed = previousData ? computeBilan(previousData, profile) : undefined

  // Référence choisie pour les hero stats. Indépendante des victoires (toujours
  // mesurées vs le bilan précédent) et du radar musculo (qui a son propre choix).
  const heroCompareBilan =
    heroCompareId === 'none'
      ? null
      : heroCompareId === 'prev'
        ? previousActiveBilan
        : bilans?.find(b => b.id === heroCompareId) ?? null
  const heroCompareData = heroCompareBilan?.data
  const heroCompareComputed = heroCompareData ? computeBilan(heroCompareData, profile) : undefined
  const heroCompareLabel =
    heroCompareBilan === null
      ? null
      : heroCompareId === 'prev'
        ? 'bilan précédent'
        : `bilan du ${formatBilanDate(heroCompareBilan.date)}`

  // Miroir du rapport : âge en forme (VO2max → âge) + objectif chiffré (si module activé).
  const fitAge = fitnessAge(
    computed.vo2max ?? (typeof activeData.vo2max === 'number' ? activeData.vo2max : null),
    client.sex
  )
  const objectif = buildObjectif(client, activeData, computed, age, (activeBilan ?? latest)!.date)
  const aiMetrics = gatherBilanMetrics(activeData, age, client.sex, norms)
  // Bilans proposés comme point de comparaison (hero stats + radar musculo). On
  // retire celui affiché et le précédent (déjà couvert par « Bilan précédent »).
  const compareOptions = (bilans ?? [])
    .filter(b => b.id !== (activeBilan ?? latest)!.id && b.id !== previousActiveBilan?.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(b => ({ id: b.id, date: b.date, data: b.data }))
  // Victoires à célébrer (Dashboard uniquement — jamais dans le PDF).
  const wins = printMode
    ? []
    : detectWins({
        computed,
        previous: previousComputed,
        bilans: bilans ?? [],
        currentData: activeData,
        objectifAtGoal: objectif?.atGoal
      })
  // Vrai si Marie-Eve regarde un bilan ANCIEN spécifique (pas la synthèse,
  // pas le plus récent). Sert au bandeau gold « vous consultez un bilan ancien ».
  const isViewingOlder =
    !isSynthesisMode && activeBilan !== null && activeBilan.id !== latest.id
  const sexLabel = client.sex === 'F' ? 'Femme' : client.sex === 'M' ? 'Homme' : '—'
  const ageLabel = age !== null ? `${age} ans` : 'âge ?'

  const Header = (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-5 min-w-0">
        <ClientAvatar client={client} size="xl" className="shadow-sm" />
        <div className="min-w-0">
          <h1 className="text-marine font-bold text-2xl leading-tight">{client.name}</h1>
          <p className="text-marine/55 text-sm mt-0.5">
            {ageLabel} · {sexLabel} · <span className="text-marine/40">{client.email}</span>
          </p>
          <p className="text-marine/45 text-xs mt-1">
            {isSynthesisMode ? (
              <>
                <span className="inline-flex items-center gap-1 text-gold-dark font-medium">
                  🔬 Synthèse — dernières valeurs disponibles
                </span>
                {synthesisResult?.latestContributionDate && (
                  <span>
                    {' '}· mise à jour {formatBilanDate(synthesisResult.latestContributionDate)}
                  </span>
                )}
                {count > 1 && <span> · {count} bilans agrégés</span>}
              </>
            ) : (
              <>
                Bilan affiché :{' '}
                <span className="text-marine font-medium">
                  {formatBilanDate(activeBilan!.date)}
                </span>
                {count > 1 && <span> · {count} bilans au total</span>}
              </>
            )}
          </p>
        </div>
      </div>
      {!printMode && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 text-marine/80 hover:text-marine font-medium border border-cream-dark hover:border-gold/60 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText size={15} />
            {generating ? 'Génération…' : 'Générer PDF'}
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={sendDisabled}
            title={sendTooltip}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail size={15} />
            Envoyer
          </button>
        </div>
      )}
    </header>
  )

  // ── Hero : score donut + 5 composites ──────────────────────────────────────
  const Hero = (
    <section className="dash-rise bg-white border border-cream-dark/30 rounded-xl p-6 shadow-sm">
      {!printMode && (previousActiveBilan !== null || compareOptions.length > 0) && (
        <div className="flex items-center justify-end mb-4">
          <label className="flex items-center gap-1.5 text-xs text-marine/55">
            <span>Comparer à</span>
            <select
              value={heroCompareId}
              onChange={e => setHeroCompareId(e.target.value)}
              className="rounded-md border border-cream-dark bg-cream/60 px-2 py-1 text-xs font-medium text-marine hover:bg-cream-dark focus:outline-none focus:ring-2 focus:ring-gold/50"
              title="Bilan de référence pour les écarts ▲▼ du score, des composites et des grandes cartes"
            >
              {previousActiveBilan !== null && <option value="prev">Bilan précédent</option>}
              {compareOptions.map(o => (
                <option key={o.id} value={o.id}>
                  {formatBilanDate(o.date)}
                </option>
              ))}
              <option value="none">Aucune comparaison</option>
            </select>
          </label>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-4 flex justify-center">
          <ScoreDonut
            score={computed.overall.score}
            category={computed.overall.category}
            previousScore={heroCompareComputed?.overall.score ?? null}
            label="Santé et condition physique globale"
          />
        </div>
        <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-3">
          <CompositeMiniCard
            title="Composition"
            subtitle="IMC + %gras + taille"
            current={computed.composition}
            previous={heroCompareComputed?.composition}
          />
          <CompositeMiniCard
            title="% gras corporel"
            current={computed.bodyFat}
            previous={heroCompareComputed?.bodyFat}
          />
          <CompositeMiniCard
            title="Aérobie"
            subtitle="VO2max"
            current={computed.aerobic}
            previous={heroCompareComputed?.aerobic}
          />
          <CompositeMiniCard
            title="Indice du dos"
            subtitle="Flex + endur + situps"
            current={computed.backHealth}
            previous={heroCompareComputed?.backHealth}
          />
          <CompositeMiniCard
            title="Musculo global"
            subtitle="6 tests"
            current={computed.musculoGlobal}
            previous={heroCompareComputed?.musculoGlobal}
          />
        </div>
      </div>
    </section>
  )

  // ── Stats XL ──────────────────────────────────────────────────────────────
  const StatsRow = (
    <section className="dash-rise grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ animationDelay: '80ms' }}>
      <StatCardXL
        label="VO2max"
        value={activeData.vo2max}
        unit="ml/kg/min"
        test="vo2max"
        age={age}
        sex={client.sex}
        norms={norms}
        originDate={isSynthesisMode ? synthesisResult?.fieldOriginDates.vo2max : undefined}
        previousValue={heroCompareData?.vo2max}
        compareLabel={heroCompareLabel}
      />
      <StatCardXL
        label="IMC"
        value={activeData.imc}
        unit="kg/m²"
        test="bmi"
        age={age}
        sex={client.sex}
        norms={norms}
        originDate={isSynthesisMode ? synthesisResult?.fieldOriginDates.imc : undefined}
        previousValue={heroCompareData?.imc}
        lowerIsBetter
        compareLabel={heroCompareLabel}
      />
      <StatCardXL
        label="% de gras"
        value={activeData.pourcentage_gras}
        unit="%"
        test="bodyFat"
        age={age}
        sex={client.sex}
        norms={norms}
        originDate={isSynthesisMode ? synthesisResult?.fieldOriginDates.pourcentage_gras : undefined}
        previousValue={heroCompareData?.pourcentage_gras}
        lowerIsBetter
        compareLabel={heroCompareLabel}
      />
      <StatCardXL
        label="Tour de taille"
        value={activeData.tour_taille_cm}
        unit="cm"
        test="waistCircumference"
        age={age}
        sex={client.sex}
        norms={norms}
        originDate={isSynthesisMode ? synthesisResult?.fieldOriginDates.tour_taille_cm : undefined}
        previousValue={heroCompareData?.tour_taille_cm}
        lowerIsBetter
        compareLabel={heroCompareLabel}
      />
    </section>
  )

  const hasMultiple = count >= 2

  // ── Mesures section (light variant inline) ────────────────────────────────
  const MesuresPanel = (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Ruler size={16} className="text-gold-dark" />
        <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Mesures corporelles</h3>
      </div>
      {circList.length === 0 && plisList.length === 0 ? (
        <p className="text-marine/45 text-sm">Aucune mesure enregistrée pour ce client.</p>
      ) : (
        <>
          {circList[0] && (
            <>
              <p className="text-marine/45 text-xs mb-3">
                Dernière prise circ. : {formatBilanDate(circList[0].date)}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                <MesureRow label="Tour de taille" value={circList[0].taille} unit="cm" />
                <MesureRow label="Tour de hanche" value={circList[0].hanche} unit="cm" />
                <MesureRow
                  label="Biceps moy."
                  value={avgGD(circList[0].bicepsG, circList[0].bicepsD)}
                  unit="cm"
                />
                <MesureRow
                  label="Cuisse moy."
                  value={avgGD(circList[0].cuisseG, circList[0].cuisseD)}
                  unit="cm"
                />
              </div>
            </>
          )}
          {plisList[0] && (
            <div className="pt-3 border-t border-cream-dark/40">
              <div className="flex items-center gap-2 mb-2">
                <Calculator size={14} className="text-gold-dark" />
                <p className="text-marine/65 text-xs uppercase tracking-wide font-medium">% gras (plis cutanés)</p>
              </div>
              <p className="text-marine text-3xl font-bold leading-none">
                {formatNumber(plisList[0].pourcentageGrasSiri)}
                <span className="text-base font-medium text-marine/45 ml-1.5">%</span>
              </p>
              <p className="text-marine/45 text-xs mt-1">
                Siri · Brozek {formatNumber(plisList[0].pourcentageGrasBrozek)} % ·{' '}
                {formatBilanDate(plisList[0].date)}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-5">
      {Header}

      {count >= 1 && (
        <BilanSelectorPills
          bilans={bilans!}
          selectedId={isSynthesisMode ? null : activeBilan!.id}
          onSelect={id => setSelectedBilanId(id ?? 'synthesis')}
          synthesisLatestDate={synthesisResult?.latestContributionDate}
        />
      )}

      {isViewingOlder && (
        <div className="bg-gold/15 border border-gold/30 rounded-lg px-4 py-3 flex items-center gap-3 text-sm">
          <Info size={16} className="text-gold-dark shrink-0" />
          <p className="text-marine/80 flex-1">
            Vous consultez le bilan du <span className="font-semibold">{formatBilanDate(activeBilan!.date)}</span>.
          </p>
          <button
            type="button"
            onClick={() => setSelectedBilanId(null)}
            className="text-gold-dark hover:text-marine underline font-medium text-sm"
          >
            Revenir à la synthèse
          </button>
        </div>
      )}

      {wins.length > 0 && (
        <>
          <Confetti token={`${client.id}:${(activeBilan ?? latest)!.id}`} />
          <section
            className="dash-rise rounded-xl border border-green-500/30 bg-gradient-to-br from-green-50 to-gold/10 p-5 shadow-sm"
            aria-label="Vos progrès"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <PartyPopper size={20} className="text-green-600 shrink-0" />
              <h3 className="text-marine font-bold text-base">Belle progression !</h3>
            </div>
            <ul className="space-y-1.5">
              {wins.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-marine/85">
                  <span aria-hidden="true" className="shrink-0">
                    {w.icon}
                  </span>
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {Hero}
      {StatsRow}

      {(fitAge !== null || objectif !== null) && (
        <section className="dash-rise grid grid-cols-1 md:grid-cols-2 gap-4" style={{ animationDelay: '160ms' }}>
          {fitAge !== null && <FitnessAgeCard fitAge={fitAge} age={age} />}
          {objectif !== null && <ObjectifCard objectif={objectif} unit={client.unitWeight ?? 'kg'} />}
        </section>
      )}

      {hasMultiple ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-5">
            <ProgressionChart
              bilans={bilans!}
              profile={profile}
              activeBilanId={activeBilan!.id}
              bodyFatTarget={objectif && !objectif.atGoal ? objectif.target : null}
              bodyFatGoalLabel={objectif?.goalDate ?? null}
            />
            <MusculoRadar
              current={activeData}
              previous={previousData}
              age={age}
              sex={client.sex}
              norms={norms}
              currentId={(activeBilan ?? latest)!.id}
              compareOptions={compareOptions}
            />
          </div>
          <div className="lg:col-span-4 space-y-5">
            {MesuresPanel}
            <TrainingZones fcMax={computed.fcMaxPredite} fcZones={computed.fcZones} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <MusculoRadar
                current={activeData}
                previous={undefined}
                age={age}
                sex={client.sex}
                norms={norms}
              />
            </div>
            <div className="lg:col-span-4 space-y-5">
              {MesuresPanel}
              <TrainingZones fcMax={computed.fcMaxPredite} fcZones={computed.fcZones} />
            </div>
          </div>
          <div className="bg-gold/10 border border-gold/30 rounded-xl px-5 py-4 text-marine/70 text-sm">
            Importez ou créez un 2e bilan pour voir la progression dans le temps.
          </div>
        </>
      )}

      <section className="dash-rise space-y-3" style={{ animationDelay: '240ms' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-marine/50 text-xs uppercase tracking-wide font-semibold">Analyse du bilan</p>
          {!printMode && <AIAnalysisPanel sex={client.sex} age={age} metrics={aiMetrics} />}
        </div>
        <StrengthsAndWeaknesses data={activeData} age={age} sex={client.sex} norms={norms} />
      </section>

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

function avgGD(a: number | null, b: number | null): number | null {
  const vals = [a, b].filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null
}

function MesureRow({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div>
      <p className="text-marine/55 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-marine text-lg font-semibold mt-0.5 tabular-nums">
        {value === null ? <span className="text-marine/25">—</span> : formatNumber(value)}
        {value !== null && <span className="text-marine/45 text-sm font-medium ml-1">{unit}</span>}
      </p>
    </div>
  )
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-marine text-cream text-base font-medium px-5 py-3 rounded-lg shadow-2xl border border-marine-light/40">
      {message}
    </div>
  )
}

// ── Objectif chiffré (miroir du rapport) ──────────────────────────────────────
/** Construit le résumé d'objectif à partir de la config nutrition du client et du
 *  bilan actif. `null` si le module est désactivé ou le calcul impossible. */
function buildObjectif(
  client: Client,
  data: BilanData,
  computed: BilanComputed,
  age: number | null,
  startDateIso: string
) {
  if (!client.nutritionEnabled || client.nutritionTargetBodyFat == null) return null
  const weightKg = typeof data.poids_kg === 'number' ? data.poids_kg : null
  const bodyFatPct =
    computed.pourcentageGrasDurnin ?? (typeof data.pourcentage_gras === 'number' ? data.pourcentage_gras : null)
  const goal = bodyFatGoal(weightKg, bodyFatPct, client.nutritionTargetBodyFat)
  if (!goal) return null
  const rate = client.nutritionRateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK
  const macros = client.nutritionActivityLevel
    ? estimateMacros({
        weightKg,
        heightCm: typeof data.taille_cm === 'number' ? data.taille_cm : null,
        age,
        sex: client.sex,
        activity: client.nutritionActivityLevel,
        leanKg: goal.leanKg,
        dailyDeficitKcal: dailyDeficitForRate(rate),
        proteinPerLbLean: client.nutritionProteinPerLbLean,
        fatMaxG: client.nutritionFatMaxG,
        targetKcalOverride: client.nutritionTargetKcal
      })
    : null
  const manualKcal = client.nutritionTargetKcal
  const effectiveRate = manualKcal != null && macros ? weeklyLossFromDeficit(macros.tdee - macros.targetKcal) : rate
  const atGoal = goal.toLoseKg <= 0.3
  const weeks = atGoal ? null : weeksToGoal(goal.toLoseKg, effectiveRate)
  const goalDate = weeks != null ? estimatedGoalDate(startDateIso, weeks) : null
  return { goal, target: client.nutritionTargetBodyFat, macros, weeks, goalDate, atGoal }
}

type ObjectifSummary = NonNullable<ReturnType<typeof buildObjectif>>

function FitnessAgeCard({ fitAge, age }: { fitAge: number; age: number | null }) {
  let sub = 'Votre VO2max traduit en âge physiologique.'
  if (age !== null) {
    const d = age - fitAge
    if (d > 0) sub = `Soit ${d} an${d > 1 ? 's' : ''} de moins que votre âge réel (${age} ans) 🎉`
    else if (d < 0) sub = `Soit ${-d} an${-d > 1 ? 's' : ''} de plus que votre âge réel (${age} ans).`
    else sub = `Pile votre âge réel (${age} ans).`
  }
  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <p className="text-marine/50 text-xs uppercase tracking-wide font-medium mb-1">Âge en forme</p>
      <p className="text-marine font-bold text-4xl leading-none">
        {fitAge}
        <span className="text-lg font-semibold text-marine/45 ml-1.5">ans</span>
      </p>
      <p className="text-marine/55 text-sm mt-2">{sub}</p>
    </div>
  )
}

function ObjectifCard({ objectif, unit }: { objectif: ObjectifSummary; unit: 'kg' | 'lb' }) {
  const { goal, target, macros, weeks, goalDate, atGoal } = objectif
  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <p className="text-gold-dark text-xs uppercase tracking-wide font-semibold mb-1">Objectif</p>
      {atGoal ? (
        <p className="text-marine font-semibold text-base mt-1">
          Objectif de composition atteint — on maintient&nbsp;! 🎉
        </p>
      ) : (
        <>
          <p className="text-marine font-bold text-2xl leading-tight">
            {dualWeight(goal.toLoseKg, unit)}
            <span className="text-base font-medium text-marine/50"> à perdre</span>
          </p>
          <p className="text-marine/60 text-sm mt-1">
            Cible {target} % de gras · poids visé {dualWeight(goal.goalKg, unit)}
          </p>
          {weeks !== null && goalDate && (
            <p className="text-marine/50 text-sm mt-0.5">
              ≈ {Math.round(weeks)} semaines · échéance {goalDate}
            </p>
          )}
          {macros && (
            <div className="mt-3 pt-3 border-t border-cream-dark/40 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-marine/70">
                <b className="text-marine">{macros.targetKcal}</b> kcal
              </span>
              <span className="text-marine/70">
                <b className="text-marine">{macros.proteinG}</b> g prot
              </span>
              <span className="text-marine/70">
                <b className="text-marine">{macros.carbsG}</b> g gluc
              </span>
              <span className="text-marine/70">
                <b className="text-marine">{macros.fatG}</b> g lip
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
