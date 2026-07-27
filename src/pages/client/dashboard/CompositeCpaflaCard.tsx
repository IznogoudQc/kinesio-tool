import { useEffect, useState } from 'react'
import { TableProperties } from 'lucide-react'
import { CATEGORY_COLORS, CATEGORY_LABELS, type Category } from '../../../lib/norms'
import { CPAFLA_TEST_LABELS, type CpaflaCombineDetail } from '../../../lib/norms/cpafla-combined'

interface Props {
  /** Titre de la carte — repris tel quel de l'ancien logiciel. */
  title: string
  /** Score composite 0-4 + catégorie (computed.backHealth ou computed.musculoGlobal). */
  score: number | null
  category: Category | null
  detail: CpaflaCombineDetail
  /** Clé de mémorisation du bouton « Barème » (localStorage). */
  storageKey: string
  /** Figure du guide CPHV d'où viennent les pondérations (ex. « Fig. 7-24 »). */
  figure: string
  /** Phrase de contexte affichée en pied de carte. */
  footnote: string
}

const nf1 = (n: number): string => n.toLocaleString('fr-CA', { maximumFractionDigits: 1 })

/** Explique une note combinée CPAFLA (indice de santé du dos, aptitude
 *  musculosquelettique) : chaque test coté 0-4, multiplié par son poids, puis
 *  `note obtenue ÷ note maximale × 4`. Les tests non mesurés sont exclus **des deux**
 *  totaux — c'est la règle du guide, et c'est ce qui explique qu'un bilan partiel
 *  donne quand même une note juste.
 *
 *  Même facture que `CompositionCpaflaCard`, avec un bouton « Barème » qui déplie
 *  les pondérations utilisées. */
export function CompositeCpaflaCard({ title, score, category, detail, storageKey, figure, footnote }: Props) {
  const [showBareme, setShowBareme] = useState<boolean>(
    () => typeof window !== 'undefined' && window.localStorage.getItem(storageKey) === '1'
  )
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, showBareme ? '1' : '0')
  }, [showBareme, storageKey])

  if (score === null || detail.max === 0) return null

  const mesures = detail.rows.filter(r => r.cote !== null)
  const absents = detail.rows.filter(r => r.cote === null)

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <p className="dash-eyebrow text-gold-dark">{title}</p>
        <div className="flex items-center gap-3">
          <span className="flex items-baseline gap-2">
            <span className="text-marine font-bold text-2xl tabular-nums leading-none">{nf1(score)}</span>
            <span className="text-marine/40 text-xs">/ 4</span>
            {category && (
              <span className={`text-sm font-semibold ${CATEGORY_COLORS[category]}`}>{CATEGORY_LABELS[category]}</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowBareme(b => !b)}
            aria-pressed={showBareme}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              showBareme ? 'bg-gold/15 text-gold-dark hover:bg-gold/25' : 'bg-cream/70 text-marine/70 hover:bg-cream-dark hover:text-marine'
            }`}
            title={`Afficher les pondérations CPAFLA (${figure})`}
          >
            <TableProperties size={13} />
            Barème
          </button>
        </div>
      </div>

      {/* Détail : chaque test coté, pondéré, et sa contribution. */}
      <div className="divide-y divide-cream-dark/40 border-y border-cream-dark/40">
        {mesures.map(r => (
          <div key={r.key} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-marine/70">{CPAFLA_TEST_LABELS[r.key] ?? r.key}</span>
            <span className="ml-auto text-marine/55 tabular-nums text-xs">
              cote {r.cote}
              {r.poids > 1 && <span className="text-gold-dark font-medium"> × {r.poids}</span>}
            </span>
            <span className="w-16 text-right text-marine font-medium tabular-nums">
              {r.points} / {r.maxPoints}
            </span>
          </div>
        ))}
      </div>

      <p className="text-marine/70 text-sm mt-3 leading-relaxed">
        Note obtenue <strong className="font-semibold tabular-nums">{nf1(detail.obtenue)}</strong> sur une note
        maximale de <strong className="font-semibold tabular-nums">{detail.max}</strong> →{' '}
        {nf1(detail.obtenue)} ÷ {detail.max} × 4 = <strong className="font-semibold tabular-nums">{nf1(score)}</strong>.
      </p>

      {absents.length > 0 && (
        <p className="text-marine/45 text-xs mt-2">
          Non mesuré{absents.length > 1 ? 's' : ''} :{' '}
          {absents.map(r => CPAFLA_TEST_LABELS[r.key] ?? r.key).join(', ')} — exclu
          {absents.length > 1 ? 's' : ''} du calcul, la note maximale est réduite d'autant.
        </p>
      )}

      {showBareme && (
        <div className="mt-4 pt-4 border-t border-cream-dark/40">
          <p className="text-marine/70 text-xs font-medium mb-2">
            Pondérations CPAFLA — {figure}
            <span className="text-marine/40 font-normal"> · un test pondéré ×2 pèse deux fois plus dans la note</span>
          </p>
          <div className="space-y-1">
            {detail.rows.map(r => (
              <div key={r.key} className="flex items-center justify-between gap-3 text-xs py-1">
                <span className="text-marine/60">{CPAFLA_TEST_LABELS[r.key] ?? r.key}</span>
                <span className={`tabular-nums ${r.poids > 1 ? 'text-gold-dark font-semibold' : 'text-marine/60'}`}>
                  × {r.poids}
                </span>
              </div>
            ))}
          </div>
          <p className="text-marine/40 text-[11px] mt-2">
            Chaque test est coté de 0 (À améliorer) à 4 (Excellent), puis multiplié par son poids.
          </p>
        </div>
      )}

      <p className="text-marine/40 text-xs mt-2">{footnote}</p>
    </div>
  )
}
