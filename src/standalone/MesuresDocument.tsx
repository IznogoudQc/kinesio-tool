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
import { formatBilanDate, makeDateTickFormatter } from '../pages/client/bilanFields'
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
 * Combien de RANGÉES d'encadrés tiennent sous un titre, sur une page A4.
 *
 * On compte en rangées et non en encadrés parce qu'une région de trois mesures
 * en occupe deux, dont une à moitié vide : à six encadrés par page, « Tronc »
 * et « Haut du corps » réclamaient quatre rangées pour une page qui n'en tient
 * que trois, et Chromium reportait la seconde région sur une feuille sans
 * titre — exactement ce que la reprise « (suite) » doit éviter.
 */
const RANGEES_PAR_PAGE = 3

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
  series: SerieMesure[]
}

/** Ce qui tient sur UNE feuille : une ou plusieurs régions, dans l'ordre. */
interface PageCartes {
  blocs: BlocCartes[]
}

/**
 * Découpe un groupe en pages imprimées.
 *
 * Un groupe qui tient sur une page reste d'un seul tenant : il n'a pas besoin
 * d'être sous-titré, et l'ordre des mesures y est celui du formulaire (les cinq
 * que Marie-Eve prend d'habitude en premier).
 *
 * Au-delà, la coupure se fait par région du corps — « Bas du corps » en tête de
 * paquet dit au lecteur ce qu'il regarde. Les régions sont ensuite REMPLIES
 * dans des pages jusqu'à `RANGEES_PAR_PAGE`, au lieu de laisser Chromium
 * décider où couper : il reportait la région suivante, insécable, sur une
 * feuille qui ne portait alors aucun titre.
 *
 * Chaque page au-delà de la première démarre la sienne et reprend le titre de
 * la section (voir `GrilleCartes`) : une grille d'encadrés sans en-tête ne dit
 * pas ce qu'elle mesure.
 */
function pagesImprimables(groupe: GroupeMesures): PageCartes[] {
  if (groupe.series.length <= CARTES_PAR_PAGE) return [{ blocs: [{ series: groupe.series }] }]

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
      blocs.push({ titre: i === 0 ? premier : `${nom} (suite)`, series: part })
    })
  }

  // Deux encadrés par rangée : une région impaire en laisse une à moitié vide,
  // et c'est la place occupée — pas le nombre de mesures — qui décide.
  const rangees = (b: BlocCartes): number => Math.ceil(b.series.length / 2)

  const pages: PageCartes[] = []
  for (const bloc of blocs) {
    const courante = pages[pages.length - 1]
    const occupe = courante?.blocs.reduce((n, b) => n + rangees(b), 0) ?? 0
    if (courante && occupe + rangees(bloc) <= RANGEES_PAR_PAGE) courante.blocs.push(bloc)
    else pages.push({ blocs: [bloc] })
  }
  return pages
}

/**
 * Les encadrés d'un groupe, découpés pour l'impression.
 *
 * Chromium n'applique pas `break-before: avoid` : on ne peut pas lui demander
 * de garder un titre avec ce qui le suit. Un sous-titre n'existe donc qu'À
 * L'INTÉRIEUR du bloc qu'il nomme, et c'est le bloc entier qui refuse d'être
 * coupé — à l'intérieur, les grappes de deux rangées servent de filet.
 */
