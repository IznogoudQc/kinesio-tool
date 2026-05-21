import { useEffect, useState } from 'react'
import { AlertCircle, Bot, Check, ExternalLink, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { aiAdviceService } from '../../services/aiAdvice'

type Status = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Carte de configuration de la clé Anthropic Claude. La clé vit dans le
 * trousseau OS (keytar) — l'IPC fait l'aller-retour, le renderer ne stocke
 * jamais la clé en mémoire (juste la saisie temporaire avant l'envoi).
 */
export function AIProviderCard() {
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState<boolean | null>(null) // null = chargement initial
  const [replacing, setReplacing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    let cancelled = false
    aiAdviceService
      .hasApiKey()
      .then(v => {
        if (!cancelled) setHasKey(v)
      })
      .catch(() => {
        if (!cancelled) setHasKey(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaveStatus('saving')
    setError(null)
    setTestResult(null)
    try {
      await aiAdviceService.setApiKey(apiKey.trim())
      setApiKey('')
      setHasKey(true)
      setReplacing(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch (err) {
      setSaveStatus('error')
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.')
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await aiAdviceService.testConnection()
      if (res.ok) {
        setTestResult({ ok: true, message: 'Connexion à Anthropic Claude réussie.' })
      } else {
        setTestResult({ ok: false, message: res.error })
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur inconnue'
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleRemove() {
    try {
      await aiAdviceService.removeApiKey()
      setHasKey(false)
      setConfirmRemove(false)
      setTestResult(null)
      setApiKey('')
      setReplacing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  const showInput = hasKey === false || replacing

  return (
    <section className="bg-white border border-cream-dark rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <Bot size={18} className="text-gold" />
        <h2 className="text-marine font-semibold text-lg">Conseils IA — Anthropic Claude</h2>
      </div>
      <p className="text-marine/55 text-sm mb-5">
        Permet de générer des conseils croisés à partir des métriques sélectionnées sur le dashboard
        d'un client. Le payload est anonymisé (sexe, âge, valeurs et catégories) — aucun nom,
        courriel ou note n'est envoyé.{' '}
        <a
          href="https://console.anthropic.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-dark hover:text-marine underline inline-flex items-center gap-1"
        >
          Obtenir une clé
          <ExternalLink size={11} />
        </a>
      </p>

      {hasKey === null ? (
        <p className="text-marine/45 text-base">Chargement…</p>
      ) : (
        <>
          {hasKey && !replacing && (
            <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2.5 mb-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-green-800 text-sm font-medium">
                <Check size={15} />
                Clé API configurée
              </span>
              <button
                type="button"
                onClick={() => {
                  setReplacing(true)
                  setTestResult(null)
                }}
                className="text-marine/60 hover:text-marine text-sm underline"
              >
                Remplacer la clé
              </button>
            </div>
          )}

          {showInput && (
            <form onSubmit={handleSave} className="space-y-3 mb-4">
              <div>
                <label className="block text-base font-medium text-marine mb-1.5">
                  <KeyRound size={14} className="inline -mt-0.5 mr-1" />
                  Clé API Anthropic
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-…"
                  autoComplete="new-password"
                  autoFocus={replacing}
                  className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
                />
                <p className="text-marine/40 text-xs mt-1">
                  La clé est stockée dans le trousseau OS (keytar) — jamais en clair dans la base.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!apiKey.trim() || saveStatus === 'saving'}
                  className="px-4 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveStatus === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {replacing && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplacing(false)
                      setApiKey('')
                    }}
                    className="text-marine/55 hover:text-marine text-sm underline"
                  >
                    Annuler
                  </button>
                )}
                {saveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1.5 text-green-700 text-sm">
                    <Check size={15} /> Enregistré
                  </span>
                )}
              </div>
              {error && (
                <p className="inline-flex items-center gap-1.5 text-red-700 text-sm">
                  <AlertCircle size={15} /> {error}
                </p>
              )}
            </form>
          )}

          {/* Actions disponibles dès qu'une clé est en place. */}
          {hasKey && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-cream-dark/40">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="inline-flex items-center gap-2 px-3.5 py-2 border border-cream-dark text-marine/80 hover:text-marine hover:border-gold/60 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                {testing ? 'Test en cours…' : 'Tester la connexion'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-red-600/75 hover:text-red-700 text-sm transition-colors"
              >
                <Trash2 size={13} />
                Supprimer la clé
              </button>
            </div>
          )}

          {testResult && (
            <div
              className={`mt-3 px-3 py-2.5 rounded-md text-sm border ${
                testResult.ok
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {testResult.ok ? (
                <span className="inline-flex items-center gap-2">
                  <Check size={15} /> {testResult.message}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <AlertCircle size={15} /> Échec : {testResult.message}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {confirmRemove && (
        <ConfirmRemoveDialog onCancel={() => setConfirmRemove(false)} onConfirm={handleRemove} />
      )}
    </section>
  )
}

function ConfirmRemoveDialog({
  onCancel,
  onConfirm
}: {
  onCancel: () => void
  onConfirm: () => void | Promise<void>
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
        <h2 className="text-marine font-semibold text-xl mb-2">Supprimer la clé API ?</h2>
        <p className="text-marine/65 text-base mb-4">
          La clé sera retirée du trousseau OS. Le mode « Conseils IA » sera désactivé jusqu'à ce que
          vous en saisissiez une nouvelle.
        </p>
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
