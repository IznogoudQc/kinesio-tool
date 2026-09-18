import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { FOREST_BG, Section, type StandaloneData } from './EditorialReport'
import logoConseil from '../assets/logo-conseil.png'
import { formatBilanDate, formatBilanMonth } from '../pages/client/bilanFields'
import { evolution, groupesDeMesures, type GroupeMesures, type SerieMesure } from '../lib/mesures-doc'

/**
 * Document « Suivi des mesures » — les prises de l'onglet Mesures, remises au
 * client.
 *
 * Il existe parce que ces prises n'atteignaient personne : la synchronisation
 * ne va que du bilan vers les mesures, donc un tour de bras pris entre deux
 * bilans restait invisible pour le client.
 *
 * Même coquille que le bilan (couverture, sections, pied de page) et un seul
 * rendu pour les deux formats : le PDF est l'impression de cette page-ci, il ne
 * peut donc pas raconter autre chose que le HTML.
 */

const nf1 = (n: number): string => n.toLocaleString('fr-CA', { maximumFractionDigits: 1 })

/** `+4` / `−4` — vrai signe moins typographique, pas un trait d'union. */
function signe(n: number): string {
  if (n > 0) return `+${nf1(n)}`
  if (n < 0) return `−${nf1(Math.abs(n))}`
  return '0'
}

/**
 * La courbe d'une mesure, en SVG inline.
 *
 * Dessinée à la main plutôt qu'avec une bibliothèque : le document doit
 * fonctionner hors ligne ET s'imprimer. Une courbe qui a besoin de mesurer son
 * conteneur (Recharts) ne rend rien à l'impression.
 */
function Courbe({ serie }: { serie: SerieMesure }) {
  const pts = serie.points
  if (pts.length < 2) return null

  const L = 260
  const H = 54
  const marge = 6
  const valeurs = pts.map(p => p.valeur)
  const min = Math.min(...valeurs)
  const max = Math.max(...valeurs)
  // Une série plate ne doit pas diviser par zéro : on la trace à mi-hauteur.
  const etendue = max - min || 1
  const x = (i: number) => marge + (i * (L - 2 * marge)) / (pts.length - 1)
  const y = (v: number) => H - marge - ((v - min) / etendue) * (H - 2 * marge)
  const trace = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.valeur).toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${L} ${H}`}
      className="mt-3 h-[54px] w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Évolution de ${serie.label} : de ${nf1(pts[0].valeur)} à ${nf1(pts[pts.length - 1].valeur)} ${serie.unite}.`}
    >
      <path d={trace} fill="none" stroke="#b8874a" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => {
        const dernier = i === pts.length - 1
        // Au-delà d'une douzaine de prises, un point par prise transforme la
        // courbe en collier de perles et cache justement sa forme. Seule la
        // dernière garde son repère — c'est la valeur qu'on cherche.
        if (!dernier && pts.length > 12) return null
        return (
          <circle
            key={p.date}
            cx={x(i)}
            cy={y(p.valeur)}
            r={dernier ? 3.2 : 2}
            fill={dernier ? '#b8874a' : '#ffffff'}
            stroke="#b8874a"
            strokeWidth={1.4}
          />
        )
      })}
    </svg>
  )
}

