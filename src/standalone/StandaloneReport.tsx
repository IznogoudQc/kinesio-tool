import { useEffect, useState } from 'react'
import { computeAge, type NormsType } from '../lib/norms'
import { computeBilan, type BilanProfile } from '../lib/bilan-computed'
import { buildPreviousSynthesisBilan, buildSynthesisBilan } from '../lib/synthesisBilan'
import { detectWins } from '../lib/dashboard-wins'
import { fitnessAge } from '../lib/fitness-age'
import { formatBilanDate } from '../pages/client/bilanFields'
import { ScoreDonut } from '../pages/client/dashboard/ScoreDonut'
import { CompositeMiniCard } from '../pages/client/dashboard/CompositeMiniCard'
import { StatCardXL } from '../pages/client/dashboard/StatCardXL'
import { ProgressionChart } from '../pages/client/dashboard/ProgressionChart'
import { MusculoRadar } from '../pages/client/dashboard/MusculoRadar'
import { TrainingZones } from '../pages/client/dashboard/TrainingZones'
import { BilanSelectorPills } from '../pages/client/dashboard/BilanSelectorPills'

/** Données injectées dans le fichier par le processus principal, à la génération.
 *  Volontairement dépourvues de tout élément privé : ni notes cliniques, ni
 *  conseils IA, ni signaux à surveiller (voir ADR 0019). */
export interface StandaloneData {
  client: {
    name: string
    sex: 'F' | 'M' | null
    birthdate: string | null
  }
  /** Photo du client en data URI, ou `null` — le fichier reste autonome. */
  avatarDataUrl: string | null
  bilans: Bilan[]
  norms: NormsType
  kinesiologist: string
  generatedAt: string
}

