import { CATEGORY_COLORS, CATEGORY_LABELS, type Category } from '../../../lib/norms'
import type { CpaflaCompositionDetail } from '../../../lib/norms/cpafla-composition'

interface Props {
  /** Score composite (0-4) + catégorie, déjà calculé (computed.composition). */
  score: number | null
  category: Category | null
  detail: CpaflaCompositionDetail
  imc: number | null
  /** Tour de taille (cm). */
  ct: number | null
  /** Somme des 5 plis (mm), ou null si le mollet manque. */
  s5pc: number | null
}

const nf = (n: number | null, d = 1): string =>
  n === null ? '—' : n.toLocaleString('fr-CA', { maximumFractionDigits: d })

interface Row {
  label: string
  value: string
  pts: string
}

/** Explique au client POURQUOI la composition corporelle obtient sa note (méthode
 *  CPAFLA) : les mesures prises, leurs points (colonnes A/B/C du guide) et le
 *  calcul. Affiché uniquement sous norme CPAFLA. */
export function CompositionCpaflaCard({ score, category, detail, imc, ct, s5pc }: Props) {
  if (score === null || detail.combo === null) return null

  const rows: Row[] = []
  if (detail.imcBandLabel !== null) {
    rows.push({ label: 'IMC', value: `${nf(imc)} kg/m²`, pts: `plage ${detail.imcBandLabel}` })
  }
  if (detail.b !== null) {
    rows.push({ label: 'Tour de taille', value: `${nf(ct, 0)} cm`, pts: `${detail.b} pt${detail.b > 1 ? 's' : ''}` })
  }
  if (detail.c !== null) {
    rows.push({ label: 'Somme des 5 plis', value: `${nf(s5pc)} mm`, pts: `${detail.c} pt${detail.c > 1 ? 's' : ''}` })
  }

  // Phrase de calcul selon la combinaison de mesures réellement disponibles.
  let calcul: string
  switch (detail.combo) {
    case 'imc+ct+s5pc':
      calcul = `Calcul CPAFLA : (tour de taille ${detail.b} × 1,5 + plis ${detail.c}) ÷ 2,5 = ${nf(detail.raw, 2)} → arrondi à ${score}.`
      break
    case 'imc+ct':
      calcul = `Somme des 5 plis non mesurée (mollet manquant) → la note repose sur l’IMC et le tour de taille : ${detail.b} sur 4.`
      break
    case 'imc+s5pc':
      calcul = `Tour de taille non mesuré → la note repose sur l’IMC et la somme des 5 plis : ${detail.c} sur 4.`
      break
    case 'ct':
      calcul = `IMC non disponible → la note repose sur le tour de taille (référence IMC 27) : ${detail.b} sur 4.`
      break
    case 'imc':
      calcul = `Seul l’IMC est disponible → note ${detail.a} sur 4.`
      break
  }

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <p className="dash-eyebrow text-gold-dark">Pourquoi cette note — composition corporelle</p>
        <span className="flex items-baseline gap-2">
          <span className="text-marine font-bold text-2xl tabular-nums leading-none">{nf(score, 1)}</span>
          <span className="text-marine/40 text-xs">/ 4</span>
          {category && <span className={`text-sm font-semibold ${CATEGORY_COLORS[category]}`}>{CATEGORY_LABELS[category]}</span>}
        </span>
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
      <p className="text-marine/40 text-xs mt-2">
        Méthode du Physitest canadien (CPAFLA) : IMC, tour de taille et somme des cinq plis cutanés.
      </p>
    </div>
  )
}
