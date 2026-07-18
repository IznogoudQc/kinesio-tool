import { useEffect, useState } from 'react'
import { Mail, ServerCog, UserCog, Check, AlertCircle, Loader2, Gauge, FileDown, Folder } from 'lucide-react'
import { DummyJeanSeedButton } from './settings/DummyJeanSeedButton'
import { AIProviderCard } from './settings/AIProviderCard'
import { PainSuggestionsCard } from './settings/PainSuggestionsCard'
import { SupplementLibraryCard, FoodListCard } from './settings/NutritionSettingsCards'
import { settingsService } from '../services/settings'
import { reportsService } from '../services/reports'
import mEvePhoto from '../assets/mEve.png'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const TEMPLATE_VARIABLES: { key: string; description: string }[] = [
  { key: '{{client_name}}', description: 'Nom du client' },
  { key: '{{date}}', description: "Date d'envoi" },
  { key: '{{coach_name}}', description: 'Votre nom (depuis Profil)' },
  { key: '{{signature}}', description: 'Votre signature (depuis Profil)' }
]

const SETTINGS_TABS = [
  { key: 'general', label: 'Général' },
  { key: 'bilans', label: 'Bilans' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'questionnaires', label: 'Questionnaires' },
  { key: 'courriel', label: 'Courriel' },
  { key: 'ia', label: 'IA' }
] as const

type SettingsTab = (typeof SETTINGS_TABS)[number]['key']

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('general')

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-marine font-semibold text-2xl mb-5">Paramètres</h1>

      {/* Barre d'onglets */}
      <div className="flex flex-wrap gap-1 border-b border-cream-dark mb-6">
        {SETTINGS_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-gold text-marine'
                : 'border-transparent text-marine/50 hover:text-marine hover:border-cream-dark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {tab === 'general' && (
            <>
              <ProfileCard />
              <DocumentsFolderCard />
              <DummyJeanSeedButton />
            </>
          )}
          {tab === 'bilans' && <NormsCard />}
          {tab === 'nutrition' && (
            <>
              <SupplementLibraryCard />
              <FoodListCard title="Aliments à privilégier" variant="good" />
              <FoodListCard title="Aliments à éviter" variant="bad" />
            </>
          )}
          {tab === 'questionnaires' && <PainSuggestionsCard />}
          {tab === 'courriel' && (
            <>
              <SmtpCard />
              <TemplateCard kind="bilan" />
              <TemplateCard kind="nutrition" />
            </>
          )}
          {tab === 'ia' && <AIProviderCard />}
        </div>

        {/* Colonne droite : profil Marie-Eve */}
        <aside className="lg:col-span-1">
          <div className="bg-white border border-cream-dark rounded-xl p-6 shadow-sm sticky top-6">
            <div className="w-48 mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-cream-dark/30">
              <img src={mEvePhoto} alt="Marie-Eve" className="w-full h-full object-contain" />
            </div>
            <h3 className="text-center text-marine text-xl font-semibold mt-4">Marie-Eve</h3>
            <p className="text-center text-marine/60 text-sm">Kinésiologue</p>
          </div>
        </aside>
      </div>
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

function DocumentsFolderCard() {
  const [folder, setFolder] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    settingsService
      .getDocumentsFolder()
      .then(f => setFolder(f))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  async function choose() {
    setBusy(true)
    try {
      const f = await settingsService.pickDocumentsFolder()
      if (f) setFolder(f)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Dossier des documents clients"
      icon={Folder}
      description="Où l'app enregistre les documents exportés (un sous-dossier par client). Depuis le tableau de bord d'un client, « Télécharger tous les documents » y dépose les bilans et la nutrition."
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0 px-3 py-2 rounded-md border border-cream-dark bg-cream/40 text-marine text-base truncate">
          {loading ? 'Chargement…' : (folder ?? 'Aucun dossier choisi')}
        </div>
        <button
          type="button"
          onClick={choose}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Folder size={15} />
          {busy ? '…' : 'Choisir un dossier'}
        </button>
      </div>
    </Card>
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

function NormsCard() {
  // Une seule norme exposée pour l'instant : ACSM (voir daily-note 2026-07-04 —
  // CPAFLA retiré de l'UI en attendant une source de tables). On normalise
  // défensivement toute valeur stockée vers 'acsm' pour rester cohérent.
  useEffect(() => {
    settingsService
      .getCategorizationNorms()
      .then(v => {
        if (v !== 'acsm') settingsService.setCategorizationNorms('acsm').catch(() => undefined)
      })
      .catch(() => undefined)
  }, [])

  return (
    <Card
      title="Normes de catégorisation"
      icon={Gauge}
      description="Tables utilisées pour situer un résultat (À améliorer → Excellent) selon l'âge et le sexe."
    >
      <div className="p-3 rounded-md border border-gold/40 bg-gold/5">
        <p className="text-marine font-medium text-base">ACSM — 11ᵉ édition (2021)</p>
        <p className="text-marine/55 text-sm mt-0.5">
          American College of Sports Medicine. Tables par âge et sexe pour VO2max, % de gras, push-ups,
          redressements, flexion du tronc, IMC, tour de taille, saut vertical, puissance et endurance du dos.
        </p>
      </div>
      <ExportBaremes />
    </Card>
  )
}

/** Bouton « Exporter les barèmes » — génère un PDF de référence (barèmes +
 *  formules, lus depuis le code) et l'ouvre. */
function ExportBaremes() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setBusy(true)
    setError(null)
    try {
      const path = await reportsService.generateBaremesPdf()
      await reportsService.openPdf(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'export.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
        {busy ? 'Génération…' : 'Exporter les barèmes (PDF)'}
      </button>
      <p className="text-marine/45 text-sm mt-1.5">
        Document de référence à valider ou imprimer — barèmes de catégorisation, seuils cliniques et formules de calcul.
      </p>
      {error && <p className="text-red-600 text-sm mt-1.5">{error}</p>}
    </div>
  )
}

function TemplateCard({ kind }: { kind: 'bilan' | 'nutrition' }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const isNutrition = kind === 'nutrition'

  useEffect(() => {
    const p = isNutrition ? settingsService.getNutritionEmailTemplate() : settingsService.getEmailTemplate()
    p.then(t => {
      setSubject(t.subject)
      setBody(t.body)
      setLoading(false)
    })
  }, [isNutrition])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      if (isNutrition) await settingsService.setNutritionEmailTemplate({ subject, body })
      else await settingsService.setEmailTemplate({ subject, body })
      setStatus('saved')
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    }
  }

  return (
    <Card
      title={isNutrition ? "Template d'email — Nutrition" : "Template d'email — Bilan"}
      icon={Mail}
      description={
        isNutrition
          ? "Modèle utilisé pour l'envoi du document nutrition. Les variables sont remplacées automatiquement."
          : "Modèle utilisé pour l'envoi du bilan. Les variables sont remplacées automatiquement."
      }
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

          <div className="flex items-center gap-4 pt-1 flex-wrap">
            <SaveButton status={status} />
            <button
              type="button"
              onClick={async () => {
                const d = isNutrition
                  ? await settingsService.getDefaultNutritionEmailTemplate()
                  : await settingsService.getDefaultEmailTemplate()
                setSubject(d.subject)
                setBody(d.body)
              }}
              className="text-marine/55 hover:text-marine text-sm underline"
              title="Recharge le texte fourni avec l’application — pensez à enregistrer ensuite"
            >
              Rétablir le texte par défaut
            </button>
            <StatusInline status={status} error={error} />
          </div>
        </form>
      )}
    </Card>
  )
}
