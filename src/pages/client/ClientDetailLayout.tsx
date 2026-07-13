import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, ImagePlus, Mail, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { clientsService } from '../../services/clients'
import { transferService } from '../../services/transfer'
import { ClientAvatar } from '../../components/ClientAvatar'
import { AvatarCropper } from '../../components/AvatarCropper'

/** Convertit un Blob en string base64 (sans le prefix data:...) — pour traverser contextBridge. */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Format : "data:image/png;base64,XXXXX..." → on garde XXXXX
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Extrait la partie base64 d'une data URL ("data:image/...;base64,XXXX" → "XXXX"). */
function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? ''
}

interface TabDef {
  to: string
  label: string
  enabled: boolean
}

const TABS: TabDef[] = [
  { to: 'dashboard', label: 'Dashboard', enabled: true },
  { to: 'bilans', label: 'Bilans', enabled: true },
  { to: 'mesures', label: 'Mesures', enabled: true },
  { to: 'nutrition', label: 'Nutrition', enabled: true },
  { to: 'notes', label: 'Notes', enabled: true }
]

/** Contexte exposé par `<ClientDetailLayout>` à toutes ses sous-routes (et
 *  re-forwardé par les couches intermédiaires type `<DashboardLayout>`). */
export interface ClientOutletContext {
  client: Client
  /** Permet à un onglet (ex. Nutrition) de remonter le client mis à jour au layout,
   *  pour garder l'en-tête et les autres onglets synchronisés sans rechargement. */
  onClientUpdated?: (client: Client) => void
}

export function useClient(): Client {
  return useOutletContext<ClientOutletContext>().client
}

export function useClientContext(): ClientOutletContext {
  return useOutletContext<ClientOutletContext>()
}

/** Permet aux couches intermédiaires de récupérer le contexte parent tel quel
 *  et de le re-forwarder à `<Outlet context={...} />`. */
export function useClientOutletContext(): ClientOutletContext {
  return useOutletContext<ClientOutletContext>()
}

export function ClientDetailLayout() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const printMode = searchParams.get('print') === '1'
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // Permet à un onglet (ex. Mesures) d'ouvrir directement le modal d'édition
  // via `?edit=1` pour compléter le profil (date de naissance / sexe).
  useEffect(() => {
    if (searchParams.get('edit') === '1') setEditing(true)
  }, [searchParams])

  function closeEdit() {
    setEditing(false)
    if (searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
    }
  }

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
          <div className="flex items-center gap-4 min-w-0">
            <ClientAvatar client={client} size="lg" />
            <div className="min-w-0">
              <h1 className="text-marine font-semibold text-2xl truncate">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 text-marine/60 text-base">
                <Mail size={15} className="shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
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
            <ClientActionsMenu clientId={client.id} onMessage={setToast} />
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
        <Outlet context={{ client, onClientUpdated: setClient } satisfies ClientOutletContext} />
      </div>

      {editing && (
        <EditClientModal
          client={client}
          onCancel={closeEdit}
          onUpdated={setClient}
          onSaved={updated => {
            setClient(updated)
            closeEdit()
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

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-marine text-cream text-base font-medium px-5 py-3 rounded-lg shadow-2xl border border-marine-light/40">
          {toast}
        </div>
      )}
    </div>
  )
}

interface ClientActionsMenuProps {
  clientId: string
  onMessage: (message: string) => void
}

function ClientActionsMenu({ clientId, onMessage }: ClientActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleExport() {
    setOpen(false)
    setBusy(true)
    try {
      const result = await transferService.exportClients([clientId])
      if (result) onMessage('Dossier client exporté')
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Échec de l'export.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        title="Plus d'actions"
        aria-label="Plus d'actions"
        className="flex items-center px-2 py-2 text-marine/60 hover:text-marine border border-cream-dark hover:border-gold/60 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-60 bg-white border border-cream-dark rounded-md shadow-xl py-1 z-30">
          <button
            type="button"
            onClick={handleExport}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-marine/80 hover:bg-cream hover:text-marine text-base text-left transition-colors"
          >
            <Download size={15} className="text-gold shrink-0" />
            Exporter en JSON (.kinesio)
          </button>
        </div>
      )}
    </div>
  )
}

interface EditClientModalProps {
  client: Client
  onCancel: () => void
  /** Appelé après une modif appliquée immédiatement (photo) — ne ferme pas le modal. */
  onUpdated: (client: Client) => void
  /** Appelé après l'enregistrement du formulaire — ferme le modal. */
  onSaved: (client: Client) => void
}