/** Une mesure : sa dernière valeur, et le chemin depuis la première prise. */
function CarteMesure({ serie }: { serie: SerieMesure }) {
  const dernier = serie.points[serie.points.length - 1]
  const ev = evolution(serie)

  return (
    <div className="mes-carte rounded-xl border border-cream-dark/60 bg-white px-5 py-4">
      <p className="ed-eyebrow text-gold-dark">{serie.label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="ed-display text-3xl leading-none text-marine tabular-nums">{nf1(dernier.valeur)}</span>
        <span className="text-base text-marine/50">{serie.unite}</span>
      </p>
      <p className="mt-1 text-xs text-marine/45">au {formatBilanDate(dernier.date)}</p>

      {ev ? (
        <p className="mt-3 border-t border-cream-dark/60 pt-3 text-sm text-marine/65">
          {/* Aucune couleur ici : un tour de bras qui monte n'est ni un progrès
              ni un recul en soi, et le document ne peut pas trancher à la place
              de la kinésiologue. */}
          <span className="font-medium text-marine tabular-nums">
            {signe(ev.ecart)} {serie.unite}
          </span>{' '}
          depuis le {formatBilanDate(ev.depuis.date)} ({nf1(ev.depuis.valeur)} {serie.unite})
        </p>
      ) : (
        <p className="mt-3 border-t border-cream-dark/60 pt-3 text-sm text-marine/45">
          Première prise — l’évolution apparaîtra à la suivante.
        </p>
      )}

      <Courbe serie={serie} />
    </div>
  )
}

/**
 * Combien de dates par tableau.
 *
 * Un client suivi tous les mois pendant trois ans a trente-six prises. Sur une
 * seule grille, elles débordent de la page — et à l'impression, ce qui déborde
 * est coupé, pas mis en défilement. On découpe donc en tranches, chacune
 * reprenant le nom des mesures.
 *
 * CINQ et pas plus : une A4 portrait imprime 638 px de large une fois les
 * marges et le retrait de section retirés, la colonne des noms en prend 120 et
 * une date en toutes lettres environ 95. À huit, les trois dernières colonnes
 * — donc les prises les plus récentes — sortaient du papier sans laisser de
 * trace : ni troncature visible, ni défilement, juste des chiffres absents.
 */
const DATES_PAR_TABLEAU = 5

function tranches<T>(liste: T[], taille: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

/**
 * Combien d'encadrés tiennent sous le titre d'une section, sur une page A4.
 *
 * Deux colonnes, un encadré d'environ 235 px de haut : trois rangées remplissent
 * la page. Au-delà, la section continue sur la suivante — et cette page-là
 * reprend un titre, sinon le lecteur tombe sur des encadrés sans en-tête.
 */
const CARTES_PAR_PAGE = 6

/** Deux rangées d'encadrés : le plus petit paquet qu'on refuse de couper. */
const CARTES_PAR_GRAPPE = 4

/**
 * Découpe en parts aussi égales que possible, sans dépasser `max` par part.
 *
 * Huit encadrés donnent 4 + 4, pas 6 + 2 ; trente-six dates donnent quatre
 * tranches de 5 puis quatre de 4, pas sept de 5 et une de 1. Chaque part
 * remplissant une page imprimée, une part presque vide à la fin se lit comme un
 * oubli — des parts égales se lisent comme une mise en page.
 */
function repartir<T>(liste: T[], max: number): T[][] {
  const parts = Math.max(1, Math.ceil(liste.length / max))
  const base = Math.floor(liste.length / parts)
  const reste = liste.length % parts
  const out: T[][] = []
  let i = 0
  for (let k = 0; k < parts; k++) {
    const taille = base + (k < reste ? 1 : 0)
    out.push(liste.slice(i, i + taille))
    i += taille
  }
  return out
}

/** Un paquet d'encadrés qu'on refuse de couper, et le sous-titre qui le nomme. */
interface BlocCartes {
  titre?: string
  /** Reste d'une région trop longue pour une page : démarre la sienne. */
  suite?: boolean
  series: SerieMesure[]
}

/**
 * Découpe un groupe en paquets insécables.
 *
 * Un groupe qui tient sur une page reste d'un seul tenant : il n'a pas besoin
 * d'être sous-titré, et l'ordre des mesures y est celui du formulaire (les cinq
 * que Marie-Eve prend d'habitude en premier).
 *
 * Au-delà, la coupure se fait par région du corps. « Bas du corps » en tête de
 * page dit au lecteur ce qu'il regarde ; un « (suite) » ne lui dirait que la
 * mécanique de la pagination. Ce dernier ne subsiste qu'en repli, pour le jour
 * où une région à elle seule dépasserait la page.
 *
 * Les blocs ne forcent PAS de saut de page : deux petites régions partagent
 * volontiers une feuille. C'est `break-inside: avoid` qui garantit qu'un
 * sous-titre ne quitte jamais ses encadrés.
 */
function blocsImprimables(groupe: GroupeMesures): BlocCartes[] {
  if (groupe.series.length <= CARTES_PAR_PAGE) return [{ series: groupe.series }]

  const familles = new Map<string, SerieMesure[]>()
  for (const s of groupe.series) {
    // Un groupe sans régions (les plis, la composition) reste une seule famille.
    const nom = s.famille ?? groupe.titre
    const deja = familles.get(nom)
    if (deja) deja.push(s)
    else familles.set(nom, [s])
  }

  const blocs: BlocCartes[] = []
  for (const [nom, series] of familles) {
    // Le titre de section est juste au-dessus : le répéter n'apprendrait rien.
    const premier = nom === groupe.titre ? undefined : nom
    repartir(series, CARTES_PAR_PAGE).forEach((part, i) => {
      blocs.push({ titre: i === 0 ? premier : `${nom} (suite)`, suite: i > 0, series: part })
    })
  }
  return blocs
}

/**
 * Les encadrés d'un groupe, découpés pour l'impression.
 *
 * Chromium n'applique pas `break-before: avoid` : on ne peut pas lui demander
 * de garder un titre avec ce qui le suit. Un sous-titre n'existe donc qu'À
 * L'INTÉRIEUR du bloc qu'il nomme, et c'est le bloc entier qui refuse d'être
 * coupé — à l'intérieur, les grappes de deux rangées servent de filet.
 */
function GrilleCartes({ groupe }: { groupe: GroupeMesures }) {
  const blocs = blocsImprimables(groupe)

  return (
    <div className="space-y-4">
      {blocs.map(bloc => (
        <div key={bloc.series[0].cle} className={`mes-bloc space-y-4${bloc.suite ? ' mes-page-neuve' : ''}`}>
          {bloc.titre && <p className="ed-eyebrow text-marine/45">{bloc.titre}</p>}
          {tranches(bloc.series, CARTES_PAR_GRAPPE).map(grappe => (
            <div key={grappe[0].cle} className="mes-grappe grid gap-4 sm:grid-cols-2">
              {grappe.map(s => (
                <CarteMesure key={s.cle} serie={s} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Le tableau complet, pour qui veut relire un chiffre précis. */
function TableauDetail({ series, dates }: { series: SerieMesure[]; dates: string[] }) {
  const valeur = (s: SerieMesure, date: string): string => {
    const p = s.points.find(x => x.date === date)
    return p ? nf1(p.valeur) : '—'
  }
  // Une mesure absente de toute la tranche ne mérite pas une ligne de tirets.
  const seriesDe = (bloc: string[]) => series.filter(s => bloc.some(d => s.points.some(p => p.date === d)))

  return (
    <div className="space-y-8">
      {repartir(dates, DATES_PAR_TABLEAU).map(bloc => (
        <div key={bloc[0]} className="mes-table overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-marine/15">
                <th className="py-2 pr-4 text-left font-medium text-marine/60">Mesure</th>
                {bloc.map(d => (
                  <th key={d} className="px-2 py-2 text-right font-medium text-marine/60">
                    {formatBilanDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seriesDe(bloc).map(s => (
                <tr key={s.cle} className="border-b border-cream-dark/50">
                  <td className="py-2 pr-4 text-marine/80">
                    {s.label} <span className="text-marine/40">({s.unite})</span>
                  </td>
                  {bloc.map(d => (
                    <td key={d} className="px-2 py-2 text-right tabular-nums text-marine">
                      {valeur(s, d)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/** Fenêtres proposées sous le graphique, comptées depuis la DERNIÈRE prise. */
const FENETRES = [
  { cle: 'tout', label: 'Tout', mois: null },
  { cle: '1an', label: '12 derniers mois', mois: 12 },
  { cle: '6mois', label: '6 derniers mois', mois: 6 }
] as const

type CleFenetre = (typeof FENETRES)[number]['cle']

/**
 * Retire les points antérieurs à la fenêtre choisie.
 *
 * Comptée depuis la dernière prise et non depuis aujourd'hui : ce document est
 * un fichier, relu des mois plus tard. « 6 derniers mois » à partir du jour de
 * lecture finirait par ne plus rien montrer.
 */
function filtrer(points: SerieMesure['points'], mois: number | null): SerieMesure['points'] {
  if (mois === null || points.length === 0) return points
  const fin = new Date(points[points.length - 1].date)
  const debut = new Date(fin)
  debut.setMonth(debut.getMonth() - mois)
  const limite = debut.toISOString().slice(0, 10)
  return points.filter(p => p.date >= limite)
}

function InfoBulle({
  active,
  payload,
  unite
}: {
  active?: boolean
  payload?: { payload: { date: string; valeur: number } }[]
  unite: string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-md border border-cream-dark bg-white px-3 py-2 shadow-lg">
      <p className="text-xs text-marine/50">{formatBilanDate(p.date)}</p>
      <p className="text-base font-semibold text-marine tabular-nums">
        {nf1(p.valeur)} <span className="text-sm font-medium text-marine/50">{unite}</span>
      </p>
    </div>
  )
}

/**
 * Le pendant interactif des encadrés : on choisit une mesure, on la lit dans le
 * temps, on survole un point pour sa date exacte.
 *
 * Hors impression (`ed-no-print`). Le PDF est l'impression de cette même page :
 * un menu de sélection et une courbe survolable n'y auraient aucun sens, et les
 * encadrés statiques racontent déjà la même chose sur papier.
 */
function ExplorateurMesures({ groupes }: { groupes: GroupeMesures[] }) {
  const toutes = useMemo(() => groupes.flatMap(g => g.series), [groupes])
  const [cle, setCle] = useState(toutes[0]?.cle ?? '')
  const [fenetre, setFenetre] = useState<CleFenetre>('tout')

  const serie = toutes.find(s => s.cle === cle) ?? toutes[0]
  if (!serie) return null

  const mois = FENETRES.find(f => f.cle === fenetre)?.mois ?? null
  const points = filtrer(serie.points, mois)
  const donnees = points.map(p => ({ ...p, mois: formatBilanMonth(p.date) }))
  const premier = points[0]
  const dernier = points[points.length - 1]

  return (
    <section className="ed-no-print ed-anchor bg-white">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-24">
        <p className="ed-eyebrow text-gold-dark">Explorer</p>
        <h2 className="ed-display ed-section-title mt-3 text-marine">Choisissez une mesure</h2>
        <p className="ed-prose mt-4 max-w-2xl text-base text-marine/60">
          Chaque mesure prise se trace ici. Survolez un point pour retrouver sa date exacte.
        </p>

        <div className="mt-8 space-y-4">
          {groupes.map(g => (
            <div key={g.titre}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-marine/55">{g.titre}</p>
              <div className="flex flex-wrap gap-2">
                {g.series.map(s => (
                  <button
                    key={s.cle}
                    type="button"
                    onClick={() => setCle(s.cle)}
                    aria-pressed={s.cle === serie.cle}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      s.cle === serie.cle
                        ? 'border-marine bg-marine text-cream'
                        : 'border-cream-dark bg-cream-dark/30 text-marine hover:bg-cream-dark/50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {serie.points.length > 2 && (
          <div className="mt-6 flex flex-wrap items-center gap-1.5 border-t border-cream-dark/50 pt-4">
            <p className="mr-1 text-xs font-medium uppercase tracking-wide text-marine/55">Période</p>
            {FENETRES.map(f => (
              <button
                key={f.cle}
                type="button"
                onClick={() => setFenetre(f.cle)}
                aria-pressed={f.cle === fenetre}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  f.cle === fenetre
                    ? 'bg-marine text-cream'
                    : 'border border-cream-dark text-marine/65 hover:border-gold/60 hover:text-marine'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <p className="mt-5 text-sm text-marine/60">
          <span className="font-medium text-marine">{serie.label}</span>
          {premier && dernier && points.length > 1 ? (
            <>
              {' '}— de {nf1(premier.valeur)} à {nf1(dernier.valeur)} {serie.unite}, soit{' '}
              <span className="font-medium text-marine tabular-nums">
                {signe(Math.round((dernier.valeur - premier.valeur) * 10) / 10)} {serie.unite}
              </span>
            </>
          ) : (
            ' — une seule prise sur cette période.'
          )}
        </p>

        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={donnees} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="rgba(10, 28, 94, 0.08)" vertical={false} />
              <XAxis
                dataKey="mois"
                tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 11 }}
                stroke="rgba(10, 28, 94, 0.15)"
              />
              <YAxis
                tick={{ fill: 'rgba(10, 28, 94, 0.55)', fontSize: 11 }}
                stroke="rgba(10, 28, 94, 0.15)"
                width={48}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<InfoBulle unite={serie.unite} />} />
              {/* La première valeur de la fenêtre, en repère : c'est d'elle que
                  se compte l'écart annoncé juste au-dessus. Sur « 6 derniers
                  mois », ce n'est PAS la première prise du suivi — l'étiquette
                  le dit, sinon le repère mentirait. */}
              {premier && points.length > 1 && (
                <ReferenceLine
                  y={premier.valeur}
                  stroke="rgba(10, 28, 94, 0.35)"
                  strokeDasharray="4 4"
                  label={{
                    value: mois === null ? 'Première prise' : 'Début de la période',
                    position: 'insideBottomLeft',
                    fill: 'rgba(10, 28, 94, 0.55)',
                    fontSize: 11
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="valeur"
                stroke="#b8874a"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#b8874a' }}
                activeDot={{ r: 5.5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

const TITRES: Record<string, string> = {
  'Poids et composition': 'Ce que la balance et les plis racontent',
  Circonférences: 'Le ruban, centimètre par centimètre',
  'Plis cutanés': 'Les plis, un à un'
}

export function MesuresDocument({ data }: { data: StandaloneData }) {
  const { client } = data
  const firstName = client.name.trim().split(/\s+/)[0]
  const circonferences = data.mesures?.circonferences ?? []
  const plis = data.mesures?.plis ?? []
  const groupes = groupesDeMesures(circonferences, plis, client.unitWeight)
  const toutes = groupes.flatMap(g => g.series)
  // Une colonne par date où quelque chose a été mesuré.
  const dates = [...new Set(toutes.flatMap(s => s.points.map(p => p.date)))].sort()

  return (
    <div className="mes-doc overflow-x-hidden bg-cream text-marine">
      {/* Impression / PDF : mêmes règles que les autres documents — fonds rendus,
          cartes jamais coupées entre deux pages, couverture raccourcie.

          Tout passe par `break-inside` et `break-before: page` : Chromium
          (qui produit le PDF) ignore `break-before: avoid` et
          `break-after: avoid`. Un titre ne se garde donc pas « collé » à ce qui
          le suit — il faut lui donner le haut d'une page. */}
      <style>{`
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { margin: 12mm; }
          .ed-hero { min-height: 0 !important; }
          .ed-anchor { padding-top: 16px !important; padding-bottom: 16px !important; }

          /* Chaque section démarre en haut d'une page. C'est ce qui empêche un
             titre de rester seul au bas de la précédente — sans dépendre d'un
             break-after: avoid que le moteur n'implémente pas. */
          .mes-doc > section.ed-anchor { break-before: page; }

          /* Repli en escalier : le bloc d'une page d'abord, puis deux rangées,
             puis l'encadré seul. Chromium ignore un break-inside: avoid plus
             haut qu'une page, donc chaque niveau rattrape le précédent. */
          .mes-bloc { break-inside: avoid; }
          .mes-grappe { break-inside: avoid; }
          .mes-carte { break-inside: avoid; }

          /* Région si longue qu'elle ne tient pas sur une page : son reste part
             en haut de la suivante, sous son nom suivi de « (suite) ». */
          .mes-page-neuve { break-before: page; }

          /* La PREMIÈRE tranche du tableau reste avec le titre de sa section —
             sinon ce titre occupe une page à lui seul. Les suivantes démarrent
             leur propre page : coupée après son en-tête, une tranche devient
             une suite de chiffres sans nom de colonne. */
          .mes-table + .mes-table { break-before: page; }
          .mes-table thead { display: table-header-group; }
          .mes-table tr { break-inside: avoid; }
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
          <p className="ed-eyebrow text-gold">Suivi des mesures</p>
          <h1 className="ed-display ed-headline mt-3 text-cream">{firstName}, vos mesures dans le temps.</h1>
          <p className="ed-prose mt-10 text-lg text-cream/75 sm:text-xl">
            {dates.length > 1
              ? `Chaque prise depuis le ${formatBilanDate(dates[0])} — ${dates.length} au total.`
              : 'Vos mesures, telles qu’elles ont été prises en rendez-vous.'}
          </p>
        </div>
        <div aria-hidden="true" />
      </header>

      {groupes.length > 0 && <ExplorateurMesures groupes={groupes} />}

      {groupes.length === 0 ? (
        <Section eyebrow="Suivi des mesures" title="Aucune mesure pour l’instant" tone="white">
          <p className="ed-prose text-base text-marine/60">
            Aucune prise n’a encore été enregistrée. Ce document se remplira dès la première.
          </p>
        </Section>
      ) : (
        <>
          {groupes.map((g, i) => (
            <Section
              key={g.titre}
              eyebrow={g.titre}
              title={TITRES[g.titre] ?? g.titre}
              lead={
                i === 0
                  ? 'Chaque encadré montre la dernière valeur mesurée et le chemin parcouru depuis la première prise. La variation est donnée telle quelle : c’est votre kinésiologue qui l’interprète avec vous.'
                  : undefined
              }
              tone={i % 2 === 0 ? 'paper' : 'white'}
            >
              <GrilleCartes groupe={g} />
            </Section>
          ))}

          {dates.length > 1 && (
            <Section
              eyebrow="Le détail"
              title="Toutes vos prises"
              lead="Le même contenu, prise par prise, pour retrouver un chiffre précis."
              tone={groupes.length % 2 === 0 ? 'paper' : 'white'}
            >
              <TableauDetail series={toutes} dates={dates} />
            </Section>
          )}
        </>
      )}

      <footer className="ed-footer border-t border-marine/10 bg-cream px-6 pb-16 pt-14 text-marine sm:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="ed-eyebrow text-gold-dark">Préparé pour vous par</p>
          <p className="ed-display mt-3 text-3xl text-marine">{data.kinesiologist}</p>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-marine/60">
            Document généré le{' '}
            {new Date(data.generatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}. Il
            fonctionne hors ligne et aucune de vos données n’est transmise à qui que ce soit — tout est contenu dans ce
            fichier.
          </p>
        </div>
      </footer>
    </div>
  )
}
