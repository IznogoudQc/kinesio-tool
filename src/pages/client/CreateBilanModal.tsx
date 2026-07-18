import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUpCircle, Check, Loader2, PencilLine } from 'lucide-react'
import { bilansService } from '../../services/bilans'
import { clientsService } from '../../services/clients'
import { settingsService } from '../../services/settings'
import { BilanForm, deriveBilanFields } from './BilanForm'
import { computeAge, type NormsType } from '../../lib/norms'
import { BILAN_FIELD_GROUPS, formatBilanDate } from './bilanFields'
import { missingImportantFields, type ImportantField } from './bilan-required-fields'

interface CreateBilanModalProps {
  client: Client
  onCancel: () => void
  onSaved: (bilan: Bilan) => void
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ── Pré-remplissage : champs structurels (changent peu d'un bilan à l'autre) ─
// On exclut volontairement les valeurs de performance (VO2max, push-ups, etc.)
// et tous les champs calculés.
interface PrefillFieldDef {
  key: keyof BilanData
  label: string
  defaultChecked: boolean
}

const PREFILL_FIELDS: PrefillFieldDef[] = [
  { key: 'taille_cm', label: 'Taille', defaultChecked: true },
  { key: 'pli_triceps', label: 'Pli triceps', defaultChecked: true },
  { key: 'pli_biceps', label: 'Pli biceps', defaultChecked: true },
  { key: 'pli_sous_scap', label: 'Pli sous-scapulaire', defaultChecked: true },
  { key: 'pli_iliaque', label: 'Pli crête iliaque', defaultChecked: true },
  { key: 'tour_taille_cm', label: 'Tour de taille', defaultChecked: true },
  { key: 'tour_hanche_cm', label: 'Tour de hanche', defaultChecked: true },
  { key: 'fc_repos', label: 'FC au repos', defaultChecked: true },
  { key: 'pa_systolique', label: 'PA systolique (repos)', defaultChecked: true },
  { key: 'pa_diastolique', label: 'PA diastolique (repos)', defaultChecked: true },
  // Performance : non pré-cochés (ça change à chaque bilan).
  { key: 'poids_kg', label: 'Poids', defaultChecked: false },
  { key: 'vo2max', label: 'VO2max', defaultChecked: false },
  { key: 'pushups', label: 'Push-ups', defaultChecked: false },
  { key: 'situps', label: 'Redressements assis', defaultChecked: false },
  { key: 'saut_vertical_cm', label: 'Saut vertical', defaultChecked: false },
  { key: 'flexion_tronc_cm', label: 'Flexion tronc', defaultChecked: false },
  { key: 'endurance_dos_sec', label: 'Endurance dos', defaultChecked: false }
]

function availableInPrevious(previous: BilanData): PrefillFieldDef[] {
  return PREFILL_FIELDS.filter(f => {
    const v = previous[f.key]
    return v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))
  })
}

