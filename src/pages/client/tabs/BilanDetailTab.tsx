import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Pencil } from 'lucide-react'
import { useClient } from '../ClientDetailLayout'
import { bilansService } from '../../../services/bilans'
import { settingsService } from '../../../services/settings'
import { BilanForm, deriveBilanFields } from '../BilanForm'
import { formatBilanDate } from '../bilanFields'
import { computeAge, getCategorization, type Category, type NormsType } from '../../../lib/norms'
import { BILAN_TO_TEST_KEY } from '../../../lib/norms/bilan-keys'

export function BilanDetailTab() {
  const client = useClient()
  const navigate = useNavigate()
  const { bilanId } = useParams<{ bilanId: string }>()

  const [bilan, setBilan] = useState<Bilan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [draftDate, setDraftDate] = useState('')
  const [draftData, setDraftData] = useState<BilanData>({})
  const [saving, setSaving] = useState(false)
  const [norms, setNorms] = useState<NormsType>('acsm')

  useEffect(() => {
    settingsService.getCategorizationNorms().then(setNorms).catch(() => undefined)
  }, [])

  const age = useMemo(() => computeAge(client.birthdate), [client.birthdate])
  const categorize = useMemo(() => {
    if (age === null || client.sex === null) return undefined
    const sex = client.sex
    const knownAge = age
    return (key: keyof BilanData, value: number): Category | null => {
      const testKey = BILAN_TO_TEST_KEY[key]
      if (!testKey) return null
      return getCategorization(testKey, value, knownAge, sex, norms)
    }
  }, [age, client.sex, norms])

  const load = useCallback(async () => {
    if (!bilanId) return
    setLoading(true)
    setError(null)
    try {
      const found = await bilansService.getById(bilanId)
      if (!found) setError('Bilan introuvable.')
      setBilan(found)
    } catch {
      setError('Impossible de charger le bilan.')
    } finally {
      setLoading(false)
    }
  }, [bilanId])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!bilan) return
    setDraftDate(bilan.date)
    setDraftData({ ...bilan.data })
    setEditing(true)
  }

  async function handleSave() {
    if (!bilan) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate)) {
      setError('La date du bilan est requise.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const finalData = deriveBilanFields(draftData, age, client.sex)
      const updated = await bilansService.update(bilan.id, { date: draftDate, data: finalData })
      setBilan(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  const backTo = `/clients/${client.id}/bilans`

  if (loading) {
    return <div className="p-8 text-marine/50 text-base">Chargement…</div>
  }

  if (error && !bilan) {
    return (
      <div className="p-8">
        <Link to={backTo} className="inline-flex items-center gap-2 text-marine/60 hover:text-marine text-base mb-4">
          <ArrowLeft size={16} />
          Retour aux bilans
        </Link>
        <p className="text-red-600 text-base">{error}</p>
      </div>
    )
  }

  if (!bilan) return null

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link to={backTo} className="inline-flex items-center gap-2 text-marine/50 hover:text-marine text-base transition-colors">
          <ArrowLeft size={16} />
          Bilans
        </Link>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-marine/70 hover:text-marine border border-cream-dark hover:border-gold/60 rounded-md text-base transition-colors"
          >
            <Pencil size={15} />
            Modifier
          </button>
        )}
      </div>

      {error && bilan && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-5">
          {error}
        </div>
      )}

      <section className="bg-marine-light/95 border border-gold/20 rounded-xl p-7 text-cream">
        <h2 className="text-cream font-semibold text-lg mb-1">
          Bilan du {formatBilanDate(editing ? draftDate || bilan.date : bilan.date)}
        </h2>
        <p className="text-cream/55 text-sm mb-6">
          {bilan.source === 'import_docx' ? 'Importé depuis un fichier .docx' : 'Saisie manuelle'}
          {' · '}
          Catégorisation selon les normes <span className="font-medium">{norms === 'cpafla' ? 'CPAFLA' : 'ACSM'}</span> — modifiable dans Paramètres.
        </p>

        {editing ? (
          <BilanForm
            date={draftDate}
            data={draftData}
            onDateChange={setDraftDate}
            onDataChange={setDraftData}
            client={client}
            norms={norms}
            showSynthesis
          />
        ) : (
          <BilanForm
            date={bilan.date}
            data={bilan.data}
            readOnly
            categorize={categorize}
            client={client}
            norms={norms}
            showSynthesis
          />
        )}

        {editing && (
          <div className="flex items-center justify-end gap-3 mt-7 pt-5 border-t border-marine-light/40">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              disabled={saving}
              className="px-4 py-2 text-cream/70 hover:text-cream text-base transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </section>

      {!editing && (
        <p className="text-marine/35 text-sm mt-4">
          Astuce : utilisez « Modifier » pour corriger une valeur mal extraite du document.
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="ml-2 text-gold-dark hover:text-marine underline"
          >
            Retour à la liste
          </button>
        </p>
      )}
    </div>
  )
}
