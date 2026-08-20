import { useEffect, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'
import { settingsService } from '../../services/settings'
import { reportsService } from '../../services/reports'

interface SendBilanModalProps {
  client: Client
  onCancel: () => void
  onSent: (recipientEmail: string) => void
  /** `bilan` (défaut) = PDF + document interactif ; `nutrition` = document nutrition seul. */
  kind?: 'bilan' | 'nutrition'
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

/**
 * Qui reçoit l'envoi. `moi` sert à la coach : les mêmes pièces jointes dans sa
 * propre boîte, pour les rouvrir sur un autre poste devant le client.
 */
type Destination = 'client' | 'moi' | 'deux'

const DESTINATIONS: { value: Destination; label: string }[] = [
  { value: 'client', label: 'Au client' },
  { value: 'moi', label: 'À moi' },
  { value: 'deux', label: 'Les deux' }
]

function estCourriel(valeur: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim())
}

export function SendBilanModal({ client, onCancel, onSent, kind = 'bilan' }: SendBilanModalProps) {
  const isNutrition = kind === 'nutrition'
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [destination, setDestination] = useState<Destination>('client')
  // Pré-remplie depuis le SMTP déjà configuré plutôt que redemandée : un second
  // endroit où saisir son adresse, c'est un second endroit qui se désynchronise.
  // Reste modifiable — chez certains fournisseurs l'identifiant SMTP n'est pas
  // une adresse.
  const [monAdresse, setMonAdresse] = useState('')

  useEffect(() => {
    // Le document nutrition a son propre modèle de courriel (≠ celui du bilan),
    // tous deux éditables dans Paramètres → Courriel.
    const tplPromise =
      kind === 'nutrition'
        ? settingsService.getNutritionEmailTemplate()
        : settingsService.getEmailTemplate()
    Promise.all([
      tplPromise,
      settingsService.getProfile(),
      settingsService.getSmtpConfig()
    ]).then(([tpl, profile, smtp]) => {
      const vars = {
        client_name: client.name,
        date: formatDate(),
        coach_name: profile.name,
        signature: profile.signature
      }
      setSubject(applyVariables(tpl.subject, vars))
      setBody(applyVariables(tpl.body, vars))
      if (smtp && estCourriel(smtp.user)) setMonAdresse(smtp.user)
      setLoading(false)
    })
  }, [client, kind])

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
    if (destination !== 'moi' && !estCourriel(client.email ?? '')) {
      setError('Ce client n’a pas d’adresse courriel valide.')
      return
    }
    if (destination !== 'client' && !estCourriel(monAdresse)) {
      setError('Entrez l’adresse à laquelle vous envoyer la copie.')
      return
    }
    const destinataires =
      destination === 'client'
        ? [client.email]
        : destination === 'moi'
          ? [monAdresse.trim()]
          : [client.email, monAdresse.trim()]
    try {
      setSending(true)
      await reportsService.sendReportByEmail(client.id, subject, body, kind, undefined, destinataires)
      onSent(destinataires.join(' et '))
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
          <h2 className="text-marine font-semibold text-xl mb-1">
            {isNutrition ? 'Envoyer le document nutrition' : 'Envoyer le bilan'}
          </h2>
          <p className="text-marine/55 text-base mb-5">
            {isNutrition ? 'Document nutrition et journal alimentaire' : 'Rapport PDF et version interactive'}
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
                <label className="block text-base font-medium text-marine mb-1.5">Destinataire</label>
                <div className="inline-flex rounded-md border border-cream-dark overflow-hidden bg-white">
                  {DESTINATIONS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDestination(d.value)}
                      aria-pressed={destination === d.value}
                      className={`px-4 py-1.5 text-base transition-colors ${
                        destination === d.value
                          ? 'bg-gold text-marine font-semibold'
                          : 'text-marine/55 hover:text-marine'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {destination !== 'moi' && (
                  <p className="text-marine/55 text-sm mt-2">
                    Client&nbsp;:{' '}
                    <span className="text-marine font-medium">
                      {client.email || <span className="text-red-700">aucune adresse</span>}
                    </span>
                  </p>
                )}

                {destination !== 'client' && (
                  <div className="mt-2">
                    <label className="block text-sm text-marine/55 mb-1">Mon adresse</label>
                    <input
                      type="email"
                      value={monAdresse}
                      onChange={e => setMonAdresse(e.target.value)}
                      placeholder="vous@exemple.com"
                      className="w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
                    />
                    <p className="text-marine/45 text-xs mt-1">
                      Reprise de votre configuration SMTP. Le sujet et le message ne changent pas — seule la
                      destination change.
                    </p>
                  </div>
                )}
              </div>

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

              <div className="flex items-start gap-2 text-marine/65 text-sm bg-cream/70 border border-cream-dark rounded-md px-3 py-2">
                <Paperclip size={15} className="text-gold shrink-0 mt-0.5" />
                {isNutrition ? (
                  <span>
                    Deux pièces jointes : le <span className="font-medium text-marine">document nutrition (.html)</span> et le{' '}
                    <span className="font-medium text-marine">journal alimentaire (.html)</span> à imprimer.
                    <span className="block text-marine/45 text-xs mt-0.5">
                      Certains services de courriel bloquent les pièces jointes .html ; le client peut aussi les enregistrer
                      en PDF depuis son navigateur.
                    </span>
                  </span>
                ) : (
                  <span>
                    Deux pièces jointes seront ajoutées : le <span className="font-medium text-marine">rapport PDF</span> et une{' '}
                    <span className="font-medium text-marine">version interactive (.html)</span> que le client ouvre dans son
                    navigateur, hors ligne.
                    <span className="block text-marine/45 text-xs mt-0.5">
                      Certains services de courriel bloquent les pièces jointes .html — le PDF, lui, passe toujours.
                    </span>
                  </span>
                )}
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