export function CreateBilanModal({ client, onCancel, onSaved }: CreateBilanModalProps) {
  const [date, setDate] = useState(todayIso)
  const [data, setData] = useState<BilanData>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [norms, setNorms] = useState<NormsType>('acsm')
  const [previous, setPrevious] = useState<Bilan | null>(null)
  const [showPrefillModal, setShowPrefillModal] = useState(false)
  // Mode de saisie : 'scroll' = formulaire complet (défaut, rapide) ;
  // 'guided' = une section à la fois avec un stepper (moins intimidant).
  const [mode, setMode] = useState<'scroll' | 'guided'>('scroll')
  const [stepIndex, setStepIndex] = useState(0)
  // Récapitulatif des champs importants manquants, affiché avant la sauvegarde.
  const [pendingMissing, setPendingMissing] = useState<ImportantField[] | null>(null)

  useEffect(() => {
    settingsService.getCategorizationNorms().then(setNorms).catch(() => undefined)
  }, [])

  useEffect(() => {
    // Récupère le bilan le plus récent du client pour le pré-remplissage.
    bilansService
      .getBilansForClient(client.id)
      .then(list => setPrevious(list[0] ?? null))
      .catch(() => setPrevious(null))
  }, [client.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, saving])

  const age = useMemo(() => computeAge(client.birthdate), [client.birthdate])

  const prefillAvailable = useMemo(
    () => (previous ? availableInPrevious(previous.data) : []),
    [previous]
  )

  function applyPrefill(selectedKeys: Set<string>) {
    if (!previous) return
    const next: BilanData = { ...data }
    for (const key of selectedKeys) {
      const v = previous.data[key as keyof BilanData]
      if (v !== undefined) {
        ;(next as Record<string, unknown>)[key] = v
      }
    }
    setData(next)
    setShowPrefillModal(false)
  }

  // Sauvegarde effective (après validation date + éventuel passage par le
  // récapitulatif des champs manquants).
  async function persist() {
    setSaving(true)
    setError(null)
    try {
      const finalData = deriveBilanFields(data, age, client.sex)
      const created = await bilansService.create(client.id, {
        date,
        data: finalData,
        source: 'manuel'
      })
      onSaved(created)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('La date du bilan est requise.')
      return
    }
    // Garde-fou doux : si des mesures importantes manquent, on propose un
    // récapitulatif (« Enregistrer quand même » / « Compléter ») — jamais bloquant.
    const missing = missingImportantFields(data)
    if (missing.length > 0) {
      setPendingMissing(missing)
      return
    }
    void persist()
  }

  const showPrefillBanner = previous && prefillAvailable.length > 0

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-marine/40 backdrop-blur-sm p-6 overflow-y-auto">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-4xl border border-cream-dark my-6">
        <form onSubmit={handleSave}>
          <div className="px-6 py-5 border-b border-cream-dark flex items-center gap-3">
            <PencilLine size={20} className="text-gold-dark shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-marine font-semibold text-xl">Saisie manuelle d'un bilan</h2>
              <p className="text-marine/55 text-sm">
                {client.name} — seule la date est requise. Tous les autres champs sont optionnels.
              </p>
            </div>
            {/* Bascule mode de saisie */}
            <div className="flex rounded-md border border-cream-dark overflow-hidden shrink-0 text-sm">
              <button
                type="button"
                onClick={() => setMode('scroll')}
                className={`px-3 py-1.5 transition-colors ${mode === 'scroll' ? 'bg-gold text-marine font-semibold' : 'bg-white/60 text-marine/60 hover:text-marine'}`}
              >
                Tout afficher
              </button>
              <button
                type="button"
                onClick={() => { setMode('guided'); setStepIndex(0) }}
                className={`px-3 py-1.5 transition-colors ${mode === 'guided' ? 'bg-gold text-marine font-semibold' : 'bg-white/60 text-marine/60 hover:text-marine'}`}
              >
                Guidé
              </button>
            </div>
          </div>

          {mode === 'guided' && (
            <StepperHeader
              stepIndex={stepIndex}
              titles={BILAN_FIELD_GROUPS.map(g => g.title)}
            />
          )}

          {error && (
            <div className="mx-6 mt-4 text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">
              {error}
            </div>
          )}

          {showPrefillBanner && (
            <button
              type="button"
              onClick={() => setShowPrefillModal(true)}
              className="mx-6 mt-4 w-[calc(100%-3rem)] bg-gold/10 border border-gold/40 hover:border-gold rounded-md px-4 py-3 flex items-center gap-3 transition-colors text-left"
            >
              <ArrowUpCircle size={20} className="text-gold-dark shrink-0" />
              <div>
                <p className="text-marine font-medium text-sm">
                  Pré-remplir avec les valeurs du bilan du {formatBilanDate(previous.date)}
                </p>
                <p className="text-marine/55 text-xs mt-0.5">
                  {prefillAvailable.length} valeur{prefillAvailable.length > 1 ? 's' : ''} disponible{prefillAvailable.length > 1 ? 's' : ''} à reprendre
                </p>
              </div>
            </button>
          )}

          <div className="px-6 py-5">
            <BilanForm
              date={date}
              data={data}
              onDateChange={setDate}
              onDataChange={setData}
              variant="light"
              client={client}
              onUnitsChange={u => {
                // Mémorise le choix d'unités sur le client (pour les prochains bilans).
                clientsService.update(client.id, u).catch(() => {})
              }}
              norms={norms}
              showSynthesis
              previousData={previous?.data}
              visibleSectionIds={mode === 'guided' ? [BILAN_FIELD_GROUPS[stepIndex].id] : undefined}
              collapsible={mode === 'guided' ? false : undefined}
            />
          </div>

          <div className="px-6 py-4 border-t border-cream-dark flex items-center justify-end gap-3 bg-white/70 rounded-b-lg sticky bottom-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-base transition-colors mr-auto"
            >
              Annuler
            </button>

            {mode === 'guided' && stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-marine border border-cream-dark rounded-md text-base hover:bg-white transition-colors"
              >
                <ArrowLeft size={15} /> Précédent
              </button>
            )}

            {mode === 'guided' && stepIndex < BILAN_FIELD_GROUPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStepIndex(i => Math.min(BILAN_FIELD_GROUPS.length - 1, i + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-marine text-cream font-semibold rounded-md text-base hover:bg-marine-light transition-colors"
              >
                Section suivante <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Enregistrement…' : mode === 'guided' ? 'Vérifier & enregistrer' : 'Enregistrer'}
              </button>
            )}
          </div>
        </form>
      </div>

      {showPrefillModal && previous && (
        <PrefillModal
          previous={previous}
          available={prefillAvailable}
          onCancel={() => setShowPrefillModal(false)}
          onConfirm={applyPrefill}
        />
      )}

      {pendingMissing && (
        <MissingFieldsDialog
          missing={pendingMissing}
          guided={mode === 'guided'}
          onComplete={() => {
            setPendingMissing(null)
            if (mode === 'guided') setStepIndex(0)
          }}
          onSaveAnyway={() => {
            setPendingMissing(null)
            void persist()
          }}
        />
      )}
    </div>
  )
}

