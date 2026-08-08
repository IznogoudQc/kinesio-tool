import type { ReactNode } from 'react'
import { VALIDATION, VALIDATION_STATUS_LABELS, type ValidationStatut } from '../../lib/norms/validation-status'

/**
 * Onglet « Mesures / Bilans » — une carte par test, groupées par section.
 *
 * Remplace la carte unique qui décrivait toutes les normes en un paragraphe.
 * Pour savoir quel barème s'applique au VO2max, il fallait lire la phrase
 * entière ; et quand la logique d'un test changeait, il fallait retrouver la
 * bonne demi-phrase et espérer qu'elle soit encore juste. C'est précisément
 * comme ça que la ligne « IMC et tour de taille » a menti pendant deux versions.
 *
 * Ici chaque test porte sa source, son état de validation et ses réglages. En
 * ajouter un devient une modification locale.
 *
 * L'état vient de `validation-status.ts` — le même descripteur que le PDF des
 * barèmes. Deux surfaces, une source : elles ne peuvent pas diverger.
 */

const PASTILLE: Record<ValidationStatut, string> = {
  confirme: 'bg-green-100 text-green-800',
  a_confirmer: 'bg-amber-100 text-amber-800',
  deduit: 'bg-red-100 text-red-800'
}

/** Une carte de test : titre, ce qu'il mesure, sa source, son état, ses réglages. */
export function TestCard({
  titre,
  role,
  validationId,
  children
}: {
  titre: string
  /** Ce que le test apporte, en une ligne — pas sa définition clinique. */
  role: string
  /** Clé dans `validation-status.ts`, si ce test y figure. */
  validationId?: string
  children?: ReactNode
}) {
  const v = validationId ? VALIDATION.find(e => e.id === validationId) : undefined

  return (
    <div className="rounded-lg border border-cream-dark bg-white p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h4 className="text-marine font-semibold text-base">{titre}</h4>
        {v && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PASTILLE[v.statut]}`}>
            {VALIDATION_STATUS_LABELS[v.statut]}
          </span>
        )}
      </div>
      <p className="text-marine/60 text-sm mt-1">{role}</p>
      {/* `source` peut être vide : certains tests portent leur citation dans leur
          propre panneau, sous la table qu'elle concerne. Mieux placée là qu'en
          en-tête de carte, où elle se lisait comme un rappel sans objet. */}
      {v?.source && <p className="text-marine/45 text-sm mt-2 leading-relaxed">{v.source}</p>}
      {v?.manque && (
        <p className="text-amber-800 text-sm mt-2 leading-relaxed">
          <span className="font-semibold">Il manque : </span>
          {v.manque}
        </p>
      )}
      {children && <div className="mt-3 pt-3 border-t border-cream-dark/60">{children}</div>}
    </div>
  )
}

/** Intitulé de section, avec ce qui la justifie. */
export function TestSection({ titre, sous, children }: { titre: string; sous: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-marine font-semibold text-base">{titre}</h3>
      <p className="text-marine/50 text-sm mt-0.5 mb-3">{sous}</p>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
