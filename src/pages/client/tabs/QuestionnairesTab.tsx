import { useCallback, useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Loader2,
  PencilLine,
  Plus,
  Save,
  ShieldAlert,
  Target,
  Trash2
} from 'lucide-react'
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
import { OBJECTIFS_FIELDS, emptyObjectifs, objectifsIsBlank, type ObjectifsData } from '../../../lib/objectifs'
import {
  emptySante,
  normalizeZones,
  regionLabel,
  santeIsBlank,
  type PainSeverity,
  type SanteData,
  type ZoneMark
} from '../../../lib/sante'
import { suggestionsForRegion, type PainSuggestionLib } from '../../../lib/pain-suggestions'
import { settingsService } from '../../../services/settings'
import { BodyPainMap } from '../BodyPainMap'

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

const TYPE_LABEL: Record<QuestionnaireType, string> = {
  qaap: 'Q-AAP',
  objectifs: 'Objectifs & habitudes de vie',
  sante: 'Questionnaire de santé'
}

/** Normalise les données brutes (unknown) d'un Q-AAP vers une forme sûre. */
function asQaap(data: unknown): QaapData {
  const d = (data ?? {}) as Partial<QaapData>
  const answers = Array.isArray(d.answers) ? d.answers.slice(0, 7) : []
  while (answers.length < 7) answers.push(null)
  return {
    answers: answers.map(a => (a === true ? true : a === false ? false : null)),
    precision: d.precision,
    notes: d.notes
  }
}

function asObjectifs(data: unknown): ObjectifsData {
  return { ...((data ?? {}) as ObjectifsData) }
}

function asSante(data: unknown): SanteData {
  const d = { ...((data ?? {}) as SanteData) }
  return {
    ...d,
    zonesDetail: normalizeZones(d),
    restrictions: d.restrictions === true ? true : d.restrictions === false ? false : null
  }
}

type Draft =
  | { id: string | null; type: 'qaap'; date: string; data: QaapData }
  | { id: string | null; type: 'objectifs'; date: string; data: ObjectifsData }
  | { id: string | null; type: 'sante'; date: string; data: SanteData }

