import { useState } from 'react'
import { Heart, Pencil } from 'lucide-react'
import type { FcZones } from '../../../lib/bilan-computed'
import { ReportEye } from '../../../components/ReportEye'

interface TrainingZonesProps {
  fcMax: number | null
  fcZones: FcZones | null
  /** D'où vient `fcMax` — l'étiquette doit dire laquelle des deux sources sert. */
  fcMaxSource?: 'manuel' | 'tanaka' | null
  /**
   * Enregistre une FC max saisie à la main (`null` = revenir à la prédiction).
   *
   * Absent = carte en LECTURE SEULE. C'est le cas du document HTML remis au
   * client : il partage ce composant avec le dashboard, et n'a évidemment
   * aucune raison d'offrir un champ de saisie.
   */
  onSaveFcMax?: (bpm: number | null) => Promise<void> | void
}

interface ZoneSpec {
  name: string
  description: string
  /** Indices vers les bornes inférieure et supérieure dans FcZones. */
  fromKey: keyof FcZones
  toKey: keyof FcZones | 'max'
  /** Tailwind colour classes (background + text). */
  bg: string
  text: string
}

const ZONES: ZoneSpec[] = [
  { name: 'Zone 1', description: 'Échauffement', fromKey: 'z60', toKey: 'z65', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { name: 'Zone 2', description: 'Endurance fondamentale', fromKey: 'z65', toKey: 'z70', bg: 'bg-emerald-100/80', text: 'text-emerald-800' },
  { name: 'Zone 3', description: 'Aérobie', fromKey: 'z70', toKey: 'z80', bg: 'bg-yellow-100/80', text: 'text-yellow-800' },
  { name: 'Zone 4', description: 'Seuil lactique', fromKey: 'z80', toKey: 'z90', bg: 'bg-orange-100/80', text: 'text-orange-800' },
  { name: 'Zone 5', description: 'VO2max', fromKey: 'z90', toKey: 'max', bg: 'bg-red-100/80', text: 'text-red-800' }
]

/**
 * Saisie de la FC max mesurée.
 *
 * Bornes 100-230 bpm, identiques à celles du schéma IPC : au-delà c'est une
 * faute de frappe, et prescrire des zones sur une valeur aberrante serait pire
 * que de garder la prédiction. Le message de refus est explicite plutôt que
 * silencieux — Marie doit comprendre pourquoi son chiffre n'entre pas.
 */
function FcMaxEditor({
  current,
  draft = '',
  setDraft,
  saving,
  erreur,
  canReset = false,
  onSave,
  onCancel,
  className = ''
}: {
  current: number | null
  draft?: string
  setDraft?: (v: string) => void
  saving: boolean
  erreur: string | null
  canReset?: boolean
  onSave: (bpm: number | null) => void
  onCancel: () => void
  className?: string
}) {
  const [local, setLocal] = useState(draft)
  const value = setDraft ? draft : local
  const set = setDraft ?? setLocal
  const n = Number(value)
  const valide = Number.isInteger(n) && n >= 100 && n <= 230

  return (
    <div className={`rounded-lg border border-cream-dark/60 bg-cream/40 p-3 ${className}`}>
      <label className="block text-marine/60 text-xs font-medium mb-1.5" htmlFor="fc-max-manuel">
        FC max mesurée (bpm)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="fc-max-manuel"
          type="number"
          min={100}
          max={230}
          value={value}
          disabled={saving}
          onChange={e => set(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && valide) onSave(n)
            if (e.key === 'Escape') onCancel()
          }}
          className="w-28 rounded-md border border-cream-dark bg-white px-2.5 py-1.5 text-sm text-marine tabular-nums focus:outline-none focus:ring-2 focus:ring-gold/50"
          placeholder={current !== null ? String(current) : '—'}
        />
        <button
          type="button"
          disabled={!valide || saving}
          onClick={() => onSave(n)}
          className="rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-marine hover:bg-gold-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {canReset && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(null)}
            className="rounded-md px-2.5 py-1.5 text-sm text-marine/65 hover:text-marine hover:bg-cream-dark transition-colors disabled:opacity-40"
          >
            Revenir à la prédiction
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="rounded-md px-2.5 py-1.5 text-sm text-marine/50 hover:text-marine transition-colors disabled:opacity-40"
        >
          Annuler
        </button>
      </div>
      {value !== '' && !valide && (
        <p className="text-red-600 text-xs mt-1.5">Valeur attendue entre 100 et 230 bpm.</p>
      )}
      {erreur && <p className="text-red-600 text-xs mt-1.5">{erreur}</p>}
      <p className="text-marine/40 text-xs mt-2">
        Les cinq zones sont recalculées à partir de cette valeur, sur le dashboard comme dans les documents
        remis au client.
      </p>
    </div>
  )
}

