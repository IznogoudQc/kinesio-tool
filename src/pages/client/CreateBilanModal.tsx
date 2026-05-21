import { useEffect, useMemo, useState } from 'react'
import { ArrowUpCircle, Loader2, PencilLine } from 'lucide-react'
import { bilansService } from '../../services/bilans'
import { settingsService } from '../../services/settings'
import { BilanForm, deriveBilanFields } from './BilanForm'
import { computeAge, type NormsType } from '../../lib/norms'
import { formatBilanDate } from './bilanFields'

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
  { key: 'pli_mollet', label: 'Pli mollet', defaultChecked: true },
  { key: 'pli_cuisse', label: 'Pli cuisse', defaultChecked: true },
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('La date du bilan est requise.')
      return
    }
    setSaving(true)
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

  const showPrefillBanner = previous && prefillAvailable.length > 0

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-marine/40 backdrop-blur-sm p-6 overflow-y-auto">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-4xl border border-cream-dark my-6">
        <form onSubmit={handleSave}>
          <div className="px-6 py-5 border-b border-cream-dark flex items-center gap-3">
            <PencilLine size={20} className="text-gold-dark" />
            <div>
              <h2 className="text-marine font-semibold text-xl">Saisie manuelle d'un bilan</h2>
              <p className="text-marine/55 text-sm">
                {client.name} — seule la date est requise. Tous les autres champs sont optionnels.
              </p>
            </div>
          </div>

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
              norms={norms}
              showSynthesis
              previousData={previous?.data}
            />
          </div>

          <div className="px-6 py-4 border-t border-cream-dark flex items-center justify-end gap-3 bg-white/70 rounded-b-lg sticky bottom-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-base transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
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
