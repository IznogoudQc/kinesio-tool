import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { Calculator, Loader2, PencilLine, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useClient } from '../ClientDetailLayout'
import { mesuresService } from '../../../services/mesures'
import { settingsService } from '../../../services/settings'
import {
  ALL_MESURE_FIELD_KEYS,
  DEFAULT_MESURE_FIELD_KEYS,
  MESURE_FIELDS,
  REQUIRED_MESURE_FIELD_KEYS,
  visibleMesureFields
} from '../../../lib/mesure-fields'
import { calculateAge, calculateBodyFat } from '../../../lib/body-fat-calculator'
import {
  cmToLengthInput,
  formatLength,
  formatWeight,
  kgToWeightInput,
  lengthInputToCm,
  lengthUnitLabel,
  weightInputToKg,
  weightUnitLabel,
  type LengthUnit,
  type WeightUnit
} from '../../../lib/units'
import { clientsService } from '../../../services/clients'
import { formatBilanDate } from '../bilanFields'
import { MeasureDelta } from '../../../components/MeasureDelta'
import { WaistRiskBar } from '../../../components/WaistRiskBar'

// ── Helpers de formatage (fr-CA, virgule décimale) ──────────────────────────────
const nf1 = (n: number): string => n.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
const nf4 = (n: number): string =>
  n.toLocaleString('fr-CA', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Champs de circonférences ────────────────────────────────────────────────────
type CircKey =
  | 'cou' | 'epaule' | 'bicepsG' | 'bicepsD' | 'poitrine'
  | 'taille' | 'abdomen' | 'hanche' | 'cuisseG' | 'cuisseD' | 'molletG' | 'molletD'

// TOUTES les colonnes de circonférence (12). Marie n'en saisit que 5 (voir
// MESURE_FIELDS), mais on charge/réenregistre les 12 à l'édition pour NE PAS
// effacer d'éventuelles anciennes données (côtés D, cou, mollets, etc.).
const ALL_CIRC_KEYS: CircKey[] = [
  'cou', 'epaule', 'bicepsG', 'bicepsD', 'poitrine',
  'taille', 'abdomen', 'hanche', 'cuisseG', 'cuisseD', 'molletG', 'molletD'
]

type PlisKey = 'triceps' | 'biceps' | 'sousscapulaire' | 'iliaque' | 'mollet'
/** Les 4 plis **requis** par Durnin-Womersley — le mollet en est exclu. */
const PLIS_REQUIS: PlisKey[] = ['triceps', 'biceps', 'sousscapulaire', 'iliaque']

const PLIS_FIELDS: { key: PlisKey; label: string }[] = [
  { key: 'triceps', label: 'Triceps' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'sousscapulaire', label: 'Sous-scapulaire' },
  { key: 'iliaque', label: 'Crête iliaque' },
  // 5e pli, facultatif : il ne sert pas au Durnin-Womersley (4 plis) mais à la
  // somme des 5 plis de la composition CPAFLA — présent aussi dans le bilan.
  { key: 'mollet', label: 'Mollet' }
]

type CircForm = Partial<Record<CircKey, number>>
type PlisForm = Partial<Record<PlisKey, number>>

/** Convertit une ligne (stockée en cm) vers les valeurs à afficher dans les champs, selon l'unité du client. */
function circRowToForm(row: MesureCirconferences, unit: 'cm' | 'in'): CircForm {
  const f: CircForm = {}
  for (const key of ALL_CIRC_KEYS) {
    const v = row[key]
    if (typeof v === 'number') f[key] = cmToLengthInput(v, unit)
  }
  return f
}

// ────────────────────────────────────────────────────────────────────────────────

export function MesuresTab() {
  const client = useClient()
  const [toast, setToast] = useState<string | null>(null)
  // Saisie non enregistrée → on bloque la navigation sortante pour éviter la perte.
  const [dirty, setDirty] = useState(false)
  const blocker = useBlocker(dirty)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="p-8 max-w-6xl">
      <MeasureEntryPanel client={client} notify={setToast} onDirtyChange={setDirty} />

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-marine text-cream text-base font-medium px-5 py-3 rounded-lg shadow-2xl border border-marine-light/40">
          {toast}
        </div>
      )}

      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
          <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark p-6">
            <h2 className="text-marine font-semibold text-xl mb-2">Modifications non enregistrées</h2>
            <p className="text-marine/60 text-base mb-5">
              Vous avez des mesures saisies mais non enregistrées. Si vous quittez, elles seront perdues.
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
    </div>
  )
}

