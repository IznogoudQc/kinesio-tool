import { useCallback, useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, PencilLine, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { useClient } from '../ClientDetailLayout'
import { questionnairesService } from '../../../services/questionnaires'
import { formatBilanDate } from '../bilanFields'
import {
  QAAP_QUESTIONS,
  emptyQaap,
  qaapExpiryDate,
  qaapHasWarning,
  qaapIsComplete,
  qaapIsExpired,
  qaapYesIndices,
  type QaapData
} from '../../../lib/qaap'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cleanErr(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message) return fallback
  return (
    err.message
      .replace(/^Error invoking remote method '[^']+':\s*/i, '')
      .replace(/^(Uncaught\s+)?(Zod)?Error:\s*/i, '')
      .trim() || fallback
  )
}

/** Normalise les données brutes (unknown) d'un Q-AAP vers une forme sûre. */
function asQaap(data: unknown): QaapData {
  const d = (data ?? {}) as Partial<QaapData>
  const answers = Array.isArray(d.answers) ? d.answers.slice(0, 7) : []
  while (answers.length < 7) answers.push(null)
  return { answers: answers.map(a => (a === true ? true : a === false ? false : null)), precision: d.precision, notes: d.notes }
}

/** Onglet Questionnaires — admission du client. Pour l'instant : le Q-AAP (PAR-Q). */
export function QuestionnairesTab() {
  const client = useClient()
  const [list, setList] = useState<Questionnaire[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Questionnaire | null>(null)

  // Édition : `editing` = questionnaire en cours (null = pas de formulaire ouvert).
  const [editing, setEditing] = useState<{ id: string | null; date: string; data: QaapData } | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await questionnairesService.list(client.id))
    } catch {
      setError('Impossible de charger les questionnaires.')
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

  const dirty = editing !== null
  const blocker = useBlocker(dirty && !saving)

  function startNew() {
    setEditing({ id: null, date: todayISO(), data: emptyQaap() })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startEdit(q: Questionnaire) {
    setEditing({ id: q.id, date: q.date, data: asQaap(q.data) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      if (editing.id) {
        await questionnairesService.update(editing.id, { date: editing.date, data: editing.data })
      } else {
        await questionnairesService.create(client.id, { type: 'qaap', date: editing.date, data: editing.data })
      }
      setEditing(null)
      await reload()
      setToast('Q-AAP enregistré')
    } catch (err) {
      setError(cleanErr(err, "Erreur lors de l'enregistrement."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <ClipboardList size={20} className="text-gold-dark" />
            <h2 className="text-marine font-bold text-2xl leading-tight">Questionnaires</h2>
          </div>
          <p className="text-marine/55 text-sm mt-1">
            Questionnaire sur l'aptitude à l'activité physique (Q-AAP / PAR-Q) — validité 12 mois.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors shadow-sm"
          >
            <Plus size={17} /> Nouveau Q-AAP
          </button>
        )}
      </header>

      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</div>
      )}

      {editing && (
        <QaapForm
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
          saving={saving}
        />
      )}

      {/* Historique */}
      {!editing && (
        <section>
          <h3 className="text-marine font-semibold text-lg mb-3">
            Historique{list.length > 0 && <span className="text-marine/40 font-normal"> ({list.length})</span>}
          </h3>
          {loading ? (
            <p className="text-marine/40 text-base">Chargement…</p>
          ) : list.length === 0 ? (
            <p className="text-marine/45 text-base">
              Aucun questionnaire pour ce client. Cliquez « Nouveau Q-AAP » pour en créer un.
            </p>
          ) : (
            <ul className="space-y-3">
              {list.map(q => (
                <QaapHistoryCard key={q.id} q={q} onEdit={() => startEdit(q)} onDelete={() => setDeleting(q)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {deleting && (
        <ConfirmDialog
          message={`Supprimer le Q-AAP du ${formatBilanDate(deleting.date)} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await questionnairesService.delete(deleting.id)
              setDeleting(null)
              await reload()
              setToast('Q-AAP supprimé')
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
            <h2 className="text-marine font-semibold text-xl mb-2">Questionnaire non enregistré</h2>
            <p className="text-marine/60 text-base mb-5">Si vous quittez, les réponses saisies seront perdues.</p>
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

/** Carte d'historique d'un Q-AAP : date, statut (OUI / aucun OUI), validité. */
function QaapHistoryCard({ q, onEdit, onDelete }: { q: Questionnaire; onEdit: () => void; onDelete: () => void }) {
  const data = asQaap(q.data)
  const warn = qaapHasWarning(data)
  const yes = qaapYesIndices(data)
  const expired = qaapIsExpired(q.date, todayISO())
  const expiry = qaapExpiryDate(q.date)
  return (
    <li className="bg-white border border-cream-dark/40 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-marine font-semibold text-sm">{formatBilanDate(q.date)}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {warn ? (
              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                <AlertTriangle size={12} /> {yes.length} « OUI » — Q{yes.join(', Q')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                <CheckCircle2 size={12} /> Aucun « OUI »
              </span>
            )}
            {expired ? (
              <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                Expiré
              </span>
            ) : (
              expiry && <span className="text-marine/45 text-xs">Valide jusqu'au {formatBilanDate(expiry)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-gold-dark hover:text-marine text-sm font-medium transition-colors"
          >
            <PencilLine size={15} /> Modifier
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Supprimer le Q-AAP du ${formatBilanDate(q.date)}`}
            className="text-red-500/70 hover:text-red-600 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {data.precision?.trim() && (
        <p className="text-marine/70 text-sm mt-2.5 whitespace-pre-wrap leading-relaxed border-t border-cream-dark/40 pt-2.5">
          {data.precision}
        </p>
      )}
    </li>
  )
}

/** Formulaire de saisie / édition d'un Q-AAP. */
function QaapForm({
  value,
  onChange,
  onCancel,
  onSave,
  saving
}: {
  value: { id: string | null; date: string; data: QaapData }
  onChange: (v: { id: string | null; date: string; data: QaapData }) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  const { date, data } = value
  const warn = qaapHasWarning(data)
  const complete = qaapIsComplete(data)

  function setAnswer(i: number, ans: boolean) {
    const answers = data.answers.slice()
    answers[i] = ans
    onChange({ ...value, data: { ...data, answers } })
  }

  return (
    <section className="bg-white border border-cream-dark/40 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-marine font-semibold text-base">{value.id ? 'Modifier le Q-AAP' : 'Nouveau Q-AAP'}</h3>
        <div className="flex items-center gap-2">
          <label className="text-marine/60 text-sm font-medium">Date</label>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={e => onChange({ ...value, date: e.target.value || todayISO() })}
            className="px-3 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
          />
        </div>
      </div>

      <p className="text-marine/55 text-sm">
        Pour les personnes de 15 à 69 ans. Répondez honnêtement à chacune des questions par OUI ou NON.
      </p>

      <ol className="space-y-2.5">
        {QAAP_QUESTIONS.map((question, i) => {
          const ans = data.answers[i]
          return (
            <li
              key={i}
              className="flex items-start gap-3 border border-cream-dark/40 rounded-lg p-3 bg-cream/30"
            >
              <span className="shrink-0 w-6 h-6 rounded-full bg-marine/10 text-marine font-semibold text-xs flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-marine/85 text-sm leading-snug flex-1">{question}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <YesNoButton active={ans === true} tone="yes" onClick={() => setAnswer(i, true)}>
                  Oui
                </YesNoButton>
                <YesNoButton active={ans === false} tone="no" onClick={() => setAnswer(i, false)}>
                  Non
                </YesNoButton>
              </div>
            </li>
          )
        })}
      </ol>

      {warn && (
        <div className="flex items-start gap-2.5 text-amber-800 bg-amber-50 border border-amber-300 rounded-md px-4 py-3">
          <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-600" />
          <p className="text-sm leading-relaxed">
            <b>Au moins un « OUI ».</b> Le client devrait consulter son médecin AVANT d'entreprendre ou
            d'augmenter son activité physique, et lui préciser à quelles questions il a répondu « OUI ».
          </p>
        </div>
      )}

      <div>
        <label className="text-marine/60 text-sm font-medium block mb-1.5">
          Précisions {warn ? '(indiquez notamment la raison du « OUI »)' : '(facultatif)'}
        </label>
        <textarea
          value={data.precision ?? ''}
          onChange={e => onChange({ ...value, data: { ...data, precision: e.target.value } })}
          rows={3}
          placeholder="Détails médicaux, restrictions, contexte…"
          className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors resize-y"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          {value.id ? 'Mettre à jour' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2.5 text-marine/60 hover:text-marine border border-cream-dark rounded-md text-base transition-colors"
        >
          Annuler
        </button>
        {!complete && <span className="text-marine/40 text-sm">Astuce : répondez aux 7 questions.</span>}
      </div>
    </section>
  )
}

function YesNoButton({
  active,
  tone,
  onClick,
  children
}: {
  active: boolean
  tone: 'yes' | 'no'
  onClick: () => void
  children: React.ReactNode
}) {
  const base = 'px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors'
  const activeCls =
    tone === 'yes'
      ? 'bg-amber-500 border-amber-500 text-white'
      : 'bg-marine border-marine text-cream'
  const idle = 'bg-white border-cream-dark text-marine/60 hover:border-gold/60'
  return (
    <button type="button" onClick={onClick} className={`${base} ${active ? activeCls : idle}`}>
      {children}
    </button>
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
