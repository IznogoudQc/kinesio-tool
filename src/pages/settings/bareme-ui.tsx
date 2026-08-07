import { useState, type ReactNode } from 'react'
import { CATEGORY_LABELS, type Category } from '../../lib/norms'
import { CPAFLA_TABLES } from '../../lib/norms/cpafla'
import { categoryCells } from '../../lib/norms/bareme'
import type { TestKey } from '../../lib/norms/types'

/**
 * Briques d'affichage des barèmes dans « Mesures / Bilans ».
 *
 * Chaque section (composition, aérobie, …) présente les mêmes choses : un texte
 * qui explique ce que la mesure dit, une ou plusieurs tables de barème, une
 * note de provenance. Écrites une fois par section, elles divergeaient en une
 * version — le premier panneau aérobie avait déjà des lignes plus serrées et
 * une pastille de couleur différente pour la même catégorie.
 *
 * ⚠️ Aucune de ces briques ne contient de valeur de barème. Les panneaux les
 * **lisent depuis le code** de cotation : une table de référence recopiée à la
 * main finit toujours par mentir sur ce que l'app calcule réellement.
 */

/** Barre d'onglets. Les barèmes d'une même section n'ont pas la même forme —
 *  empilés, ils deviennent illisibles ; côte à côte, chacun garde sa logique. */
export function Tabulations<K extends string>({
  onglets,
  actif,
  onChange
}: {
  onglets: readonly { key: K; label: string }[]
  actif: K
  onChange: (k: K) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-cream-dark mb-4">
      {onglets.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={actif === o.key}
          className={`px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
            actif === o.key
              ? 'border-gold text-marine'
              : 'border-transparent text-marine/50 hover:text-marine hover:border-cream-dark'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** État d'onglet + barre, en un seul appel. */
export function useTabulations<K extends string>(onglets: readonly { key: K; label: string }[]) {
  const [actif, setActif] = useState<K>(onglets[0].key)
  return { actif, barre: <Tabulations onglets={onglets} actif={actif} onChange={setActif} /> }
}

/** Bloc de texte explicatif — ce que la mesure dit, et ce qu'elle ne dit pas. */
export function Explication({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h5 className="text-marine font-semibold text-sm">{titre}</h5>
      <div className="text-marine/60 text-sm mt-1 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

/** Ligne de barème : cote optionnelle, intitulé coloré, plage alignée à droite. */
export function LigneBareme({
  cote,
  label,
  plage,
  couleur
}: {
  cote?: number
  label: string
  plage: string
  couleur: string
}) {
  return (
    <tr className="border-b border-cream-dark/50 last:border-0">
      {cote !== undefined && <td className="py-1.5 pl-2 w-8 text-marine/45 tabular-nums">{cote}</td>}
      <td className="py-1.5">
        <span className={`font-medium ${couleur}`}>{label}</span>
      </td>
      <td className="py-1.5 pr-2 text-right text-marine/70 tabular-nums">{plage}</td>
    </tr>
  )
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-cream-dark bg-white overflow-hidden">
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** Note de provenance, sous une table. */
export function Source({ children }: { children: ReactNode }) {
  return <p className="text-marine/40 text-xs mt-2 leading-relaxed">{children}</p>
}

/** Intertitre d'un groupe de lignes (« Hommes · 30-39 ans »). */
export function SousTitre({ children }: { children: ReactNode }) {
  return (
    <p className="text-marine/45 text-xs uppercase tracking-wide font-semibold mb-1.5">{children}</p>
  )
}

/**
 * Barème CPAFLA d'un test, par tranche d'âge, pour un sexe.
 *
 * Les tables musculosquelettiques et l'aérobie ont exactement cette forme : six
 * tranches d'âge × cinq catégories. La rendre une seule fois évite que l'aérobie
 * et le dos affichent la même chose de deux façons — et surtout qu'elles se
 * mettent à diverger sur les bornes, comme le PDF et le dashboard l'ont déjà fait.
 *
 * Les plages viennent de `categoryCells`, donc des seuils réellement appliqués
 * par `categorizeRaw`. Aucune borne n'est écrite ici.
 */
export function TableParAge({
  test,
  sex,
  unite,
  lowerIsBetter = false
}: {
  test: TestKey
  sex: 'F' | 'M'
  /** Suffixe affiché dans l'entête (« reps », « cm », « s »…). */
  unite: string
  lowerIsBetter?: boolean
}) {
  const rows = (CPAFLA_TABLES[test] ?? []).filter(r => r.sex === sex)
  if (rows.length === 0) return null

  return (
    <div>
      <SousTitre>
        {sex === 'M' ? 'Hommes' : 'Femmes'} · {unite}
      </SousTitre>
      <div className="rounded-md border border-cream-dark bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream-dark/60">
              <th className="py-1.5 pl-2 text-left font-medium text-marine/45 text-xs">Âge</th>
              {ORDRE_CAT.map(c => (
                <th key={c} className={`py-1.5 px-2 text-right text-xs font-semibold ${COULEUR_CAT[c]}`}>
                  {CATEGORY_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const cells = categoryCells(r.percentiles, lowerIsBetter)
              return (
                <tr key={r.ageMin} className="border-b border-cream-dark/50 last:border-0">
                  <td className="py-1.5 pl-2 text-marine/70 tabular-nums whitespace-nowrap">
                    {r.ageMin}–{r.ageMax}
                  </td>
                  {ORDRE_CAT.map(c => (
                    <td
                      key={c}
                      className="py-1.5 px-2 text-right text-marine/70 tabular-nums whitespace-nowrap"
                    >
                      {cells[c]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Couleur par catégorie — la même dans toutes les sections. */
export const COULEUR_CAT: Record<Category, string> = {
  A_AMELIORER: 'text-red-700',
  ACCEPTABLE: 'text-amber-700',
  BIEN: 'text-marine/70',
  TRES_BIEN: 'text-green-700',
  EXCELLENT: 'text-green-800'
}

/** Du meilleur au moins bon — l'ordre de lecture attendu d'un barème. */
export const ORDRE_CAT: Category[] = ['EXCELLENT', 'TRES_BIEN', 'BIEN', 'ACCEPTABLE', 'A_AMELIORER']

export { CATEGORY_LABELS }