/** Onglet Questionnaires — admission du client : Q-AAP + Objectifs & habitudes de vie. */
export function QuestionnairesTab() {
  const client = useClient()
  const [list, setList] = useState<Questionnaire[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Questionnaire | null>(null)

  const [editing, setEditing] = useState<Draft | null>(null)
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

  function startNew(type: QuestionnaireType) {
    const date = todayISO()
    setEditing(
      type === 'qaap'
        ? { id: null, type: 'qaap', date, data: emptyQaap() }
        : type === 'objectifs'
          ? { id: null, type: 'objectifs', date, data: emptyObjectifs() }
          : { id: null, type: 'sante', date, data: emptySante() }
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startEdit(q: Questionnaire) {
    setEditing(
      q.type === 'qaap'
        ? { id: q.id, type: 'qaap', date: q.date, data: asQaap(q.data) }
        : q.type === 'objectifs'
          ? { id: q.id, type: 'objectifs', date: q.date, data: asObjectifs(q.data) }
          : { id: q.id, type: 'sante', date: q.date, data: asSante(q.data) }
    )
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
        await questionnairesService.create(client.id, { type: editing.type, date: editing.date, data: editing.data })
      }
      setEditing(null)
      await reload()
      setToast(`${TYPE_LABEL[editing.type]} enregistré`)
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
            Formulaires d'admission de {client.name.split(' ')[0]} — datés, avec historique.
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => startNew('qaap')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors shadow-sm"
            >
              <Plus size={17} /> Q-AAP
            </button>
            <button
              type="button"
              onClick={() => startNew('objectifs')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-marine text-cream font-semibold rounded-md text-base hover:bg-marine-light transition-colors shadow-sm"
            >
              <Plus size={17} /> Objectifs &amp; habitudes
            </button>
            <button
              type="button"
              onClick={() => startNew('sante')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-marine font-semibold rounded-md text-base border border-cream-dark hover:border-gold/60 transition-colors shadow-sm"
            >
              <Plus size={17} /> Santé
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</div>
      )}

      {editing?.type === 'qaap' && (
        <QaapForm
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
          saving={saving}
        />
      )}
      {editing?.type === 'objectifs' && (
        <ObjectifsForm
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
          saving={saving}
        />
      )}
      {editing?.type === 'sante' && (
        <SanteForm
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
              Aucun questionnaire pour ce client. Utilisez les boutons ci-dessus pour en créer un.
            </p>
          ) : (
            <ul className="space-y-3">
              {list.map(q =>
                q.type === 'qaap' ? (
                  <QaapHistoryCard key={q.id} q={q} onEdit={() => startEdit(q)} onDelete={() => setDeleting(q)} />
                ) : q.type === 'objectifs' ? (
                  <ObjectifsHistoryCard key={q.id} q={q} onEdit={() => startEdit(q)} onDelete={() => setDeleting(q)} />
                ) : (
                  <SanteHistoryCard key={q.id} q={q} onEdit={() => startEdit(q)} onDelete={() => setDeleting(q)} />
                )
              )}
            </ul>
          )}
        </section>
      )}

      {deleting && (
        <ConfirmDialog
          message={`Supprimer « ${TYPE_LABEL[deleting.type]} » du ${formatBilanDate(deleting.date)} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await questionnairesService.delete(deleting.id)
              setDeleting(null)
              await reload()
              setToast('Questionnaire supprimé')
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

/** Petit chip de type affiché sur les cartes d'historique. */
function TypeChip({ type }: { type: QuestionnaireType }) {
  const style: Record<QuestionnaireType, string> = {
    qaap: 'bg-gold/20 text-gold-dark',
    objectifs: 'bg-marine/10 text-marine',
    sante: 'bg-rose-100 text-rose-700'
  }
  const icon =
    type === 'qaap' ? <ClipboardList size={11} /> : type === 'objectifs' ? <Target size={11} /> : <HeartPulse size={11} />
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style[type]}`}>
      {icon}
      {TYPE_LABEL[type]}
    </span>
  )
}

// ── Q-AAP ─────────────────────────────────────────────────────────────────────

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
          <div className="flex items-center gap-2 flex-wrap">
            <TypeChip type="qaap" />
            <p className="text-marine font-semibold text-sm">{formatBilanDate(q.date)}</p>
          </div>
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
        <HistoryActions label={`Q-AAP du ${formatBilanDate(q.date)}`} onEdit={onEdit} onDelete={onDelete} />
      </div>
      {data.precision?.trim() && (
        <p className="text-marine/70 text-sm mt-2.5 whitespace-pre-wrap leading-relaxed border-t border-cream-dark/40 pt-2.5">
          {data.precision}
        </p>
      )}
    </li>
  )
}

