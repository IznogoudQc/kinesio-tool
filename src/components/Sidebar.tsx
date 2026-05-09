import { Users } from 'lucide-react'
import { useUpdate } from '../contexts/UpdateContext'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'clients', label: 'Clients', icon: Users }
]

interface SidebarProps {
  activeItem: string
  onNavChange: (id: string) => void
}

function VersionBadge() {
  const { currentVersion, latestVersion, status, errorMessage, quitAndInstall } = useUpdate()

  if (status === 'downloaded') {
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

  if (status === 'available') {
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

export function Sidebar({ activeItem, onNavChange }: SidebarProps) {
  return (
    <aside className="w-60 bg-marine flex flex-col h-full shrink-0">
      <div className="px-6 py-5 border-b border-marine-light/40">
        <span className="text-cream font-semibold text-base tracking-wide leading-tight">
          Kinésio Outils
        </span>
      </div>

      <nav className="flex-1 py-3">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeItem === id
          return (
            <button
              key={id}
              onClick={() => onNavChange(id)}
              className={[
                'w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors text-left',
                isActive
                  ? 'bg-gold/15 text-cream border-r-2 border-gold'
                  : 'text-cream/60 hover:bg-marine-light/60 hover:text-cream/90'
              ].join(' ')}
            >
              <Icon size={17} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-marine-light/40">
        <VersionBadge />
      </div>
    </aside>
  )
}