/** Pastille de choix d'unité — même rendu que le formulaire de bilan. */
function unitPill(active: boolean): string {
  return `px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
    active ? 'bg-gold text-marine border-gold font-semibold' : 'bg-white text-marine/55 border-cream-dark hover:text-marine'
  }`
}

// ── Carte de saisie d'une mesure ────────────────────────────────────────────────
function MeasureField({
  label,
  unit,
  unitToggle,
  value,
  onChange,
  previousValue,
  previousDate,
  lowerIsBetter,
  extra
}: {
  label: string
  unit: string
  /** Sélecteur d'unité propre au champ (grandeur), rendu à droite du libellé. */
  unitToggle?: React.ReactNode
  value: number | undefined
  onChange: (v: number | undefined) => void
  /** Valeur de la mesure précédente (même unité que `value`) — affiche un delta. */
  previousValue?: number
  /** Date ISO de la mesure précédente — suffixe « depuis 10 sept 2025 ». */
  previousDate?: string
  /** Pour tour de taille / hanche / abdomen / IMC : baisse = bien (couleur inversée). */
  lowerIsBetter?: boolean
  /** Slot pour une visualisation supplémentaire (ex: <WaistRiskBar>). */
  extra?: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <label className="flex items-center gap-1.5 text-xs uppercase tracking-wide mb-1 text-marine/60">
        <span className="truncate">
          {label} <span className="lowercase tracking-normal">({unit})</span>
        </span>
        {unitToggle}
      </label>
      <input
        type="number"
        step="any"
        min="0"
        inputMode="decimal"
        value={value === undefined ? '' : value}
        onChange={e => onChange(Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)}
        className="w-full px-2.5 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
      />
      <MeasureDelta
        current={value}
        previous={previousValue}
        previousDate={previousDate}
        unit={unit}
        lowerIsBetter={lowerIsBetter}
      />
      {extra}
    </div>
  )
}

/** Champ « Date de la mesure » placé en haut du formulaire. Défaut aujourd'hui,
 *  `max={today}` empêche la sélection d'une date future. */
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = todayISO()
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide mb-1 text-marine/60">Date de la mesure</label>
      <input
        type="date"
        value={value}
        max={today}
        onChange={e => onChange(e.target.value || today)}
        className="px-2.5 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
      />
    </div>
  )
}

// ── Confirmation de suppression ─────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
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