function GrilleCartes({ groupe, eyebrow, titre }: { groupe: GroupeMesures; eyebrow: string; titre: string }) {
  const pages = pagesImprimables(groupe)

  return (
    <div className="space-y-4">
      {pages.map((page, i) => (
        <div key={page.blocs[0].series[0].cle} className={`space-y-4${i > 0 ? ' mes-page-neuve' : ''}`}>
          {/* Le titre de la section ne couvre que la première page. Les suivantes
              le reprennent suivi de « (suite) », comme les tranches du tableau :
              sans lui, la feuille s'ouvre sur des encadrés sans en-tête.
              À l'écran la section est d'un seul tenant — ce rappel n'existe donc
              que sur papier. */}
          {i > 0 && (
            <div className="mes-impression mb-8">
              <p className="ed-eyebrow text-gold-dark">{eyebrow}</p>
              <h3 className="ed-display ed-section-title mt-3 text-marine">{titre} (suite)</h3>
            </div>
          )}
          {page.blocs.map(bloc => (
            <div key={bloc.series[0].cle} className="mes-bloc space-y-4">
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
      ))}
    </div>
  )
}

/**
 * En dessous de ce nombre de valeurs, une mesure est rangée derrière le bouton.
 *
 * Deux, donc : une mesure prise une seule fois n'a rien à raconter dans un
 * tableau d'évolution — sa valeur est déjà sur son encadré, à côté de « Première
 * prise ». Le libellé du bouton dit « prises une seule fois » et suppose donc ce
 * seuil-ci : le relever demanderait de le réécrire.
 */
const MIN_VALEURS_POUR_AFFICHER = 2

/** Une valeur du tableau, ou un tiret quand la mesure n'a pas été prise ce jour-là. */
function valeurDe(s: SerieMesure, date: string): string {
  const p = s.points.find(x => x.date === date)
  return p ? nf1(p.valeur) : '—'
}

/**
 * Le tableau complet, en DEUX rendus.
 *
 * Le document est un seul fichier : le PDF est l'impression de ce même HTML
 * (`htmlFileToPdf`), et le client qui reçoit le `.html` peut l'imprimer lui
 * aussi. Les deux rendus vivent donc côte à côte dans le DOM, basculés en CSS —
 * comme l'explorateur interactif, déjà en `ed-no-print`, avec les encadrés
 * statiques pour pendant sur papier.
 *
 * Choisir par un drapeau dans les données aurait produit un HTML SANS le rendu
 * imprimable : la version envoyée au client se serait réimprimée avec ses
 * dernières colonnes coupées, exactement le défaut corrigé en v0.9.219.
 *
 *  - à l'écran : UNE table qui défile. On compare 2011 à 2026 d'un geste, sans
 *    chercher dans quelle tranche se trouve la date.
 *  - à l'impression : des tranches, parce qu'une A4 portrait ne tient que cinq
 *    colonnes et que ce qui déborde du papier est coupé, pas mis en défilement.
 */
function TableauDetail({ series, dates }: { series: SerieMesure[]; dates: string[] }) {
  /**
   * Une mesure prise une seule fois : une ligne quasi vide au milieu de celles
   * qui, elles, racontent une évolution. Repliée derrière un bouton à l'écran ;
   * toujours présente sur papier, où rien ne se déplie.
   */
  const creuses = series.filter(s => s.points.length < MIN_VALEURS_POUR_AFFICHER)
  const [toutMontrer, setToutMontrer] = useState(false)
  const pluriel = creuses.length > 1 ? 's' : ''
  const visibles = toutMontrer ? series : series.filter(s => s.points.length >= MIN_VALEURS_POUR_AFFICHER)

  return (
    <>
      <div className="ed-no-print">
        <TableauDefilant series={visibles} dates={dates} />
        {creuses.length > 0 && (
          <button
            type="button"
            onClick={() => setToutMontrer(v => !v)}
            aria-expanded={toutMontrer}
            className="mt-4 text-xs font-medium text-marine/55 underline decoration-cream-dark decoration-2 underline-offset-4 transition-colors hover:text-marine hover:decoration-gold"
          >
            {toutMontrer
              ? `Masquer les ${creuses.length} mesure${pluriel} prise${pluriel} une seule fois`
              : `Afficher ${creuses.length} mesure${pluriel} prise${pluriel} une seule fois`}
          </button>
        )}
      </div>
      <div className="mes-impression">
        <TableauEnTranches series={series} dates={dates} />
      </div>
    </>
  )
}

/**
 * À l'écran : une seule table qui défile.
 *
 * La colonne des noms et la ligne des dates restent collées (`sticky`) : sans
 * elles on perd de vue quelle mesure on lit dès la quatrième colonne, c'est-à-dire
 * précisément au moment où le tableau devient utile.
 */
function TableauDefilant({ series, dates }: { series: SerieMesure[]; dates: string[] }) {
  return (
    <div className="relative">
      <div className="mes-defilant max-h-[70vh] overflow-auto rounded-lg border border-cream-dark/60">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 whitespace-nowrap border-b border-marine/15 bg-cream px-3 py-2.5 text-left font-medium text-marine/60">
                Mesure
              </th>
              {dates.map(d => (
                <th
                  key={d}
                  className="sticky top-0 z-10 whitespace-nowrap border-b border-marine/15 bg-cream px-4 py-2.5 text-right font-medium text-marine/60"
                >
                  {formatBilanDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map(s => (
              <tr key={s.cle} className="group">
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-cream-dark/50 bg-white px-3 py-2 text-marine/80 group-hover:bg-cream/40">
                  {s.label} <span className="text-marine/40">({s.unite})</span>
                </td>
                {dates.map(d => {
                  const p = s.points.find(x => x.date === d)
                  return (
                    <td
                      key={d}
                      className={`whitespace-nowrap border-b border-cream-dark/50 px-4 py-2 text-right tabular-nums group-hover:bg-cream/40 ${
                        p ? 'text-marine' : 'text-marine/25'
                      }`}
                    >
                      {p ? nf1(p.valeur) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Il y a plus à droite : un dégradé le dit sans occuper de place. Au-delà
          de quatre dates seulement — en dessous la table tient dans sa largeur,
          et le dégradé annoncerait un défilement qui n'existe pas. */}
      {dates.length > 4 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 top-0 w-10 rounded-r-lg bg-gradient-to-l from-cream to-transparent"
        />
      )}
    </div>
  )
}

/** À l'impression : des tranches de dates, chacune sur sa page, toutes avec les mêmes lignes. */
function TableauEnTranches({ series, dates }: { series: SerieMesure[]; dates: string[] }) {
  return (
    <div className="space-y-8">
      {repartir(dates, DATES_PAR_TABLEAU).map((bloc, i) => (
        <div key={bloc[0]} className={i > 0 ? 'mes-page-neuve' : undefined}>
          {/* Le titre de la section ne couvre que la première tranche. Les
              suivantes démarrent leur propre page et le reprennent : sans ça on
              tombe sur une grille de chiffres sans savoir ce qu'on lit. */}
          {i > 0 && (
            <div className="mb-8">
              <p className="ed-eyebrow text-gold-dark">Le détail</p>
              <h3 className="ed-display ed-section-title mt-3 text-marine">Toutes vos prises (suite)</h3>
              <p className="ed-prose mt-3 text-base text-marine/60">
                Du {formatBilanDate(bloc[0])} au {formatBilanDate(bloc[bloc.length - 1])}.
              </p>
            </div>
          )}
          <div className="mes-table overflow-x-auto">
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
              {/* TOUTES les mesures, à chaque tranche — et pas seulement celles
                  présentes dans celle-ci. Le filtre par tranche faisait
                  apparaître « Biceps fléchi » sur la deuxième page et pas sur la
                  première, comme si la ligne avait été oubliée. Une cellule sans
                  valeur porte un tiret, ce qui se lit tout seul. */}
              <tbody>
                {series.map(s => (
                  <tr key={s.cle} className="border-b border-cream-dark/50">
                    <td className="py-2 pr-4 text-marine/80">
                      {s.label} <span className="text-marine/40">({s.unite})</span>
                    </td>
                    {bloc.map(d => (
                      <td key={d} className="px-2 py-2 text-right tabular-nums text-marine">
                        {valeurDe(s, d)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  // L'axe porte la DATE et non un mois pré-calculé : deux prises d'un même mois
  // donnaient deux fois « sept 2026 », impossible de savoir laquelle on regarde.
  // Le formateur ne descend au jour que sur les mois effectivement dédoublés.
  const formatTick = makeDateTickFormatter(points.map(p => p.date))
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
            <LineChart data={points} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="rgba(10, 28, 94, 0.08)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatTick}
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
        /* Le rendu imprimable du tableau n'existe que sur papier. Son pendant
           a l'ecran porte ed-no-print, defini dans editorial.css. */
        .mes-impression { display: none; }
        @media print {
          @page { margin: 12mm; }
          .ed-hero { min-height: 0 !important; }

          /* Le retrait vertical d'une section vit sur le div INTÉRIEUR
             (py-16 sm:py-24), pas sur le <section> qui porte .ed-anchor. Viser
             le seul .ed-anchor ne retirait donc rien : les 96 px de retrait bas
             de la dernière section débordaient sur la feuille suivante, qui
             partait à l'impression comme une page blanche. */
          .ed-anchor,
          .ed-anchor > div { padding-top: 16px !important; padding-bottom: 16px !important; }

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
             sinon ce titre occupe une page à lui seul. Les suivantes portent la
             classe mes-page-neuve (ci-dessus) et reprennent le titre en haut de
             leur page. */
          .mes-table thead { display: table-header-group; }
          .mes-table tr { break-inside: avoid; }

          /* Sur papier, aucun bouton ne se clique : le rendu en tranches porte
             donc TOUTES les lignes, quel que soit l'etat du repli a l'ecran. */
          .mes-impression { display: block; }
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
              <GrilleCartes groupe={g} eyebrow={g.titre} titre={TITRES[g.titre] ?? g.titre} />
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
