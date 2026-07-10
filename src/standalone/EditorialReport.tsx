import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CATEGORY_LABELS,
  computeAge,
  getCategorization,
  getPercentile,
  type Category,
  type NormsType,
  type TestKey
} from '../lib/norms'
import { computeBilan, type BilanComputed, type BilanProfile, type CompositeScore } from '../lib/bilan-computed'
import { buildPreviousSynthesisBilan, buildSynthesisBilan } from '../lib/synthesisBilan'
import { detectWins } from '../lib/dashboard-wins'
import { fitnessAge } from '../lib/fitness-age'
import { useCountUp } from '../lib/useCountUp'
import { formatBilanDate } from '../pages/client/bilanFields'
import { DeltaIndicator } from '../components/DeltaIndicator'
import { Sparkline } from '../components/Sparkline'
import { ProgressionChart } from '../pages/client/dashboard/ProgressionChart'
import { MusculoRadar } from '../pages/client/dashboard/MusculoRadar'
import { TrainingZones } from '../pages/client/dashboard/TrainingZones'
import { BilanSelectorPills } from '../pages/client/dashboard/BilanSelectorPills'

/** Données injectées par le processus principal. Volontairement dépourvues de
 *  tout élément privé : ni notes cliniques, ni conseils IA, ni signaux
 *  cliniques à surveiller (voir ADR 0019). */
export interface StandaloneData {
  client: { name: string; sex: 'F' | 'M' | null; birthdate: string | null }
  /** Photo du client en data URI, ou `null` — le fichier reste autonome. */
  avatarDataUrl: string | null
  bilans: Bilan[]
  norms: NormsType
  kinesiologist: string
  generatedAt: string
}

// ── Petits blocs de mise en page ─────────────────────────────────────────────

