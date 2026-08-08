import { useState } from 'react'
import { TableProperties } from 'lucide-react'
import { WaistRiskBar } from './WaistRiskBar'
import { WAIST_BOUNDS, waistRating, waistRatingExplanation } from '../lib/norms/clinical'

/**
 * Barre de risque du tour de taille + bouton « Barème » qui déplie les seuils.
 *
 * Même facture que le bouton des cartes CPAFLA (composition, musculo) : Marie
 * retrouve le même geste partout. La ligne du client est surlignée, et une
 * phrase dit **quelle borne a été franchie** — c'est ce que le tableau seul ne
 * montre pas.
 *
 * Les trois lignes viennent de `WAIST_BOUNDS`, pas d'une recopie : ce
 * barème a déjà existé en quatre exemplaires divergents dans le projet.
 */
export function WaistBareme({ value, sex }: { value: number | null | undefined; sex: 'F' | 'M' | null }) {
  const [ouvert, setOuvert] = useState(false)
  if (sex === null || typeof value !== 'number' || !Number.isFinite(value)) return null

  const cote = waistRating(value, sex)
  const raison = waistRatingExplanation(value, sex)
  const [excellent, potentiel] = WAIST_BOUNDS[sex]

  // Les deux bornes sont EXCLUSIVES (« Scores < » dans la fenêtre Propriétés).
  // Écrire « 94 à 102 » suggérerait que 102 est encore dedans — il ne l'est pas.
  const lignes = [
    { cote: 4, label: 'Excellent', plage: `moins de ${excellent} cm`, couleur: 'text-green-700' },
    { cote: 3, label: 'Risque potentiel', plage: `${excellent} à moins de ${potentiel} cm`, couleur: 'text-yellow-700' },
    { cote: 1, label: 'Risque considérable', plage: `${potentiel} cm et plus`, couleur: 'text-red-700' }
  ]

  return (
    <div>
      <WaistRiskBar value={value} sex={sex} type="waist" />

      <button
        type="button"
        onClick={() => setOuvert(o => !o)}
        aria-pressed={ouvert}
        className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
          ouvert
            ? 'bg-gold/15 text-gold-dark hover:bg-gold/25'
            : 'bg-cream/70 text-marine/70 hover:bg-cream-dark hover:text-marine'
        }`}
        title="Afficher les seuils du tour de taille"
      >
        <TableProperties size={13} />
        Barème
      </button>

      {ouvert && (
        <div className="mt-2 rounded-md border border-cream-dark bg-white/70 p-3">
          <p className="text-[10px] uppercase tracking-wide text-marine/40 font-semibold mb-2">
            Tour de taille · {sex === 'F' ? 'femmes' : 'hommes'} · tous les âges
          </p>
          <table className="w-full text-xs tabular-nums">
            <tbody>
              {lignes.map(l => {
                const active = cote?.cote === l.cote
                return (
                  <tr
                    key={l.cote}
                    className={active ? 'bg-gold/10 font-semibold' : undefined}
                    title={active ? 'Ligne du client' : undefined}
                  >
                    <td className="py-1 pl-1.5 w-6 text-marine/50">{l.cote}</td>
                    <td className={`py-1 ${active ? l.couleur : 'text-marine/70'}`}>{l.label}</td>
                    <td className="py-1 pr-1.5 text-right text-marine/70">{l.plage}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {raison && (
            <p className="mt-2 pt-2 border-t border-cream-dark text-xs text-marine/60">
              <span className="font-semibold text-marine/75">Ici : </span>
              {raison}
            </p>
          )}
          {/* La cote 2 n'existe pas dans ce test — le signaler évite de croire à un bogue. */}
          <p className="mt-1 text-[10px] text-marine/35">
            Ce test n’attribue que les cotes 4, 3 et 1.
          </p>
        </div>
      )}
    </div>
  )
}
