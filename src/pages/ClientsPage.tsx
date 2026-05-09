import { useState, useEffect } from 'react'
import { Plus, User } from 'lucide-react'
import { clientsService } from '../services/clients'

type View = 'list' | 'form'

interface FormState {
  name: string
  email: string
}

export function ClientsPage() {
  const [view, setView] = useState<View>('list')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', email: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadClients()
  }, [])

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
    setForm({ name: '', email: '' })
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

    try {
      setSaving(true)
      await clientsService.create({ name: form.name.trim(), email: form.email.trim() })
      await loadClients()
      setView('list')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  if (view === 'form') {
    return (
      <div className="p-8 max-w-lg">
        <h2 className="text-marine font-semibold text-lg mb-6">Nouveau client</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-md px-4 py-3">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-marine mb-1.5">
              Nom
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Marie-Eve Tremblay"
              autoFocus
              className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-marine mb-1.5">
              Courriel
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="marie@exemple.com"
              className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              disabled={saving}
              className="px-4 py-2 text-marine/60 text-sm hover:text-marine transition-colors"
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
        <span className="text-marine/50 text-sm">
          {!loading && `${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={openForm}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors"
        >
          <Plus size={15} />
          Nouveau client
        </button>
      </div>

      {loading && (
        <p className="text-marine/40 text-sm">Chargement…</p>
      )}

      {loadError && (
        <p className="text-red-600 text-sm">{loadError}</p>
      )}

      {!loading && !loadError && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-cream-dark rounded-full flex items-center justify-center mb-4">
            <User size={28} className="text-marine/25" />
          </div>
          <p className="text-marine/50 text-sm font-medium">Aucun client pour l'instant</p>
          <p className="text-marine/35 text-xs mt-1">
            Cliquez sur « Nouveau client » pour commencer.
          </p>
        </div>
      )}

      {!loading && !loadError && clients.length > 0 && (
        <div className="space-y-2 max-w-2xl">
          {clients.map(client => (
            <div
              key={client.id}
              className="flex items-center gap-4 bg-white border border-cream-dark rounded-lg px-4 py-3.5 hover:border-gold/40 hover:shadow-sm transition-all"
            >
              <div className="w-9 h-9 bg-marine/8 rounded-full flex items-center justify-center shrink-0">
                <User size={16} className="text-marine/40" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-marine font-medium text-sm truncate">{client.name}</p>
                <p className="text-marine/50 text-xs mt-0.5 truncate">{client.email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
