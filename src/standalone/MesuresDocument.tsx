import { FOREST_BG, Section, type StandaloneData } from './EditorialReport'
import logoConseil from '../assets/logo-conseil.png'
import { formatBilanDate } from '../pages/client/bilanFields'
import { evolution, groupesDeMesures, type SerieMesure } from '../lib/mesures-doc'

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
 * est coupé, pas mis en défilement. On découpe donc en tranches de huit
 * colonnes, chacune reprenant le nom des mesures.
 */
const DATES_PAR_TABLEAU = 8

function tranches<T>(liste: T[], taille: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
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
      {tranches(dates, DATES_PAR_TABLEAU).map(bloc => (
        <div key={bloc[0]} className="mes-table overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-marine/15">
                <th className="py-2 pr-4 text-left font-medium text-marine/60">Mesure</th>
                {bloc.map(d => (
                  <th key={d} className="whitespace-nowrap px-2 py-2 text-right font-medium text-marine/60">
                    {formatBilanDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seriesDe(bloc).map(s => (
                <tr key={s.cle} className="border-b border-cream-dark/50">
                  <td className="whitespace-nowrap py-2 pr-4 text-marine/80">
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
    <div className="overflow-x-hidden bg-cream text-marine">
      {/* Impression / PDF : mêmes règles que les autres documents — fonds rendus,
          cartes jamais coupées entre deux pages, couverture raccourcie. */}
      <style>{`
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { margin: 12mm; }
          .ed-hero { min-height: 0 !important; }
          .ed-anchor { padding-top: 16px !important; padding-bottom: 16px !important; }
          .mes-carte { break-inside: avoid; }
          /* Chaque tranche du tableau démarre sur sa propre page : coupée après
             son en-tête, elle devient une suite de chiffres sans nom de colonne. */
          .mes-table { break-before: page; }
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
              <div className="grid gap-4 sm:grid-cols-2">
                {g.series.map(s => (
                  <CarteMesure key={s.cle} serie={s} />
                ))}
              </div>
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

      <footer className="border-t border-marine/10 bg-cream px-6 pb-16 pt-14 text-marine sm:px-8">
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