function cleanIpcError(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message) return fallback
  return (
    err.message
      .replace(/^Error invoking remote method '[^']+':\s*/i, '')
      .replace(/^(Uncaught\s+)?(Zod)?Error:\s*/i, '')
      .trim() || fallback
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  Sous-onglet : Circonférences
// ════════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════════
//  Prise de mesures unifiée : Poids · Grandeur · Circonférences · Plis cutanés
//  Une seule date, un seul bouton Enregistrer (écrit les 2 tables), un historique
//  combiné par date. Le % de gras est calculé à partir des 4 plis + profil.
// ════════════════════════════════════════════════════════════════════════════════
interface PriseEntry {
  date: string
  circ?: MesureCirconferences
  plis?: MesurePlisCutanes
}

function MeasureEntryPanel({
  client,
  notify,
  onDirtyChange
}: {
  client: Client
  notify: (m: string) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  // Unités de SAISIE, modifiables ici comme dans le formulaire de bilan. La DB
  // stocke toujours en métrique (cm / kg) ; on convertit à l'affichage et au save.
  const [unitLength, setUnitLength] = useState<LengthUnit>(client.unitLength ?? 'cm')
  const [unitWeight, setUnitWeight] = useState<WeightUnit>(client.unitWeight ?? 'kg')
  // La grandeur a son propre sélecteur : on la note souvent en pouces même quand
  // les circonférences restent en cm (défaut historique de cet écran).
  const [heightUnit, setHeightUnit] = useState<LengthUnit>('in')
  /** Change l'unité de longueur des circonférences et reconvertit la saisie en cours. */
  function changeUnitLength(next: LengthUnit) {
    if (next === unitLength) return
    setCircForm(prev => {
      const out: CircForm = {}
      for (const k of ALL_CIRC_KEYS) {
        const v = prev[k]
        if (typeof v === 'number') out[k] = cmToLengthInput(lengthInputToCm(v, unitLength), next)
      }
      return out
    })
    setUnitLength(next)
    clientsService.update(client.id, { unitLength: next }).catch(() => {})
  }

  /** Idem pour le poids. */
  function changeUnitWeight(next: WeightUnit) {
    if (next === unitWeight) return
    setPoids(p => (typeof p === 'number' ? kgToWeightInput(weightInputToKg(p, unitWeight), next) : p))
    setUnitWeight(next)
    clientsService.update(client.id, { unitWeight: next }).catch(() => {})
  }

  /** Sélecteur propre à la grandeur — non mémorisé sur le client (préférence d'écran). */
  function changeHeightUnit(next: LengthUnit) {
    if (next === heightUnit) return
    setGrandeur(g => (typeof g === 'number' ? cmToLengthInput(lengthInputToCm(g, heightUnit), next) : g))
    setHeightUnit(next)
  }

  const lenLabel = lengthUnitLabel(unitLength)
  const wLabel = weightUnitLabel(unitWeight)
  const grandeurUnit = lengthUnitLabel(heightUnit)

  const [circList, setCircList] = useState<MesureCirconferences[]>([])
  const [plisList, setPlisList] = useState<MesurePlisCutanes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mesureFields, setMesureFields] = useState<MesureFieldKey[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [date, setDate] = useState<string>(todayISO())
  const [poids, setPoids] = useState<number | undefined>(undefined)
  const [grandeur, setGrandeur] = useState<number | undefined>(undefined)
  const [circForm, setCircForm] = useState<CircForm>({})
  const [plisForm, setPlisForm] = useState<PlisForm>({})
  const [notes, setNotes] = useState('')
  const [editCircId, setEditCircId] = useState<string | null>(null)
  const [editPlisId, setEditPlisId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<PriseEntry | null>(null)

  const editing = editCircId !== null || editPlisId !== null
  const profileComplete = Boolean(client.birthdate && client.sex)

  useEffect(() => {
    settingsService.getMesureFields().then(setMesureFields).catch(() => undefined)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, p] = await Promise.all([
        mesuresService.circonferences.list(client.id),
        mesuresService.plis.list(client.id)
      ])
      setCircList(c)
      setPlisList(p)
    } catch {
      setError('Impossible de charger les mesures.')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => {
    reload()
  }, [reload])

  // Historique combiné : une entrée par date (circ et/ou plis), plus récent d'abord.
  const history = useMemo<PriseEntry[]>(() => {
    const byDate = new Map<string, PriseEntry>()
    for (const c of circList) {
      const e = byDate.get(c.date) ?? { date: c.date }
      e.circ = c
      byDate.set(c.date, e)
    }
    for (const p of plisList) {
      const e = byDate.get(p.date) ?? { date: p.date }
      e.plis = p
      byDate.set(p.date, e)
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [circList, plisList])

  // Prise précédente (date strictement antérieure) — pour les deltas.
  const previous = useMemo<PriseEntry | null>(() => history.find(h => h.date < date) ?? null, [history, date])
  const previousCircRow = previous?.circ ?? null
  const previousPlisRow = previous?.plis ?? null

  function setCircField(key: CircKey, v: number | undefined) {
    setCircForm(f => {
      const next = { ...f }
      if (v === undefined) delete next[key]
      else next[key] = v
      return next
    })
  }
  function setPlisField(key: PlisKey, v: number | undefined) {
    setPlisForm(f => {
      const next = { ...f }
      if (v === undefined) delete next[key]
      else next[key] = v
      return next
    })
  }

  const previousCirc = (key: CircKey): number | undefined => {
    const v = previousCircRow?.[key]
    return typeof v === 'number' ? cmToLengthInput(v, unitLength) : undefined
  }
  const previousPoids = previousCircRow?.poidsKg != null ? kgToWeightInput(previousCircRow.poidsKg, unitWeight) : undefined
  const previousGrandeur =
    previousCircRow?.grandeurCm != null ? cmToLengthInput(previousCircRow.grandeurCm, heightUnit) : undefined

  const LOWER_IS_BETTER_CIRC: Partial<Record<CircKey, boolean>> = { taille: true, hanche: true, abdomen: true }

  const circCard = (key: CircKey, label: string) => {
    let riskBar: React.ReactNode = null
    if ((key === 'taille' || key === 'hanche') && client.sex && typeof circForm[key] === 'number') {
      const valueCm = lengthInputToCm(circForm[key] as number, unitLength)
      riskBar = <WaistRiskBar value={valueCm} sex={client.sex} type="waist" />
    }
    return (
      <MeasureField
        label={label}
        unit={lenLabel}
        value={circForm[key]}
        onChange={v => setCircField(key, v)}
        previousValue={previousCirc(key)}
        previousDate={previousCircRow?.date}
        lowerIsBetter={LOWER_IS_BETTER_CIRC[key] ?? false}
        extra={riskBar}
      />
    )
  }

  const ratioTH = useMemo(() => {
    const tCm = circForm.taille !== undefined ? lengthInputToCm(circForm.taille, unitLength) : null
    const hCm = circForm.hanche !== undefined ? lengthInputToCm(circForm.hanche, unitLength) : null
    if (tCm === null || hCm === null || hCm <= 0) return null
    return Math.round((tCm / hCm) * 100) / 100
  }, [circForm.taille, circForm.hanche, unitLength])
  const previousRatioTH = useMemo(() => {
    if (!previousCircRow?.taille || !previousCircRow?.hanche || previousCircRow.hanche <= 0) return undefined
    return Math.round((previousCircRow.taille / previousCircRow.hanche) * 100) / 100
  }, [previousCircRow])

  // Seuls les 4 plis de Durnin sont exigés ; le mollet reste optionnel.
  const plisAllFilled = PLIS_REQUIS.every(k => typeof plisForm[k] === 'number' && (plisForm[k] as number) > 0)
  const plisHasAny = PLIS_FIELDS.some(f => plisForm[f.key] !== undefined)
  const plisCalc = useMemo(() => {
    if (!plisAllFilled || !client.sex || !client.birthdate) return null
    try {
      const age = calculateAge(client.birthdate)
      const r = calculateBodyFat(
        {
          triceps: plisForm.triceps as number,
          biceps: plisForm.biceps as number,
          sousscapulaire: plisForm.sousscapulaire as number,
          iliaque: plisForm.iliaque as number
        },
        age,
        client.sex
      )
      return { age, ...r }
    } catch {
      return null
    }
  }, [plisAllFilled, plisForm, client.sex, client.birthdate])

  const circHasData =
    poids !== undefined || grandeur !== undefined || ALL_CIRC_KEYS.some(k => circForm[k] !== undefined)
  const hasAny = circHasData || plisHasAny

  const dirty = !editing && hasAny
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  function resetForm() {
    setDate(todayISO())
    setPoids(undefined)
    setGrandeur(undefined)
    setCircForm({})
    setPlisForm({})
    setNotes('')
    setEditCircId(null)
    setEditPlisId(null)
  }

  function startEdit(entry: PriseEntry) {
    setDate(entry.date)
    if (entry.circ) {
      setCircForm(circRowToForm(entry.circ, unitLength))
      setPoids(entry.circ.poidsKg != null ? kgToWeightInput(entry.circ.poidsKg, unitWeight) : undefined)
      setGrandeur(entry.circ.grandeurCm != null ? cmToLengthInput(entry.circ.grandeurCm, heightUnit) : undefined)
      setEditCircId(entry.circ.id)
    } else {
      setCircForm({})
      setPoids(undefined)
      setGrandeur(undefined)
      setEditCircId(null)
    }
    if (entry.plis) {
      setPlisForm({
        triceps: entry.plis.triceps,
        biceps: entry.plis.biceps,
        sousscapulaire: entry.plis.sousscapulaire,
        iliaque: entry.plis.iliaque
      })
      setEditPlisId(entry.plis.id)
    } else {
      setPlisForm({})
      setEditPlisId(null)
    }
    setNotes(entry.circ?.notes ?? entry.plis?.notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    if (!hasAny) return
    if (plisHasAny && !plisAllFilled) {
      setError('Plis cutanés : saisissez les 4 plis, ou laissez-les tous vides.')
      return
    }
    if (plisAllFilled && !profileComplete) {
      setError('Profil incomplet : date de naissance + sexe requis pour calculer le % de gras.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const notesVal = notes.trim() || undefined
      if (circHasData) {
        const payload: CirconferencesInput = { date, notes: notesVal }
        for (const key of ALL_CIRC_KEYS) {
          const v = circForm[key]
          if (v !== undefined) payload[key] = lengthInputToCm(v, unitLength)
        }
        if (poids !== undefined) payload.poidsKg = weightInputToKg(poids, unitWeight)
        if (grandeur !== undefined) payload.grandeurCm = lengthInputToCm(grandeur, heightUnit)
        if (editCircId) await mesuresService.circonferences.update(editCircId, payload)
        else await mesuresService.circonferences.create(client.id, payload)
      }
      if (plisAllFilled) {
        const payload: PlisInput = {
          date,
          triceps: plisForm.triceps as number,
          biceps: plisForm.biceps as number,
          sousscapulaire: plisForm.sousscapulaire as number,
          iliaque: plisForm.iliaque as number,
          ...(typeof plisForm.mollet === 'number' ? { mollet: plisForm.mollet } : {}),
          notes: notesVal
        }
        if (editPlisId) await mesuresService.plis.update(editPlisId, payload)
        else await mesuresService.plis.create(client.id, payload)
      }
      resetForm()
      await reload()
      notify(editing ? 'Prise de mesures mise à jour' : 'Prise de mesures enregistrée')
    } catch (err) {
      setError(cleanIpcError(err, "Erreur lors de l'enregistrement."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-7">
      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</div>
      )}

      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-marine font-semibold text-lg">{editing ? 'Modifier la prise' : 'Nouvelle prise de mesures'}</h3>
          <div className="flex items-center gap-3">
            {editing && (
              <button type="button" onClick={resetForm} className="text-marine/50 hover:text-marine text-sm underline">
                Annuler la modification
              </button>
            )}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 text-marine/60 text-sm hover:text-marine transition-colors"
              title="Choisir les circonférences à saisir (vaut pour tous les clients)"
            >
              <SlidersHorizontal size={13} />
              Choisir les mesures
            </button>
          </div>
        </div>

        {/* Unités de saisie — même bandeau que le formulaire de bilan. */}
        <div className="max-w-5xl mx-auto mb-4 flex flex-wrap items-end gap-x-8 gap-y-3">
          <DateField value={date} onChange={setDate} />
          <div className="ml-auto">
            <span className="block text-xs uppercase tracking-wide mb-1 text-marine/60">Longueurs</span>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => changeUnitLength('cm')} className={unitPill(unitLength === 'cm')}>cm</button>
              <button type="button" onClick={() => changeUnitLength('in')} className={unitPill(unitLength === 'in')}>pouce</button>
            </div>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wide mb-1 text-marine/60">Poids</span>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => changeUnitWeight('kg')} className={unitPill(unitWeight === 'kg')}>kg</button>
              <button type="button" onClick={() => changeUnitWeight('lb')} className={unitPill(unitWeight === 'lb')}>lb</button>
            </div>
          </div>
          <p className="basis-full text-xs text-marine/45 order-last">
            Les plis restent en mm. Tout est converti en métrique pour les calculs.
          </p>
        </div>

        {/* Poids · Grandeur sur leur propre ligne (Grandeur saisie en pouces). */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <MeasureField
            label="Poids"
            unit={wLabel}
            value={poids}
            onChange={setPoids}
            previousValue={previousPoids}
            previousDate={previousCircRow?.date}
            lowerIsBetter
          />
          <MeasureField
            label="Grandeur"
            unit={grandeurUnit}
            unitToggle={
              <span className="ml-auto inline-flex rounded overflow-hidden border border-cream-dark normal-case tracking-normal">
                {(['cm', 'in'] as LengthUnit[]).map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => changeHeightUnit(u)}
                    className={`px-1.5 py-px text-[10px] transition-colors ${
                      heightUnit === u ? 'bg-gold text-marine font-semibold' : 'text-marine/50 hover:text-marine'
                    }`}
                  >
                    {lengthUnitLabel(u)}
                  </button>
                ))}
              </span>
            }
            value={grandeur}
            onChange={setGrandeur}
            previousValue={previousGrandeur}
            previousDate={previousCircRow?.date}
            extra={
              grandeur !== undefined ? (
                heightUnit === 'in' ? (
                  <p className="text-marine/45 text-xs mt-1">({nf1(lengthInputToCm(grandeur, 'in'))} cm)</p>
                ) : null
              ) : null
            }
          />
        </div>

        {/* Circonférences choisies, à partir de la ligne suivante. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {visibleMesureFields(mesureFields).map(f => (
            <Fragment key={f.key}>{circCard(f.key as CircKey, f.label)}</Fragment>
          ))}
        </div>

        {ratioTH !== null && client.sex && (
          <div className="mt-4 bg-white border border-cream-dark rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-marine/60 text-xs uppercase tracking-wide">Ratio Taille / Hanche</p>
                <p className="text-marine text-2xl font-bold mt-0.5">{ratioTH.toFixed(2)}</p>
                <MeasureDelta current={ratioTH} previous={previousRatioTH} previousDate={previousCircRow?.date} lowerIsBetter />
              </div>
              <div className="flex-1 min-w-[180px]">
                <WaistRiskBar value={ratioTH} sex={client.sex} type="ratio" />
              </div>
            </div>
          </div>
        )}

        {/* Plis cutanés (mêmes prise/date) + composition estimée */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div>
            <p className="text-marine/60 text-sm font-medium uppercase tracking-wide mb-2">Plis cutanés (mm)</p>
            {!profileComplete && (
              <p className="text-marine/45 text-sm mb-2">
                Complétez le profil (date de naissance + sexe) pour calculer le % de gras.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLIS_FIELDS.map(f => (
                <MeasureField
                  key={f.key}
                  label={f.label}
                  unit="mm"
                  value={plisForm[f.key]}
                  onChange={v => setPlisField(f.key, v)}
                  previousValue={previousPlisRow?.[f.key] ?? undefined}
                  previousDate={previousPlisRow?.date}
                  lowerIsBetter
                />
              ))}
            </div>
          </div>

          <div className="bg-white border border-cream-dark rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <Calculator size={17} className="text-gold-dark" />
              <h4 className="text-marine font-semibold text-base">Composition corporelle estimée</h4>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <div>
                <p className="text-marine/60 text-xs uppercase tracking-wide">Somme des 4 plis</p>
                <p className="text-marine text-xl font-bold mt-0.5">
                  {plisCalc ? nf1(plisCalc.sumPlis) : <span className="text-marine/25">—</span>}
                  {plisCalc && <span className="text-marine/45 text-sm font-medium ml-1.5">mm</span>}
                </p>
              </div>
              <div>
                <p className="text-marine/60 text-xs uppercase tracking-wide">Densité</p>
                <p className="text-marine text-xl font-bold mt-0.5">
                  {plisCalc ? nf4(plisCalc.density) : <span className="text-marine/25">—</span>}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-cream-dark pt-4">
              <p className="text-marine/60 text-xs uppercase tracking-wide">% de gras (Durnin-Womersley)</p>
              <p className="mt-1 flex items-baseline gap-3 flex-wrap">
                <span className="text-gold-dark text-3xl font-bold leading-none">
                  {plisCalc ? nf1(plisCalc.bodyFatSiri) : '—'}
                  {plisCalc && <span className="text-xl"> %</span>}
                </span>
                {plisCalc && <span className="text-marine/45 text-sm">4 plis · densité → Siri</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-marine/60 text-sm font-medium uppercase tracking-wide mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Observations, conditions de la mesure…"
            className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={save}
            disabled={!hasAny || saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {editing ? 'Mettre à jour' : 'Enregistrer'}
          </button>
          {!hasAny && <span className="text-marine/40 text-sm">Saisissez au moins une mesure.</span>}
        </div>
      </div>

      {/* Historique combiné (une ligne par prise/date) */}
      <section>
        <h3 className="text-marine font-semibold text-lg mb-3">Prises précédentes</h3>
        {loading ? (
          <p className="text-marine/40 text-base">Chargement…</p>
        ) : history.length === 0 ? (
          <p className="text-marine/45 text-base">Aucune prise de mesures enregistrée pour ce client.</p>
        ) : (
          <div className="bg-white border border-cream-dark rounded-lg overflow-hidden">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-cream/70 text-marine/55 text-sm uppercase tracking-wide">
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-right font-medium px-4 py-3">Poids ({wLabel})</th>
                  <th className="text-right font-medium px-4 py-3">Taille ({lenLabel})</th>
                  <th className="text-right font-medium px-4 py-3">% gras</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {history.map(entry => (
                  <tr key={entry.date} className="border-t border-cream-dark hover:bg-cream/40 transition-colors">
                    <td className="px-4 py-3 text-marine font-medium">{formatBilanDate(entry.date)}</td>
                    <td className="px-4 py-3 text-right text-marine/80">{formatWeight(entry.circ?.poidsKg ?? null, unitWeight)}</td>
                    <td className="px-4 py-3 text-right text-marine/80">{formatLength(entry.circ?.taille ?? null, unitLength)}</td>
                    <td className="px-4 py-3 text-right text-marine/80">
                      {entry.plis ? `${nf1(entry.plis.pourcentageGrasSiri)} %` : <span className="text-marine/30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          title="Modifier"
                          className="inline-flex items-center gap-1 text-gold-dark hover:text-marine text-base font-medium transition-colors"
                        >
                          <PencilLine size={16} /> Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(entry)}
                          title="Supprimer"
                          aria-label={`Supprimer la prise du ${formatBilanDate(entry.date)}`}
                          className="text-red-500/70 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deleting && (
        <ConfirmDialog
          message={`Supprimer la prise du ${formatBilanDate(deleting.date)} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              if (deleting.circ) await mesuresService.circonferences.delete(deleting.circ.id)
              if (deleting.plis) await mesuresService.plis.delete(deleting.plis.id)
              if (editing && (editCircId === deleting.circ?.id || editPlisId === deleting.plis?.id)) resetForm()
              setDeleting(null)
              await reload()
              notify('Prise supprimée')
            } catch (err) {
              setError(cleanIpcError(err, 'Erreur lors de la suppression.'))
              setDeleting(null)
            }
          }}
        />
      )}

      {pickerOpen && (
        <MesureFieldsPicker
          current={mesureFields}
          onCancel={() => setPickerOpen(false)}
          onSave={async next => {
            await settingsService.setMesureFields(next)
            setMesureFields(next)
            setPickerOpen(false)
            notify('Mesures à saisir mises à jour')
          }}
        />
      )}
    </div>
  )
}


/** Choix des circonférences saisies. Réglage global (la pratique de Marie-Eve),
 *  pas par client. Masquer une mesure n'efface aucune donnée déjà enregistrée. */
function MesureFieldsPicker({
  current,
  onCancel,
  onSave
}: {
  current: MesureFieldKey[] | null
  onCancel: () => void
  onSave: (next: MesureFieldKey[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<Set<MesureFieldKey>>(
    () => new Set(current ?? DEFAULT_MESURE_FIELD_KEYS)
  )
  const [saving, setSaving] = useState(false)

  const toggle = (key: MesureFieldKey): void => {
    if (REQUIRED_MESURE_FIELD_KEYS.includes(key)) return
    setSelected(s => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-marine/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6">
          <h3 className="text-marine font-bold text-lg">Choisir les mesures</h3>
          <p className="text-marine/55 text-sm mt-1">
            Décochez les circonférences que vous ne prenez pas — elles disparaîtront du formulaire.
            <span className="block mt-1 text-marine/45">
              Aucune donnée déjà enregistrée n’est supprimée : les anciennes mesures restent visibles dans
              l’historique et le rapport.
            </span>
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setSelected(new Set(ALL_MESURE_FIELD_KEYS))}
              className="text-gold-dark hover:text-marine text-sm underline"
            >
              Tout cocher
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set(REQUIRED_MESURE_FIELD_KEYS))}
              className="text-gold-dark hover:text-marine text-sm underline"
            >
              Tout décocher
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {MESURE_FIELDS.map(f => {
              const required = REQUIRED_MESURE_FIELD_KEYS.includes(f.key)
              return (
                <label
                  key={f.key}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-base ${
                    required ? 'text-marine/45 cursor-not-allowed' : 'text-marine hover:bg-cream/60 cursor-pointer'
                  }`}
                  title={required ? 'Nécessaire au calcul du ratio Taille / Hanche' : undefined}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(f.key)}
                    disabled={required}
                    onChange={() => toggle(f.key)}
                    className="w-4 h-4 accent-gold-dark"
                  />
                  <span>{f.label}</span>
                  {required && <span className="text-marine/35 text-xs">(requis)</span>}
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6 pt-2 border-t border-cream-dark/40">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-marine/60 hover:text-marine font-medium text-base"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                // Ordre du catalogue, pas ordre de clic.
                await onSave(ALL_MESURE_FIELD_KEYS.filter(k => selected.has(k)))
              } finally {
                setSaving(false)
              }
            }}
            className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
