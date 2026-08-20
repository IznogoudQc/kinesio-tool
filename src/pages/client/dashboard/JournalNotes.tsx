import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Lock, Plus } from 'lucide-react'
import { notesService } from '../../../services/notes'
import { libelleSection } from '../../../lib/note-sections'
import { formatBilanDate } from '../bilanFields'

/** Au-delà, la liste devient un mur : le reste se lit dans l'onglet Notes. */
const MAX_AFFICHEES = 5

/**
 * Le journal des notes, dans la section « Dans le temps ».
 *
 * Ces notes SONT une progression : elles racontent ce que les courbes ne disent
 * pas — ce que le client a essayé, ce qui a coincé, ce qu'il a dit. Les lire à
 * côté des graphiques donne la version longue de la même histoire.
 *
 * ── Ajouter ici, modifier ailleurs ──────────────────────────────────────────
 *
 * On peut ÉCRIRE une note depuis ce bloc : Marie est déjà devant son tableau
 * de bord, l'envoyer dans un autre onglet pour trois lignes n'a pas de sens.
 * Ajouter ne risque rien — c'est une note de plus.
 *
 * La MODIFICATION reste dans l'onglet Notes. Deux endroits pour changer le même
 * texte finissent toujours par diverger, et rien n'oblige à prendre ce risque
 * pour une correction qui est rare.
 *
 * La note créée ici n'a pas de section, exactement comme celle écrite dans
 * l'onglet Notes : ce bloc EST ce journal, vu depuis le tableau de bord.
 *
 * Privées comme partout ailleurs — jamais dans le PDF ni le document du client.
 */
export function JournalNotes({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<ClientNote[] | null>(null)
  const [brouillon, setBrouillon] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    notesService.list(clientId).then(setNotes).catch(() => setNotes([]))
  }, [clientId])

  async function ajouter() {
    const texte = brouillon.trim()
    if (!texte || occupe) return
    setOccupe(true)
    setErreur(null)
    try {
      const creee = await notesService.create(clientId, { content: texte })
      setNotes(n => [creee, ...(n ?? [])])
      setBrouillon('')
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "La note n'a pas pu être enregistrée.")
    } finally {
      setOccupe(false)
    }
  }

  const visibles = (notes ?? []).slice(0, MAX_AFFICHEES)
  const reste = (notes?.length ?? 0) - visibles.length

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

      <div className="flex gap-2 mb-3">
        <textarea
          value={brouillon}
          onChange={e => setBrouillon(e.target.value)}
          rows={2}
          placeholder="Observations, contenu de séance, ressenti du client…"
          className="flex-1 px-2.5 py-2 border border-cream-dark rounded-md bg-white text-marine text-sm placeholder-marine/30 resize-y focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
        />
        <button
          type="button"
          onClick={ajouter}
          disabled={!brouillon.trim() || occupe}
          className="self-start inline-flex items-center gap-1 px-3 py-2 rounded-md border border-gold/50 text-marine/70 text-sm hover:border-gold hover:bg-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {occupe ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Ajouter
        </button>
      </div>

      {erreur && <p className="text-red-700 text-xs mb-2">{erreur}</p>}

      {notes === null ? (
        <p className="text-marine/35 text-sm">Chargement…</p>
      ) : notes.length === 0 ? (
        <p className="text-marine/35 text-sm">Aucune note pour l’instant.</p>
      ) : (
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
      )}

      {reste > 0 && (
        <p className="text-marine/40 text-xs mt-2">
          <Link to={`/clients/${clientId}/notes`} className="hover:text-marine transition-colors">
            {reste} note{reste > 1 ? 's' : ''} de plus — avec la modification et la suppression
          </Link>
        </p>
      )}
    </div>
  )
}
