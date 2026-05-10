import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Eye, Loader2, PencilLine, PersonStanding, Ruler, Save, Trash2, UserCog, X } from 'lucide-react'
import bodyMale from '@/assets/body-male.png'
import bodyFemale from '@/assets/body-female.png'
import { useClient } from '../ClientDetailLayout'
import { clientsService } from '../../../services/clients'
import { mesuresService } from '../../../services/mesures'
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

// Toutes les circonférences, dans l'ordre d'affichage du détail / du rapport.
const CIRC_ALL: { key: CircKey; label: string }[] = [
  { key: 'cou', label: 'Cou' },
  { key: 'epaule', label: 'Épaule' },
  { key: 'bicepsG', label: 'Biceps G' },
  { key: 'bicepsD', label: 'Biceps D' },
  { key: 'poitrine', label: 'Poitrine' },
  { key: 'taille', label: 'Taille' },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'hanche', label: 'Hanche' },
  { key: 'cuisseG', label: 'Cuisse G' },
  { key: 'cuisseD', label: 'Cuisse D' },
  { key: 'molletG', label: 'Mollet G' },
  { key: 'molletD', label: 'Mollet D' }
]

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

      {view === 'circ' ? (
        <CirconferencesPanel client={client} notify={setToast} />
      ) : (
        <PlisPanel client={client} notify={setToast} />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-marine text-cream text-base font-medium px-5 py-3 rounded-lg shadow-2xl border border-marine-light/40">
          {toast}
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
  onChange
}: {
  label: string
  unit: string
  value: number | undefined
  onChange: (v: number | undefined) => void
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
function CirconferencesPanel({ client, notify }: { client: Client; notify: (m: string) => void }) {
  const unitLength = client.unitLength ?? 'cm'
  const unitWeight = client.unitWeight ?? 'kg'
  const lenLabel = lengthUnitLabel(unitLength)
  const wLabel = weightUnitLabel(unitWeight)
  const [list, setList] = useState<MesureCirconferences[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<CircForm>({})
  // `poids` est exprimé dans l'unité préférée du client (kg ou lb) — converti en kg à l'enregistrement.
  const [poids, setPoids] = useState<number | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<MesureCirconferences | null>(null)
  const [viewing, setViewing] = useState<MesureCirconferences | null>(null)

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

  // Une carte de saisie pour une circonférence (toutes en `lenLabel`).
  const circCard = (key: CircKey, label: string) => (
    <MeasureField label={label} unit={lenLabel} value={form[key]} onChange={v => setField(key, v)} />
  )

  function resetForm() {
    setForm({})
    setPoids(undefined)
    setNotes('')
    setEditId(null)
  }

  function startEdit(row: MesureCirconferences) {
    setForm(circRowToForm(row, unitLength))
    setPoids(row.poidsKg != null ? kgToWeightInput(row.poidsKg, unitWeight) : undefined)
    setNotes(row.notes ?? '')
    setEditId(row.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasAny = poids !== undefined || CIRC_ALL.some(c => form[c.key] !== undefined)

  async function save() {
    if (!hasAny) return
    setSaving(true)
    setError(null)
    try {
      // Conversion vers le stockage métrique (cm + kg) — jamais l'inverse.
      const payload: CirconferencesInput = { notes: notes.trim() || undefined }
      for (const { key } of CIRC_ALL) {
        const v = form[key]
        if (v !== undefined) payload[key] = lengthInputToCm(v, unitLength)
      }
      if (poids !== undefined) payload.poidsKg = weightInputToKg(poids, unitWeight)
      if (editId) {
        await mesuresService.circonferences.update(editId, payload)
      } else {
        await mesuresService.circonferences.create(client.id, { ...payload, date: todayISO() })
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

  return (
    <div className="space-y-7">
      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</div>
      )}

      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-marine font-semibold text-lg">
            {editId ? `Modifier les circonférences du ${formatBilanDate(list.find(r => r.id === editId)?.date ?? todayISO())}` : 'Nouvelle prise de mesures'}
          </h2>
          {editId && (
            <button type="button" onClick={resetForm} className="text-marine/50 hover:text-marine text-sm underline">
              Annuler la modification
            </button>
          )}
        </div>

        {/*
          Disposition : grille 7 lignes × 3 colonnes, toutes de largeur égale.
          ─ colonne 2, lignes 1-6 : silhouette (placée explicitement).
          ─ colonnes 1 & 3, lignes 1-6 : les 12 circonférences, gauche / droite.
          ─ ligne 7, colonne 2 : Poids — une seule colonne de large, donc exactement
            la même largeur visuelle que les cartes de circonférences.
          Les cartes de gauche se placent en auto-flow (col 1) ; celles de droite
          sont forcées en col 3 via `col-start-3`.
          `minmax(0,1fr)` sur chaque colonne : empêche l'image de la silhouette
          (intrinsèquement large) d'élargir la colonne 2 au-delà de sa fraction.
        */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 max-w-5xl mx-auto items-start">
          {/* Silhouette — colonne centrale, lignes 1 à 6 (étirée sur toute la hauteur des 6 rangées) */}
          <div className="row-span-6 row-start-1 col-start-2 self-stretch flex items-center justify-center min-h-[320px]">
            <Silhouette client={client} />
          </div>

          {/* Ligne 1 */}
          {circCard('cou', 'Cou')}
          <div className="col-start-3">{circCard('epaule', 'Épaule')}</div>

          {/* Ligne 2 */}
          {circCard('bicepsG', 'Biceps G')}
          <div className="col-start-3">{circCard('bicepsD', 'Biceps D')}</div>

          {/* Ligne 3 */}
          {circCard('poitrine', 'Poitrine')}
          <div className="col-start-3">{circCard('taille', 'Taille')}</div>

          {/* Ligne 4 */}
          {circCard('abdomen', 'Abdomen')}
          <div className="col-start-3">{circCard('hanche', 'Hanche')}</div>

          {/* Ligne 5 */}
          {circCard('cuisseG', 'Cuisse G')}
          <div className="col-start-3">{circCard('cuisseD', 'Cuisse D')}</div>

          {/* Ligne 6 */}
          {circCard('molletG', 'Mollet G')}
          <div className="col-start-3">{circCard('molletD', 'Mollet D')}</div>

          {/* Ligne 7 : Poids — colonne centrale uniquement (même largeur que les autres cartes) */}
          <div className="col-start-2 row-start-7">
            <MeasureField label="Poids" unit={wLabel} value={poids} onChange={setPoids} />
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
function PlisPanel({ client, notify }: { client: Client; notify: (m: string) => void }) {
  const navigate = useNavigate()
  const [list, setList] = useState<MesurePlisCutanes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<PlisForm>({})
  const [notes, setNotes] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<MesurePlisCutanes | null>(null)

  const profileComplete = Boolean(client.birthdate && client.sex)

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
    setEditId(null)
  }

  function startEdit(row: MesurePlisCutanes) {
    setForm({ triceps: row.triceps, biceps: row.biceps, sousscapulaire: row.sousscapulaire, iliaque: row.iliaque })
    setNotes(row.notes ?? '')
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
        triceps: form.triceps as number,
        biceps: form.biceps as number,
        sousscapulaire: form.sousscapulaire as number,
        iliaque: form.iliaque as number,
        notes: notes.trim() || undefined
      }
      if (editId) {
        await mesuresService.plis.update(editId, payload)
      } else {
        await mesuresService.plis.create(client.id, { ...payload, date: todayISO() })
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLIS_FIELDS.map(f => (
              <MeasureField key={f.key} label={f.label} unit="mm" value={form[f.key]} onChange={v => setField(f.key, v)} />
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
    </div>
  )
}
