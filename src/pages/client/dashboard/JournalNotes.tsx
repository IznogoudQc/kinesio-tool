import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { notesService } from '../../../services/notes'
import { libelleSection } from '../../../lib/note-sections'
import { formatBilanDate } from '../bilanFields'

/** Au-delà, la liste devient un mur : le reste se lit dans l'onglet Notes. */
const MAX_AFFICHEES = 5

/**
 * Le journal des notes, en lecture, dans la section « Dans le temps ».
 *
 * Ces notes SONT une progression : elles racontent ce que les courbes ne
 * disent pas — ce que le client a essayé, ce qui a coincé, ce qu'il a dit. Les
 * lire à côté des graphiques donne la version longue de la même histoire.
 *
 * En LECTURE SEULE, volontairement : elles s'écrivent dans l'onglet Notes ou
 * sous leur section, et deux endroits pour modifier la même chose finissent
 * toujours par diverger. Un lien mène là où l'on corrige.
 *
 * Privées comme partout ailleurs — jamais dans le PDF ni le document du client.
 */
export function JournalNotes({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<ClientNote[] | null>(null)

  useEffect(() => {
    notesService.list(clientId).then(setNotes).catch(() => setNotes([]))
  }, [clientId])

  // Rien à montrer tant qu'il n'y a rien : un bloc vide dans le tableau de bord
  // n'apprend rien à personne.
  if (!notes || notes.length === 0) return null

  const visibles = notes.slice(0, MAX_AFFICHEES)
  const reste = notes.length - visibles.length

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="flex items-center gap-2">
          <Lock size={13} className="text-marine/35" />
          <span className="dash-eyebrow text-gold-dark">Journal des notes</span>
        </span>
        <Link
          to={`/clients/${clientId}/notes`}
          className="text-marine/40 hover:text-marine text-xs transition-colors"
        >
          Tout voir
        </Link>
      </div>

      <ol className="space-y-2">
        {visibles.map(n => (
          <li key={n.id} className="rounded-md border border-cream-dark/60 bg-cream/25 px-3 py-2">
            <p className="text-marine/45 text-[11px] tabular-nums">
              {formatBilanDate(n.date)}
              {libelleSection(n.section) && (
                <>
                  {' · '}
                  <span className="text-marine/35">{libelleSection(n.section)}</span>
                </>
              )}
            </p>
            {/* `whitespace-pre-wrap` : Marie écrit en plusieurs lignes et ses
                retours doivent survivre à la relecture. */}
            <p className="text-marine/75 text-sm whitespace-pre-wrap mt-0.5">{n.content}</p>
          </li>
        ))}
      </ol>

      {reste > 0 && (
        <p className="text-marine/40 text-xs mt-2">
          <Link to={`/clients/${clientId}/notes`} className="hover:text-marine transition-colors">
            {reste} note{reste > 1 ? 's' : ''} de plus dans l’onglet Notes
          </Link>
        </p>
      )}
    </div>
  )
}
