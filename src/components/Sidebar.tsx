import { Menu, Settings, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUpdate } from '../contexts/UpdateContext'
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

function navLinkClass(collapsed: boolean) {
  return ({ isActive }: { isActive: boolean }) =>
    [
      'w-full flex items-center transition-colors text-left font-medium px-4 py-3',
      collapsed ? '' : 'gap-3 text-base',
      isActive
        ? 'bg-gold/15 text-cream border-r-2 border-gold'
        : 'text-cream/60 hover:bg-marine-light/60 hover:text-cream/90'
    ].join(' ')
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
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
