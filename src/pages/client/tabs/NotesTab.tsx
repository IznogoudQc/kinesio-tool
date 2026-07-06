import { useCallback, useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { Loader2, Lock, PencilLine, Save, StickyNote, Trash2 } from 'lucide-react'
import { useClient } from '../ClientDetailLayout'
import { notesService } from '../../../services/notes'
import { formatBilanDate } from '../bilanFields'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cleanErr(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message) return fallback
  return err.message.replace(/^Error invoking remote method '[^']+':\s*/i, '').replace(/^(Uncaught\s+)?(Zod)?Error:\s*/i, '').trim() || fallback
}

/** Onglet Notes — journal de notes cliniques datées, privé (jamais dans le rapport). */
export function NotesTab() {
  const client = useClient()
  const [list, setList] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [content, setContent] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<ClientNote | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await notesService.list(client.id))
    } catch {
      setError('Impossible de charger les notes.')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // « Dirty » = nouvelle note saisie non enregistrée → bloque la navigation sortante.
  const dirty = !editId && content.trim() !== ''
  const blocker = useBlocker(dirty)

  function resetForm() {
    setDate(todayISO())
    setContent('')
    setEditId(null)
  }

  function startEdit(n: ClientNote) {
    setDate(n.date)
    setContent(n.content)
    setEditId(n.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    if (content.trim() === '') return
    setSaving(true)
    setError(null)
    try {
      const payload: ClientNoteInput = { date, content: content.trim() }
      if (editId) await notesService.update(editId, payload)
      else await notesService.create(client.id, payload)
      resetForm()
      await reload()
      setToast(editId ? 'Note mise à jour' : 'Note ajoutée')
    } catch (err) {
      setError(cleanErr(err, "Erreur lors de l'enregistrement."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-6">
      <header>
        <div className="flex items-center gap-2.5">
          <StickyNote size={20} className="text-gold-dark" />
          <h2 className="text-marine font-bold text-2xl leading-tight">Notes</h2>
        </div>
        <p className="text-marine/55 text-sm mt-1 flex items-center gap-1.5">
          <Lock size={13} className="text-marine/40" />
          Notes cliniques privées de {client.name.split(' ')[0]} — jamais incluses dans le rapport envoyé au client.
        </p>
      </header>

      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</div>
      )}

      {/* Formulaire d'ajout / édition */}
      <section className="bg-white border border-cream-dark/40 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-marine font-semibold text-base">{editId ? 'Modifier la note' : 'Nouvelle note'}</h3>
          {editId && (
            <button type="button" onClick={resetForm} className="text-marine/50 hover:text-marine text-sm underline">
              Annuler la modification
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <label className="text-marine/60 text-sm font-medium">Date</label>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={e => setDate(e.target.value || todayISO())}
            className="px-3 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
          />
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={5}
          placeholder="Observations, contenu de séance, objectifs discutés, ressenti du client…"
          className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors resize-y"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={save}
            disabled={content.trim() === '' || saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {editId ? 'Mettre à jour' : 'Ajouter la note'}
          </button>
          {content.trim() === '' && <span className="text-marine/40 text-sm">Écrivez une note pour l'enregistrer.</span>}
        </div>
      </section>

      {/* Historique */}
      <section>
        <h3 className="text-marine font-semibold text-lg mb-3">
          Notes précédentes{list.length > 0 && <span className="text-marine/40 font-normal"> ({list.length})</span>}
        </h3>
        {loading ? (
          <p className="text-marine/40 text-base">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="text-marine/45 text-base">Aucune note pour ce client. Écrivez la première ci-dessus.</p>
        ) : (
          <ul className="space-y-3">
            {list.map(n => (
              <li key={n.id} className="bg-white border border-cream-dark/40 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-marine font-semibold text-sm">{formatBilanDate(n.date)}</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      title="Modifier"
                      className="inline-flex items-center gap-1 text-gold-dark hover:text-marine text-sm font-medium transition-colors"
                    >
                      <PencilLine size={15} /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(n)}
                      title="Supprimer"
                      aria-label={`Supprimer la note du ${formatBilanDate(n.date)}`}
                      className="text-red-500/70 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-marine/80 text-base mt-2 whitespace-pre-wrap leading-relaxed">{n.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleting && (
        <ConfirmDialog
          message={`Supprimer la note du ${formatBilanDate(deleting.date)} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await notesService.delete(deleting.id)
              if (editId === deleting.id) resetForm()
              setDeleting(null)
              await reload()
              setToast('Note supprimée')
            } catch (err) {
              setError(cleanErr(err, 'Erreur lors de la suppression.'))
              setDeleting(null)
            }
          }}
        />
      )}

      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
          <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark p-6">
            <h2 className="text-marine font-semibold text-xl mb-2">Note non enregistrée</h2>
            <p className="text-marine/60 text-base mb-5">
              Vous avez une note en cours de rédaction. Si vous quittez, elle sera perdue.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => blocker.reset?.()}
                autoFocus
                className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-base transition-colors"
              >
                Rester sur la page
              </button>
              <button
                type="button"
                onClick={() => blocker.proceed?.()}
                className="px-5 py-2 bg-red-600 text-white font-semibold rounded-md text-base hover:bg-red-700 transition-colors"
              >
                Quitter sans enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-marine text-cream text-base font-medium px-5 py-3 rounded-lg shadow-2xl border border-marine-light/40">
          {toast}
        </div>
      )}
    </div>
  )
}

function ConfirmDialog({
  message,
  onCancel,
  onConfirm
}: {
  message: string
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark p-6">
        <h2 className="text-marine font-semibold text-xl mb-2">{message}</h2>
        <p className="text-marine/50 text-sm mb-5">Cette action est irréversible.</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            autoFocus
            className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-base transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white font-semibold rounded-md text-base hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}
