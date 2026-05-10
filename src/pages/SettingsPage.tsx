import { useEffect, useState } from 'react'
import { Mail, ServerCog, UserCog, Check, AlertCircle, Loader2 } from 'lucide-react'
import { settingsService } from '../services/settings'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const TEMPLATE_VARIABLES: { key: string; description: string }[] = [
  { key: '{{client_name}}', description: 'Nom du client' },
  { key: '{{date}}', description: "Date d'envoi" },
  { key: '{{coach_name}}', description: 'Votre nom (depuis Profil)' },
  { key: '{{signature}}', description: 'Votre signature (depuis Profil)' }
]

export function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-marine font-semibold text-2xl">Paramètres</h1>

      <ProfileCard />
      <SmtpCard />
      <TemplateCard />
    </div>
  )
}

interface CardProps {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
  description?: string
}

function Card({ title, icon: Icon, children, description }: CardProps) {
  return (
    <section className="bg-white border border-cream-dark rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <Icon size={18} className="text-gold" />
        <h2 className="text-marine font-semibold text-lg">{title}</h2>
      </div>
      {description && (
        <p className="text-marine/55 text-sm mb-5">{description}</p>
      )}
      <div className={description ? '' : 'mt-5'}>{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
  hint
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="block text-base font-medium text-marine mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-marine/45 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function inputClass(): string {
  return 'w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors'
}

function SaveButton({
  status,
  disabled,
  label = 'Enregistrer'
}: {
  status: SaveStatus
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="submit"
      disabled={disabled || status === 'saving'}
      className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {status === 'saving' ? 'Enregistrement…' : label}
    </button>
  )
}

function StatusInline({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-700 text-sm">
        <Check size={15} /> Enregistré
      </span>
    )
  }
  if (status === 'error' && error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-700 text-sm">
        <AlertCircle size={15} /> {error}
      </span>
    )
  }
  return null
}

function ProfileCard() {
  const [name, setName] = useState('')
  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    settingsService.getProfile().then(p => {
      setName(p.name)
      setSignature(p.signature)
      setLoading(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      await settingsService.setProfile({ name: name.trim(), signature })
      setStatus('saved')
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    }
  }

  return (
    <Card title="Profil" icon={UserCog} description="Vos informations utilisées dans les courriels.">
      {loading ? (
        <p className="text-marine/45 text-base">Chargement…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nom">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Marie-Eve Bélanger"
              className={inputClass()}
            />
          </Field>
          <Field label="Signature email" hint="Apparaît à la fin de vos courriels (variable {{signature}}).">
            <textarea
              value={signature}
              onChange={e => setSignature(e.target.value)}
              rows={4}
              className={inputClass()}
            />
          </Field>
          <div className="flex items-center gap-4 pt-1">
            <SaveButton status={status} />
            <StatusInline status={status} error={error} />
          </div>
        </form>
      )}
    </Card>
  )
}

function SmtpCard() {
  const [host, setHost] = useState('')
  const [port, setPort] = useState<number>(587)
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [secure, setSecure] = useState(false)
  const [hasStoredPassword, setHasStoredPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<SmtpTestResult | null>(null)

  useEffect(() => {
    Promise.all([
      settingsService.getSmtpConfig(),
      settingsService.hasSmtpPassword()
    ]).then(([cfg, hasPwd]) => {
      if (cfg) {
        setHost(cfg.host)
        setPort(cfg.port)
        setUser(cfg.user)
        setSecure(cfg.secure)
      }
      setHasStoredPassword(hasPwd)
      setLoading(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    setTestResult(null)
    try {
      if (!host.trim() || !user.trim()) {
        throw new Error('Hôte et utilisateur sont requis.')
      }
      await settingsService.setSmtpConfig({
        host: host.trim(),
        port,
        user: user.trim(),
        secure
      })
      if (password) {
        await settingsService.setSmtpPassword(password)
        setHasStoredPassword(true)
        setPassword('')
      }
      setStatus('saved')
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await settingsService.testSmtpConnection()
      setTestResult(result)
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue'
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card
      title="Configuration SMTP"
      icon={ServerCog}
      description="Le mot de passe est stocké de façon sécurisée dans le trousseau Windows, jamais en clair dans la base."
    >
      {loading ? (
        <p className="text-marine/45 text-base">Chargement…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Field label="Hôte">
                <input
                  type="text"
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className={inputClass()}
                />
              </Field>
            </div>
            <Field label="Port">
              <input
                type="number"
                value={port}
                onChange={e => setPort(Number(e.target.value) || 0)}
                min={1}
                max={65535}
                className={inputClass()}
              />
            </Field>
          </div>
          <Field label="Utilisateur (courriel)">
            <input
              type="email"
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="marie@exemple.com"
              className={inputClass()}
            />
          </Field>
          <Field
            label="Mot de passe"
            hint={hasStoredPassword ? 'Un mot de passe est déjà enregistré. Laissez vide pour le conserver.' : undefined}
          >
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={hasStoredPassword ? '••••••••' : 'Mot de passe SMTP'}
              autoComplete="new-password"
              className={inputClass()}
            />
          </Field>
          <label className="flex items-center gap-2.5 text-base text-marine cursor-pointer">
            <input
              type="checkbox"
              checked={secure}
              onChange={e => setSecure(e.target.checked)}
              className="w-4 h-4 accent-gold cursor-pointer"
            />
            TLS sécurisé (port 465 normalement)
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <SaveButton status={status} />
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !hasStoredPassword}
              title={!hasStoredPassword ? 'Enregistrez d\'abord un mot de passe' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 border border-cream-dark text-marine hover:border-gold/60 rounded-md text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? <Loader2 size={15} className="animate-spin" /> : <ServerCog size={15} />}
              {testing ? 'Test en cours…' : 'Tester la connexion'}
            </button>
            <StatusInline status={status} error={error} />
          </div>

          {testResult && (
            <div
              className={[
                'rounded-md px-4 py-3 text-base border',
                testResult.success
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              ].join(' ')}
            >
              {testResult.success ? (
                <span className="inline-flex items-center gap-2">
                  <Check size={16} /> Connexion réussie.
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <AlertCircle size={16} /> Échec : {testResult.error}
                </span>
              )}
            </div>
          )}
        </form>
      )}
    </Card>
  )
}

function TemplateCard() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    settingsService.getEmailTemplate().then(t => {
      setSubject(t.subject)
      setBody(t.body)
      setLoading(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      await settingsService.setEmailTemplate({ subject, body })
      setStatus('saved')
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    }
  }

  return (
    <Card
      title="Template d'email"
      icon={Mail}
      description="Modèle utilisé pour l'envoi du bilan. Les variables sont remplacées automatiquement."
    >
      {loading ? (
        <p className="text-marine/45 text-base">Chargement…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Sujet">
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className={inputClass()}
            />
          </Field>
          <Field label="Corps du message">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              className={[inputClass(), 'font-mono text-sm leading-relaxed'].join(' ')}
            />
          </Field>

          <div className="bg-cream/60 border border-cream-dark rounded-md px-4 py-3">
            <p className="text-marine/70 text-sm font-medium mb-2">Variables disponibles</p>
            <ul className="space-y-1 text-sm">
              {TEMPLATE_VARIABLES.map(v => (
                <li key={v.key} className="flex items-baseline gap-3">
                  <code className="text-gold-dark bg-cream px-1.5 py-0.5 rounded border border-cream-dark text-xs">
                    {v.key}
                  </code>
                  <span className="text-marine/65">{v.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <SaveButton status={status} />
            <StatusInline status={status} error={error} />
          </div>
        </form>
      )}
    </Card>
  )
}
