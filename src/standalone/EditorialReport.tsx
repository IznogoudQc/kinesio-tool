import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CATEGORY_LABELS,
  computeAge,
  getCategorization,
  getNextCategoryTarget,
  type Category,
  type NormsType,
  type TestKey
} from '../lib/norms'
import { computeBilan, type BilanComputed, type BilanProfile, type CompositeScore } from '../lib/bilan-computed'
import { buildPreviousSynthesisBilan, buildSynthesisBilan } from '../lib/synthesisBilan'
import { detectWins } from '../lib/dashboard-wins'
import { fitnessAge } from '../lib/fitness-age'
import { buildActionPlan } from '../lib/action-plan'
import { buildObjectif, type Objectif } from '../lib/objectif'
import { dualRate, dualWeight, formatWeeks } from '../lib/objectif-format'
import { ACTIVITY_LABELS, DEFAULT_MEALS_PER_DAY, macrosPerMeal } from '../lib/nutrition'
import {
  parseSuppPlan,
  parseMenuPlan,
  suppPlanHasSchedule,
  SUPP_MOMENTS,
  SUPP_MENTION,
  MENU_MENTION,
  type SuppMomentKey
} from '../lib/nutrition-plan'
import { Sunrise, Coffee, Dumbbell, UtensilsCrossed, Moon, Info, type LucideIcon } from 'lucide-react'
import { useCountUp } from '../lib/useCountUp'
import { formatBilanDate } from '../pages/client/bilanFields'
import { DeltaIndicator } from '../components/DeltaIndicator'
import { Sparkline } from '../components/Sparkline'
import { BodyFatRiskBar } from '../components/BodyFatRiskBar'
import { bodyFatTargetWeights } from '../lib/body-fat-risk'
import { BloodPressureBar } from '../components/BloodPressureBar'
import { classifyBloodPressure } from '../lib/norms/clinical'
import { kgToLb } from '../lib/units'
import { ProgressionChart } from '../pages/client/dashboard/ProgressionChart'
import { MusculoRadar } from '../pages/client/dashboard/MusculoRadar'
import { TrainingZones } from '../pages/client/dashboard/TrainingZones'
import { BilanSelectorPills } from '../pages/client/dashboard/BilanSelectorPills'
import { principesFor, principesCountWord } from '../lib/principes'
import { dailyWindows, describeProgram, fastingDaysInRange, toISO as fastingToISO, type FastingProgram } from '../lib/fasting-planning'
import { FastingCalendar } from '../components/FastingCalendar'
import forestUrl from '../assets/forest.jpg'
import logoConseil from '../assets/logo-conseil.png'

/** Données injectées par le processus principal. Volontairement dépourvues de
 *  tout élément privé : ni notes cliniques, ni conseils IA, ni signaux
 *  cliniques à surveiller (voir ADR 0019). */