function QaapForm({
  value,
  onChange,
  onCancel,
  onSave,
  saving
}: {
  value: Extract<Draft, { type: 'qaap' }>
  onChange: (v: Draft) => void
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
      <FormHeader title={value.id ? 'Modifier le Q-AAP' : 'Nouveau Q-AAP'} date={date} onDate={d => onChange({ ...value, date: d })} />

      <p className="text-marine/55 text-sm">
        Pour les personnes de 15 à 69 ans. Répondez honnêtement à chacune des questions par OUI ou NON.
      </p>

      <ol className="space-y-2.5">
        {QAAP_QUESTIONS.map((question, i) => {
          const ans = data.answers[i]
          return (
            <li key={i} className="flex items-start gap-3 border border-cream-dark/40 rounded-lg p-3 bg-cream/30">
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

      <FormActions
        saving={saving}
        editing={!!value.id}
        onSave={onSave}
        onCancel={onCancel}
        hint={complete ? undefined : 'Astuce : répondez aux 7 questions.'}
      />
    </section>
  )
}

// ── Objectifs & habitudes de vie ──────────────────────────────────────────────

function ObjectifsHistoryCard({
  q,
  onEdit,
  onDelete
}: {
  q: Questionnaire
  onEdit: () => void
  onDelete: () => void
}) {
  const data = asObjectifs(q.data)
  return (
    <li className="bg-white border border-cream-dark/40 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeChip type="objectifs" />
            <p className="text-marine font-semibold text-sm">{formatBilanDate(q.date)}</p>
          </div>
          {data.objectif?.trim() && (
            <p className="text-marine/85 text-sm mt-1.5">
              <span className="text-marine/45">Objectif : </span>
              {data.objectif}
            </p>
          )}
        </div>
        <HistoryActions
          label={`Objectifs & habitudes du ${formatBilanDate(q.date)}`}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </li>
  )
}

function ObjectifsForm({
  value,
  onChange,
  onCancel,
  onSave,
  saving
}: {
  value: Extract<Draft, { type: 'objectifs' }>
  onChange: (v: Draft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  const { date, data } = value
  const blank = objectifsIsBlank(data)

  function setField(key: keyof ObjectifsData, v: string) {
    onChange({ ...value, data: { ...data, [key]: v } })
  }

  return (
    <section className="bg-white border border-cream-dark/40 rounded-xl p-5 shadow-sm space-y-4">
      <FormHeader
        title={value.id ? 'Modifier « Objectifs & habitudes »' : 'Nouveau « Objectifs & habitudes de vie »'}
        date={date}
        onDate={d => onChange({ ...value, date: d })}
      />

      <div>
        <label className="text-marine font-semibold text-sm flex items-center gap-1.5 mb-1.5">
          <Target size={15} className="text-gold-dark" /> Objectif
        </label>
        <textarea
          value={data.objectif ?? ''}
          onChange={e => setField('objectif', e.target.value)}
          rows={2}
          placeholder="Le but principal du client (ex. perdre 10 lbs, courir un 5 km, réduire les douleurs au dos…)"
          className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OBJECTIFS_FIELDS.map(f => (
          <div key={f.key}>
            <label className="text-marine/60 text-sm font-medium block mb-1.5">{f.label}</label>
            <textarea
              value={(data[f.key] as string | undefined) ?? ''}
              onChange={e => setField(f.key, e.target.value)}
              rows={f.rows}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-sm placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors resize-y"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-marine/60 text-sm font-medium block mb-1.5">Note interne (privée)</label>
        <textarea
          value={data.notes ?? ''}
          onChange={e => setField('notes', e.target.value)}
          rows={2}
          placeholder="Observations de Marie — jamais montrées au client."
          className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-sm placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors resize-y"
        />
      </div>

      <FormActions
        saving={saving}
        editing={!!value.id}
        onSave={onSave}
        onCancel={onCancel}
        disabled={blank}
        hint={blank ? 'Remplissez au moins un champ pour enregistrer.' : undefined}
      />
    </section>
  )
}

// ── Questionnaire de santé ────────────────────────────────────────────────────

function SanteHistoryCard({ q, onEdit, onDelete }: { q: Questionnaire; onEdit: () => void; onDelete: () => void }) {
  const data = asSante(q.data)
  const zones = data.zonesDetail ?? {}
  const ids = Object.keys(zones)
  const nbRouge = ids.filter(id => zones[id].severity === 'rouge').length
  const nbJaune = ids.filter(id => zones[id].severity === 'jaune').length
  // Zones listées, douleurs (rouge) d'abord.
  const orderedIds = [...ids].sort((a, b) => (zones[a].severity === 'rouge' ? 0 : 1) - (zones[b].severity === 'rouge' ? 0 : 1))
  return (
    <li className="bg-white border border-cream-dark/40 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeChip type="sante" />
            <p className="text-marine font-semibold text-sm">{formatBilanDate(q.date)}</p>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {data.restrictions === true ? (
              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                <AlertTriangle size={12} /> Restrictions de mouvement
              </span>
            ) : data.restrictions === false ? (
              <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
                <CheckCircle2 size={12} /> Aucune restriction
              </span>
            ) : null}
            {nbRouge > 0 && (
              <span className="inline-flex items-center gap-1 text-red-700 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {nbRouge} douleur{nbRouge > 1 ? 's' : ''}
              </span>
            )}
            {nbJaune > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> {nbJaune} tension{nbJaune > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <HistoryActions
          label={`Questionnaire de santé du ${formatBilanDate(q.date)}`}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
      {orderedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {orderedIds.map(id => (
            <span
              key={id}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                zones[id].severity === 'rouge' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
              title={zones[id].description || undefined}
            >
              {regionLabel(id)}
              {zones[id].description?.trim() ? ' — ' + zones[id].description : ''}
            </span>
          ))}
        </div>
      )}
      {data.conditions?.trim() && (
        <p className="text-marine/70 text-sm mt-2.5 whitespace-pre-wrap leading-relaxed border-t border-cream-dark/40 pt-2.5">
          {data.conditions}
        </p>
      )}
    </li>
  )
}

function SanteForm({
  value,
  onChange,
  onCancel,
  onSave,
  saving
}: {
  value: Extract<Draft, { type: 'sante' }>
  onChange: (v: Draft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  const { date, data } = value
  const blank = santeIsBlank(data)
  const [library, setLibrary] = useState<PainSuggestionLib | null>(null)
  const zones = data.zonesDetail ?? {}

  useEffect(() => {
    settingsService.getPainSuggestions().then(setLibrary).catch(() => setLibrary(null))
  }, [])

  function patch(p: Partial<SanteData>) {
    onChange({ ...value, data: { ...data, ...p } })
  }

  return (
    <section className="bg-white border border-cream-dark/40 rounded-xl p-5 shadow-sm space-y-4">
      <FormHeader
        title={value.id ? 'Modifier le questionnaire de santé' : 'Nouveau questionnaire de santé'}
        date={date}
        onDate={d => onChange({ ...value, date: d })}
      />

      <div>
        <label className="text-marine/60 text-sm font-medium block mb-1.5">Conditions de santé</label>
        <textarea
          value={data.conditions ?? ''}
          onChange={e => patch({ conditions: e.target.value })}
          rows={3}
          placeholder="Blessures, chirurgies, douleurs chroniques, diagnostics, grossesse…"
          className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors resize-y"
        />
      </div>

      <div>
        <label className="text-marine/60 text-sm font-medium block mb-2">
          Zones de tension / douleur
          <span className="text-marine/40 font-normal"> — cliquez sur la silhouette</span>
        </label>
        <div className="border border-cream-dark/50 rounded-lg p-3 bg-cream/20">
          <BodyPainMap value={zones} onChange={m => patch({ zonesDetail: m })} />
        </div>
        <ZoneDetailsList value={zones} onChange={m => patch({ zonesDetail: m })} library={library} />
        <input
          type="text"
          value={data.zonesAutre ?? ''}
          onChange={e => patch({ zonesAutre: e.target.value })}
          placeholder="Autre(s) zone(s) ou précisions…"
          className="w-full mt-2 px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-sm placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
        />
      </div>

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-marine/70 text-sm font-medium">Restrictions de mouvement à respecter ?</label>
          <div className="flex items-center gap-1.5">
            <YesNoButton active={data.restrictions === true} tone="yes" onClick={() => patch({ restrictions: true })}>
              Oui
            </YesNoButton>
            <YesNoButton active={data.restrictions === false} tone="no" onClick={() => patch({ restrictions: false })}>
              Non
            </YesNoButton>
          </div>
        </div>
        {data.restrictions === true && (
          <textarea
            value={data.restrictionsDetail ?? ''}
            onChange={e => patch({ restrictionsDetail: e.target.value })}
            rows={2}
            placeholder="Décrivez les mouvements à éviter ou à adapter…"
            className="w-full mt-2 px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors resize-y"
          />
        )}
      </div>

      <div>
        <label className="text-marine/60 text-sm font-medium block mb-1.5">Note interne (privée)</label>
        <textarea
          value={data.notes ?? ''}
          onChange={e => patch({ notes: e.target.value })}
          rows={2}
          placeholder="Observations de Marie — jamais montrées au client."
          className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-sm placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors resize-y"
        />
      </div>

      <FormActions
        saving={saving}
        editing={!!value.id}
        onSave={onSave}
        onCancel={onCancel}
        disabled={blank}
        hint={blank ? 'Remplissez au moins un champ pour enregistrer.' : undefined}
      />
    </section>
  )
}

/** Liste éditable des zones marquées : sévérité, description, puces de suggestions. */
function ZoneDetailsList({
  value,
  onChange,
  library
}: {
  value: Record<string, ZoneMark>
  onChange: (next: Record<string, ZoneMark>) => void
  library: PainSuggestionLib | null
}) {
  const ids = Object.keys(value)
  if (ids.length === 0) {
    return <p className="text-marine/40 text-sm mt-2">Aucune zone marquée — cliquez sur la silhouette ci-dessus.</p>
  }
  const ordered = [...ids].sort(
    (a, b) => (value[a].severity === 'rouge' ? 0 : 1) - (value[b].severity === 'rouge' ? 0 : 1)
  )

  function setMark(id: string, p: Partial<ZoneMark>) {
    onChange({ ...value, [id]: { ...value[id], ...p } })
  }
  function remove(id: string) {
    const next = { ...value }
    delete next[id]
    onChange(next)
  }

  return (
    <ul className="mt-3 space-y-2">
      {ordered.map(id => (
        <ZoneRow
          key={id}
          id={id}
          mark={value[id]}
          library={library}
          onSeverity={s => setMark(id, { severity: s })}
          onDescription={d => setMark(id, { description: d })}
          onRemove={() => remove(id)}
        />
      ))}
    </ul>
  )
}

function ZoneRow({
  id,
  mark,
  library,
  onSeverity,
  onDescription,
  onRemove
}: {
  id: string
  mark: ZoneMark
  library: PainSuggestionLib | null
  onSeverity: (s: PainSeverity) => void
  onDescription: (d: string) => void
  onRemove: () => void
}) {
  const desc = mark.description ?? ''
  // Suggestions non déjà présentes dans la description.
  const suggestions = (library ? suggestionsForRegion(id, library) : suggestionsForRegion(id)).filter(
    s => !desc.toLowerCase().includes(s.toLowerCase())
  )
  function addSuggestion(phrase: string) {
    const trimmed = desc.trim()
    onDescription(trimmed ? `${trimmed}, ${phrase}` : phrase)
  }
  return (
    <li className="border border-cream-dark/50 rounded-lg p-2.5 bg-white">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSeverity('jaune')}
            className={`w-5 h-5 rounded-full border-2 transition-colors ${
              mark.severity === 'jaune' ? 'bg-amber-400 border-amber-500' : 'bg-amber-100 border-amber-200 hover:border-amber-400'
            }`}
            title="Tension légère"
            aria-label="Tension légère"
          />
          <button
            type="button"
            onClick={() => onSeverity('rouge')}
            className={`w-5 h-5 rounded-full border-2 transition-colors ${
              mark.severity === 'rouge' ? 'bg-red-500 border-red-600' : 'bg-red-100 border-red-200 hover:border-red-400'
            }`}
            title="Douleur"
            aria-label="Douleur"
          />
        </div>
        <span className="text-marine font-medium text-sm flex-1 min-w-[120px]">{regionLabel(id)}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-marine/40 hover:text-red-600 transition-colors"
          aria-label={`Retirer ${regionLabel(id)}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <input
        type="text"
        value={desc}
        onChange={e => onDescription(e.target.value)}
        placeholder="Description de la douleur…"
        className="w-full mt-2 px-2.5 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => addSuggestion(s)}
              className="inline-flex items-center gap-1 text-marine/70 bg-cream/60 hover:bg-gold/20 hover:text-marine border border-cream-dark/60 rounded-full px-2 py-0.5 text-[11px] transition-colors"
            >
              <Plus size={10} /> {s}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

// ── Éléments partagés ─────────────────────────────────────────────────────────

function FormHeader({ title, date, onDate }: { title: string; date: string; onDate: (d: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h3 className="text-marine font-semibold text-base">{title}</h3>
      <div className="flex items-center gap-2">
        <label className="text-marine/60 text-sm font-medium">Date</label>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={e => onDate(e.target.value || todayISO())}
          className="px-3 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
        />
      </div>
    </div>
  )
}

function FormActions({
  saving,
  editing,
  onSave,
  onCancel,
  disabled,
  hint
}: {
  saving: boolean
  editing: boolean
  onSave: () => void
  onCancel: () => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {editing ? 'Mettre à jour' : 'Enregistrer'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="px-4 py-2.5 text-marine/60 hover:text-marine border border-cream-dark rounded-md text-base transition-colors"
      >
        Annuler
      </button>
      {hint && <span className="text-marine/40 text-sm">{hint}</span>}
    </div>
  )
}

function HistoryActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
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
        aria-label={`Supprimer ${label}`}
        className="text-red-500/70 hover:text-red-600 transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
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
  const activeCls = tone === 'yes' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-marine border-marine text-cream'
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
