import { useEffect, useState } from 'react'
import { Activity, Check, Copy, Menu, Settings, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUpdate } from '../contexts/UpdateContext'
import { pulseService } from '../services/pulse'
import iconLogo from '../assets/icon.png'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  matchPrefix?: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/clients', label: 'Clients', icon: Users, matchPrefix: '/clients' }
]

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { to: '/settings', label: 'Paramètres', icon: Settings, matchPrefix: '/settings' }
]

/** L'habillage d'une entrée de menu. Extrait de `navLinkClass` pour que le
 *  bouton Pulse — un `<button>`, pas un `NavLink` — le partage vraiment plutôt
 *  que d'en garder une copie qui divergerait au premier changement de style. */
function navItemClass(collapsed: boolean, isActive: boolean) {
  return [
    'w-full flex items-center transition-colors text-left font-medium px-4 py-3',
    collapsed ? '' : 'gap-3 text-base',
    isActive
      ? 'bg-gold/15 text-cream border-r-2 border-gold'
      : 'text-cream/60 hover:bg-marine-light/60 hover:text-cream/90'
  ].join(' ')
}

function navLinkClass(collapsed: boolean) {
  return ({ isActive }: { isActive: boolean }) => navItemClass(collapsed, isActive)
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

/**
 * Effet — l'app web des programmes d'entraînement. Application séparée, donc
 * pas une route react-router : un `<button>` qui ouvre le navigateur par
 * défaut, habillé comme ses voisins mais sans état actif, jamais « courant ».
 */
function PulseButton({ collapsed }: { collapsed: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Relu à chaque changement depuis Paramètres, sinon la barre afficherait
  // l'ancien mot de passe tant que Marie ne change pas de page.
  useEffect(() => {
    const lire = () => {
      pulseService
        .getPassword()
        .then(setPassword)
        .catch(() => setPassword(null))
    }
    lire()
    return pulseService.onPasswordChanged(lire)
  }, [])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <>
      <button
        onClick={() => {
          setError(null)
          // N'échoue que si l'adresse configurée n'est plus une https vers un
          // hôte connu — le handler refuse alors d'ouvrir quoi que ce soit.
          pulseService.open().catch(() => setError("Effet n'a pas pu être ouvert."))
        }}
        title={collapsed ? (error ?? 'Effet') : undefined}
        className={navItemClass(collapsed, false)}
      >
        <Activity size={20} />
        {!collapsed && <span>Effet</span>}
      </button>

      {/* Le mot de passe de connexion, en clair, pour le recopier dans le
          navigateur. Rien en mode replié : seize pixels de large ne montrent
          pas un mot de passe, et un bouton Copier seul serait indevinable. */}
      {!collapsed && password && (
        <div className="px-4 pb-3 -mt-1 flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate font-mono text-xs text-cream/70 select-text">
            {password}
          </span>
          <button
            type="button"
            onClick={() => {
              pulseService
                .copyPassword()
                .then(ok => setCopied(ok))
                .catch(() => setCopied(false))
            }}
            title="Copier le mot de passe"
            aria-label="Copier le mot de passe"
            className="shrink-0 text-cream/50 hover:text-cream hover:bg-marine-light/60 rounded p-1 transition-colors"
          >
            {copied ? <Check size={14} className="text-gold" /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {!collapsed && error && <p className="px-4 pb-2 text-xs text-red-400/80">{error}</p>}
    </>
  )
}

function VersionBadge({ collapsed }: { collapsed: boolean }) {
  const { currentVersion, latestVersion, status, errorMessage, quitAndInstall } = useUpdate()

  if (status === 'downloaded') {
    if (collapsed) {
      return (
        <button
          onClick={quitAndInstall}
          className="text-gold text-xs animate-pulse cursor-pointer hover:text-gold-light transition-colors"
          title={`Cliquer pour redémarrer et installer v${latestVersion}`}
        >
          v{latestVersion}
        </button>
      )
    }
    return (
      <button
        onClick={quitAndInstall}
        className="text-gold text-xs animate-pulse cursor-pointer hover:text-gold-light transition-colors text-left"
        title={`Cliquer pour redémarrer et installer v${latestVersion}`}
      >
        Redémarrer pour installer v{latestVersion}
      </button>
    )
  }

  if (status === 'available' && !collapsed) {
    return (
      <span className="text-gold text-xs">
        v{currentVersion} → v{latestVersion} disponible
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span
        className="text-red-400/60 text-xs cursor-default"
        title={errorMessage ?? 'Erreur de mise à jour'}
      >
        v{currentVersion}
      </span>
    )
  }

  return (
    <span className="text-cream/40 text-xs">
      v{currentVersion}
    </span>
  )
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={[
        'bg-marine flex flex-col h-full shrink-0 transition-[width] duration-200 ease-out rounded-tr-2xl',
        collapsed ? 'w-16' : 'w-60'
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center border-b border-marine-light/40 h-14',
          collapsed ? 'justify-center' : 'justify-between px-4'
        ].join(' ')}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <img src={iconLogo} alt="" className="h-7 w-7 shrink-0" />
            <span className="text-cream font-semibold text-base truncate">Kinésio Outils</span>
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Ouvrir le menu' : 'Replier le menu'}
          aria-label={collapsed ? 'Ouvrir le menu' : 'Replier le menu'}
          className="text-cream/70 hover:text-cream hover:bg-marine-light/60 rounded-md p-1.5 transition-colors shrink-0"
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="flex flex-col flex-1 py-3 min-h-0">
        <div>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={navLinkClass(collapsed)}
            >
              <Icon size={20} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto">
          <PulseButton collapsed={collapsed} />

          {BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={navLinkClass(collapsed)}
            >
              <Icon size={20} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      <div
        className={[
          'border-t border-marine-light/40 flex',
          collapsed ? 'justify-center px-2 py-3' : 'px-5 py-4'
        ].join(' ')}
      >
        <VersionBadge collapsed={collapsed} />
      </div>
    </aside>
  )
}
