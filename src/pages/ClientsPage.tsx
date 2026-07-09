import { useState, useEffect } from 'react'
import { ChevronRight, Download, Plus, Upload, User } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clientsService } from '../services/clients'
import { transferService } from '../services/transfer'
import { ClientAvatar } from '../components/ClientAvatar'

type View = 'list' | 'form'

interface FormState {
  name: string
  email: string
  birthdate: string
  sex: 'F' | 'M' | ''
  unitLength: 'cm' | 'in'
  unitWeight: 'kg' | 'lb'
}

// Les unités ont toujours une valeur (jamais null) ; défaut métrique, comme en DB.
const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  birthdate: '',
  sex: '',
  unitLength: 'cm',
  unitWeight: 'kg'
}

export function ClientsPage() {
  const [view, setView] = useState<View>('list')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  // Aperçu du fichier choisi — Marie-Eve décide ensuite « Remplacer » ou « Fusionner ».
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    const state = location.state as { deletedClientName?: string } | null
    if (state?.deletedClientName) {
      setToast(`${state.deletedClientName} a été supprimé`)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  async function loadClients() {
    try {
      setLoading(true)
      setLoadError(null)
      const data = await clientsService.list()
      setClients(data)
    } catch {
      setLoadError('Impossible de charger les clients.')
    } finally {
      setLoading(false)
    }
  }

  function openForm() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setView('form')
  }

  function cancelForm() {
    setView('list')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.name.trim()) {
      setFormError('Le nom est requis.')
      return
    }
    if (!form.email.trim()) {
      setFormError('Le courriel est requis.')
      return
    }
    if (form.birthdate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthdate)) {
        setFormError('Date de naissance invalide.')
        return
      }
      if (form.birthdate > new Date().toISOString().slice(0, 10)) {
        setFormError('La date de naissance ne peut pas être dans le futur.')
        return
      }
    }

    try {
      setSaving(true)
      await clientsService.create({
        name: form.name.trim(),
        email: form.email.trim(),
        birthdate: form.birthdate ? form.birthdate : null,
        sex: form.sex ? form.sex : null,
        unitLength: form.unitLength,
        unitWeight: form.unitWeight
      })
      await loadClients()
      setView('list')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleImportClick() {
    try {
      const p = await transferService.previewImport()
      if (p) setPreview(p)
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Ce fichier n'a pas pu être lu.")
    }
  }

  async function runImport(mode: 'replace' | 'merge') {
    if (!preview) return
    setImporting(true)
    try {
      const r = await transferService.importClients(preview.filePath, mode)
      setPreview(null)
      await loadClients()
      const parts: string[] = []
      if (r.added) parts.push(`${r.added} ajouté${r.added > 1 ? 's' : ''}`)
      if (r.updated) parts.push(`${r.updated} mis à jour`)
      setToast(`Import terminé — ${parts.join(', ') || 'aucun changement'}.`)
    } catch (err) {
      setPreview(null)
      setToast(err instanceof Error ? err.message : "Échec de l'import.")
    } finally {
      setImporting(false)
    }
  }

  async function runExport(clientIds: string[]) {
    try {
      const r = await transferService.exportClients(clientIds)
      setExportOpen(false)
      if (!r) return
      const n = r.summary.clientCount
      setToast(`${n} client${n > 1 ? 's' : ''} exporté${n > 1 ? 's' : ''} vers ${r.filePath}`)
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Échec de l'export.")
    }
  }

  if (view === 'form') {
    return (
      <div className="p-8 max-w-lg">
        <h2 className="text-marine font-semibold text-xl mb-6">Nouveau client</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-base font-medium text-marine mb-1.5">
              Nom
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Marie-Eve Tremblay"
              autoFocus
              className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-marine mb-1.5">
              Courriel
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="marie@exemple.com"
              className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-marine mb-1.5">
              Date de naissance <span className="text-marine/40 font-normal">(facultatif)</span>
            </label>
            <input
              type="date"
              value={form.birthdate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setForm(prev => ({ ...prev, birthdate: e.target.value }))}
              className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
            />
            <p className="text-marine/40 text-sm mt-1">Sert au calcul du pourcentage de gras à partir des plis cutanés.</p>
          </div>

          <div>
            <label className="block text-base font-medium text-marine mb-1.5">
              Sexe <span className="text-marine/40 font-normal">(facultatif)</span>
            </label>
            <div className="flex items-center gap-5">
              {([
                { value: 'F', label: 'Femme' },
                { value: 'M', label: 'Homme' }
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-2 text-marine text-base cursor-pointer">
                  <input
                    type="radio"
                    name="new-client-sex"
                    value={opt.value}
                    checked={form.sex === opt.value}
                    onChange={() => setForm(prev => ({ ...prev, sex: opt.value }))}
                    className="accent-gold"
                  />
                  {opt.label}
                </label>
              ))}
              {form.sex && (
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, sex: '' }))}
                  className="text-marine/45 hover:text-marine text-sm underline"
                >
                  Effacer
                </button>
              )}
            </div>
            <p className="text-marine/40 text-sm mt-1">Détermine la silhouette affichée et les coefficients du calcul.</p>
          </div>

          <div>
            <label className="block text-base font-medium text-marine mb-1.5">Unité de longueur</label>
            <div className="flex items-center gap-5">
              {([
                { value: 'cm', label: 'cm' },
                { value: 'in', label: 'po (pouces)' }
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-2 text-marine text-base cursor-pointer">
                  <input
                    type="radio"
                    name="new-client-unit-length"
                    value={opt.value}
                    checked={form.unitLength === opt.value}
                    onChange={() => setForm(prev => ({ ...prev, unitLength: opt.value }))}
                    className="accent-gold"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-marine/40 text-sm mt-1">Unité d'affichage et de saisie des circonférences (les données sont stockées en cm).</p>
          </div>

          <div>
            <label className="block text-base font-medium text-marine mb-1.5">Unité de poids</label>
            <div className="flex items-center gap-5">
              {([
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb (livres)' }
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-2 text-marine text-base cursor-pointer">
                  <input
                    type="radio"
                    name="new-client-unit-weight"
                    value={opt.value}
                    checked={form.unitWeight === opt.value}
                    onChange={() => setForm(prev => ({ ...prev, unitWeight: opt.value }))}
                    className="accent-gold"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-marine/40 text-sm mt-1">Unité d'affichage et de saisie du poids (les données sont stockées en kg).</p>
          </div>

          <div className="sticky bottom-0 -mx-8 mt-2 flex items-center gap-3 border-t border-cream-dark bg-cream px-8 py-4">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              disabled={saving}
              className="px-4 py-2 text-marine/60 text-base hover:text-marine transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <span className="text-marine/50 text-base">
          {!loading && `${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExportOpen(true)}
            disabled={clients.length === 0}
            title="Exporter des dossiers clients en .kinesio"
            className="flex items-center gap-2 px-4 py-2 text-marine/80 hover:text-marine font-medium border border-cream-dark hover:border-gold/60 rounded-md text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Exporter
          </button>
          <button
            onClick={handleImportClick}
            disabled={importing}
            title="Importer des dossiers clients exportés en .kinesio"
            className="flex items-center gap-2 px-4 py-2 text-marine/80 hover:text-marine font-medium border border-cream-dark hover:border-gold/60 rounded-md text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={16} />
            {importing ? 'Import…' : 'Importer'}
          </button>
          <button
            onClick={openForm}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors"
          >
            <Plus size={16} />
            Nouveau client
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-marine/40 text-base">Chargement…</p>
      )}

      {loadError && (
        <p className="text-red-600 text-base">{loadError}</p>
      )}

      {!loading && !loadError && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-cream-dark rounded-full flex items-center justify-center mb-4">
            <User size={28} className="text-marine/25" />
          </div>
          <p className="text-marine/50 text-base font-medium">Aucun client pour l'instant</p>
          <p className="text-marine/35 text-sm mt-1">
            Cliquez sur « Nouveau client » pour commencer.
          </p>
        </div>
      )}

      {!loading && !loadError && clients.length > 0 && (
        <div className="space-y-2 max-w-2xl">
          {clients.map(client => (
            <Link
              key={client.id}
              to={`/clients/${client.id}/dashboard`}
              className="group flex items-center gap-4 bg-white border border-cream-dark rounded-lg px-4 py-3.5 hover:border-gold/50 hover:shadow-sm transition-all"
            >
              <ClientAvatar client={client} size="sm" className="group-hover:ring-2 group-hover:ring-gold/30 transition-all" />
              <div className="flex-1 min-w-0">
                <p className="text-marine font-medium text-base truncate">{client.name}</p>
                <p className="text-marine/50 text-sm mt-0.5 truncate">{client.email}</p>
              </div>
              <ChevronRight size={18} className="text-marine/25 group-hover:text-gold/80 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {exportOpen && (
        <ExportClientsModal clients={clients} onCancel={() => setExportOpen(false)} onExport={runExport} />
      )}

      {preview && (
        <ImportPreviewModal
          preview={preview}
          importing={importing}
          onCancel={() => setPreview(null)}
          onImport={runImport}
        />
      )}

    </div>
  )
}

/** Choix des clients à exporter. Un seul fichier `.kinesio` pour la sélection. */
function ExportClientsModal({
  clients,
  onCancel,
  onExport
}: {
  clients: Client[]
  onCancel: () => void
  onExport: (clientIds: string[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const toggle = (id: string): void =>
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-lg border border-cream-dark max-h-[90vh] flex flex-col">
        <div className="p-6 pb-3">
          <h2 className="text-marine font-semibold text-xl">Exporter des clients</h2>
          <p className="text-marine/55 text-sm mt-1">
            Le fichier contiendra les clients cochés et tout ce qui leur appartient : bilans, mesures, plis, notes
            et photos. Ni les autres clients, ni vos réglages, ni votre compte courriel.
          </p>
        </div>

        <div className="px-6 py-2 overflow-y-auto">
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => setSelected(new Set(clients.map(c => c.id)))}
              className="text-gold-dark hover:text-marine text-sm underline"
            >
              Tout cocher
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-gold-dark hover:text-marine text-sm underline">
              Tout décocher
            </button>
          </div>
          <div className="space-y-0.5">
            {clients.map(c => (
              <label
                key={c.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-cream-dark/40 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="w-4 h-4 accent-gold-dark"
                />
                <span className="text-marine text-base">{c.name}</span>
                <span className="text-marine/40 text-sm truncate">{c.email}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 pt-3 border-t border-cream-dark">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-marine/65 text-base hover:text-marine">
            Annuler
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onExport([...selected])
              } finally {
                setBusy(false)
              }
            }}
            className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Exporter {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Aperçu du fichier avant d'écrire quoi que ce soit, puis choix du mode. */
function ImportPreviewModal({
  preview,
  importing,
  onCancel,
  onImport
}: {
  preview: ImportPreview
  importing: boolean
  onCancel: () => void
  onImport: (mode: 'replace' | 'merge') => Promise<void>
}) {
  const { summary, plan } = preview
  const exportedOn = new Date(summary.exportedAt).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-xl border border-cream-dark max-h-[90vh] flex flex-col">
        <div className="p-6 pb-3">
          <h2 className="text-marine font-semibold text-xl">Importer {preview.fileName}</h2>
          <p className="text-marine/55 text-sm mt-1">
            Export du {exportedOn} · Kinésio Outils {summary.appVersion}
          </p>
        </div>

        <div className="px-6 overflow-y-auto">
          <div className="bg-white border border-cream-dark rounded-lg p-4 text-sm text-marine/80">
            <p className="font-semibold text-marine mb-1">Le fichier contient</p>
            <p>
              {summary.clientCount} client{summary.clientCount > 1 ? 's' : ''} · {summary.bilanCount} bilan
              {summary.bilanCount > 1 ? 's' : ''} · {summary.mesureCount} prise
              {summary.mesureCount > 1 ? 's' : ''} de mesures · {summary.plisCount} plis · {summary.noteCount} note
              {summary.noteCount > 1 ? 's' : ''} · {summary.avatarCount} photo{summary.avatarCount > 1 ? 's' : ''}
            </p>
            <p className="text-marine/50 mt-1.5">{summary.clientNames.join(', ')}</p>
          </div>

          <div className="mt-3 space-y-1.5 text-sm">
            {plan.toAdd.length > 0 && (
              <p className="text-marine/80">
                <span className="font-semibold text-green-700">{plan.toAdd.length} nouveau
                {plan.toAdd.length > 1 ? 'x' : ''}</span> — sera ajouté tel quel : {plan.toAdd.join(', ')}
              </p>
            )}
            {plan.toUpdate.length > 0 && (
              <p className="text-marine/80">
                <span className="font-semibold text-gold-dark">{plan.toUpdate.length} déjà présent
                {plan.toUpdate.length > 1 ? 's' : ''}</span> — c’est le choix ci-dessous qui décide : {plan.toUpdate.join(', ')}
              </p>
            )}
          </div>

          <p className="text-marine/50 text-xs mt-3">
            Dans les deux cas, vos clients absents du fichier ne sont jamais touchés ni supprimés.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 pt-4 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            disabled={importing}
            className="px-4 py-2 text-marine/65 text-base hover:text-marine disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onImport('merge')}
            disabled={importing}
            title="Ajoute ce qui manque et met à jour ce qui a changé. Rien n’est supprimé."
            className="px-4 py-2 text-marine border border-cream-dark hover:border-gold/60 rounded-md text-base font-medium transition-colors disabled:opacity-50"
          >
            Fusionner
          </button>
          <button
            type="button"
            onClick={() => onImport('replace')}
            disabled={importing}
            title="Les clients du fichier repartent de zéro : leurs bilans et mesures actuels sont effacés puis remplacés."
            className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            {importing ? 'Import…' : 'Remplacer'}
          </button>
        </div>
      </div>
    </div>
  )
}