export interface StandaloneData {
  /** Type de document rendu par le gabarit autonome. `'report'` (défaut) = bilan
   *  interactif ; `'nutrition'` = document nutrition & jeûne ; `'foodlog'` = journal
   *  alimentaire vierge imprimable. */
  docType?: 'report' | 'nutrition' | 'foodlog'
  client: {
    name: string
    sex: 'F' | 'M' | null
    birthdate: string | null
    unitWeight: 'kg' | 'lb'
    nutritionEnabled: boolean
    nutritionTargetBodyFat: number | null
    nutritionActivityLevel: 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif' | null
    nutritionRateKgPerWeek: number | null
    nutritionProteinPerLbLean: number | null
    nutritionFatMaxG: number | null
    nutritionTargetKcal: number | null
    nutritionMacroManual: boolean
    nutritionManualProteinG: number | null
    nutritionManualFatG: number | null
    nutritionManualCarbG: number | null
    nutritionRepasParJour: number | null
    principePersoTitre: string | null
    principePersoTexte: string | null
    jeuneType: '16:8' | '18:6' | '20:4' | 'omad' | '5:2' | null
    jeuneFenetreDebut: string | null
    jeuneFenetreFin: string | null
    jeuneNotes: string | null
    jeunePlanning: FastingProgram[] | null
    hydratationMlParJour: number | null
    supplementsNotes: string | null
    alimentsPrivilegier: string | null
    alimentsEviter: string | null
    nutritionMot: string | null
    nutritionMenu: string | null
  }
  /** Photo du client en data URI, ou `null` — le fichier reste autonome. */
  avatarDataUrl: string | null
  bilans: Bilan[]
  norms: NormsType
  kinesiologist: string
  /** Bloc de signature du PDF (« Marie-Eve Riendeau 
 Kinésiologue »). */
  signature: string
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

/** Note d'un domaine (X.X / 5 + catégorie colorée). `big` pour l'en-tête solo. */
function ScoreValue({ score, big = false }: { score: CompositeScore; big?: boolean }) {
  const anim = useCountUp(score.score)
  const shown = anim ?? score.score
  return (
    <div>
      <p className={`ed-display tabular-nums text-marine sm:text-right ${big ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>
        {shown === null ? '—' : shown.toFixed(1)}
        <span className="text-base text-marine/35"> / 5</span>
      </p>
      {score.category && (
        <p className="mt-1 flex items-center gap-2 text-sm font-semibold sm:justify-end" style={{ color: CAT_HEX[score.category] }}>
          <span
            aria-hidden="true"
            className="h-1.5 w-10 rounded-full"
            style={{ background: `linear-gradient(90deg, ${CAT_HEX[score.category]}1f, ${CAT_HEX[score.category]})` }}
          />
          {CATEGORY_LABELS[score.category]}
        </p>
      )}
    </div>
  )
}

/** Badge de note(s) pour l'en-tête d'une section. 1 domaine = grande note ; 2 =
 *  deux notes compactes étiquetées (ex. section « Force et mobilité »). */
function ScoreBadge({ items }: { items: { label?: string; score: CompositeScore }[] }) {
  if (items.length === 1) return <ScoreValue score={items[0].score} big />
  return (
    <div className="flex flex-row gap-8 sm:flex-col sm:items-end sm:gap-4">
      {items.map((it, i) => (
        <div key={i}>
          {it.label && <p className="ed-eyebrow text-marine/40 sm:text-right">{it.label}</p>}
          <div className="mt-1">
            <ScoreValue score={it.score} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Section({
  eyebrow,
  title,
  lead,
  tone = 'paper',
  id,
  scores,
  backTop = false,
  children
}: {
  eyebrow: string
  title: string
  lead?: string
  tone?: 'paper' | 'white'
  id?: string
  scores?: { label?: string; score: CompositeScore }[]
  /** Ajoute un lien « Retour à la vue d'ensemble » en bas de la section. */
  backTop?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} className={`ed-anchor ${tone === 'white' ? 'bg-white' : 'bg-cream'}`}>
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-24">
        <Reveal>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <div className="min-w-0">
              <p className="ed-eyebrow text-gold-dark">{eyebrow}</p>
              <h2 className="ed-display ed-section-title mt-3 text-marine">{title}</h2>
            </div>
            {scores && scores.length > 0 && <div className="shrink-0">{<ScoreBadge items={scores} />}</div>}
          </div>
          {lead && <p className="ed-prose mt-4 text-base text-marine/65 sm:text-lg">{lead}</p>}
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-10">{children}</div>
        </Reveal>
        {backTop && (
          <div className="ed-no-print mt-14 border-t border-marine/10 pt-6 text-center">
            <a
              href="#vue-ensemble"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-dark transition-colors hover:text-marine"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 15-6-6-6 6" />
              </svg>
              Retour à la vue d’ensemble
            </a>
          </div>
        )}
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
  history,
  weightKg,
  id
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
  /** Poids du bilan (kg) — sert au « poids optimal » du % de gras. */
  weightKg?: number | null
  /** Ancre pour la navigation depuis la vue d'ensemble. */
  id?: string
}) {
  const has = typeof value === 'number' && !Number.isNaN(value)
  const anim = useCountUp(has ? (value as number) : null)
  const shown = has ? (anim ?? (value as number)) : null

  // Le % de gras n'affiche QUE la grille de risque de Marie (pas le percentile
  // ACSM ni la catégorie) — décision « A ». L'ACSM reste utilisé en coulisse
  // pour le score de composition corporelle.
  const useAcsm = has && age !== null && sex && test !== 'bodyFat'
  const category: Category | null = useAcsm ? getCategorization(test, value as number, age as number, sex as 'F' | 'M', norms) : null
  // « +4 ml/kg/min pour atteindre Excellent » — la cible devient concrète.
  const next = useAcsm ? getNextCategoryTarget(test, value as number, age as number, sex as 'F' | 'M', norms) : null
  // Poids-repères (optimal + santé max) — % de gras uniquement.
  const targetW = test === 'bodyFat' && has ? bodyFatTargetWeights(value as number, weightKg ?? null, sex) : null

  return (
    <div id={id} className="ed-anchor border-t border-marine/10 py-6">
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

      {category && <CategoryCue category={category} />}

      {next && (
        <p className="mt-2 text-sm text-marine/70">
          {next.isAtTop ? (
            <span className="font-semibold text-gold-dark">Niveau maximal atteint — l’objectif devient de le maintenir.</span>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-marine">
                {next.delta >= 0 ? '+' : ''}
                {next.delta.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} {unit}
              </span>{' '}
              pour atteindre « {CATEGORY_LABELS[next.nextCategory]} ».
            </>
          )}
        </p>
      )}

      {/* Grille de risque de Marie + poids optimal — uniquement pour le % de gras. */}
      {test === 'bodyFat' && has && (
        <div className="mt-5 space-y-3 border-t border-marine/10 pt-4">
          <BodyFatRiskBar pct={value} sex={sex} />
          {targetW && (
            <div className="rounded-lg border border-marine/10 bg-marine/[0.03] px-4 py-3">
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <div>
                  <p className="ed-eyebrow text-marine/40">Poids optimal (≤ {targetW.optimal.targetBf} %)</p>
                  <p className="ed-display mt-0.5 text-2xl tabular-nums text-marine">{Math.round(kgToLb(targetW.optimal.targetKg))} lb</p>
                </div>
                <div>
                  <p className="ed-eyebrow text-marine/40">Poids santé max. (≤ {targetW.healthyMax.targetBf} %)</p>
                  <p className="ed-display mt-0.5 text-2xl tabular-nums text-marine">{Math.round(kgToLb(targetW.healthyMax.targetKg))} lb</p>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-marine/40">À masse maigre constante — repères indicatifs, pas des cibles de poids.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Statut : couleur + petit dégradé ─────────────────────────────────────────

// Couleur de chaque statut — reprend celles de l'app (rouge → vert foncé), en
// versions assez soutenues pour rester lisibles sur le fond crème.
const CAT_HEX: Record<Category, string> = {
  A_AMELIORER: '#dc2626',
  ACCEPTABLE: '#ea580c',
  BIEN: '#ca8a04',
  TRES_BIEN: '#16a34a',
  EXCELLENT: '#15803d'
}

/** Repère de statut : petit dégradé dans la couleur de la catégorie + libellé
 *  coloré. La couleur seule dit d'un coup d'œil où on se situe. */
function CategoryCue({ category }: { category: Category }) {
  const c = CAT_HEX[category]
  return (
    <div className="mt-3.5 flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="h-2 w-16 shrink-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${c}1f, ${c})` }}
      />
      <span className="text-sm font-semibold" style={{ color: c }}>
        {CATEGORY_LABELS[category]}
      </span>
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

function CompositeRow({ label, subtitle, score, href }: { label: string; subtitle: string; score: CompositeScore; href?: string }) {
  const anim = useCountUp(score.score)
  const shown = anim ?? score.score

  const inner = (
    <>
      <div className="min-w-0">
        <p className="ed-display flex items-center gap-2 text-xl text-marine sm:text-2xl">
          {label}
          {href && (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="ed-no-print h-4 w-4 shrink-0 text-marine/25 transition-transform duration-200 group-hover:translate-y-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
        </p>
        <p className="mt-0.5 text-xs text-marine/40">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="ed-display text-3xl tabular-nums text-marine sm:text-4xl">
          {shown === null ? '—' : shown.toFixed(1)}
          <span className="text-base text-marine/35"> / 5</span>
        </p>
        {score.category && (
          <p className="mt-1 flex items-center justify-end gap-2 text-sm font-semibold" style={{ color: CAT_HEX[score.category] }}>
            <span
              aria-hidden="true"
              className="h-1.5 w-10 rounded-full"
              style={{ background: `linear-gradient(90deg, ${CAT_HEX[score.category]}1f, ${CAT_HEX[score.category]})` }}
            />
            {CATEGORY_LABELS[score.category]}
          </p>
        )}
      </div>
    </>
  )

  const rowClass = 'flex items-baseline justify-between gap-4 border-t border-marine/10 py-5'
  return href ? (
    <a href={href} className={`group -mx-3 rounded-lg px-3 transition-colors hover:bg-marine/[0.035] ${rowClass}`}>
      {inner}
    </a>
  ) : (
    <div className={rowClass}>{inner}</div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────

// Photo de forêt du hero — clin d'œil à l'affiche et au site de la clinique.
// Vite l'inline en data URI au build (`assetsInlineLimit` très élevé dans
// vite.standalone.config.ts), donc le document reste autonome et hors ligne.
// Le cadrage (`cover`, position) est géré par `.ed-hero-forest` dans editorial.css.
const FOREST_BG = `url(${forestUrl})`

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
        : 'Voici le portrait de vos dernières mesures.'

  return (
    <header className="ed-hero relative flex min-h-[100svh] flex-col justify-between overflow-hidden bg-marine px-6 py-10 text-cream sm:px-10">
      {/* Forêt — clin d'œil à l'affiche et au site de la clinique. Couches
          décoratives derrière le contenu ; masquées à l'impression. */}
      <div className="ed-hero-forest ed-no-print" aria-hidden="true" style={{ backgroundImage: FOREST_BG }} />
      <div className="ed-hero-veil ed-no-print" aria-hidden="true" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        {/* Logo de la clinique — le blanc/or ne ressort que sur fond marine, donc
            masqué à l'impression (hero blanc). Le nom du praticien reste en pied. */}
        <img src={logoConseil} alt="Kinésio Conseil" className="ed-no-print h-14 w-auto sm:h-16" />
        {data.avatarDataUrl && (
          <img src={data.avatarDataUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/40" />
        )}
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl py-12">
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

      <div className="relative z-10 ed-no-print flex items-center justify-center">
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

// ── Nutrition & jeûne ────────────────────────────────────────────────────────

/** Liste à puces à partir d'un texte multi-lignes (une puce par ligne non vide). */
/** Icône par moment de prise, pour aérer et illustrer le document nutrition. */
const SUPP_ICONS: Record<SuppMomentKey, LucideIcon> = {
  reveil: Sunrise,
  dejeuner: Coffee,
  apresEntrainement: Dumbbell,
  souper: UtensilsCrossed,
  coucher: Moon
}

/** Lignes d'un champ texte, aérées, sans puce (l'icône du moment sert d'ancre). */
function EdLines({ text, className = 'text-marine/80' }: { text: string; className?: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) => (
        <p key={i} className={`text-[15px] leading-relaxed ${className}`}>
          {l}
        </p>
      ))}
    </div>
  )
}

function EdBullets({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) return <p className="ed-prose whitespace-pre-line text-base leading-relaxed text-marine/75">{text}</p>
  return (
    <ul className="space-y-2">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2.5 text-base text-marine/75">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          <span className="leading-relaxed">{l}</span>
        </li>
      ))}
    </ul>
  )
}

/** Découpe un texte de menu libre en journées. Une nouvelle journée démarre à un
 *  en-tête « Jour / Journée / Exemple N » (isolé, ou en début de ligne suivi de
 *  « — »). Les lignes sans en-tête (repas, total, mention finale) sont rattachées
 *  à la journée courante. Robuste aux menus générés par l'IA comme au texte saisi
 *  à la main ; sans en-tête détecté, tout reste dans une seule journée. */
function parseMenuDays(menu: string): { header: string | null; lines: string[] }[] {
  const dayRe = /^((?:jours?|journ[ée]es?|exemples?)\s*n?[°o]?\s*\d+)\s*[:—–-]?\s*(.*)$/i
  const days: { header: string | null; lines: string[] }[] = []
  let cur: { header: string | null; lines: string[] } | null = null
  for (const raw of menu.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = dayRe.exec(line)
    if (m) {
      cur = { header: m[1], lines: m[2] ? [m[2]] : [] }
      days.push(cur)
    } else {
      if (!cur) {
        cur = { header: null, lines: [] }
        days.push(cur)
      }
      cur.lines.push(line)
    }
  }
  return days.length ? days : [{ header: null, lines: [menu.trim()] }]
}

/** Choisit jusqu'à `max` mois (à partir de `startY/startM0`) contenant au moins une
 *  occurrence de jeûne ; sinon au moins le mois de départ. */
function monthsWithFasts(
  programs: FastingProgram[],
  startY: number,
  startM0: number,
  lookahead = 6,
  max = 3
): { y: number; m: number }[] {
  const nonDaily = programs.filter(p => p.freq !== 'daily')
  const out: { y: number; m: number }[] = []
  for (let i = 0; i < lookahead && out.length < max; i++) {
    const abs = startM0 + i
    const y = startY + Math.floor(abs / 12)
    const m = ((abs % 12) + 12) % 12
    const from = fastingToISO(new Date(Date.UTC(y, m, 1)))
    const to = fastingToISO(new Date(Date.UTC(y, m + 1, 0)))
    if (Object.keys(fastingDaysInRange(nonDaily, from, to)).length > 0) out.push({ y, m })
  }
  if (out.length === 0) out.push({ y: startY, m: startM0 })
  return out
}

/** Bloc jeûne du document : fenêtres quotidiennes + calendrier + liste des programmes. */
function NutritionFastingBlock({ programs, generatedAt }: { programs: FastingProgram[]; generatedAt: string }) {
  const daily = dailyWindows(programs)
  const nonDaily = programs.filter(p => p.freq !== 'daily')
  const start = new Date(generatedAt)
  const months = nonDaily.length > 0 ? monthsWithFasts(programs, start.getUTCFullYear(), start.getUTCMonth()) : []

  return (
    <div className="mb-6 rounded-xl border border-marine/10 p-6">
      <p className="ed-eyebrow text-gold-dark">Jeûne</p>

      {daily.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {daily.map(p => (
            <span key={p.id} className="rounded-full bg-gold/15 px-3 py-1 text-sm text-marine">
              {p.label || 'Fenêtre'} · tous les jours
              {p.windowStart && p.windowEnd ? ` (${p.windowStart}–${p.windowEnd})` : ''}
            </span>
          ))}
        </div>
      )}

      {months.length > 0 && (
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {months.map(({ y, m }) => (
            <FastingCalendar key={`${y}-${m}`} programs={programs} year={y} month0={m} />
          ))}
        </div>
      )}

      {nonDaily.length > 0 && (
        <ul className="mt-5 space-y-2">
          {nonDaily.map(p => (
            <li key={p.id} className="flex items-start gap-2.5 text-base text-marine/75">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-sm bg-gold" />
              <span>
                <strong className="text-marine">{p.label || describeProgram(p)}</strong> — {describeProgram(p)}
                {p.notes ? ` · ${p.notes}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Repères de sécurité pour les jeûnes prolongés — affichés si le planning contient
 *  au moins un jeûne de 24 h ou plus. Contenu éducatif général (non prescriptif). */
function ProlongedFastingSafety({ programs }: { programs: FastingProgram[] }) {
  const hasLong = programs.some(p => p.kind === 'extended' && (p.durationHours ?? 0) >= 24)
  if (!hasLong) return null
  return (
    <div className="mt-6 rounded-xl border border-gold/40 bg-gold/5 p-6">
      <p className="ed-eyebrow text-gold-dark">Jeûne prolongé — repères de sécurité</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        <div>
          <p className="ed-display text-lg text-marine">Électrolytes</p>
          <p className="ed-prose mt-1 text-base leading-relaxed text-marine/70">
            Sur un jeûne long, l’eau seule ne suffit pas. Ajoutez du sel (sodium) et pensez au potassium et au
            magnésium pour éviter fatigue, maux de tête et crampes.
          </p>
        </div>
        <div>
          <p className="ed-display text-lg text-marine">Rompre le jeûne</p>
          <p className="ed-prose mt-1 text-base leading-relaxed text-marine/70">
            Reprenez en douceur : bouillon, puis petites portions d’aliments faciles à digérer (protéines, légumes
            cuits). Évitez un gros repas ou beaucoup de sucre d’un coup.
          </p>
        </div>
        <div>
          <p className="ed-display text-lg text-marine">À surveiller</p>
          <p className="ed-prose mt-1 text-base leading-relaxed text-marine/70">
            Étourdissements, palpitations, grande faiblesse ou confusion : rompez le jeûne et consultez. Écoutez
            votre corps.
          </p>
        </div>
      </div>
      <p className="ed-prose mt-5 text-sm text-marine/50">
        Repères généraux — ils ne remplacent pas un avis médical. Validez avec votre médecin, surtout en cas de
        condition de santé, de grossesse ou de médication.
      </p>
    </div>
  )
}

/** Corps de la section nutrition (cartes). `null` si aucune brique n'est remplie. */
function NutritionBody({ client, generatedAt }: { client: StandaloneData['client']; generatedAt: string }) {
  const programs = client.jeunePlanning ?? []
  const hasJeune = programs.length > 0
  const hydra = client.hydratationMlParJour
  const hasHydra = typeof hydra === 'number' && Number.isFinite(hydra) && hydra > 0
  const privil = (client.alimentsPrivilegier ?? '').trim()
  const eviter = (client.alimentsEviter ?? '').trim()
  const supp = (client.supplementsNotes ?? '').trim()
  const suppPlan = parseSuppPlan(client.supplementsNotes)
  const mot = (client.nutritionMot ?? '').trim()
  const menu = (client.nutritionMenu ?? '').trim()
  const menuPlan = parseMenuPlan(client.nutritionMenu)

  if (!hasJeune && !hasHydra && !privil && !eviter && !supp && !mot && !menu) return null

  const verres = hasHydra ? Math.round((hydra as number) / 250) : null

  return (
    <>
      {mot && (
        <div className="mb-10 rounded-xl bg-cream p-8 sm:p-10">
          <p className="ed-eyebrow text-gold-dark">Le mot de votre kinésiologue</p>
          <p className="ed-prose mt-4 whitespace-pre-line text-lg italic leading-relaxed text-marine">{mot}</p>
        </div>
      )}

      {hasJeune && <NutritionFastingBlock programs={programs} generatedAt={generatedAt} />}
      {hasJeune && <ProlongedFastingSafety programs={programs} />}

      {hasHydra && (
        <div className="mb-6 rounded-xl border border-marine/10 p-6">
          <p className="ed-eyebrow text-gold-dark">Hydratation</p>
          <p className="ed-display mt-3 text-4xl tabular-nums text-marine">
            {((hydra as number) / 1000).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} L
          </p>
          <p className="mt-1 text-base text-marine/60">
            {(hydra as number).toLocaleString('fr-CA')} ml par jour · environ {verres} verres de 250 ml
          </p>
        </div>
      )}

      {(privil || eviter) && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {privil && (
            <div className="rounded-xl border border-marine/10 p-6">
              <p className="ed-eyebrow text-gold-dark">À privilégier</p>
              <div className="mt-4">
                <EdBullets text={privil} />
              </div>
            </div>
          )}
          {eviter && (
            <div className="rounded-xl border border-marine/10 p-6">
              <p className="ed-eyebrow text-marine/40">À limiter</p>
              <div className="mt-4">
                <EdBullets text={eviter} />
              </div>
            </div>
          )}
        </div>
      )}

      {supp && (
        <div className="nut-supp mt-6 rounded-xl border border-marine/10 p-6 sm:p-8">
          <p className="ed-eyebrow text-gold-dark">Suppléments</p>
          {suppPlanHasSchedule(suppPlan) ? (
            <>
              <div className="mt-6 space-y-7">
                {SUPP_MOMENTS.filter((m) => suppPlan[m.key].trim()).map((m) => {
                  const Icon = SUPP_ICONS[m.key]
                  return (
                    <div key={m.key} className="flex gap-4">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-dark">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="ed-eyebrow text-gold-dark">{m.label}</p>
                        <div className="mt-2">
                          <EdLines text={suppPlan[m.key]} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {suppPlan.interactions.trim() && (
                /* Filet de séparation avant les consignes « À espacer / interactions ». */
                <div className="mt-7 flex gap-4 border-t border-marine/10 pt-7">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marine/5 text-marine/50">
                    <Info size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="ed-eyebrow text-marine/40">À espacer / interactions</p>
                    <div className="mt-2">
                      <EdLines text={suppPlan.interactions} className="text-marine/70" />
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-7 text-xs italic leading-relaxed text-marine/50">{SUPP_MENTION}</p>
            </>
          ) : (
            <div className="mt-4">
              <EdBullets text={suppPlan.input || supp} />
            </div>
          )}
        </div>
      )}

      {menu &&
        (() => {
          // Journées structurées (nouveau modèle) : une carte crème par journée,
          // libellé « Journée N » implicite, étiquette de repas en gras.
          const structured = menuPlan?.jours.filter((j) => j.trim()) ?? null
          if (structured && structured.length > 0) {
            return (
              <div className="mt-10">
                <p className="ed-eyebrow text-gold-dark">Idées de menu</p>
                <div className="mt-4 space-y-6">
                  {structured.map((jour, i) => (
                    <div
                      key={i}
                      className={`rounded-xl bg-cream p-8 sm:p-10${i > 0 ? ' nut-menu-day' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-dark">
                          <UtensilsCrossed size={20} />
                        </span>
                        <p className="ed-display text-2xl text-marine">Journée {i + 1}</p>
                      </div>
                      <div className="mt-5 space-y-3">
                        {jour
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean)
                          .map((line, j) => {
                            const m = /^([^:]{1,40}):\s*(.*)$/.exec(line)
                            return (
                              <p key={j} className="ed-prose text-[15px] leading-relaxed text-marine/75">
                                {m ? (
                                  <>
                                    <span className="font-semibold text-marine">{m[1]}</span> : {m[2]}
                                  </>
                                ) : (
                                  line
                                )}
                              </p>
                            )
                          })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs italic leading-relaxed text-marine/50">{MENU_MENTION}</p>
              </div>
            )
          }
          // Rétro-compatibilité : ancien texte libre → découpage heuristique par jour.
          const days = parseMenuDays(menu)
          return (
            <div className="mt-10">
              <p className="ed-eyebrow text-gold-dark">Idées de menu</p>
              <div className="mt-4 space-y-6">
                {days.map((day, i) => (
                  <div
                    key={i}
                    className={`rounded-xl bg-cream p-8 sm:p-10${i > 0 ? ' nut-menu-day' : ''}`}
                  >
                    {day.header && <p className="ed-display text-xl text-marine">{day.header}</p>}
                    <div className={day.header ? 'mt-3 space-y-2' : 'space-y-2'}>
                      {day.lines.map((line, j) => (
                        <p key={j} className="ed-prose text-base leading-relaxed text-marine/75">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
    </>
  )
}

/** Corps de la section « Votre objectif » — PARTAGÉ par le bilan et le document
 *  nutrition pour un rendu et un texte strictement identiques. Rendu à l'intérieur
 *  d'une `<Section eyebrow="Votre objectif" …>`. */
function ObjectifBody({
  objectif,
  objectifText,
  unitWeight,
  activityLevel,
  mealsPerDay
}: {
  objectif: Objectif | null
  objectifText: string
  unitWeight: 'kg' | 'lb'
  activityLevel: StandaloneData['client']['nutritionActivityLevel']
  /** Si fourni (> 1), affiche la répartition des macros par repas. */
  mealsPerDay?: number
}) {
  return (
    <>
      {objectifText !== '' && (
        <p className="ed-prose text-2xl italic leading-relaxed text-marine sm:text-3xl">«&nbsp;{objectifText}&nbsp;»</p>
      )}
      {objectif && (
        <div className={objectifText !== '' ? 'mt-10' : ''}>
          {!objectif.atGoal && (
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <p className="ed-eyebrow text-marine/40">Poids visé</p>
                <p className="ed-display mt-1 text-4xl tabular-nums text-marine">{dualWeight(objectif.goal.goalKg, unitWeight)}</p>
              </div>
              <div>
                <p className="ed-eyebrow text-marine/40">À perdre</p>
                <p className="ed-display mt-1 text-4xl tabular-nums text-marine">{dualWeight(objectif.goal.toLoseKg, unitWeight)}</p>
              </div>
              {objectif.rate !== null && (
                <div>
                  <p className="ed-eyebrow text-marine/40">Rythme visé</p>
                  <p className="ed-display mt-1 text-4xl tabular-nums text-marine">
                    {(unitWeight === 'lb' ? kgToLb(objectif.rate) : objectif.rate).toLocaleString('fr-CA', { maximumFractionDigits: 1 })}{' '}
                    {unitWeight === 'lb' ? 'lb' : 'kg'}
                    <span className="text-lg text-marine/40">
                      {' '}({(unitWeight === 'lb' ? objectif.rate : kgToLb(objectif.rate)).toLocaleString('fr-CA', { maximumFractionDigits: 1 })}{' '}
                      {unitWeight === 'lb' ? 'kg' : 'lb'}) / sem
                    </span>
                  </p>
                </div>
              )}
              {objectif.weeks !== null && (
                <div>
                  <p className="ed-eyebrow text-marine/40">Durée estimée</p>
                  <p className="ed-display mt-1 text-4xl tabular-nums text-marine">≈ {formatWeeks(objectif.weeks)} sem.</p>
                </div>
              )}
              {objectif.goalDate && (
                <div>
                  <p className="ed-eyebrow text-marine/40">Échéance estimée</p>
                  <p className="ed-display mt-1 text-4xl text-marine">{objectif.goalDate}</p>
                </div>
              )}
            </div>
          )}

          {!objectif.atGoal && objectif.weeks !== null && objectif.rate !== null && (
            <div className="mt-8 border-l-2 border-gold pl-6">
              <p className="ed-prose text-base text-marine/70">
                <span className="font-semibold text-marine">D’où vient ce calcul ?</span> Il vous reste{' '}
                {dualWeight(objectif.goal.toLoseKg, unitWeight)} à perdre, au rythme visé de{' '}
                {dualRate(objectif.rate, unitWeight)}. Cela donne environ {formatWeeks(objectif.weeks)} semaines.
              </p>
              <p className="ed-prose mt-3 text-sm text-marine/50">
                C’est une <strong className="font-semibold text-marine/70">estimation</strong>, pas une promesse. Le rythme
                réel varie selon votre régularité, votre sommeil, votre entraînement et votre métabolisme — et il ralentit
                souvent à mesure qu’on approche de la cible. L’échéance est recalculée à chaque bilan.
              </p>
            </div>
          )}

          {objectif.macros && (
            <div className="mt-10 border-t border-marine/10 pt-8">
              <p className="ed-eyebrow text-marine/40">
                Repères alimentaires
                {activityLevel ? ` · ${ACTIVITY_LABELS[activityLevel]}` : ''}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
                {[
                  { label: 'Calories', value: Math.round(objectif.macros.targetKcal), unit: 'kcal / jour' },
                  { label: 'Protéines', value: Math.round(objectif.macros.proteinG), unit: 'g' },
                  { label: 'Lipides', value: Math.round(objectif.macros.fatG), unit: 'g' },
                  { label: 'Glucides', value: Math.round(objectif.macros.carbsG), unit: 'g' }
                ].map(m => (
                  <div key={m.label}>
                    <p className="ed-eyebrow text-marine/40">{m.label}</p>
                    <p className="ed-display mt-1 text-3xl tabular-nums text-marine">{m.value.toLocaleString('fr-CA')}</p>
                    <p className="text-xs text-marine/40">{m.unit}</p>
                  </div>
                ))}
              </div>

              {mealsPerDay && mealsPerDay > 1 && (
                <div className="mt-6 rounded-lg bg-cream/60 p-5">
                  <p className="ed-eyebrow text-marine/40">Répartition par repas · {mealsPerDay} repas / jour</p>
                  <div className="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-4">
                    {(() => {
                      const pm = macrosPerMeal(objectif.macros, mealsPerDay)
                      return [
                        { label: 'Calories', value: pm.targetKcal, unit: 'kcal' },
                        { label: 'Protéines', value: pm.proteinG, unit: 'g' },
                        { label: 'Lipides', value: pm.fatG, unit: 'g' },
                        { label: 'Glucides', value: pm.carbsG, unit: 'g' }
                      ]
                    })().map(m => (
                      <div key={m.label}>
                        <p className="ed-eyebrow text-marine/40">{m.label}</p>
                        <p className="ed-display mt-1 text-2xl tabular-nums text-marine">{m.value.toLocaleString('fr-CA')}</p>
                        <p className="text-xs text-marine/40">{m.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="ed-prose mt-5 text-sm text-marine/50">
                Ce sont des repères indicatifs, calculés à partir de votre masse maigre et de votre niveau d’activité. Ils
                ne remplacent pas l’avis d’une nutritionniste.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** En-tête (titre + intro) d'une section « Votre objectif », identique bilan/nutrition. */
function objectifHeading(objectif: Objectif | null): { title: string; lead: string | undefined } {
  return {
    title: objectif ? (objectif.atGoal ? 'Vous y êtes.' : `Cap sur ${objectif.target} % de gras`) : 'Votre cap',
    lead: objectif
      ? objectif.atGoal
        ? 'Vous avez atteint la cible de composition fixée avec votre kinésiologue. L’enjeu devient de la tenir dans le temps.'
        : 'Une cible chiffrée, une échéance réaliste, et de quoi vous y rendre sans perdre de muscle.'
      : undefined
  }
}

/** Journal alimentaire imprimable — grille vierge (7 jours × repas) que le client
 *  imprime et remplit à la main. Optimisé pour l'impression (noir sur blanc, paysage). */
export function FoodJournal({ data }: { data: StandaloneData }) {
  const { client } = data
  const programs = client.jeunePlanning ?? []
  const dayWindow = dailyWindows(programs).find(p => p.windowStart && p.windowEnd)
  const extended = programs.filter(p => p.freq !== 'daily' && p.kind === 'extended')
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  // Repas en LIGNES, jours en COLONNES. Hauteurs généreuses pour écrire.
  const rows: { label: string; height: string }[] = [
    { label: 'Déjeuner', height: '92px' },
    { label: 'Dîner', height: '92px' },
    { label: 'Souper', height: '92px' },
    { label: 'Collations', height: '80px' },
    { label: 'Eau', height: '40px' },
    { label: 'Notes', height: '80px' }
  ]

  const cell: React.CSSProperties = { border: '1px solid #444', padding: '4px 6px', verticalAlign: 'top' }
  const th: React.CSSProperties = { ...cell, background: '#f0ede6', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#333', textAlign: 'center' }

  return (
    <div style={{ background: '#fff', color: '#111', minHeight: '100vh', padding: '20px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@media print { @page { size: A4 landscape; margin: 9mm } .fj-noprint { display: none !important } } body { background:#fff } * { -webkit-print-color-adjust: exact; print-color-adjust: exact }`}</style>

      <div className="fj-noprint" style={{ textAlign: 'right', marginBottom: '8px' }}>
        <button
          type="button"
          onClick={() => window.print()}
          style={{ padding: '8px 16px', border: '1px solid #001331', borderRadius: '6px', background: '#001331', color: '#fff', cursor: 'pointer', fontSize: '14px' }}
        >
          Imprimer
        </button>
      </div>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '2px solid #001331', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#001331', borderRadius: '10px', padding: '10px 16px' }}>
            <img src={logoConseil} alt="Kinésio Conseil" style={{ height: '58px', width: 'auto' }} />
          </span>
          <div>
            <h1 style={{ fontSize: '21px', fontWeight: 700, color: '#001331', margin: 0 }}>Journal alimentaire</h1>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#444' }}>
              {client.name} · Semaine du{' '}
              <span style={{ borderBottom: '1px solid #999', display: 'inline-block', minWidth: '130px' }}>&nbsp;</span>
            </p>
          </div>
        </div>
        {dayWindow && (
          <p style={{ margin: 0, fontSize: '13px', color: '#444' }}>
            Fenêtre d’alimentation : <strong>{dayWindow.windowStart}–{dayWindow.windowEnd}</strong>
          </p>
        )}
      </header>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '86px', textAlign: 'left' }}>&nbsp;</th>
            {days.map(d => (
              <th key={d} style={th}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} style={{ height: r.height }}>
              <td style={{ ...cell, fontWeight: 600, color: '#001331', fontSize: '12px', background: '#faf8f3' }}>{r.label}</td>
              {days.map(d => (
                <td key={d} style={cell} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {extended.length > 0 && (
        <p style={{ marginTop: '9px', fontSize: '12px', color: '#555' }}>
          Jeûnes prévus : {extended.map(p => p.label || `Jeûne ${p.durationHours} h`).join(' · ')} — notez « jeûne » les jours concernés.
        </p>
      )}
      <p style={{ marginTop: '7px', fontSize: '11px', color: '#888' }}>
        Notez ce que vous mangez et buvez au fil de la journée. Rapportez ce journal à votre prochaine rencontre.
      </p>
    </div>
  )
}

/** Document HTML autonome DÉDIÉ à la nutrition & au jeûne — distinct du bilan.
 *  Même identité visuelle (marine / or / crème) que le bilan interactif. */
export function NutritionDocument({ data }: { data: StandaloneData }) {
  const { client } = data
  const firstName = client.name.trim().split(/\s+/)[0]

  // Objectif chiffré & macros — mêmes calculs que le bilan (synthèse des bilans).
  const age = computeAge(client.birthdate)
  const profile: BilanProfile = { age, sex: client.sex, norms: data.norms }
  const synth = data.bilans.length > 0 ? buildSynthesisBilan(data.bilans) : null
  const objectifData = synth?.data ?? {}
  const objectifComputed = computeBilan(objectifData, profile)
  const objectifDate = synth?.latestContributionDate ?? data.bilans[0]?.date ?? data.generatedAt
  const objectif = client.nutritionEnabled ? buildObjectif(client, objectifData, objectifComputed, age, objectifDate) : null
  // Objectif en texte libre du client (« courir un 10 km ») — affiché comme dans le bilan.
  const objectifText = typeof objectifData.objectif === 'string' ? objectifData.objectif.trim() : ''
  const hasObjectif = !!objectif || objectifText !== ''

  const hasJeune = (client.jeunePlanning?.length ?? 0) > 0
  // Le document s'intitule toujours « Nutrition » (le jeûne reste une section interne).
  const planTitle = 'Nutrition'

  const hasBricks =
    hasJeune ||
    (typeof client.hydratationMlParJour === 'number' && client.hydratationMlParJour > 0) ||
    !!(client.alimentsPrivilegier ?? '').trim() ||
    !!(client.alimentsEviter ?? '').trim() ||
    !!(client.supplementsNotes ?? '').trim() ||
    !!(client.nutritionMot ?? '').trim() ||
    !!(client.nutritionMenu ?? '').trim()

  return (
    <div className="overflow-x-hidden bg-cream text-marine">
      {/* Impression / PDF : évite de couper les cartes entre deux pages, réduit le
          hero, et force le rendu des fonds. Sans effet à l'écran. */}
      <style>{`
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { margin: 12mm; }
          .ed-hero { min-height: 0 !important; }
          .ed-anchor { padding-top: 16px !important; padding-bottom: 16px !important; }
          .rounded-xl, .rounded-lg { break-inside: avoid; }
          /* Le plan « Nutrition » démarre toujours sur une nouvelle page. */
          #nutrition-plan { break-before: page; }
          /* La carte Suppléments reste d'un seul tenant : on évite qu'elle soit
             orpheline en bas de page et on la garde entière. */
          .nut-supp { break-inside: avoid; break-before: auto; }
          /* Chaque journée de menu (sauf la première) démarre sur une nouvelle page. */
          .nut-menu-day { break-before: page; }
        }
      `}</style>
      <header className="ed-hero relative flex min-h-[65svh] flex-col justify-between overflow-hidden bg-marine px-6 py-10 text-cream sm:px-10">
        <div className="ed-hero-forest ed-no-print" aria-hidden="true" style={{ backgroundImage: FOREST_BG }} />
        <div className="ed-hero-veil ed-no-print" aria-hidden="true" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <img src={logoConseil} alt="Kinésio Conseil" className="ed-no-print h-14 w-auto sm:h-16" />
          {data.avatarDataUrl && (
            <img src={data.avatarDataUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-gold/40" />
          )}
        </div>

        <div className="relative z-10 mx-auto w-full max-w-4xl py-12">
          <p className="ed-eyebrow text-gold">{planTitle}</p>
          <h1 className="ed-display ed-headline mt-3 text-cream">{firstName}, votre plan alimentaire.</h1>
          <p className="ed-prose mt-10 text-lg text-cream/75 sm:text-xl">
            Vos repères nutrition et jeûne, réunis en un seul endroit — à ajuster avec votre kinésiologue.
          </p>
        </div>
        <div aria-hidden="true" />
      </header>

      {/* Objectif — section propre, identique au bilan (même texte explicatif). */}
      {hasObjectif && (
        <Section eyebrow="Votre objectif" {...objectifHeading(objectif)}>
          <ObjectifBody
            objectif={objectif}
            objectifText={objectifText}
            unitWeight={client.unitWeight}
            activityLevel={client.nutritionActivityLevel}
            mealsPerDay={client.nutritionRepasParJour ?? DEFAULT_MEALS_PER_DAY}
          />
        </Section>
      )}

      {hasBricks ? (
        <Section eyebrow="Votre plan" title={planTitle} tone="white" id="nutrition-plan">
          <NutritionBody client={client} generatedAt={data.generatedAt} />
        </Section>
      ) : (
        !hasObjectif && (
          <Section eyebrow="Votre plan" title={planTitle} tone="white">
            <p className="ed-prose text-base text-marine/60">
              Aucune consigne nutrition n’a encore été renseignée par votre kinésiologue.
            </p>
          </Section>
        )
      )}

      <footer className="border-t border-marine/10 bg-cream px-6 pb-16 pt-14 text-marine sm:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="ed-eyebrow text-gold-dark">Préparé pour vous par</p>
          <p className="ed-display mt-3 text-3xl text-marine">{data.kinesiologist}</p>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-marine/60">
            Document généré le{' '}
            {new Date(data.generatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}. Il
            fonctionne hors ligne et aucune de vos données n’est transmise à qui que ce soit — tout est contenu dans ce
            fichier. Ces conseils ne remplacent pas l’avis d’une nutritionniste ou d’un médecin.
          </p>
        </div>
      </footer>
    </div>
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
  // On garde les « forces » (mises en valeur pour le client), pas les priorités
  // auto — retirées à la demande de Marie (peu utiles, pas toujours le focus réel).
  const plan = buildActionPlan(activeData, profile)
  const objectif = buildObjectif(client, activeData, computed, age, activeBilan.date)
  // Objectif en texte libre saisi par Marie/le client — affiché même sans module nutrition.
  const objectifText = typeof activeData.objectif === 'string' ? activeData.objectif.trim() : ''
  // FC au repos — toujours affichée dans la section cardio (repère de récupération).
  const fcRepos = typeof activeData.fc_repos === 'number' && !Number.isNaN(activeData.fc_repos) ? activeData.fc_repos : null
  const fcReposCat: Category | null =
    fcRepos !== null && client.sex ? getCategorization('restingHeartRate', fcRepos, age ?? 40, client.sex) : null
  // Pression artérielle — barres de zones cliniques (OMS/JNC).
  const paSys = typeof activeData.pa_systolique === 'number' && !Number.isNaN(activeData.pa_systolique) ? activeData.pa_systolique : null
  const paDia = typeof activeData.pa_diastolique === 'number' && !Number.isNaN(activeData.pa_diastolique) ? activeData.pa_diastolique : null
  const paCatSys = paSys !== null ? classifyBloodPressure(paSys, 'systolic')?.category ?? null : null
  const paCatDia = paDia !== null ? classifyBloodPressure(paDia, 'diastolic')?.category ?? null : null
  // « Dans la norme » = les deux valeurs présentes sont Optimale ou Normale.
  const paNormale = [paCatSys, paCatDia].every(c => c === null || c === 'EXCELLENT' || c === 'TRES_BIEN')
  // Observations que Marie-Eve destine au client (≠ ses notes cliniques privées).
  const motDuKine = typeof activeData.notes === 'string' ? activeData.notes.trim() : ''

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
        <div className="mx-auto max-w-5xl px-6 py-4 sm:px-8 sm:py-5">
          {/* Téléphone : deux listes pleine largeur. Une frise de pastilles
              horizontale y déborde et devient illisible. `text-base` (16 px)
              empêche iOS de zoomer à la sélection. */}
          <div className="grid gap-3 sm:hidden">
            <label className="block">
              <span className="ed-eyebrow block text-marine/40">Bilan affiché</span>
              <select
                value={selectedId ?? 'synthesis'}
                onChange={e => setSelectedId(e.target.value === 'synthesis' ? null : e.target.value)}
                className="mt-1.5 w-full rounded-md border border-cream-dark bg-white px-3 py-2.5 text-base font-medium text-marine focus:outline-none focus:ring-2 focus:ring-gold/50"
              >
                <option value="synthesis">Dernières valeurs — tous vos bilans</option>
                {bilans.map(b => (
                  <option key={b.id} value={b.id}>
                    {formatBilanDate(b.date)}
                  </option>
                ))}
              </select>
            </label>

            {(previousBilan !== null || compareOptions.length > 0) && (
              <label className="block">
                <span className="ed-eyebrow block text-marine/40">Comparer à</span>
                <select
                  value={compareId}
                  onChange={e => setCompareId(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-cream-dark bg-white px-3 py-2.5 text-base font-medium text-marine focus:outline-none focus:ring-2 focus:ring-gold/50"
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

          {/* Écran large : la frise, qui montre en plus l'ancienneté et les bilans partiels. */}
          <div className="hidden flex-wrap items-start justify-between gap-4 sm:flex">
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
        id="vue-ensemble"
        eyebrow="Vue d’ensemble"
        title="Quatre façons de lire votre condition physique"
        lead="Chaque domaine est noté sur 5, en comparant vos résultats à ceux des personnes de votre âge et de votre sexe. Le score global en est la moyenne."
        tone="white"
      >
        <div>
          <CompositeRow label="Composition corporelle" subtitle="IMC, % de gras, tour de taille" score={computed.composition} href="#composition" />
          <CompositeRow label="Cœur et endurance" subtitle="VO2max" score={computed.aerobic} href="#cardio" />
          <CompositeRow label="Santé du dos" subtitle="Flexibilité, endurance, abdominaux" score={computed.backHealth} href="#force-mobilite" />
          <CompositeRow label="Force musculaire" subtitle="Six tests" score={computed.musculoGlobal} href="#force-mobilite" />
        </div>
        {computed.overall.category && (
          <p className="ed-prose mt-8 text-base text-marine/65">{DOMAIN_ADVICE[computed.overall.category]}</p>
        )}
      </Section>

      <Section
        id="composition"
        backTop
        scores={[{ score: computed.composition }]}
        eyebrow="Composition corporelle"
        title="Ce que raconte votre silhouette"
        lead="L’IMC seul dit peu de choses : un athlète musclé et une personne sédentaire peuvent avoir le même. Il doit être interprété avec le % de gras, le tour de taille et l’évaluation de la kinésiologue."
      >
        <Measure label="Indice de masse corporelle" value={activeData.imc} unit="kg/m²" test="bmi" {...measureProps} previousValue={compareData?.imc} lowerIsBetter history={historyOf('imc')} />
        <Measure id="pourcentage-gras" label="Pourcentage de gras" value={activeData.pourcentage_gras} unit="%" test="bodyFat" {...measureProps} previousValue={compareData?.pourcentage_gras} lowerIsBetter history={historyOf('pourcentage_gras')} weightKg={typeof activeData.poids_kg === 'number' ? activeData.poids_kg : null} />
        <Measure label="Tour de taille" value={activeData.tour_taille_cm} unit="cm" test="waistCircumference" {...measureProps} previousValue={compareData?.tour_taille_cm} lowerIsBetter history={historyOf('tour_taille_cm')} />
      </Section>

      <Section
        id="cardio"
        backTop
        scores={[{ score: computed.aerobic }]}
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

        {fcRepos !== null && (
          <div className="mt-10 border-l-2 border-gold pl-6">
            <p className="ed-eyebrow text-marine/40">Fréquence cardiaque au repos</p>
            <p className="ed-display mt-2 text-5xl tabular-nums text-marine">
              {fcRepos}
              <span className="text-xl text-marine/45"> bpm</span>
            </p>
            <p className="ed-prose mt-2 text-base text-marine/65">
              {fcReposCat && (
                <>
                  <span className="font-semibold" style={{ color: CAT_HEX[fcReposCat] }}>{CATEGORY_LABELS[fcReposCat]}</span>
                  {' — '}
                </>
              )}
              une fréquence de repos basse reflète un cœur efficace et une bonne récupération.
            </p>
          </div>
        )}

        {(paSys !== null || paDia !== null) && (
          <div className="mt-12">
            <p className="ed-eyebrow text-marine/40">Pression artérielle</p>
            <p className="ed-prose mt-3 text-base text-marine/65">
              Mesurée au repos, après quelques minutes de calme. La <strong className="font-semibold text-marine/80">systolique</strong> est
              la pression quand le cœur se contracte ; la <strong className="font-semibold text-marine/80">diastolique</strong>, quand il se
              remplit entre deux battements. Une valeur plus basse est généralement préférable, et une lecture élevée isolée ne signifie pas
              de l’hypertension — c’est pourquoi on la revérifie régulièrement.
            </p>
            <div className="mt-6 space-y-6">
              {paSys !== null && <BloodPressureBar value={paSys} kind="systolic" />}
              {paDia !== null && <BloodPressureBar value={paDia} kind="diastolic" />}
            </div>
            <p className="ed-prose mt-5 text-sm text-marine/55">
              {paNormale
                ? 'Votre pression artérielle au repos est dans la norme. Un contrôle une fois par an suffit.'
                : 'Une ou plusieurs valeurs sortent de la zone optimale — à reprendre au calme, puis à valider avec votre médecin au besoin.'}
            </p>
          </div>
        )}

        <div className="mt-12">
          <TrainingZones fcMax={computed.fcMaxPredite} fcZones={computed.fcZones} />
        </div>
      </Section>

      <Section
        id="force-mobilite"
        backTop
        scores={[
          { label: 'Santé du dos', score: computed.backHealth },
          { label: 'Force musculaire', score: computed.musculoGlobal }
        ]}
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
          backTop
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

      {(objectifText !== '' || objectif) && (
        <Section eyebrow="Votre objectif" backTop {...objectifHeading(objectif)}>
          <ObjectifBody
            objectif={objectif}
            objectifText={objectifText}
            unitWeight={client.unitWeight}
            activityLevel={client.nutritionActivityLevel}
          />
        </Section>
      )}

      {(plan.forces.length > 0 || motDuKine) && (
        <Section eyebrow="Et maintenant ?" title={plan.forces.length > 0 ? 'Vos forces' : 'En terminant'} tone="white" backTop>
          {plan.forces.length > 0 && (
            <div>
              <p className="ed-eyebrow mb-4 text-gold-dark">Vos forces</p>
              <div className="grid gap-4 sm:grid-cols-3">
                {plan.forces.map(f => (
                  <div key={f.metric.key as string} className="rounded-lg border border-marine/10 p-4">
                    <p className="text-sm font-semibold text-marine">{f.metric.label}</p>
                    <p className="mt-1 text-sm text-marine/55">
                      {f.value.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} {f.metric.unit} ·{' '}
                      {CATEGORY_LABELS[f.category]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {motDuKine && (
            <div className="mt-14 rounded-xl bg-cream p-8 sm:p-10">
              <p className="ed-eyebrow text-gold-dark">Le mot de votre kinésiologue</p>
              <p className="ed-prose mt-4 whitespace-pre-line text-base leading-relaxed text-marine">{motDuKine}</p>
              <p className="mt-6 whitespace-pre-line text-sm italic text-marine/60">{data.signature}</p>
            </div>
          )}
        </Section>
      )}

      {/* Cinq piliers de bien-être — un final positif et global, le même pour tous.
          En marine, il se fond avec le pied de page en un bloc de clôture calme. */}
      <section className="bg-marine px-6 pt-16 pb-4 text-cream sm:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="ed-eyebrow text-gold">L’équilibre au quotidien</p>
            <h2 className="ed-display ed-section-title mt-3 text-cream">{principesCountWord({ title: client.principePersoTitre, line: client.principePersoTexte })} principes essentiels</h2>
            <p className="ed-prose mt-4 text-base text-cream/70 sm:text-lg">
              À garder en tête avec le plan proposé à la suite de votre bilan — la forme physique se construit
              autant à la table, au lit et dans la tête qu’à l’entraînement.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className={`mt-10 grid grid-cols-1 gap-y-8 gap-x-6 ${principesFor({ title: client.principePersoTitre, line: client.principePersoTexte }).length === 6 ? 'sm:grid-cols-3' : 'sm:grid-cols-5'}`}>
              {principesFor({ title: client.principePersoTitre, line: client.principePersoTexte }).map(p => (
                <div key={p.title} className="flex items-start gap-4 sm:flex-col sm:items-center sm:text-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/30 text-gold">
                    <p.icon size={20} strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0">
                    <p className="ed-display text-lg text-cream">{p.title}</p>
                    <p className="mt-1 text-sm leading-snug text-cream/55">{p.line}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="bg-marine px-6 pb-16 pt-8 text-cream sm:px-8">
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
