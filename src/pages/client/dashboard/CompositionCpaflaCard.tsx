import { useEffect, useState } from 'react'
import { TableProperties } from 'lucide-react'
import { CATEGORY_COLORS, CATEGORY_LABELS, type Category } from '../../../lib/norms'
import {
  cpaflaCompositionBareme,
  USE_CALF_SKINFOLD,
  cpaflaCompositionExplanation,
  cpaflaCompositionMethod,
  type CpaflaCompositionDetail
} from '../../../lib/norms/cpafla-composition'
import { ReportEye } from '../../../components/ReportEye'

interface Props {
  /** Score composite (0-4) + catégorie (computed.composition). */
  score: number | null
  category: Category | null
  detail: CpaflaCompositionDetail
  imc: number | null
  /** Tour de taille (cm). */
  ct: number | null
  /** Somme des 5 plis (mm), ou null si le mollet manque. */
  s5pc: number | null
  sex: 'F' | 'M'
}

const nf = (n: number | null, d = 1): string =>
  n === null ? '—' : n.toLocaleString('fr-CA', { maximumFractionDigits: d })

const BAREME_KEY = 'kinesio.composition.bareme'
const loadBareme = (): boolean =>
  typeof window !== 'undefined' && window.localStorage.getItem(BAREME_KEY) === '1'

interface Row {
  label: string
  value: string
  pts: string
}

/** Explique au client la note de composition corporelle (méthode CPAFLA) : mesures,
 *  points (colonnes A/B/C), calcul. Bouton « Barème » → table Fig. 7-4/7-5 avec la
 *  ligne/case du client surlignée. Affiché uniquement sous norme CPAFLA. */
export function CompositionCpaflaCard({ score, category, detail, imc, ct, s5pc, sex }: Props) {
  const [showBareme, setShowBareme] = useState<boolean>(loadBareme)
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(BAREME_KEY, showBareme ? '1' : '0')
  }, [showBareme])

  if (score === null || detail.combo === null) return null

  const rows: Row[] = []
  if (detail.imcBandLabel !== null) rows.push({ label: 'IMC', value: `${nf(imc)} kg/m²`, pts: `plage ${detail.imcBandLabel}` })
  if (detail.b !== null) rows.push({ label: 'Tour de taille', value: `${nf(ct, 0)} cm`, pts: `${detail.b} pt${detail.b > 1 ? 's' : ''}` })
  if (detail.c !== null) rows.push({ label: 'Somme des 5 plis', value: `${nf(s5pc)} mm`, pts: `${detail.c} pt${detail.c > 1 ? 's' : ''}` })

  const calcul = cpaflaCompositionExplanation(detail, nf) ?? ''

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <p className="dash-eyebrow text-gold-dark">Composition corporelle</p>
        <div className="flex items-center gap-3">
          <span className="flex items-baseline gap-2">
            {/* Le résultat publié est à UNE décimale (StatCan, tableau 16) : avec
                les trois mesures, la moyenne pondérée vaut 3,6 et non 4. La cote
                entière, elle, reste ce qui entre dans le score global. */}
            <span className="text-marine font-bold text-2xl tabular-nums leading-none">
              {nf(detail.valeur ?? score, 1)}
            </span>
            <span className="text-marine/40 text-xs">/ 4</span>
            {category && <span className={`text-sm font-semibold ${CATEGORY_COLORS[category]}`}>{CATEGORY_LABELS[category]}</span>}
          </span>
          <button
            type="button"
            onClick={() => setShowBareme(b => !b)}
            aria-pressed={showBareme}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              showBareme ? 'bg-gold/15 text-gold-dark hover:bg-gold/25' : 'bg-cream/70 text-marine/70 hover:bg-cream-dark hover:text-marine'
            }`}
            title="Afficher le barème CPAFLA de la composition corporelle"
          >
            <TableProperties size={13} />
            Barème
          </button>
          <ReportEye section="composition" />
        </div>
      </div>

      <div className="divide-y divide-cream-dark/40 border-y border-cream-dark/40">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-marine/55">{r.label}</span>
            <span className="ml-auto text-marine font-medium tabular-nums">{r.value}</span>
            <span className="w-28 text-right text-marine/70 tabular-nums">{r.pts}</span>
          </div>
        ))}
      </div>

      <p className="text-marine/70 text-sm mt-3 leading-relaxed">{calcul}</p>

      {showBareme && <BaremeTable sex={sex} detail={detail} />}

      <p className="text-marine/40 text-xs mt-2">
        {cpaflaCompositionMethod(detail)}
      </p>
    </div>
  )
}

/** Table complète Fig. 7-4/7-5 pour le sexe, avec la ligne d'IMC et les cases (tour
 *  de taille / plis) du client surlignées. */
function BaremeTable({ sex, detail }: { sex: 'F' | 'M'; detail: CpaflaCompositionDetail }) {
  const rows = cpaflaCompositionBareme(sex)
  return (
    <div className="mt-4 pt-4 border-t border-cream-dark/40">
      <p className="text-marine/70 text-xs font-medium mb-2">
        Barème CPAFLA — {sex === 'F' ? 'femmes' : 'hommes'}
        <span className="text-marine/40 font-normal"> · la ligne et les cases surlignées sont celles du client</span>
      </p>
      {/* Le guide donne aussi une colonne « somme des 5 plis ». Elle n'est pas
          affichée : elle n'entre dans aucun calcul ici (le pli du mollet n'est
          pas mesuré), et la montrer laissait croire qu'elle comptait — c'est
          exactement la confusion signalée par Nicholas sur sa capture. */}
      {!USE_CALF_SKINFOLD && (
        <p className="text-marine/40 text-xs mb-2">
          Le guide prévoit aussi une colonne « somme des 5 plis ». Elle n’est pas reprise ici : le pli du
          mollet n’étant pas mesuré, elle n’entre dans aucun calcul.
        </p>
      )}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const activeBand = i === detail.imcIndex
          return (
            <div
              key={r.imcLabel}
              className={`rounded-lg border px-3 py-2 text-xs ${
                activeBand ? 'border-gold/50 bg-gold/10' : 'border-cream-dark/40 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-marine">IMC {r.imcLabel}</span>
                <span className="text-marine/45">· IMC seul : {r.a} pts</span>
              </div>
              <BaremeLine title="Tour de taille" cells={r.ct} activeIndex={activeBand ? detail.ctIndex : null} />
              {USE_CALF_SKINFOLD && (
                <BaremeLine title="Somme 5 plis" cells={r.s5pc} activeIndex={activeBand ? detail.s5pcIndex : null} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BaremeLine({
  title,
  cells,
  activeIndex
}: {
  title: string
  cells: { range: string; pts: number }[]
  activeIndex: number | null
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-marine/45 w-24 shrink-0">{title}</span>
      {cells.map((c, i) => (
        <span
          key={c.range}
          className={`tabular-nums rounded px-1.5 py-0.5 ${
            i === activeIndex ? 'bg-marine text-cream font-semibold' : 'text-marine/70'
          }`}
        >
          {c.range} → {c.pts}
        </span>
      ))}
    </div>
  )
}