function EditClientModal({ client, onCancel, onUpdated, onSaved }: EditClientModalProps) {
  // `current` reflète l'état serveur du client (incl. la photo, modifiée à part) ;
  // les autres champs sont édités localement puis enregistrés à la soumission.
  const [current, setCurrent] = useState(client)
  const [name, setName] = useState(client.name)
  const [email, setEmail] = useState(client.email)
  const [birthdate, setBirthdate] = useState(client.birthdate ?? '')
  const [sex, setSex] = useState<'F' | 'M' | ''>(client.sex ?? '')
  const [unitLength, setUnitLength] = useState<'cm' | 'in'>(client.unitLength ?? 'cm')
  const [unitWeight, setUnitWeight] = useState<'kg' | 'lb'>(client.unitWeight ?? 'kg')
  const [principeTitre, setPrincipeTitre] = useState<string>(client.principePersoTitre ?? '')
  const [principeTexte, setPrincipeTexte] = useState<string>(client.principePersoTexte ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false)
  // Source de l'image en cours de recadrage (data URL) ; `null` = éditeur fermé.
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const busy = saving || avatarBusy
  const cropping = cropSrc !== null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy && !cropping) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy, cropping])

  async function handleChooseAvatar() {
    if (busy || cropping) return
    const picked = await clientsService.pickAvatar()
    if (picked.canceled) return
    setError(null)
    setConfirmRemoveAvatar(false)
    setCropSrc(picked.dataUrl)
  }

  async function handleCropDone(croppedBlob: Blob) {
    // Les erreurs remontent à l'éditeur de cadrage, qui les affiche et reste ouvert.
    setAvatarBusy(true)
    try {
      // Note Electron : contextBridge ne sérialise pas Uint8Array/ArrayBuffer/Array
      // de manière fiable. On encode donc en base64 (string) qui traverse sans souci.
      const croppedBytes = await blobToBase64(croppedBlob)
      // `cropSrc` est la data URL de la photo d'origine — on extrait la partie base64
      const originalBytes = dataUrlToBase64(cropSrc!)
      const updated = await clientsService.setAvatar(client.id, croppedBytes, originalBytes)
      setCurrent(updated)
      onUpdated(updated)
      setCropSrc(null)
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleRemoveAvatar() {
    setError(null)
    try {
      setAvatarBusy(true)
      const updated = await clientsService.removeAvatar(client.id)
      setCurrent(updated)
      onUpdated(updated)
      setConfirmRemoveAvatar(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de retirer la photo.')
    } finally {
      setAvatarBusy(false)
    }
  }

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
    if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
      setError('Date de naissance invalide.')
      return
    }
    try {
      setSaving(true)
      const updated = await clientsService.update(client.id, {
        name: name.trim(),
        email: email.trim(),
        birthdate: birthdate ? birthdate : null,
        sex: sex ? sex : null,
        unitLength,
        unitWeight,
        principePersoTitre: principeTitre.trim() || null,
        principePersoTexte: principeTexte.trim() || null
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
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark max-h-[92vh] flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <h2 className="text-marine font-semibold text-xl mb-5">Modifier le client</h2>

          {error && (
            <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4 mb-5">
            <button
              type="button"
              onClick={handleChooseAvatar}
              disabled={busy}
              title="Changer la photo"
              className="relative group rounded-full disabled:cursor-not-allowed"
            >
              <ClientAvatar client={current} size="lg" />
              <span className="absolute inset-0 rounded-full bg-marine/65 text-cream text-[11px] font-medium leading-tight flex items-center justify-center text-center px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarBusy ? '…' : 'Changer la photo'}
              </span>
            </button>
            <div className="flex flex-col items-start gap-1.5 min-w-0">
              <button
                type="button"
                onClick={handleChooseAvatar}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-marine/80 hover:text-marine text-sm font-medium border border-cream-dark hover:border-gold/60 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ImagePlus size={14} />
                Choisir une photo…
              </button>
              {current.avatarFilename &&
                (confirmRemoveAvatar ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-marine/60">Retirer&nbsp;?</span>
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={busy}
                      className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveAvatar(false)}
                      disabled={busy}
                      className="text-marine/50 hover:text-marine"
                    >
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveAvatar(true)}
                    disabled={busy}
                    className="text-red-600/80 hover:text-red-700 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Retirer la photo
                  </button>
                ))}
              <p className="text-marine/40 text-xs">PNG, JPG ou WEBP · max 10&nbsp;Mo</p>
            </div>
          </div>

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

            <div>
              <label className="block text-base font-medium text-marine mb-1.5">
                Date de naissance <span className="text-marine/40 font-normal">(facultatif)</span>
              </label>
              <input
                type="date"
                value={birthdate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setBirthdate(e.target.value)}
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
                      name="client-sex"
                      value={opt.value}
                      checked={sex === opt.value}
                      onChange={() => setSex(opt.value)}
                      className="accent-gold"
                    />
                    {opt.label}
                  </label>
                ))}
                {sex && (
                  <button
                    type="button"
                    onClick={() => setSex('')}
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
                      name="client-unit-length"
                      value={opt.value}
                      checked={unitLength === opt.value}
                      onChange={() => setUnitLength(opt.value)}
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
                      name="client-unit-weight"
                      value={opt.value}
                      checked={unitWeight === opt.value}
                      onChange={() => setUnitWeight(opt.value)}
                      className="accent-gold"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <p className="text-marine/40 text-sm mt-1">Unité d'affichage et de saisie du poids (les données sont stockées en kg).</p>
            </div>

            <div className="border-t border-cream-dark pt-5 mt-5">
              <p className="text-base font-medium text-marine mb-1">Principe personnalisé (optionnel)</p>
              <p className="text-marine/50 text-xs mb-3">
                Un 6<sup>e</sup> principe montré en clôture du rapport de ce client. Laissez vide pour n’en afficher aucun.
              </p>
              <input
                type="text"
                value={principeTitre}
                onChange={e => setPrincipeTitre(e.target.value)}
                maxLength={60}
                placeholder="Titre (ex. Bon sommeil)"
                className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
              />
              <input
                type="text"
                value={principeTexte}
                onChange={e => setPrincipeTexte(e.target.value)}
                maxLength={300}
                placeholder="Courte phrase (ex. C’est la nuit que le corps se répare.)"
                className="mt-2 w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
              />
            </div>
          </div>
          </div>

          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-cream-dark bg-cream">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2 text-marine/60 text-base hover:text-marine transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          busy={avatarBusy}
          onCropDone={handleCropDone}
          onCancel={() => {
            if (!avatarBusy) setCropSrc(null)
          }}
        />
      )}
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