/** Fait apparaître son contenu quand il entre à l'écran. Inerte si l'utilisateur
 *  a désactivé les animations (la classe CSS neutralise la transition). */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true)
            io.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`ed-reveal${visible ? ' is-visible' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function Section({
  eyebrow,
  title,
  lead,
  tone = 'paper',
  children
}: {
  eyebrow: string
  title: string
  lead?: string
  tone?: 'paper' | 'white'
  children: ReactNode
}) {
  return (
    <section className={tone === 'white' ? 'bg-white' : 'bg-cream'}>
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-24">
        <Reveal>
          <p className="ed-eyebrow text-gold-dark">{eyebrow}</p>
          <h2 className="ed-display ed-section-title mt-3 text-marine">{title}</h2>
          {lead && <p className="ed-prose mt-4 text-base text-marine/65 sm:text-lg">{lead}</p>}
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-10">{children}</div>
        </Reveal>
      </div>
    </section>
  )
}

// ── Une mesure, en grand ─────────────────────────────────────────────────────

function Measure({
  label,
  value,
  unit,
  test,
  age,
  sex,
  norms,
  previousValue,
  lowerIsBetter = false,
  history
}: {
  label: string
  value: number | undefined
  unit: string
  test: TestKey
  age: number | null
  sex: 'F' | 'M' | null
  norms: NormsType
  previousValue?: number
  lowerIsBetter?: boolean
  history: (number | null)[]
}) {
  const has = typeof value === 'number' && !Number.isNaN(value)
  const anim = useCountUp(has ? (value as number) : null)
  const shown = has ? (anim ?? (value as number)) : null

  const percentile = has && age !== null && sex ? getPercentile(test, value as number, age, sex, norms) : null
  const category: Category | null = has && age !== null && sex ? getCategorization(test, value as number, age, sex, norms) : null

  return (
    <div className="border-t border-marine/10 py-6">
      <p className="ed-eyebrow text-marine/40">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="ed-display text-5xl tabular-nums text-marine sm:text-6xl">
          {shown === null ? '—' : shown.toLocaleString('fr-CA', { maximumFractionDigits: 1 })}
        </span>
        {has && <span className="text-base text-marine/45">{unit}</span>}
        {typeof previousValue === 'number' && has && (
          <span className="ml-auto">
            <DeltaIndicator current={value as number} previous={previousValue} unit={unit} lowerIsBetter={lowerIsBetter} size="sm" />
          </span>
        )}
      </div>

      {history.filter(v => v !== null).length >= 2 && (
        <div className="mt-3 max-w-xs">
          <Sparkline values={history} lowerIsBetter={lowerIsBetter} />
        </div>
      )}

      {category && percentile !== null && (
        <p className="mt-3 text-sm text-marine/55">
          <span className="font-semibold text-marine">{CATEGORY_LABELS[category]}</span> — mieux que{' '}
          {Math.round(percentile)} % des personnes de votre âge et de votre sexe.
        </p>
      )}
    </div>
  )
}

// ── Textes d'interprétation, en français simple ──────────────────────────────

const DOMAIN_ADVICE: Record<Category, string> = {
  EXCELLENT: 'C’est excellent. L’objectif devient de maintenir ce niveau.',
  TRES_BIEN: 'C’est très bien. Vous êtes au-dessus de la moyenne de votre groupe d’âge.',
  BIEN: 'C’est bien. Il reste une marge de progression confortable.',
  ACCEPTABLE: 'C’est acceptable. C’est un bon endroit où concentrer vos efforts.',
  A_AMELIORER: 'C’est le domaine à travailler en priorité — et donc celui qui progressera le plus vite.'
}

function CompositeRow({ label, subtitle, score }: { label: string; subtitle: string; score: CompositeScore }) {
  const anim = useCountUp(score.score)
  const shown = anim ?? score.score

  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-marine/10 py-5">
      <div className="min-w-0">
        <p className="ed-display text-xl text-marine sm:text-2xl">{label}</p>
        <p className="mt-0.5 text-xs text-marine/40">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="ed-display text-3xl tabular-nums text-marine sm:text-4xl">
          {shown === null ? '—' : shown.toFixed(1)}
          <span className="text-base text-marine/35"> / 5</span>
        </p>
        {score.category && <p className="mt-0.5 text-sm text-marine/55">{CATEGORY_LABELS[score.category]}</p>}
      </div>
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────

/** Le titre s'adapte à ce que disent les données. Jamais de reproche : un client
 *  qui a régressé est invité à faire le point, pas sermonné. */
function headlineFor(firstName: string, computed: BilanComputed, previous?: BilanComputed): string {
  const now = computed.overall.score
  const before = previous?.overall.score
  if (now === null || before === null || before === undefined) return `${firstName}, voici où vous en êtes.`
  const delta = now - before
  if (delta >= 0.1) return `${firstName}, vous avez progressé.`
  if (delta <= -0.1) return `${firstName}, faisons le point.`
  return `${firstName}, vous tenez le cap.`
}

function Hero({
  data,
  computed,
  previous,
  fitAge,
  age
}: {
  data: StandaloneData
  computed: BilanComputed
  previous?: BilanComputed
  fitAge: number | null
  age: number | null
}) {
  const firstName = data.client.name.trim().split(/\s+/)[0]
  const score = computed.overall.score
  const anim = useCountUp(score, 1100)
  const shown = anim ?? score

  const subline =
    fitAge !== null && age !== null && fitAge < age
      ? `Votre capacité aérobie est celle d’une personne de ${fitAge} ans — ${age - fitAge} an${age - fitAge > 1 ? 's' : ''} de moins que votre âge réel.`
      : computed.overall.category
        ? `Votre condition physique globale est jugée « ${CATEGORY_LABELS[computed.overall.category].toLowerCase()} » pour votre âge et votre sexe.`
        : 'Voici la synthèse de vos mesures.'

  return (
    <header className="ed-hero relative flex min-h-[100svh] flex-col justify-between bg-marine px-6 py-10 text-cream sm:px-10">
      <div className="flex items-center justify-between gap-4">
        <p className="ed-eyebrow text-gold">{data.kinesiologist} · Kinésiologue</p>
        {data.avatarDataUrl && (
          <img src={data.avatarDataUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/40" />
        )}
      </div>

      <div className="mx-auto w-full max-w-4xl py-12">
        <h1 className="ed-display ed-headline text-cream">{headlineFor(firstName, computed, previous)}</h1>

        <div className="mt-12 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="flex items-end gap-3">
            <span className="ed-score text-gold">{shown === null ? '—' : shown.toFixed(1)}</span>
            <span className="pb-3 text-lg text-cream/50">sur 5</span>
          </div>
          {previous?.overall.score != null && score !== null && (
            <div className="pb-3">
              <p className="ed-eyebrow text-cream/40">Depuis le bilan précédent</p>
              <p className="mt-1">
                <DeltaIndicator current={score} previous={previous.overall.score} size="sm" />
              </p>
            </div>
          )}
        </div>

        <p className="ed-prose mt-10 text-lg text-cream/75 sm:text-xl">{subline}</p>
      </div>

      <div className="ed-no-print flex items-center justify-center">
        <div className="ed-nudge flex flex-col items-center gap-2 text-cream/50">
          <span className="ed-eyebrow">Faites défiler</span>
          <svg width="18" height="24" viewBox="0 0 18 24" fill="none" aria-hidden="true">
            <path d="M9 2v18m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </header>
  )
}

// ── Document ─────────────────────────────────────────────────────────────────

export function EditorialReport({ data }: { data: StandaloneData }) {
  const { client, bilans, norms } = data
  const age = computeAge(client.birthdate)
  const profile: BilanProfile = { age, sex: client.sex, norms }

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compareId, setCompareId] = useState<string>('prev')

  const synthesis = bilans.length > 0 ? buildSynthesisBilan(bilans) : null
  const previousSynthesis = bilans.length > 0 ? buildPreviousSynthesisBilan(bilans) : null
  const isSynthesis = selectedId === null

  useEffect(() => {
    setCompareId('prev')
  }, [selectedId])

  if (bilans.length === 0 || !synthesis) {
    return <p className="p-10 text-marine/50">Aucun bilan à afficher.</p>
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

  const wins = detectWins({ computed, previous: previousComputed, bilans, currentData: activeData })

  const historyOf = (key: keyof BilanData): (number | null)[] =>
    [...bilans].reverse().map(b => {
      const v = b.data[key]
      return typeof v === 'number' && !Number.isNaN(v) ? v : null
    })

  const measureProps = { age, sex: client.sex, norms }

  return (
    /* `overflow-x-hidden` : rien ne doit faire défiler la page latéralement sur
       un téléphone — ni la frise, ni une étiquette de graphique. */
    <div className="overflow-x-hidden bg-cream text-marine">
      <Hero data={data} computed={computed} previous={compareComputed} fitAge={fitAge} age={age} />

      {/* Choix du bilan affiché — discret, mais c'est le cœur de l'interactivité. */}
      <div className="ed-no-print border-b border-marine/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-4 px-6 py-5 sm:px-8">
          {/* La frise défile d'elle-même plutôt que d'élargir la page. */}
          <div className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1 pb-1">
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
      </div>

      {wins.length > 0 && (
        <section className="bg-marine-light/95 text-cream">
          <div className="mx-auto max-w-5xl px-6 py-14 sm:px-8">
            <Reveal>
              <p className="ed-eyebrow text-gold">Ce qui a changé</p>
              <h2 className="ed-display ed-section-title mt-3">Vos victoires depuis le dernier bilan</h2>
              <ul className="mt-8 space-y-4">
                {/* Pas d'emoji ici : sur fond marine, ils s'affichent en carrés bleus.
                    Une puce dorée dit la même chose, plus proprement. */}
                {wins.map((w, i) => (
                  <li key={i} className="flex items-start gap-4 border-t border-cream/15 pt-4 text-base sm:text-lg">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span className="text-cream/85">{w.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      )}

      <Section
        eyebrow="Vue d’ensemble"
        title="Cinq façons de lire votre condition physique"
        lead="Chaque domaine est noté sur 5, en comparant vos résultats à ceux des personnes de votre âge et de votre sexe. Le score global en est la moyenne."
        tone="white"
      >
        <div>
          <CompositeRow label="Composition corporelle" subtitle="IMC, % de gras, tour de taille" score={computed.composition} />
          <CompositeRow label="Pourcentage de gras" subtitle="Mesuré aux plis cutanés" score={computed.bodyFat} />
          <CompositeRow label="Cœur et endurance" subtitle="VO2max" score={computed.aerobic} />
          <CompositeRow label="Santé du dos" subtitle="Flexibilité, endurance, abdominaux" score={computed.backHealth} />
          <CompositeRow label="Force musculaire" subtitle="Six tests" score={computed.musculoGlobal} />
        </div>
        {computed.overall.category && (
          <p className="ed-prose mt-8 text-base text-marine/65">{DOMAIN_ADVICE[computed.overall.category]}</p>
        )}
      </Section>

      <Section
        eyebrow="Composition corporelle"
        title="Ce que raconte votre silhouette"
        lead="L’IMC seul dit peu de choses : un athlète musclé et une personne sédentaire peuvent avoir le même. C’est en le lisant avec le pourcentage de gras et le tour de taille qu’il prend son sens."
      >
        <Measure label="Indice de masse corporelle" value={activeData.imc} unit="kg/m²" test="bmi" {...measureProps} previousValue={compareData?.imc} lowerIsBetter history={historyOf('imc')} />
        <Measure label="Pourcentage de gras" value={activeData.pourcentage_gras} unit="%" test="bodyFat" {...measureProps} previousValue={compareData?.pourcentage_gras} lowerIsBetter history={historyOf('pourcentage_gras')} />
        <Measure label="Tour de taille" value={activeData.tour_taille_cm} unit="cm" test="waistCircumference" {...measureProps} previousValue={compareData?.tour_taille_cm} lowerIsBetter history={historyOf('tour_taille_cm')} />
      </Section>

      <Section
        eyebrow="Cœur et endurance"
        title="La mesure qui prédit le mieux votre santé"
        lead="Le VO2max est le volume d’oxygène que votre corps sait utiliser à l’effort maximal. C’est le meilleur indicateur unique de longévité en bonne santé — et il répond vite à l’entraînement."
        tone="white"
      >
        <Measure label="VO2max" value={activeData.vo2max} unit="ml/kg/min" test="vo2max" {...measureProps} previousValue={compareData?.vo2max} history={historyOf('vo2max')} />

        {fitAge !== null && (
          <div className="mt-10 border-l-2 border-gold pl-6">
            <p className="ed-eyebrow text-marine/40">Votre âge en forme</p>
            <p className="ed-display mt-2 text-5xl tabular-nums text-marine">{fitAge} ans</p>
            <p className="ed-prose mt-3 text-base text-marine/65">
              {age !== null && fitAge < age
                ? `Sur le plan cardiorespiratoire, votre corps se comporte comme celui d’une personne de ${fitAge} ans. C’est ${age - fitAge} an${age - fitAge > 1 ? 's' : ''} de moins que votre âge réel.`
                : `Estimation obtenue en comparant votre VO2max à la valeur médiane de chaque âge.`}
            </p>
          </div>
        )}

        <div className="mt-12">
          <TrainingZones fcMax={computed.fcMaxPredite} fcZones={computed.fcZones} />
        </div>
      </Section>

      <Section
        eyebrow="Force et mobilité"
        title="Six tests, six angles"
        lead="Chaque barre situe votre résultat parmi les personnes de votre âge et de votre sexe. Basculez en vue radar pour voir la forme d’ensemble de votre profil."
      >
        <MusculoRadar current={activeData} compare={compareData} compareLabel={compareLabel} age={age} sex={client.sex} norms={norms} />
      </Section>

      {bilans.length >= 2 && (
        <Section
          eyebrow="Dans le temps"
          title="Le chemin parcouru"
          lead="Choisissez la mesure qui vous intéresse. La ligne grise, quand elle apparaît, est la moyenne des personnes de votre âge et de votre sexe."
          tone="white"
        >
          <ProgressionChart
            bilans={bilans}
            profile={profile}
            activeBilanId={activeBilan.id}
            compareBilan={compareBilan}
            compareLabel={compareShortLabel}
          />
        </Section>
      )}

      <footer className="bg-marine px-6 py-16 text-cream sm:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="ed-eyebrow text-gold">Préparé pour vous par</p>
          <p className="ed-display mt-3 text-3xl">{data.kinesiologist}</p>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-cream/50">
            Document généré le {new Date(data.generatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}.
            Il fonctionne hors ligne et aucune de vos données n’est transmise à qui que ce soit — tout est contenu dans ce
            fichier. Ces résultats ne remplacent pas un avis médical.
          </p>
        </div>
      </footer>
    </div>
  )
}
