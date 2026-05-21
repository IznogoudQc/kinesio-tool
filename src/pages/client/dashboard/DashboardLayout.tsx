import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bot, ClipboardList, Ruler } from 'lucide-react'
import { useClient, useClientOutletContext } from '../ClientDetailLayout'
import { bilansService } from '../../../services/bilans'
import { mesuresService } from '../../../services/mesures'
import { AIAdviceProvider, useAIAdvice } from '../../../contexts/AIAdviceContext'
import { AIAdvicePanel } from './AIAdvicePanel'

/** Clé localStorage du dernier sous-onglet visité, par client.
 *  Permet à Marie-Eve d'atterrir directement sur le bon sous-onglet quand elle
 *  revient sur un client (par ex. quelqu'un en suivi mesures fréquent → mesures). */
function storageKey(clientId: string): string {
  return `dashboard.subtab.${clientId}`
}

type SubTab = 'mesures' | 'bilan'

function readPreference(clientId: string): SubTab {
  if (typeof window === 'undefined') return 'mesures'
  const v = window.localStorage.getItem(storageKey(clientId))
  return v === 'bilan' ? 'bilan' : 'mesures'
}

/** Layout wrapper du Dashboard : ajoute une nav de sous-onglets (Mesures / Bilan)
 *  sous le header client, et expose le contexte client aux sous-routes via
 *  `<Outlet />`. Les compteurs (N) à côté du nom indiquent le nombre de sessions.
 */
export function DashboardLayout() {
  // Le provider IA enveloppe tout le contenu du Dashboard pour que les cards
  // (MesuresOverview, BilanOverview, etc.) puissent consulter le mode de
  // sélection via `useAIAdvice()`. La logique métier (toggle, FAB, modals)
  // vit dans un composant interne pour avoir accès au contexte.
  return (
    <AIAdviceProvider>
      <DashboardLayoutInner />
    </AIAdviceProvider>
  )
}

function DashboardLayoutInner() {
  const client = useClient()
  const ai = useAIAdvice()
  // On récupère le contexte parent tel quel pour le re-forwarder via <Outlet />.
  // Sans ça, `useClient()` retourne `undefined` dans MesuresOverview / BilanOverview.
  const parentContext = useClientOutletContext()
  const navigate = useNavigate()
  const location = useLocation()

  const [bilansCount, setBilansCount] = useState<number | null>(null)
  const [circCount, setCircCount] = useState<number | null>(null)
  const [plisCount, setPlisCount] = useState<number | null>(null)

  // Index route → on redirige selon la préférence localStorage (mesures par
  // défaut, qui correspond à la fréquence de saisie la plus élevée).
  useEffect(() => {
    if (location.pathname.endsWith('/dashboard') || location.pathname.endsWith('/dashboard/')) {
      const preferred = readPreference(client.id)
      navigate(preferred, { replace: true })
    }
  }, [location.pathname, client.id, navigate])

  // Charge les compteurs une seule fois par client (l'overlay des pills mute peu).
  useEffect(() => {
    let cancelled = false
    Promise.all([
      bilansService.list(client.id),
      mesuresService.circonferences.list(client.id),
      mesuresService.plis.list(client.id)
    ])
      .then(([bilans, circ, plis]) => {
        if (cancelled) return
        setBilansCount(bilans.length)
        setCircCount(circ.length)
        setPlisCount(plis.length)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [client.id])

  // Le compteur Mesures = somme des sessions (circ + plis) — chaque type est une
  // « session » de saisie côté Marie-Eve.
  const mesuresTotal = useMemo(() => {
    if (circCount === null && plisCount === null) return null
    return (circCount ?? 0) + (plisCount ?? 0)
  }, [circCount, plisCount])

  // Mémorise le sous-onglet courant à chaque visite pour la prochaine fois.
  useEffect(() => {
    const m = /\/dashboard\/(mesures|bilan)\b/.exec(location.pathname)
    if (m && (m[1] === 'mesures' || m[1] === 'bilan')) {
      try {
        window.localStorage.setItem(storageKey(client.id), m[1])
      } catch {
        // ignore
      }
    }
  }, [location.pathname, client.id])

  return (
    <div className="bg-cream">
      <nav className="bg-white border-b border-cream-dark/40 px-6 lg:px-8 py-2.5 flex items-center gap-1 sticky top-0 z-10">
        <SubTabPill to="mesures" icon={Ruler} label="Mesures" count={mesuresTotal} emphasis />
        <SubTabPill to="bilan" icon={ClipboardList} label="Bilan complet" count={bilansCount} />
        <button
          type="button"
          onClick={ai.toggleMode}
          title="Activer la sélection multi-métriques pour générer des conseils IA croisés"
          className={[
            'ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border',
            ai.mode
              ? 'bg-gold text-marine border-gold shadow-sm'
              : 'bg-white text-marine/65 border-cream-dark hover:border-gold/60 hover:text-marine'
          ].join(' ')}
        >
          <Bot size={15} />
          <span>{ai.mode ? 'Quitter le mode IA' : 'Mode conseils IA'}</span>
        </button>
      </nav>

      {/* Bandeau d'aide visible quand le mode IA est actif. */}
      {ai.mode && (
        <div className="bg-gold/15 border-b border-gold/30 px-6 lg:px-8 py-2 text-marine/75 text-sm">
          <Bot size={14} className="inline -mt-0.5 mr-1.5 text-gold-dark" />
          Cochez les métriques à analyser ensemble — l'IA proposera un programme intégré.
        </div>
      )}

      <Outlet context={parentContext} />

      <AIAdvicePanel client={client} />
    </div>
  )
}

interface SubTabPillProps {
  to: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  /** `null` = en cours de chargement, `0` = pill grisé mais cliquable. */
  count: number | null
  /** Marque le pill « par défaut » pour Marie-Eve (visuel discret). */
  emphasis?: boolean
}

function SubTabPill({ to, icon: Icon, label, count }: SubTabPillProps) {
  const isEmpty = count === 0
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          isActive
            ? 'bg-marine text-cream shadow-sm'
            : isEmpty
              ? 'text-marine/40 hover:text-marine/65 hover:bg-cream/60'
              : 'text-marine/65 hover:text-marine hover:bg-cream/60'
        ].join(' ')
      }
    >
      <Icon size={15} />
      <span>{label}</span>
      {count !== null && (
        <span className="text-xs opacity-75 tabular-nums">({count})</span>
      )}
    </NavLink>
  )
}
