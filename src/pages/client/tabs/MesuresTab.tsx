import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { ArrowUpCircle, Calculator, Eye, Loader2, PencilLine, PersonStanding, Ruler, Save, SlidersHorizontal, Trash2, UserCog, X } from 'lucide-react'
import bodyMale from '@/assets/body-male.png'
import bodyFemale from '@/assets/body-female.png'
import { useClient } from '../ClientDetailLayout'
import { clientsService } from '../../../services/clients'
import { mesuresService } from '../../../services/mesures'
import { settingsService } from '../../../services/settings'
import {
  ALL_MESURE_FIELD_KEYS,
  DEFAULT_MESURE_FIELD_KEYS,
  MESURE_FIELDS,
  REQUIRED_MESURE_FIELD_KEYS,
  mesureRows
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
  weightUnitLabel
} from '../../../lib/units'
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

// Toutes les circonférences (clé + libellé), dans l'ordre du catalogue partagé
// `MESURE_FIELDS` — source unique des libellés/ordre (détail, rapport, préremplissage).
const CIRC_ALL: { key: CircKey; label: string }[] = MESURE_FIELDS.map(f => ({ key: f.key as CircKey, label: f.label }))

type PlisKey = 'triceps' | 'biceps' | 'sousscapulaire' | 'iliaque'
const PLIS_FIELDS: { key: PlisKey; label: string }[] = [
  { key: 'triceps', label: 'Triceps' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'sousscapulaire', label: 'Sous-scapulaire' },
  { key: 'iliaque', label: 'Crête iliaque' }
]

type CircForm = Partial<Record<CircKey, number>>
type PlisForm = Partial<Record<PlisKey, number>>

/** Convertit une ligne (stockée en cm) vers les valeurs à afficher dans les champs, selon l'unité du client. */
function circRowToForm(row: MesureCirconferences, unit: 'cm' | 'in'): CircForm {
  const f: CircForm = {}
  for (const { key } of CIRC_ALL) {
    const v = row[key]
    if (typeof v === 'number') f[key] = cmToLengthInput(v, unit)
  }
  return f
}

// ────────────────────────────────────────────────────────────────────────────────

export function MesuresTab() {
  const client = useClient()
  const [view, setView] = useState<'circ' | 'plis'>('circ')
  const [toast, setToast] = useState<string | null>(null)
  // Saisie non enregistrée dans l'un ou l'autre panneau → on bloque la navigation
  // sortante (changement d'onglet, retour, autre client) pour éviter la perte.
  const [circDirty, setCircDirty] = useState(false)
  const [plisDirty, setPlisDirty] = useState(false)
  const dirty = circDirty || plisDirty
  const blocker = useBlocker(dirty)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="p-8 max-w-6xl">
      <div className="inline-flex items-center gap-1 bg-cream-dark/60 rounded-lg p-1 mb-6">
        <SubTabButton active={view === 'circ'} onClick={() => setView('circ')} icon={Ruler}>
          Circonférences
        </SubTabButton>
        <SubTabButton active={view === 'plis'} onClick={() => setView('plis')} icon={Calculator}>
          Plis cutanés
        </SubTabButton>
      </div>

      {/* Les DEUX panneaux restent montés (l'inactif masqué via `hidden`) afin de
          NE PAS perdre la saisie en cours quand on bascule d'un sous-onglet à
          l'autre. Démonter/remonter réinitialiserait l'état local du formulaire. */}
      <div className={view === 'circ' ? '' : 'hidden'}>
        <CirconferencesPanel client={client} notify={setToast} onDirtyChange={setCircDirty} />
      </div>
      <div className={view === 'plis' ? '' : 'hidden'}>
        <PlisPanel client={client} notify={setToast} onDirtyChange={setPlisDirty} />
      </div>

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

function SubTabButton({
  active,
  onClick,
  icon: Icon,
  children
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 px-4 py-2 rounded-md text-base font-medium transition-colors',
        active ? 'bg-marine text-cream shadow-sm' : 'text-marine/55 hover:text-marine'
      ].join(' ')}
    >
      <Icon size={16} />
      {children}
    </button>
  )
}

// ── Carte de saisie d'une mesure ────────────────────────────────────────────────
function MeasureField({
  label,
  unit,
  value,
  onChange,
  previousValue,
  previousDate,
  lowerIsBetter,
  extra
}: {
  label: string
  unit: string
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
    <div className="bg-marine-light/95 border border-gold/20 rounded-xl px-4 py-3">
      <p className="text-cream/55 text-xs uppercase tracking-wide truncate">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <input
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          value={value === undefined ? '' : value}
          onChange={e => onChange(Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)}
          placeholder="—"
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-cream outline-none placeholder:text-cream/20"
        />
        <span className="text-cream/40 text-sm font-medium shrink-0">{unit}</span>
      </div>
      <MeasureDelta
        current={value}
        previous={previousValue}
        previousDate={previousDate}
        unit={unit}
        lowerIsBetter={lowerIsBetter}
        theme="dark"
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
    <div className="mb-4 max-w-5xl mx-auto bg-marine-light/95 border border-gold/20 rounded-xl px-4 py-3">
      <p className="text-cream/55 text-xs uppercase tracking-wide">Date de la mesure</p>
      <input
        type="date"
        value={value}
        max={today}
        onChange={e => onChange(e.target.value || today)}
        className="mt-1 bg-transparent text-cream text-lg font-semibold outline-none border-0 [color-scheme:dark]"
      />
    </div>
  )
}