export function TrainingZones({ fcMax, fcZones, fcMaxSource, onSaveFcMax }: TrainingZonesProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function save(bpm: number | null) {
    if (!onSaveFcMax) return
    setSaving(true)
    setErreur(null)
    try {
      await onSaveFcMax(bpm)
      setEditing(false)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }
  if (fcZones === null || fcMax === null) {
    return (
      <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Heart size={16} className="text-gold-dark" />
          <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Zones d'entraînement</h3>
        </div>
        <p className="text-marine/45 text-sm">
          Date de naissance requise pour calculer la FC max prédite (Tanaka){onSaveFcMax ? ', ou saisissez la FC max mesurée' : ''}.
        </p>
        {onSaveFcMax && (
          <FcMaxEditor
            current={null}
            saving={saving}
            erreur={erreur}
            onSave={save}
            onCancel={() => setEditing(false)}
            className="mt-3"
          />
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Heart size={16} className="text-gold-dark" />
        <h3 className="text-marine font-semibold text-sm uppercase tracking-wide">Zones d'entraînement</h3>
        <ReportEye section="zonesEntrainement" />
      </div>
      {/* L'étiquette suit la SOURCE réelle. Annoncer « prédite » sur une valeur
          saisie par Marie serait le même défaut que les barèmes qui affichaient
          « ACSM » sur des chiffres CPAFLA (v0.9.64-66). */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
        <p className="text-marine/45 text-xs">
          {fcMaxSource === 'manuel' ? 'FC max mesurée' : 'FC max prédite'} :{' '}
          <span className="text-marine font-semibold">{fcMax} bpm</span>
          {fcMaxSource === 'manuel' ? ' · saisie par la kinésiologue' : ' · Tanaka (208 − 0.7 × âge)'}
        </p>
        {onSaveFcMax && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(String(fcMax))
              setErreur(null)
              setEditing(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-marine/70 hover:bg-cream-dark hover:text-marine transition-colors"
          >
            <Pencil size={12} />
            Ajuster
          </button>
        )}
      </div>

      {onSaveFcMax && editing && (
        <FcMaxEditor
          current={fcMax}
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          erreur={erreur}
          canReset={fcMaxSource === 'manuel'}
          onSave={save}
          onCancel={() => setEditing(false)}
          className="mb-3"
        />
      )}

      <div className="space-y-1.5">
        {ZONES.map(z => {
          const from = fcZones[z.fromKey]
          const to = z.toKey === 'max' ? fcMax : fcZones[z.toKey]
          return (
            <div key={z.name} className={`${z.bg} rounded-md px-3 py-2 flex items-center justify-between`}>
              <div>
                <p className={`${z.text} text-sm font-semibold leading-tight`}>{z.name}</p>
                <p className={`${z.text} opacity-75 text-xs leading-tight`}>{z.description}</p>
              </div>
              <p className={`${z.text} text-sm font-mono font-medium tabular-nums`}>
                {from}–{to} bpm
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
