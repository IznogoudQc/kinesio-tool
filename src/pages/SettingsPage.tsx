import { useEffect, useState } from 'react'
import { Mail, ServerCog, UserCog, Check, AlertCircle, Loader2, Gauge, FileDown, Folder, CloudUpload, FolderOpen, LifeBuoy, ChevronDown, ChevronRight, Activity } from 'lucide-react'
import { DummyJeanSeedButton } from './settings/DummyJeanSeedButton'
import { AIProviderCard } from './settings/AIProviderCard'
import { PainSuggestionsCard } from './settings/PainSuggestionsCard'
import { SupplementLibraryCard, FoodListCard, FoodMacrosCard } from './settings/NutritionSettingsCards'
import { TestCard, TestSection } from './settings/BilanTestCards'
import { CompositionBaremes } from './settings/CompositionBaremes'
import { AerobieBaremes } from './settings/AerobieBaremes'
import { DosBaremes } from './settings/DosBaremes'
import { MusculoBaremes } from './settings/MusculoBaremes'
import { PaBaremes } from './settings/PaBaremes'
import { settingsService } from '../services/settings'
import { backupService } from '../services/backup'
import { pulseService } from '../services/pulse'
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
  { key: 'bilans', label: 'Mesures / Bilans' },
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
              <BackupCard />
              <RestoreProcedure />
              <PulseCard />
              <DummyJeanSeedButton />
            </>
          )}
          {tab === 'bilans' && <BilanTestsTab />}
          {tab === 'nutrition' && (
            <>
              <SupplementLibraryCard />
              <FoodListCard liste="good" />
              <FoodListCard liste="bad" />
              <FoodListCard liste="proteines" />
              <FoodListCard liste="glucides" />
              <FoodListCard liste="lipides" />
              {/* Juste après les trois palettes : c'est de leurs aliments qu'on
                  ajuste la composition. */}
              <FoodMacrosCard />
              <FoodListCard liste="pref_semaine" />
              <FoodListCard liste="pref_weekend" />
            </>
          )}
          {tab === 'questionnaires' && <PainSuggestionsCard />}
          {tab === 'courriel' && (
            <>
              <SmtpCard />
              <TemplateCard kind="bilan" />
              <TemplateCard kind="nutrition" />
              <TemplateCard kind="mesures" />
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

/**
 * Mot de passe de connexion à Kinésio Pulse.
 *
 * Dépannage temporaire, le temps que Pulse garde Marie connectée : le mot de
 * passe est gardé EN CLAIR dans `kinesio.db`, pas dans keytar comme celui du
 * SMTP. La carte le dit, parce que la base part chaque jour dans OneDrive.
 *
 * Le champ arrive prérempli avec le mot de passe livré par l'app
 * (`DEFAULT_PULSE_PASSWORD`) : il sert à le remplacer, pas à l'inventer.
 */
function PulseCard() {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    pulseService
      .getPassword()
      .then(p => setValue(p ?? ''))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(t)
  }, [saved])

  return (
    <Card
      title="Mot de passe de Kinésio Pulse"
      icon={Activity}
      description="Affiché en clair sous le bouton « Pulse » de la barre latérale, avec un bouton pour le copier. L'application en livre un par défaut : ce champ sert à le remplacer si le mot de passe de Pulse change, sans attendre une mise à jour. Vider le champ revient au mot de passe livré. Gardé tel quel dans la base locale — qui part chaque jour dans la sauvegarde OneDrive."
    >
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={loading ? '' : value}
          onChange={e => setValue(e.target.value)}
          disabled={loading}
          placeholder={loading ? 'Chargement…' : 'Aucun mot de passe'}
          spellCheck={false}
          className="flex-1 min-w-0 px-3 py-2 rounded-md border border-cream-dark bg-white text-marine text-base font-mono focus:outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={() => {
            void pulseService.setPassword(value).then(() => setSaved(true))
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? <Check size={15} /> : null}
          {saved ? 'Enregistré' : 'Enregistrer'}
        </button>
      </div>
    </Card>
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

/**
 * Sauvegarde quotidienne vers OneDrive (ADR 0012).
 *
 * La date de la dernière sauvegarde est l'information qui compte : c'est elle qui
 * dit si le filet est réellement tendu. Elle est donc affichée même quand tout va
 * bien, et pas seulement en cas d'erreur.
 */
function BackupCard() {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    backupService
      .getStatus()
      .then(setStatus)
      .catch(() => setError("Impossible de lire l'état de la sauvegarde."))
  }, [])

  async function toggle(enabled: boolean) {
    setError(null)
    setSaveStatus('saving')
    try {
      await backupService.setEnabled(enabled)
      setStatus(await backupService.getStatus())
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
      setError("Le réglage n'a pas pu être enregistré.")
    }
  }

  async function runNow() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const r = await backupService.runNow()
      setStatus(await backupService.getStatus())
      setDone(`${r.clientCount} client${r.clientCount > 1 ? 's' : ''} sauvegardé${r.clientCount > 1 ? 's' : ''}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Sauvegarde automatique"
      icon={CloudUpload}
      description="Une fois par jour, tous vos dossiers clients sont écrits dans OneDrive. Si vous perdez cet ordinateur, vous pouvez les réimporter sur un autre depuis vos fichiers OneDrive."
    >
      {status === null ? (
        <p className="text-marine/40 text-base">Chargement…</p>
      ) : !status.oneDriveDetected ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            OneDrive n’a pas été trouvé sur ce PC. La sauvegarde automatique est donc inactive. Installez OneDrive,
            connectez-vous, puis redémarrez l’application.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={status.enabled}
              onChange={e => toggle(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            <span className="text-marine text-base">Sauvegarder automatiquement chaque jour</span>
            <StatusInline status={saveStatus} error={null} />
          </label>

          <div>
            <p className="text-marine/55 text-sm mb-1.5">Dossier de sauvegarde</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0 px-3 py-2 rounded-md border border-cream-dark bg-cream/40 text-marine text-sm truncate">
                {status.backupFolder}
              </div>
              <button
                type="button"
                onClick={() => backupService.openFolder().catch(() => setError("Le dossier n'a pas pu être ouvert."))}
                className="inline-flex items-center gap-2 px-4 py-2 text-marine/80 hover:text-marine font-medium border border-cream-dark hover:border-gold/60 rounded-md text-sm transition-colors"
              >
                <FolderOpen size={15} />
                Ouvrir
              </button>
            </div>
          </div>

          <p className="text-marine/65 text-base">
            {status.lastRunAt ? (
              <>
                Dernière sauvegarde : <strong className="text-marine">{formatBackupDate(status.lastRunAt)}</strong>
                {' · '}
                {status.lastClientCount} client{status.lastClientCount > 1 ? 's' : ''}
              </>
            ) : (
              <span className="text-marine/45">Aucune sauvegarde pour l’instant — elle se fera au prochain démarrage.</span>
            )}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={runNow}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
              {busy ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
            </button>
            {done && (
              <span className="inline-flex items-center gap-1.5 text-green-700 text-sm">
                <Check size={15} /> {done}
              </span>
            )}
          </div>

          <p className="text-marine/45 text-xs leading-relaxed">
            Les fichiers sont enregistrés en clair, puis synchronisés par OneDrive — donc copiés sur les serveurs de
            Microsoft, hors Québec. Sont conservées : les 7 dernières journées, plus une sauvegarde par semaine sur 8
            semaines.
          </p>
        </div>
      )}
      {error && (
        <p className="mt-4 inline-flex items-start gap-1.5 text-red-700 text-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </Card>
  )
}

/**
 * La procédure de restauration, dépliable.
 *
 * Repliée par défaut : c'est une page qu'on lit une fois dans sa vie, et
 * déployée elle noierait les réglages qu'on ouvre vraiment. Elle reprend mot pour
 * mot le `COMMENT-RESTAURER.txt` déposé dans OneDrive — l'écran sert à ce que
 * Marie sache que ce fichier existe AVANT d'en avoir besoin, le fichier sert le
 * jour où l'app n'est plus installée.
 */
function RestoreProcedure() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="bg-white border border-cream-dark rounded-xl shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full p-5 flex items-center gap-2.5 text-marine font-medium text-left hover:bg-cream/30 rounded-xl transition-colors"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <LifeBuoy size={18} className="text-gold" />
        <span className="flex-1">En cas d’urgence — comment restaurer mes clients ?</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 text-marine text-base">
          <p className="text-marine/65">
            Si votre ordinateur est perdu, volé ou en panne, vos clients sont dans OneDrive. Voici comment les
            récupérer sur un nouveau PC.
          </p>

          <ol className="space-y-3 pl-5 list-decimal">
            <li>
              <strong>Installez Kinésio Outils</strong> sur le nouveau PC depuis{' '}
              <a
                href="https://github.com/IznogoudQc/kinesio-tool/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-dark underline decoration-cream-dark underline-offset-2 hover:decoration-gold"
              >
                github.com/IznogoudQc/kinesio-tool/releases
              </a>
              . Windows affichera « Éditeur inconnu » : cliquez sur « Informations complémentaires » puis
              « Exécuter quand même ».
            </li>
            <li>
              <strong>Connectez OneDrive</strong> avec le même compte Microsoft, et attendez que la synchronisation
              soit finie — l’icône OneDrive, près de l’horloge, ne doit plus tourner.
            </li>
            <li>
              <strong>Ouvrez le dossier</strong>{' '}
              <code className="bg-cream/60 px-1.5 py-0.5 rounded text-sm">OneDrive\Kinesio-Outilsackups\</code>{' '}
              et repérez le fichier <code className="bg-cream/60 px-1.5 py-0.5 rounded text-sm">.kinesio</code> dont
              la date est la plus récente.
            </li>
            <li>
              <strong>Dans Kinésio Outils</strong>, page Clients, cliquez « Importer » en haut à droite, choisissez ce
              fichier, puis « Fusionner ». Vos clients réapparaissent avec leurs photos, bilans, mesures, notes et
              questionnaires signés.
            </li>
          </ol>

          <div className="bg-cream/40 border border-cream-dark/60 rounded-md p-3.5 text-sm text-marine/70">
            Cette même procédure est écrite dans un fichier{' '}
            <code className="bg-white px-1.5 py-0.5 rounded text-xs">COMMENT-RESTAURER.txt</code>, déposé à côté des
            sauvegardes et réécrit à chaque fois. Il s’ouvre dans le Bloc-notes, sans avoir installé quoi que ce soit —
            c’est lui qui sert le jour où l’application n’est plus là pour afficher cet écran.
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null)
              backupService.openFolder().catch(() => setError("Le dossier n'a pas pu être ouvert."))
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-marine/70 hover:text-marine underline decoration-cream-dark decoration-2 underline-offset-4 hover:decoration-gold transition-colors"
          >
            <FolderOpen size={15} />
            Ouvrir le dossier de sauvegarde maintenant
          </button>
          {error && (
            <p className="inline-flex items-start gap-1.5 text-red-700 text-sm">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/** « 18 septembre 2026 à 09:12 » — la date ET l'heure : c'est l'heure qui dit si
 *  la sauvegarde du matin est bien passée. */
function formatBackupDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
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

/**
 * Onglet « Mesures / Bilans » — un test par carte, groupées par section.
 *
 * L'ancienne version décrivait toutes les normes dans un seul paragraphe : pour
 * savoir quel barème s'applique à un test, il fallait le lire en entier, et le
 * modifier demandait de retrouver la bonne demi-phrase. Chaque test porte
 * désormais sa source, son état de validation et ses réglages propres.
 */
function BilanTestsTab() {
  return (
    <Card
      title="Mesures / Bilans"
      icon={Gauge}
      description="Chaque test avec son barème, sa source et ses réglages. L'état indique ce qui est confirmé et ce qui reste à valider avec Marie."
    >
      <TestSection
        titre="1 · Ce qui entre dans le score global"
        sous="Les cinq composantes de « Santé et condition physique globale ». Chacune est ramenée à sa cote 0-4, puis toutes comptent également."
      >
        <TestCard
          titre="Composition corporelle"
          role="IMC, tour de taille et somme des 5 plis, combinés selon les mesures disponibles."
          validationId="composition-cpafla"
        >
          <CompositionBaremes />
        </TestCard>

        <TestCard
          titre="Aptitude aérobie — VO2max"
          role="Le VO2max estimé au tapis roulant (protocole de Bruce), coté par âge et par sexe. Le score global utilise son équivalent en METS."
          validationId="aerobie-cpafla"
        >
          <AerobieBaremes />
        </TestCard>

        <TestCard
          titre="Pression artérielle"
          role="Les zones colorées du bilan et la cote 0-4 qui entre dans le score suivent le même barème."
          validationId="pa-systolique-cote"
        >
          <PaBaremes />
        </TestCard>

        <TestCard
          titre="Indice de santé du dos"
          role="Quatre mesures du tronc et de la taille, en moyenne pondérée."
          validationId="dos-musculo"
        >
          <DosBaremes />
        </TestCard>

        <TestCard
          titre="Aptitude musculosquelettique globale"
          role="Cinq tests de force, d’endurance et de souplesse, en moyenne pondérée."
          validationId="dos-musculo"
        >
          <MusculoBaremes />
        </TestCard>
      </TestSection>

      <TestSection
        titre="2 · Mesures cotées séparément"
        sous="Elles s'affichent avec leur propre barème mais n'entrent pas directement dans le score global."
      >
        <TestCard
          titre="Tour de taille"
          role="Coté seul, sur trois niveaux."
          validationId="tour-taille-autonome"
        />
        <TestCard
          titre="Pourcentage de gras"
          role="Présenté au client par une grille de risque à cinq zones, avec du risque aux deux extrémités."
          validationId="pourcentage-gras-grille"
        />
        <TestCard
          titre="IMC"
          role="Affiché seul avec les catégories de l'OMS. Il entre aussi dans la composition corporelle, mais par les tables CPAFLA, pas par celles-ci."
        >
          <p className="text-marine/55 text-sm leading-relaxed">
            Catégories OMS — indépendantes de l'âge et du sexe. Le calcul est le rapport du poids sur le carré de
            la taille.
          </p>
        </TestCard>
        <TestCard
          titre="Pression diastolique"
          role="Affichage seulement — elle n'entre dans aucun score."
          validationId="pa-diastolique-seuils"
        />
        <TestCard
          titre="Endurance du dos, saut vertical, puissance, FC repos"
          role="Quatre tests que les tables ACSM ne couvrent pas."
          validationId="hors-acsm"
        />
      </TestSection>

      <TestSection titre="3 · Document de référence" sous="À imprimer pour une séance de validation avec Marie.">
        <div className="rounded-lg border border-cream-dark bg-white p-4">
          <ExportBaremes />
        </div>
      </TestSection>
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

/**
 * Un modèle de courriel par document.
 *
 * Table plutôt que suite de `if` : à deux modèles, un booléen suffisait ; au
 * troisième, chaque ternaire aurait dû être rouvert, et il s'en trouve un pour
 * le titre, un pour la description, un pour lire, un pour écrire et un pour le
 * défaut. Ajouter un quatrième document ne demande maintenant qu'une entrée.
 */
const MODELES_COURRIEL = {
  bilan: {
    titre: "Template d'email — Bilan",
    description: "Modèle utilisé pour l'envoi du bilan. Les variables sont remplacées automatiquement.",
    lire: () => settingsService.getEmailTemplate(),
    ecrire: (t: EmailTemplate) => settingsService.setEmailTemplate(t),
    defaut: () => settingsService.getDefaultEmailTemplate()
  },
  nutrition: {
    titre: "Template d'email — Nutrition",
    description:
      "Modèle utilisé pour l'envoi du document nutrition. Les variables sont remplacées automatiquement.",
    lire: () => settingsService.getNutritionEmailTemplate(),
    ecrire: (t: EmailTemplate) => settingsService.setNutritionEmailTemplate(t),
    defaut: () => settingsService.getDefaultNutritionEmailTemplate()
  },
  mesures: {
    titre: "Template d'email — Suivi des mesures",
    description:
      "Modèle utilisé pour l'envoi du suivi des mesures. Les variables sont remplacées automatiquement.",
    lire: () => settingsService.getMesuresEmailTemplate(),
    ecrire: (t: EmailTemplate) => settingsService.setMesuresEmailTemplate(t),
    defaut: () => settingsService.getDefaultMesuresEmailTemplate()
  }
} as const

function TemplateCard({ kind }: { kind: keyof typeof MODELES_COURRIEL }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const modele = MODELES_COURRIEL[kind]

  useEffect(() => {
    MODELES_COURRIEL[kind].lire().then(t => {
      setSubject(t.subject)
      setBody(t.body)
      setLoading(false)
    })
  }, [kind])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      await modele.ecrire({ subject, body })
      setStatus('saved')
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    }
  }

  return (
    <Card title={modele.titre} icon={Mail} description={modele.description}>
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
                const d = await modele.defaut()
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