/** Barre de progression du mode guidé : « Section N / M » + le titre courant. */
function StepperHeader({ stepIndex, titles }: { stepIndex: number; titles: string[] }) {
  const total = titles.length
  const pct = Math.round(((stepIndex + 1) / total) * 100)
  return (
    <div className="px-6 pt-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-marine font-medium text-sm">
          Étape {stepIndex + 1} / {total} — {titles[stepIndex]}
        </p>
        <p className="text-marine/50 text-xs">{pct} %</p>
      </div>
      <div className="h-1.5 bg-cream-dark/50 rounded-full overflow-hidden">
        <div className="h-full bg-gold transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

interface MissingFieldsDialogProps {
  missing: ImportantField[]
  guided: boolean
  onComplete: () => void
  onSaveAnyway: () => void
}

/** Récapitulatif non bloquant des mesures importantes manquantes. */
function MissingFieldsDialog({ missing, guided, onComplete, onSaveAnyway }: MissingFieldsDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-marine/50 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark">
        <div className="px-6 py-5 border-b border-cream-dark flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-500 shrink-0" />
          <h3 className="text-marine font-semibold text-lg">Quelques mesures manquent</h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-marine/70 text-sm mb-3">
            Ces mesures importantes ne sont pas renseignées. Vous pouvez compléter le bilan ou l'enregistrer
            tel quel — rien n'est perdu.
          </p>
          <ul className="space-y-1">
            {missing.map(f => (
              <li key={f.key as string} className="flex items-center gap-2 text-marine text-base">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="px-6 py-4 border-t border-cream-dark flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-marine border border-cream-dark rounded-md text-base hover:bg-white transition-colors"
          >
            {guided ? 'Compléter' : 'Revenir au formulaire'}
          </button>
          <button
            type="button"
            onClick={onSaveAnyway}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors"
          >
            <Check size={15} /> Enregistrer quand même
          </button>
        </div>
      </div>
    </div>
  )
}

interface PrefillModalProps {
  previous: Bilan
  available: PrefillFieldDef[]
  onCancel: () => void
  onConfirm: (selected: Set<string>) => void
}

function PrefillModal({ previous, available, onCancel, onConfirm }: PrefillModalProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(available.filter(f => f.defaultChecked).map(f => f.key as string))
  )

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function formatValue(key: keyof BilanData): string {
    const v = previous.data[key]
    return v === undefined || v === '' ? '—' : String(v)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-marine/50 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-lg border border-cream-dark">
        <div className="px-6 py-5 border-b border-cream-dark">
          <h3 className="text-marine font-semibold text-lg">
            Pré-remplir depuis le bilan du {formatBilanDate(previous.date)}
          </h3>
          <p className="text-marine/55 text-sm mt-1">
            Décocher les champs qu'on ne veut pas reprendre (par défaut : valeurs structurelles uniquement).
          </p>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <ul className="space-y-1.5">
            {available.map(f => (
              <li key={f.key}>
                <label className="flex items-center gap-3 cursor-pointer hover:bg-white/50 px-2 py-1.5 rounded">
                  <input
                    type="checkbox"
                    checked={selected.has(f.key as string)}
                    onChange={() => toggle(f.key as string)}
                    className="w-4 h-4 accent-gold cursor-pointer"
                  />
                  <span className="flex-1 text-marine text-base">{f.label}</span>
                  <span className="text-marine/50 text-sm font-mono">{formatValue(f.key)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 py-4 border-t border-cream-dark flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-base transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            disabled={selected.size === 0}
            className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pré-remplir ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
