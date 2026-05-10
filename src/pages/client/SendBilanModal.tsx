import { useEffect, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'
import { settingsService } from '../../services/settings'
import { emailService } from '../../services/email'

interface SendBilanModalProps {
  client: Client
  onCancel: () => void
  onSent: (recipientEmail: string) => void
}

function formatDate(): string {
  return new Date().toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function applyVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

export function SendBilanModal({ client, onCancel, onSent }: SendBilanModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      settingsService.getEmailTemplate(),
      settingsService.getProfile()
    ]).then(([template, profile]) => {
      const vars = {
        client_name: client.name,
        date: formatDate(),
        coach_name: profile.name,
        signature: profile.signature
      }
      setSubject(applyVariables(template.subject, vars))
      setBody(applyVariables(template.body, vars))
      setLoading(false)
    })
  }, [client])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !sending) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, sending])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!subject.trim() || !body.trim()) {
      setError('Sujet et corps sont requis.')
      return
    }
    try {
      setSending(true)
      const result = await emailService.sendBilan(client.id, subject, body)
      onSent(result.sentTo)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'envoi.'
      setError(message)
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-2xl border border-cream-dark max-h-[90vh] flex flex-col">
        <form onSubmit={handleSend} className="p-6 flex flex-col min-h-0 flex-1">
          <h2 className="text-marine font-semibold text-xl mb-1">Envoyer le bilan</h2>
          <p className="text-marine/55 text-base mb-5">
            Destinataire&nbsp;: <span className="text-marine font-medium">{client.email}</span>
          </p>

          {loading ? (
            <p className="text-marine/45 text-base">Préparation du courriel…</p>
          ) : (
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0">
              {error && (
                <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-base font-medium text-marine mb-1.5">Sujet</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="block text-base font-medium text-marine mb-1.5">Message</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 text-marine/65 text-sm bg-cream/70 border border-cream-dark rounded-md px-3 py-2">
                <Paperclip size={15} className="text-gold shrink-0" />
                Une copie PDF du dashboard sera attachée automatiquement.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-6 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={sending}
              className="px-4 py-2 text-marine/65 text-base hover:text-marine transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={sending || loading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending && <Loader2 size={15} className="animate-spin" />}
              {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