export function StandaloneReport({ data }: { data: StandaloneData }) {
  const { client, bilans, norms } = data
  const age = computeAge(client.birthdate)
  const profile: BilanProfile = { age, sex: client.sex, norms }

  // 'synthesis' = la valeur la plus récente de chaque champ, tous bilans confondus.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Bilan de référence des écarts ▲▼ — miroir du Dashboard de Marie-Eve.
  const [compareId, setCompareId] = useState<string>('prev')

  const synthesis = bilans.length > 0 ? buildSynthesisBilan(bilans) : null
  const previousSynthesis = bilans.length > 0 ? buildPreviousSynthesisBilan(bilans) : null
  const isSynthesis = selectedId === null

  useEffect(() => {
    setCompareId('prev')
  }, [selectedId])

  if (bilans.length === 0 || !synthesis) {
    return <p className="p-8 text-marine/50">Aucun bilan à afficher.</p>
  }

  const activeBilan: Bilan = isSynthesis
    ? {
        id: 'synthesis',
        clientId: '',
        date: synthesis.latestContributionDate ?? bilans[0].date,
        data: synthesis.data,
        source: 'manuel',
        createdAt: ''
      }
    : bilans.find(b => b.id === selectedId) ?? bilans[0]

  const previousBilan: Bilan | null = isSynthesis
    ? previousSynthesis
      ? { id: 'synthesis-previous', clientId: '', date: '', data: previousSynthesis.data, source: 'manuel', createdAt: '' }
      : null
    : (() => {
        const i = bilans.findIndex(b => b.id === activeBilan.id)
        return i >= 0 ? bilans[i + 1] ?? null : null
      })()

  const compareOptions = bilans
    .filter(b => b.id !== activeBilan.id && b.id !== previousBilan?.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))

  const compareBilan =
    compareId === 'none' ? null : compareId === 'prev' ? previousBilan : bilans.find(b => b.id === compareId) ?? null
  const compareData = compareBilan?.data
  const compareComputed = compareData ? computeBilan(compareData, profile) : undefined
  const compareLabel =
    compareBilan === null ? null : compareId === 'prev' ? 'bilan précédent' : `bilan du ${formatBilanDate(compareBilan.date)}`
  const compareShortLabel =
    compareBilan === null ? null : compareId === 'prev' ? 'Bilan précédent' : formatBilanDate(compareBilan.date)

  const activeData = activeBilan.data
  const computed = computeBilan(activeData, profile)
  const previousComputed = previousBilan ? computeBilan(previousBilan.data, profile) : undefined
  const fitAge = fitnessAge(computed.vo2max ?? (typeof activeData.vo2max === 'number' ? activeData.vo2max : null), client.sex)

  const wins = detectWins({
    computed,
    previous: previousComputed,
    bilans,
    currentData: activeData
  })

  const historyOf = (key: keyof BilanData): (number | null)[] =>
    [...bilans].reverse().map(b => {
      const v = b.data[key]
      return typeof v === 'number' && !Number.isNaN(v) ? v : null
    })

  const sexLabel = client.sex === 'F' ? 'Femme' : client.sex === 'M' ? 'Homme' : '—'

  return (
    <div className="min-h-full bg-cream">
      <div className="mx-auto max-w-7xl space-y-5 p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5">
            {data.avatarDataUrl && (
              <img
                src={data.avatarDataUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full object-cover shadow-sm"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight text-marine">{client.name}</h1>
              <p className="mt-0.5 text-sm text-marine/55">
                {age !== null ? `${age} ans` : 'âge ?'} · {sexLabel}
              </p>
              <p className="mt-1 text-xs text-marine/45">
                Bilan de forme physique · {bilans.length} bilan{bilans.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-marine/45">
            <p className="font-semibold text-marine/70">{data.kinesiologist}</p>
            <p>Document généré le {new Date(data.generatedAt).toLocaleDateString('fr-CA')}</p>
          </div>
        </header>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <BilanSelectorPills
              bilans={bilans}
              selectedId={isSynthesis ? null : activeBilan.id}
              onSelect={setSelectedId}
              synthesisLatestDate={synthesis.latestContributionDate}
            />
          </div>
          {(previousBilan !== null || compareOptions.length > 0) && (
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-marine/55">
              <span>Comparer à</span>
              <select
                value={compareId}
                onChange={e => setCompareId(e.target.value)}
                className="rounded-md border border-cream-dark bg-cream/60 px-2 py-1 text-xs font-medium text-marine hover:bg-cream-dark focus:outline-none focus:ring-2 focus:ring-gold/50"
              >
                {previousBilan !== null && <option value="prev">Bilan précédent</option>}
                {compareOptions.map(b => (
                  <option key={b.id} value={b.id}>
                    {formatBilanDate(b.date)}
                  </option>
                ))}
                <option value="none">Aucune comparaison</option>
              </select>
            </label>
          )}
        </div>

        {wins.length > 0 && (
          <section className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-50 to-gold/10 p-5 shadow-sm">
            <h3 className="mb-2.5 text-base font-bold text-marine">🎉 Belle progression !</h3>
            <ul className="space-y-1.5">
              {wins.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-marine/85">
                  <span aria-hidden="true">{w.icon}</span>
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-cream-dark/30 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            <div className="flex justify-center lg:col-span-4">
              <ScoreDonut
                score={computed.overall.score}
                category={computed.overall.category}
                previousScore={compareComputed?.overall.score ?? null}
                label="Santé et condition physique globale"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:col-span-8">
              <CompositeMiniCard title="Composition" subtitle="IMC + %gras + taille" current={computed.composition} previous={compareComputed?.composition} />
              <CompositeMiniCard title="% gras corporel" current={computed.bodyFat} previous={compareComputed?.bodyFat} />
              <CompositeMiniCard title="Aérobie" subtitle="VO2max" current={computed.aerobic} previous={compareComputed?.aerobic} />
              <CompositeMiniCard title="Indice du dos" subtitle="Flex + endur + situps" current={computed.backHealth} previous={compareComputed?.backHealth} />
              <CompositeMiniCard title="Musculo global" subtitle="6 tests" current={computed.musculoGlobal} previous={compareComputed?.musculoGlobal} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCardXL label="VO2max" value={activeData.vo2max} unit="ml/kg/min" test="vo2max" age={age} sex={client.sex} norms={norms} previousValue={compareData?.vo2max} compareLabel={compareLabel} history={historyOf('vo2max')} />
          <StatCardXL label="IMC" value={activeData.imc} unit="kg/m²" test="bmi" age={age} sex={client.sex} norms={norms} previousValue={compareData?.imc} lowerIsBetter compareLabel={compareLabel} history={historyOf('imc')} />
          <StatCardXL label="% de gras" value={activeData.pourcentage_gras} unit="%" test="bodyFat" age={age} sex={client.sex} norms={norms} previousValue={compareData?.pourcentage_gras} lowerIsBetter compareLabel={compareLabel} history={historyOf('pourcentage_gras')} />
          <StatCardXL label="Tour de taille" value={activeData.tour_taille_cm} unit="cm" test="waistCircumference" age={age} sex={client.sex} norms={norms} previousValue={compareData?.tour_taille_cm} lowerIsBetter compareLabel={compareLabel} history={historyOf('tour_taille_cm')} />
        </section>

        {fitAge !== null && (
          <section className="rounded-xl border border-cream-dark/30 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-marine/50">Âge en forme</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-marine">{fitAge} ans</p>
            <p className="mt-1 text-sm text-marine/55">
              {age !== null && fitAge < age
                ? `Votre capacité aérobie correspond à celle d'une personne de ${fitAge} ans — ${age - fitAge} an${age - fitAge > 1 ? 's' : ''} de moins que votre âge réel.`
                : 'Estimé à partir de votre VO2max.'}
            </p>
          </section>
        )}

        {bilans.length >= 2 && (
          <ProgressionChart
            bilans={bilans}
            profile={profile}
            activeBilanId={activeBilan.id}
            compareBilan={compareBilan}
            compareLabel={compareShortLabel}
          />
        )}

        <MusculoRadar current={activeData} compare={compareData} compareLabel={compareLabel} age={age} sex={client.sex} norms={norms} />

        <TrainingZones fcMax={computed.fcMaxPredite} fcZones={computed.fcZones} />

        <footer className="pt-2 text-center text-xs text-marine/40">
          <p>
            Document interactif — fonctionne hors ligne, aucune donnée n’est transmise. Préparé par {data.kinesiologist}.
          </p>
        </footer>
      </div>
    </div>
  )
}