/**
 * Visuel central de l'onglet Mesures. Priorité : (1) la photo « plein corps » du
 * client si elle existe, (2) sinon la silhouette générique selon le sexe, (3) sinon
 * une invite à compléter le profil.
 *
 * NB : la photo est affichée telle quelle. Si Marie-Eve téléverse une photo brute
 * (fond non transparent), le fond sera visible — recommander un PNG à fond
 * transparent. Un détourage automatique pourra être ajouté dans une v0.1.x suivante.
 */
function Silhouette({ client }: { client: Client }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Priorité : avatar full-body s'il existe, sinon avatar circle classique
    const filename = client.avatarFullbodyFilename ?? client.avatarFilename ?? null
    if (filename) {
      clientsService
        .getAvatarUrl(filename)
        .then(url => {
          if (!cancelled) setAvatarUrl(url)
        })
        .catch(() => {
          if (!cancelled) setAvatarUrl(null)
        })
    } else {
      setAvatarUrl(null)
    }
    return () => {
      cancelled = true
    }
  }, [client.avatarFullbodyFilename, client.avatarFilename])

  if (!avatarUrl && !client.sex) {
    return (
      <div className="flex flex-col items-center justify-center text-center bg-marine-light/35 border border-dashed border-gold/30 rounded-2xl p-6 min-h-[320px] h-full">
        <PersonStanding size={64} className="text-cream/30" />
        <p className="text-cream/55 text-sm mt-3 max-w-[15rem]">
          Complétez le profil du client (ou ajoutez une photo) pour personnaliser la silhouette.
        </p>
      </div>
    )
  }

  const bodyImage = avatarUrl ?? (client.sex === 'F' ? bodyFemale : bodyMale)
  return (
    <div className="flex items-center justify-center h-full">
      <img
        src={bodyImage}
        alt={avatarUrl ? client.name : client.sex === 'F' ? 'Silhouette femme' : 'Silhouette homme'}
        draggable={false}
        className="max-h-[560px] max-w-full w-auto object-contain select-none"
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
function CirconferencesPanel({
  client,
  notify,
  onDirtyChange
}: {
  client: Client
  notify: (m: string) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const unitLength = client.unitLength ?? 'cm'
  const unitWeight = client.unitWeight ?? 'kg'
  const lenLabel = lengthUnitLabel(unitLength)
  const wLabel = weightUnitLabel(unitWeight)
  const [list, setList] = useState<MesureCirconferences[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<CircForm>({})
  // Circonférences que Marie-Eve saisit. `null` = jamais choisi → toutes.
  // Réglage global (sa pratique), pas par client.
  const [mesureFields, setMesureFields] = useState<MesureFieldKey[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  // `poids` est exprimé dans l'unité préférée du client (kg ou lb) — converti en kg à l'enregistrement.
  const [poids, setPoids] = useState<number | undefined>(undefined)
  // Date de la session de mesure (ISO `AAAA-MM-JJ`). Éditable pour permettre
  // une saisie en retard (Marie-Eve note sur papier puis entre les jours suivants).
  const [date, setDate] = useState<string>(todayISO())
  const [notes, setNotes] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<MesureCirconferences | null>(null)
  const [viewing, setViewing] = useState<MesureCirconferences | null>(null)

  useEffect(() => {
    settingsService.getMesureFields().then(setMesureFields).catch(() => undefined)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await mesuresService.circonferences.list(client.id))
    } catch {
      setError('Impossible de charger les mesures.')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => {
    reload()
  }, [reload])

  function setField(key: CircKey, v: number | undefined) {
    setForm(f => {
      const next = { ...f }
      if (v === undefined) delete next[key]
      else next[key] = v
      return next
    })
  }

  // Mesure précédente, dans l'ordre temporel relatif à ce qu'on est en train de saisir.
  // - Si on édite la ligne d'index `i` → précédent = list[i + 1] (plus ancien).
  // - Si on crée une nouvelle ligne → précédent = list[0] (la plus récente sauvegardée).
  const previousRow = useMemo<MesureCirconferences | null>(() => {
    if (!list.length) return null
    if (editId) {
      const idx = list.findIndex(r => r.id === editId)
      return idx >= 0 ? list[idx + 1] ?? null : null
    }
    return list[0]
  }, [list, editId])

  /** Valeur de la circonférence dans la mesure précédente, convertie dans l'unité du client. */
  const previousCirc = (key: CircKey): number | undefined => {
    if (!previousRow) return undefined
    const v = previousRow[key]
    return typeof v === 'number' ? cmToLengthInput(v, unitLength) : undefined
  }
  const previousPoids = previousRow?.poidsKg != null ? kgToWeightInput(previousRow.poidsKg, unitWeight) : undefined

  // Tour de taille / hanche / abdomen : baisse = amélioration.
  const LOWER_IS_BETTER_CIRC: Partial<Record<CircKey, boolean>> = {
    taille: true,
    hanche: true,
    abdomen: true
  }

  // Lignes du formulaire. Chaque mesure garde sa ligne anatomique : masquer
  // « Cou » laisse sa place vide plutôt que d'y faire remonter « Biceps G ».
  const fieldRows = mesureRows(mesureFields)

  // Une carte de saisie pour une circonférence (toutes en `lenLabel`).
  const circCard = (key: CircKey, label: string) => {
    // Barre de risque OMS sous la mesure pour tour de taille et hanche.
    let riskBar: React.ReactNode = null
    if ((key === 'taille' || key === 'hanche') && client.sex && typeof form[key] === 'number') {
      // Convertit la valeur saisie (peut être en pouces) en cm pour l'évaluation OMS.
      const valueCm = lengthInputToCm(form[key] as number, unitLength)
      riskBar = <WaistRiskBar value={valueCm} sex={client.sex} type="waist" />
    }
    return (
      <MeasureField
        label={label}
        unit={lenLabel}
        value={form[key]}
        onChange={v => setField(key, v)}
        previousValue={previousCirc(key)}
        previousDate={previousRow?.date}
        lowerIsBetter={LOWER_IS_BETTER_CIRC[key] ?? false}
        extra={riskBar}
      />
    )
  }

  // Ratio T/H calculé (en cm — indépendant de l'unité d'affichage).
  const ratioTH = useMemo(() => {
    const tCm = form.taille !== undefined ? lengthInputToCm(form.taille, unitLength) : null
    const hCm = form.hanche !== undefined ? lengthInputToCm(form.hanche, unitLength) : null
    if (tCm === null || hCm === null || hCm <= 0) return null
    return Math.round((tCm / hCm) * 100) / 100
  }, [form.taille, form.hanche, unitLength])
  const previousRatioTH = useMemo(() => {
    if (!previousRow?.taille || !previousRow?.hanche || previousRow.hanche <= 0) return undefined
    return Math.round((previousRow.taille / previousRow.hanche) * 100) / 100
  }, [previousRow])

  function resetForm() {
    setForm({})
    setPoids(undefined)
    setDate(todayISO())
    setNotes('')
    setEditId(null)
  }

  function startEdit(row: MesureCirconferences) {
    setForm(circRowToForm(row, unitLength))
    setPoids(row.poidsKg != null ? kgToWeightInput(row.poidsKg, unitWeight) : undefined)
    setDate(row.date)
    setNotes(row.notes ?? '')
    setEditId(row.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasAny = poids !== undefined || CIRC_ALL.some(c => form[c.key] !== undefined)

  // « Dirty » = nouvelle saisie non enregistrée (on n'alerte pas en mode édition
  // d'une ligne existante, dont les valeurs sont déjà en base).
  const dirty = !editId && hasAny
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function save() {
    if (!hasAny) return
    setSaving(true)
    setError(null)
    try {
      // Conversion vers le stockage métrique (cm + kg) — jamais l'inverse.
      const payload: CirconferencesInput = { date, notes: notes.trim() || undefined }
      for (const { key } of CIRC_ALL) {
        const v = form[key]
        if (v !== undefined) payload[key] = lengthInputToCm(v, unitLength)
      }
      if (poids !== undefined) payload.poidsKg = weightInputToKg(poids, unitWeight)
      if (editId) {
        await mesuresService.circonferences.update(editId, payload)
      } else {
        await mesuresService.circonferences.create(client.id, payload)
      }
      resetForm()
      await reload()
      notify(editId ? 'Mesures mises à jour' : 'Mesures enregistrées')
    } catch (err) {
      setError(cleanIpcError(err, "Erreur lors de l'enregistrement."))
    } finally {
      setSaving(false)
    }
  }

  const [showPrefillModal, setShowPrefillModal] = useState(false)

  /** Champs disponibles dans la mesure précédente (sources potentielles du pré-remplissage). */
  const prefillSources = useMemo<CircKey[]>(() => {
    if (!previousRow) return []
    return CIRC_ALL.filter(({ key }) => typeof previousRow[key] === 'number').map(c => c.key)
  }, [previousRow])
  const previousPoidsAvailable = previousRow?.poidsKg != null
  const prefillAvailableCount = prefillSources.length + (previousPoidsAvailable ? 1 : 0)

  function applyPrefill(selectedCirc: Set<CircKey>, includePoids: boolean, overwrite: boolean) {
    if (!previousRow) return
    setForm(prev => {
      const next = { ...prev }
      for (const key of selectedCirc) {
        if (!overwrite && next[key] !== undefined) continue
        const v = previousRow[key]
        if (typeof v === 'number') next[key] = cmToLengthInput(v, unitLength)
      }
      return next
    })
    if (includePoids && previousRow.poidsKg != null) {
      if (overwrite || poids === undefined) {
        setPoids(kgToWeightInput(previousRow.poidsKg, unitWeight))
      }
    }
    setShowPrefillModal(false)
  }

  return (
    <div className="space-y-7">
      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</div>
      )}

      {!editId && previousRow && prefillAvailableCount > 0 && (
        <button
          type="button"
          onClick={() => setShowPrefillModal(true)}
          className="w-full bg-gold/10 border border-gold/40 hover:border-gold rounded-md px-4 py-3 flex items-center gap-3 transition-colors text-left"
        >
          <ArrowUpCircle size={20} className="text-gold-dark shrink-0" />
          <div className="flex-1">
            <p className="text-marine font-medium text-sm">
              Reprendre les valeurs de la mesure du {formatBilanDate(previousRow.date)}
            </p>
            <p className="text-marine/55 text-xs mt-0.5">
              {prefillAvailableCount} champ{prefillAvailableCount > 1 ? 's' : ''} disponible{prefillAvailableCount > 1 ? 's' : ''} à pré-remplir
            </p>
          </div>
          <span className="px-3 py-1.5 bg-gold text-marine font-semibold rounded-md text-xs">Pré-remplir</span>
        </button>
      )}

      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-marine font-semibold text-lg">
            {editId ? `Modifier les circonférences du ${formatBilanDate(list.find(r => r.id === editId)?.date ?? date)}` : 'Nouvelle prise de mesures'}
          </h2>
          <div className="flex items-center gap-3">
            {editId && (
              <button type="button" onClick={resetForm} className="text-marine/50 hover:text-marine text-sm underline">
                Annuler la modification
              </button>
            )}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-cream/70 text-marine/70 hover:bg-cream-dark hover:text-marine transition-colors"
              title="Choisir les circonférences que vous prenez"
            >
              <SlidersHorizontal size={13} />
              Choisir les mesures
            </button>
          </div>
        </div>

        <DateField value={date} onChange={setDate} />

        {/*
          Disposition : grille 3 colonnes de largeur égale, N+1 lignes.
          ─ colonne 2, lignes 1..N : silhouette (étirée sur toutes les rangées).
          ─ colonnes 1 & 3 : les circonférences visibles, gauche / droite.
          ─ ligne N+1, colonne 2 : Poids — une seule colonne de large, donc
            exactement la même largeur visuelle que les cartes de mesure.
          Chaque carte pose sa ligne explicitement (`gridRow`) : si Marie-Eve
          masque « Mollet G » sans « Mollet D », la colonne de droite ne remonte
          pas d'un cran.
          `minmax(0,1fr)` sur chaque colonne : empêche l'image de la silhouette
          (intrinsèquement large) d'élargir la colonne 2 au-delà de sa fraction.
        */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 max-w-5xl mx-auto items-start">
          <div
            className="col-start-2 self-stretch flex items-center justify-center min-h-[320px]"
            style={{ gridRow: `1 / span ${Math.max(fieldRows.length, 1)}` }}
          >
            <Silhouette client={client} />
          </div>

          {fieldRows.map(([left, right], i) => (
            <Fragment key={left?.key ?? right?.key ?? i}>
              {left && (
                <div className="col-start-1" style={{ gridRow: i + 1 }}>
                  {circCard(left.key, left.label)}
                </div>
              )}
              {right && (
                <div className="col-start-3" style={{ gridRow: i + 1 }}>
                  {circCard(right.key, right.label)}
                </div>
              )}
            </Fragment>
          ))}

          <div className="col-start-2" style={{ gridRow: fieldRows.length + 1 }}>
            <MeasureField
              label="Poids"
              unit={wLabel}
              value={poids}
              onChange={setPoids}
              previousValue={previousPoids}
              previousDate={previousRow?.date}
              lowerIsBetter
            />
          </div>
        </div>

        {/* Ratio Taille/Hanche : calculé dès que les 2 sont saisis, avec barre OMS */}
        {ratioTH !== null && client.sex && (
          <div className="mt-3 max-w-5xl mx-auto bg-marine-light/95 border border-gold/20 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-cream/55 text-xs uppercase tracking-wide">Ratio Taille / Hanche</p>
                <p className="text-cream text-2xl font-bold mt-0.5">{ratioTH.toFixed(2)}</p>
                <MeasureDelta
                  current={ratioTH}
                  previous={previousRatioTH}
                  previousDate={previousRow?.date}
                  lowerIsBetter
                  theme="dark"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <WaistRiskBar value={ratioTH} sex={client.sex} type="ratio" />
              </div>
            </div>
          </div>
        )}

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
            {editId ? 'Mettre à jour' : 'Enregistrer'}
          </button>
          {!hasAny && <span className="text-marine/40 text-sm">Saisissez au moins une mesure.</span>}
        </div>
      </div>

      {/* Historique */}
      <section>
        <h3 className="text-marine font-semibold text-lg mb-3">Mesures précédentes</h3>
        {loading ? (
          <p className="text-marine/40 text-base">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="text-marine/45 text-base">Aucune prise de mesures enregistrée pour ce client.</p>
        ) : (
          <div className="bg-white border border-cream-dark rounded-lg overflow-hidden">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-cream/70 text-marine/55 text-sm uppercase tracking-wide">
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-right font-medium px-4 py-3">Poids ({wLabel})</th>
                  <th className="text-right font-medium px-4 py-3">Taille ({lenLabel})</th>
                  <th className="text-right font-medium px-4 py-3">Hanche ({lenLabel})</th>
                  <th className="text-right font-medium px-4 py-3">Variation taille</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((row, i) => {
                  const older = list[i + 1]
                  const variation =
                    older && typeof row.taille === 'number' && typeof older.taille === 'number' && older.taille !== 0
                      ? ((row.taille - older.taille) / older.taille) * 100
                      : null
                  return (
                    <tr key={row.id} className="border-t border-cream-dark hover:bg-cream/40 transition-colors">
                      <td className="px-4 py-3 text-marine font-medium">{formatBilanDate(row.date)}</td>
                      <td className="px-4 py-3 text-right text-marine/80">{formatWeight(row.poidsKg, unitWeight)}</td>
                      <td className="px-4 py-3 text-right text-marine/80">{formatLength(row.taille, unitLength)}</td>
                      <td className="px-4 py-3 text-right text-marine/80">{formatLength(row.hanche, unitLength)}</td>
                      <td className="px-4 py-3 text-right">
                        {variation === null ? (
                          <span className="text-marine/30">—</span>
                        ) : (
                          <span
                            className={
                              variation === 0
                                ? 'text-marine/45'
                                : variation < 0
                                ? 'text-green-600 font-medium'
                                : 'text-red-600 font-medium'
                            }
                          >
                            {variation > 0 ? '▲' : variation < 0 ? '▼' : '='} {nf1(Math.abs(variation))} %
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setViewing(row)}
                            title="Voir le détail"
                            className="inline-flex items-center gap-1 text-marine/55 hover:text-marine text-base transition-colors"
                          >
                            <Eye size={16} /> Voir
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            title="Modifier"
                            className="inline-flex items-center gap-1 text-gold-dark hover:text-marine text-base font-medium transition-colors"
                          >
                            <PencilLine size={16} /> Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(row)}
                            title="Supprimer"
                            aria-label={`Supprimer les mesures du ${formatBilanDate(row.date)}`}
                            className="text-red-500/70 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {viewing && <CircDetailModal row={viewing} client={client} onClose={() => setViewing(null)} />}

      {showPrefillModal && previousRow && (
        <CircPrefillModal
          previousRow={previousRow}
          unitLength={unitLength}
          unitWeight={unitWeight}
          onCancel={() => setShowPrefillModal(false)}
          onApply={applyPrefill}
        />
      )}

      {deleting && (
        <ConfirmDialog
          message={`Supprimer les mesures du ${formatBilanDate(deleting.date)} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await mesuresService.circonferences.delete(deleting.id)
              if (editId === deleting.id) resetForm()
              setDeleting(null)
              await reload()
              notify('Mesures supprimées')
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

interface CircPrefillModalProps {
  previousRow: MesureCirconferences
  unitLength: 'cm' | 'in'
  unitWeight: 'kg' | 'lb'
  onCancel: () => void
  onApply: (selected: Set<CircKey>, includePoids: boolean, overwrite: boolean) => void
}

function CircPrefillModal({ previousRow, unitLength, unitWeight, onCancel, onApply }: CircPrefillModalProps) {
  const availableCirc = useMemo(
    () => CIRC_ALL.filter(({ key }) => typeof previousRow[key] === 'number'),
    [previousRow]
  )
  const poidsAvailable = previousRow.poidsKg != null

  const [selected, setSelected] = useState<Set<CircKey>>(
    () => new Set(availableCirc.map(c => c.key))
  )
  const [includePoids, setIncludePoids] = useState(poidsAvailable)
  const [overwrite, setOverwrite] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function toggle(key: CircKey) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalSelected = selected.size + (includePoids ? 1 : 0)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-lg border border-cream-dark">
        <div className="px-6 py-5 border-b border-cream-dark">
          <h3 className="text-marine font-semibold text-lg">
            Pré-remplir depuis le {formatBilanDate(previousRow.date)}
          </h3>
          <p className="text-marine/55 text-sm mt-1">
            Décocher les valeurs qu'on ne veut pas reprendre.
          </p>
        </div>

        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto">
          {poidsAvailable && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-white/50 px-2 py-1.5 rounded mb-1">
              <input
                type="checkbox"
                checked={includePoids}
                onChange={() => setIncludePoids(v => !v)}
                className="w-4 h-4 accent-gold cursor-pointer"
              />
              <span className="flex-1 text-marine text-base">Poids</span>
              <span className="text-marine/50 text-sm font-mono">
                {formatWeight(previousRow.poidsKg as number, unitWeight)} {weightUnitLabel(unitWeight)}
              </span>
            </label>
          )}
          <ul className="space-y-0.5">
            {availableCirc.map(c => (
              <li key={c.key}>
                <label className="flex items-center gap-3 cursor-pointer hover:bg-white/50 px-2 py-1.5 rounded">
                  <input
                    type="checkbox"
                    checked={selected.has(c.key)}
                    onChange={() => toggle(c.key)}
                    className="w-4 h-4 accent-gold cursor-pointer"
                  />
                  <span className="flex-1 text-marine text-base">{c.label}</span>
                  <span className="text-marine/50 text-sm font-mono">
                    {formatLength(previousRow[c.key] as number, unitLength)} {lengthUnitLabel(unitLength)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 py-3 border-t border-cream-dark bg-cream/40">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={() => setOverwrite(v => !v)}
              className="w-4 h-4 accent-gold cursor-pointer"
            />
            <span className="text-marine/70 text-sm">Écraser les champs déjà saisis</span>
          </label>
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
            onClick={() => onApply(selected, includePoids, overwrite)}
            disabled={totalSelected === 0}
            className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pré-remplir ({totalSelected})
          </button>
        </div>
      </div>
    </div>
  )
}

function CircDetailModal({ row, client, onClose }: { row: MesureCirconferences; client: Client; onClose: () => void }) {
  const unitLength = client.unitLength ?? 'cm'
  const unitWeight = client.unitWeight ?? 'kg'
  const lenLabel = lengthUnitLabel(unitLength)
  const wLabel = weightUnitLabel(unitWeight)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="bg-cream rounded-lg shadow-2xl w-full max-w-lg border border-cream-dark p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-marine font-semibold text-xl">Circonférences — {formatBilanDate(row.date)}</h2>
          <button type="button" onClick={onClose} className="text-marine/40 hover:text-marine" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2.5">
          <div>
            <p className="text-marine/50 text-xs uppercase tracking-wide">Poids</p>
            <p className="text-marine font-medium text-base">
              {row.poidsKg != null ? `${formatWeight(row.poidsKg, unitWeight)} ${wLabel}` : <span className="text-marine/25">—</span>}
            </p>
          </div>
          {CIRC_ALL.map(({ key, label }) => (
            <div key={key}>
              <p className="text-marine/50 text-xs uppercase tracking-wide">{label}</p>
              <p className="text-marine font-medium text-base">
                {row[key] != null ? `${formatLength(row[key] as number, unitLength)} ${lenLabel}` : <span className="text-marine/25">—</span>}
              </p>
            </div>
          ))}
        </div>
        {row.notes && (
          <div className="mt-4 border-t border-cream-dark pt-3">
            <p className="text-marine/50 text-xs uppercase tracking-wide mb-1">Notes</p>
            <p className="text-marine/80 text-base whitespace-pre-wrap">{row.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  Sous-onglet : Plis cutanés
// ════════════════════════════════════════════════════════════════════════════════
function PlisPanel({
  client,
  notify,
  onDirtyChange
}: {
  client: Client
  notify: (m: string) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const navigate = useNavigate()
  const [list, setList] = useState<MesurePlisCutanes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<PlisForm>({})
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState<string>(todayISO())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<MesurePlisCutanes | null>(null)

  const profileComplete = Boolean(client.birthdate && client.sex)

  // « Dirty » = nouveaux plis saisis non enregistrés (hors mode édition).
  const plisDirty = !editId && PLIS_FIELDS.some(f => typeof form[f.key] === 'number')
  useEffect(() => {
    onDirtyChange(plisDirty)
  }, [plisDirty, onDirtyChange])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await mesuresService.plis.list(client.id))
    } catch {
      setError('Impossible de charger les plis cutanés.')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => {
    reload()
  }, [reload])

  function setField(key: PlisKey, v: number | undefined) {
    setForm(f => {
      const next = { ...f }
      if (v === undefined) delete next[key]
      else next[key] = v
      return next
    })
  }

  function resetForm() {
    setForm({})
    setNotes('')
    setDate(todayISO())
    setEditId(null)
  }

  // Mesure précédente — pour delta et pré-remplissage (4 plis = lower is better).
  const previousPlisRow = useMemo<MesurePlisCutanes | null>(() => {
    if (!list.length) return null
    if (editId) {
      const idx = list.findIndex(r => r.id === editId)
      return idx >= 0 ? list[idx + 1] ?? null : null
    }
    return list[0]
  }, [list, editId])

  const [showPlisPrefillModal, setShowPlisPrefillModal] = useState(false)

  function applyPlisPrefill(selected: Set<PlisKey>, overwrite: boolean) {
    if (!previousPlisRow) return
    setForm(prev => {
      const next = { ...prev }
      for (const key of selected) {
        if (!overwrite && next[key] !== undefined) continue
        next[key] = previousPlisRow[key]
      }
      return next
    })
    setShowPlisPrefillModal(false)
  }

  function startEdit(row: MesurePlisCutanes) {
    setForm({ triceps: row.triceps, biceps: row.biceps, sousscapulaire: row.sousscapulaire, iliaque: row.iliaque })
    setNotes(row.notes ?? '')
    setDate(row.date)
    setEditId(row.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const allFilled = PLIS_FIELDS.every(f => typeof form[f.key] === 'number' && (form[f.key] as number) > 0)

  const calc = useMemo(() => {
    if (!allFilled || !client.sex || !client.birthdate) return null
    try {
      const age = calculateAge(client.birthdate)
      const r = calculateBodyFat(
        {
          triceps: form.triceps as number,
          biceps: form.biceps as number,
          sousscapulaire: form.sousscapulaire as number,
          iliaque: form.iliaque as number
        },
        age,
        client.sex
      )
      return { age, ...r }
    } catch {
      return null
    }
  }, [allFilled, form, client.sex, client.birthdate])

  async function save() {
    if (!allFilled) return
    setSaving(true)
    setError(null)
    try {
      const payload: PlisInput = {
        date,
        triceps: form.triceps as number,
        biceps: form.biceps as number,
        sousscapulaire: form.sousscapulaire as number,
        iliaque: form.iliaque as number,
        notes: notes.trim() || undefined
      }
      if (editId) {
        await mesuresService.plis.update(editId, payload)
      } else {
        await mesuresService.plis.create(client.id, payload)
      }
      resetForm()
      await reload()
      notify(editId ? 'Plis cutanés mis à jour' : 'Plis cutanés enregistrés')
    } catch (err) {
      setError(cleanIpcError(err, "Erreur lors de l'enregistrement."))
    } finally {
      setSaving(false)
    }
  }

  if (!profileComplete) {
    return (
      <div className="max-w-2xl">
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <UserCog size={22} className="text-gold-dark shrink-0 mt-0.5" />
            <div>
              <p className="text-marine font-semibold text-base">Profil du client incomplet</p>
              <p className="text-marine/65 text-base mt-1">
                Pour calculer le pourcentage de gras corporel, complétez le profil du client (date de naissance + sexe).
              </p>
              <button
                type="button"
                onClick={() => navigate(`/clients/${client.id}/mesures?edit=1`)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors"
              >
                <UserCog size={16} />
                Compléter le profil
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const sexLabel = client.sex === 'F' ? 'femme' : 'homme'

  return (
    <div className="space-y-7">
      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Saisie des 4 plis */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-marine font-semibold text-lg">
              {editId ? 'Modifier les plis cutanés' : 'Mesure des plis cutanés (mm)'}
            </h2>
            {editId && (
              <button type="button" onClick={resetForm} className="text-marine/50 hover:text-marine text-sm underline">
                Annuler la modification
              </button>
            )}
          </div>
          <div className="mb-3">
            <DateField value={date} onChange={setDate} />
          </div>
          {!editId && previousPlisRow && (
            <button
              type="button"
              onClick={() => setShowPlisPrefillModal(true)}
              className="w-full bg-gold/10 border border-gold/40 hover:border-gold rounded-md px-4 py-3 flex items-center gap-3 transition-colors text-left mb-4"
            >
              <ArrowUpCircle size={20} className="text-gold-dark shrink-0" />
              <div className="flex-1">
                <p className="text-marine font-medium text-sm">
                  Reprendre les valeurs de la mesure du {formatBilanDate(previousPlisRow.date)}
                </p>
                <p className="text-marine/55 text-xs mt-0.5">4 plis disponibles à pré-remplir</p>
              </div>
              <span className="px-3 py-1.5 bg-gold text-marine font-semibold rounded-md text-xs">Pré-remplir</span>
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLIS_FIELDS.map(f => (
              <MeasureField
                key={f.key}
                label={f.label}
                unit="mm"
                value={form[f.key]}
                onChange={v => setField(f.key, v)}
                previousValue={previousPlisRow?.[f.key]}
                previousDate={previousPlisRow?.date}
                lowerIsBetter
              />
            ))}
          </div>

          <div className="mt-5">
            <label className="block text-marine/60 text-sm font-medium uppercase tracking-wide mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Observations, pince utilisée, etc."
              className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={save}
              disabled={!allFilled || saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {editId ? 'Mettre à jour' : 'Enregistrer'}
            </button>
            {!allFilled && <span className="text-marine/40 text-sm">Saisissez les 4 plis pour calculer.</span>}
          </div>
        </div>

        {/* Résultats calculés en temps réel */}
        <div className="bg-marine-light/95 border border-gold/20 rounded-xl p-6 text-cream">
          <div className="flex items-center gap-2.5 mb-4">
            <Calculator size={18} className="text-gold" />
            <h2 className="text-cream font-semibold text-lg">Composition corporelle estimée</h2>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <p className="text-cream/55 text-xs uppercase tracking-wide">Somme des 4 plis</p>
              <p className="text-cream text-2xl font-bold mt-0.5">
                {calc ? `${nf1(calc.sumPlis)}` : <span className="text-cream/25">—</span>}
                {calc && <span className="text-cream/40 text-base font-medium ml-1.5">mm</span>}
              </p>
            </div>
            <div>
              <p className="text-cream/55 text-xs uppercase tracking-wide">Densité corporelle</p>
              <p className="text-cream text-2xl font-bold mt-0.5">
                {calc ? nf4(calc.density) : <span className="text-cream/25">—</span>}
                {calc && <span className="text-cream/40 text-base font-medium ml-1.5">g/cm³</span>}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-marine-light/40 pt-5">
            <p className="text-cream/55 text-xs uppercase tracking-wide">% de gras corporel (Siri)</p>
            <p className="mt-1 flex items-baseline gap-3 flex-wrap">
              <span className="text-gold text-4xl font-bold leading-none">
                {calc ? nf1(calc.bodyFatSiri) : '—'}
                {calc && <span className="text-2xl"> %</span>}
              </span>
              <span className="text-cream/60 text-base">
                {calc ? `Brozek : ${nf1(calc.bodyFatBrozek)} %` : 'Brozek : —'}
              </span>
            </p>
            <p className="text-cream/40 text-sm mt-2">
              Catégorie : <span className="text-cream/55">à venir (normes CPAFLA — v0.1.9)</span>
            </p>
            {calc && (
              <p className="text-cream/40 text-xs mt-1">
                Calculé pour {calc.age} ans · {sexLabel} (équations Durnin-Womersley 1974)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Historique */}
      <section>
        <h3 className="text-marine font-semibold text-lg mb-3">Plis cutanés précédents</h3>
        {loading ? (
          <p className="text-marine/40 text-base">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="text-marine/45 text-base">Aucune mesure de plis cutanés enregistrée pour ce client.</p>
        ) : (
          <div className="bg-white border border-cream-dark rounded-lg overflow-hidden">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-cream/70 text-marine/55 text-sm uppercase tracking-wide">
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-right font-medium px-4 py-3">Somme plis (mm)</th>
                  <th className="text-right font-medium px-4 py-3">% gras (Siri)</th>
                  <th className="text-right font-medium px-4 py-3">% gras (Brozek)</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map(row => (
                  <tr key={row.id} className="border-t border-cream-dark hover:bg-cream/40 transition-colors">
                    <td className="px-4 py-3 text-marine font-medium">{formatBilanDate(row.date)}</td>
                    <td className="px-4 py-3 text-right text-marine/80">{nf1(row.somme4Plis)}</td>
                    <td className="px-4 py-3 text-right text-marine font-semibold">{nf1(row.pourcentageGrasSiri)} %</td>
                    <td className="px-4 py-3 text-right text-marine/60">{nf1(row.pourcentageGrasBrozek)} %</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          title="Modifier"
                          className="inline-flex items-center gap-1 text-gold-dark hover:text-marine text-base font-medium transition-colors"
                        >
                          <PencilLine size={16} /> Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(row)}
                          title="Supprimer"
                          aria-label={`Supprimer les plis du ${formatBilanDate(row.date)}`}
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
          message={`Supprimer les plis cutanés du ${formatBilanDate(deleting.date)} ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await mesuresService.plis.delete(deleting.id)
              if (editId === deleting.id) resetForm()
              setDeleting(null)
              await reload()
              notify('Plis cutanés supprimés')
            } catch (err) {
              setError(cleanIpcError(err, 'Erreur lors de la suppression.'))
              setDeleting(null)
            }
          }}
        />
      )}

      {showPlisPrefillModal && previousPlisRow && (
        <PlisPrefillModal
          previousRow={previousPlisRow}
          onCancel={() => setShowPlisPrefillModal(false)}
          onApply={applyPlisPrefill}
        />
      )}
    </div>
  )
}

interface PlisPrefillModalProps {
  previousRow: MesurePlisCutanes
  onCancel: () => void
  onApply: (selected: Set<PlisKey>, overwrite: boolean) => void
}

function PlisPrefillModal({ previousRow, onCancel, onApply }: PlisPrefillModalProps) {
  const [selected, setSelected] = useState<Set<PlisKey>>(() => new Set(PLIS_FIELDS.map(f => f.key)))
  const [overwrite, setOverwrite] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function toggle(key: PlisKey) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark">
        <div className="px-6 py-5 border-b border-cream-dark">
          <h3 className="text-marine font-semibold text-lg">
            Pré-remplir depuis le {formatBilanDate(previousRow.date)}
          </h3>
        </div>
        <div className="px-6 py-4">
          <ul className="space-y-0.5">
            {PLIS_FIELDS.map(f => (
              <li key={f.key}>
                <label className="flex items-center gap-3 cursor-pointer hover:bg-white/50 px-2 py-1.5 rounded">
                  <input
                    type="checkbox"
                    checked={selected.has(f.key)}
                    onChange={() => toggle(f.key)}
                    className="w-4 h-4 accent-gold cursor-pointer"
                  />
                  <span className="flex-1 text-marine text-base">{f.label}</span>
                  <span className="text-marine/50 text-sm font-mono">{previousRow[f.key]} mm</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-6 py-3 border-t border-cream-dark bg-cream/40">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={() => setOverwrite(v => !v)}
              className="w-4 h-4 accent-gold cursor-pointer"
            />
            <span className="text-marine/70 text-sm">Écraser les champs déjà saisis</span>
          </label>
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
            onClick={() => onApply(selected, overwrite)}
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
