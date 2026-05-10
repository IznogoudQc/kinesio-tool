import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Pencil, Trash2 } from 'lucide-react'
import { clientsService } from '../../services/clients'

interface TabDef {
  to: string
  label: string
  enabled: boolean
}

const TABS: TabDef[] = [
  { to: 'dashboard', label: 'Dashboard', enabled: true },
  { to: 'bilans', label: 'Bilans', enabled: true },
  { to: 'mesures', label: 'Mesures', enabled: false },
  { to: 'notes', label: 'Notes', enabled: false },
  { to: 'historique', label: 'Historique', enabled: false }
]

interface ClientOutletContext {
  client: Client
}

export function useClient(): Client {
  return useOutletContext<ClientOutletContext>().client
}

export function ClientDetailLayout() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const printMode = searchParams.get('print') === '1'
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const all = await clientsService.list()
        const found = all.find(c => c.id === id) ?? null
        if (!cancelled) {
          setClient(found)
          if (!found) setError('Client introuvable.')
        }
      } catch {
        if (!cancelled) setError('Impossible de charger le client.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleDelete() {
    if (!client) return
    const name = client.name
    await clientsService.delete(client.id)
    navigate('/clients', { state: { deletedClientName: name } })
  }

  if (loading) {
    return <div className="p-8 text-marine/50 text-base">Chargement…</div>
  }

  if (printMode && client) {
    return <Outlet context={{ client } satisfies ClientOutletContext} />
  }

  if (error || !client) {
    return (
      <div className="p-8">
        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-marine/60 hover:text-marine text-base mb-4"
        >
          <ArrowLeft size={16} />
          Retour à la liste
        </Link>
        <p className="text-red-600 text-base">{error ?? 'Client introuvable.'}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-cream-dark px-8 pt-5 pb-0 shrink-0">
        <Link
          to="/clients"
          className="inline-flex items-center gap-2 text-marine/50 hover:text-marine text-sm mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          Clients
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-marine font-semibold text-2xl truncate">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 text-marine/60 text-base">
              <Mail size={15} className="shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-marine/70 hover:text-marine border border-cream-dark hover:border-gold/60 rounded-md text-base transition-colors"
            >
              <Pencil size={15} />
              Modifier
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              title="Supprimer ce client"
              className="flex items-center gap-2 px-3 py-2 text-red-600/80 hover:text-red-700 border border-cream-dark hover:border-red-300 hover:bg-red-50 rounded-md text-base transition-colors"
            >
              <Trash2 size={15} />
              Supprimer
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-1 mt-5 -mb-px">
          {TABS.map(tab =>
            tab.enabled ? (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  [
                    'px-4 py-2.5 text-base font-medium border-b-2 transition-colors',
                    isActive
                      ? 'text-marine border-gold'
                      : 'text-marine/50 border-transparent hover:text-marine hover:border-cream-dark'
                  ].join(' ')
                }
              >
                {tab.label}
              </NavLink>
            ) : (
              <span
                key={tab.to}
                title="Disponible dans une prochaine version"
                className="px-4 py-2.5 text-base font-medium border-b-2 border-transparent text-marine/25 cursor-not-allowed"
              >
                {tab.label}
              </span>
            )
          )}
        </nav>
      </div>

      <div className="flex-1 overflow-auto">
        <Outlet context={{ client } satisfies ClientOutletContext} />
      </div>

      {editing && (
        <EditClientModal
          client={client}
          onCancel={() => setEditing(false)}
          onSaved={updated => {
            setClient(updated)
            setEditing(false)
          }}
        />
      )}

      {confirmingDelete && (
        <ConfirmDeleteDialog
          clientName={client.name}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

interface EditClientModalProps {
  client: Client
  onCancel: () => void
  onSaved: (client: Client) => void
}

function EditClientModal({ client, onCancel, onSaved }: EditClientModalProps) {
  const [name, setName] = useState(client.name)
  const [email, setEmail] = useState(client.email)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, saving])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Le nom est requis.')
      return
    }
    if (!email.trim()) {
      setError('Le courriel est requis.')
      return
    }
    try {
      setSaving(true)
      const updated = await clientsService.update(client.id, {
        name: name.trim(),
        email: email.trim()
      })
      onSaved(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
      setError(message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-marine font-semibold text-xl mb-5">Modifier le client</h2>

          {error && (
            <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-base font-medium text-marine mb-1.5">Nom</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
              />
            </div>

            <div>
              <label className="block text-base font-medium text-marine mb-1.5">Courriel</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-marine/60 text-base hover:text-marine transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ConfirmDeleteDialogProps {
  clientName: string
  onCancel: () => void
  onConfirm: () => Promise<void>
}

function ConfirmDeleteDialog({ clientName, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, deleting])

  async function handleConfirm() {
    setError(null)
    try {
      setDeleting(true)
      await onConfirm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression.'
      setError(message)
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark p-6">
        <h2 className="text-marine font-semibold text-xl mb-3">Supprimer ce client&nbsp;?</h2>
        <p className="text-marine/70 text-base mb-2">
          Êtes-vous sûre de vouloir supprimer le dossier de{' '}
          <span className="font-semibold text-marine">{clientName}</span>&nbsp;?
        </p>
        <p className="text-marine/50 text-sm mb-5">Cette action est irréversible.</p>

        {error && (
          <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            autoFocus
            className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-base transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="px-5 py-2 bg-red-600 text-white font-semibold rounded-md text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}
