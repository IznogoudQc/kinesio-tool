import { useEffect, useState } from 'react'
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { notesService } from '../../../services/notes'
import { libelleSection, type NoteSectionKey } from '../../../lib/note-sections'
import { formatBilanDate } from '../bilanFields'

/**
 * Notes privées de Marie sous une section du tableau de bord.
 *
 * ── Privées, et il faut que ça se voie ──────────────────────────────────────
 *
 * Ces notes ne partent JAMAIS dans le PDF ni dans le document HTML remis au
 * client. Elles vivent dans `client_notes`, la table du journal clinique, qu'
 * aucun rendu de rapport ne lit. Le cadenas affiché n'est pas décoratif : sans
 * lui, Marie hésiterait à écrire ce qu'elle pense vraiment, et la fonction ne
 * servirait à rien.
 *
 * Chaque note porte sa date, posée automatiquement au moment de l'écriture —
 * une note d'accompagnement sans date ne se relit pas.
 */
export function SectionNotes({
  clientId,
  section
}: {
  clientId: string
  section: NoteSectionKey
}) {
  const [notes, setNotes] = useState<ClientNote[] | null>(null)
  const [brouillon, setBrouillon] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  /**
   * Replié tant qu'il n'y a rien à lire, déplié dès qu'une note existe.
   *
   * Cinq panneaux ouverts et vides noieraient le tableau de bord ; mais une
   * note qu'il faut aller chercher derrière un clic ne se relit jamais — et
   * c'est exactement au moment de rouvrir la fiche, juste avant de revoir le
   * client, qu'elle sert.
   */
  const [ouvert, setOuvert] = useState(false)

  useEffect(() => {
    notesService
      .list(clientId)
      .then(tout => {
        const propres = tout.filter(n => n.section === section)
        setNotes(propres)
        if (propres.length > 0) setOuvert(true)
      })
      .catch(() => setNotes([]))
  }, [clientId, section])

  async function ajouter() {
    const texte = brouillon.trim()
    if (!texte || occupe) return
    setOccupe(true)
    setErreur(null)
    try {
      const creee = await notesService.create(clientId, { content: texte, section })
      // En tête : la plus récente d'abord, comme le journal clinique.
      setNotes(n => [creee, ...(n ?? [])])
      setBrouillon('')
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "La note n'a pas pu être enregistrée.")
    } finally {
      setOccupe(false)
    }
  }

  async function supprimer(id: string) {
    try {
      await notesService.delete(id)
      setNotes(n => (n ?? []).filter(x => x.id !== id))
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "La note n'a pas pu être supprimée.")
    }
  }

  const nb = notes?.length ?? 0

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOuvert(o => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <Lock size={13} className="text-marine/35" />
          <span className="dash-eyebrow text-gold-dark">Mes notes</span>
          {nb > 0 && (
            <span className="text-marine/45 text-xs tabular-nums">
              {nb} note{nb > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className="text-marine/40 text-xs">{ouvert ? 'Masquer' : 'Ouvrir'}</span>
      </button>

      {ouvert && (
        <div className="mt-3 space-y-3">
          {/* Dit à qui appartiennent ces lignes, une fois, en haut. */}
          <p className="text-marine/40 text-[11px]">
            Visible par vous seule — {libelleSection(section)?.toLowerCase()}. Ces notes n’entrent ni
            dans le document du client ni dans le PDF.
          </p>

          <div className="flex gap-2">
            <textarea
              value={brouillon}
              onChange={e => setBrouillon(e.target.value)}
              rows={2}
              placeholder="Ce que vous voulez retenir de cette séance…"
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

          {erreur && <p className="text-red-700 text-xs">{erreur}</p>}

          {notes === null ? (
            <p className="text-marine/35 text-sm">Chargement…</p>
          ) : notes.length === 0 ? (
            <p className="text-marine/35 text-sm">Aucune note pour l’instant.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map(n => (
                <li
                  key={n.id}
                  className="group rounded-md border border-cream-dark/60 bg-cream/25 px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-marine/45 text-[11px] tabular-nums">
                      {formatBilanDate(n.date)}
                    </span>
                    <button
                      type="button"
                      onClick={() => supprimer(n.id)}
                      className="text-marine/25 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Supprimer cette note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {/* `whitespace-pre-wrap` : Marie écrit en plusieurs lignes et
                      ses retours doivent survivre à la relecture. */}
                  <p className="text-marine/75 text-sm whitespace-pre-wrap mt-0.5">{n.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
