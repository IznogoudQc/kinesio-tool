import { useCallback, useEffect, useState } from 'react'
import { createHashRouter, Navigate, Outlet, RouterProvider, useMatch, useSearchParams } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ClientsPage } from './pages/ClientsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ReportPage } from './pages/ReportPage'
import { BaremesPage } from './pages/BaremesPage'
import { QaapPrintPage } from './pages/QaapPrintPage'
import { ClientDetailLayout } from './pages/client/ClientDetailLayout'
import { DashboardLayout } from './pages/client/dashboard/DashboardLayout'
import { MesuresOverview } from './pages/client/dashboard/MesuresOverview'
import { BilanOverview } from './pages/client/dashboard/BilanOverview'
import { BilansTab } from './pages/client/tabs/BilansTab'
import { BilanDetailTab } from './pages/client/tabs/BilanDetailTab'
import { MesuresTab } from './pages/client/tabs/MesuresTab'
import { NutritionTab } from './pages/client/tabs/NutritionTab'
import { NotesTab } from './pages/client/tabs/NotesTab'
import { QuestionnairesTab } from './pages/client/tabs/QuestionnairesTab'
import { UpdateProvider } from './contexts/UpdateContext'
import { UpdateToast } from './components/UpdateToast'
import foret from './assets/foret.webp'

const SIDEBAR_STORAGE_KEY = 'sidebar.collapsed'

/**
 * Fond de forêt du volet principal.
 *
 * Trois couches empilées, la première étant la plus haute : un voile crème qui
 * va d'opaque à gauche (28 %) à translucide à droite (77 %), un second voile qui
 * ferme le haut, puis la photo. La lecture se fait à gauche, donc c'est là que
 * le fond s'efface complètement ; la forêt ne respire que dans la marge droite.
 *
 * Posé sur le conteneur qui NE défile PAS (le parent de `<main>`), et non sur
 * `<main>` lui-même : la photo reste ainsi immobile quand le contenu défile,
 * sans recourir à `background-attachment: fixed`, capricieux dans Chromium.
 */
const VOILE_CREME = 'linear-gradient(to right, #f5f1e8 0%, #f5f1e8 28%, rgba(245,241,232,.98) 38%, rgba(245,241,232,.88) 58%, rgba(245,241,232,.77) 100%)'
const VOILE_HAUT = 'linear-gradient(to bottom, #f5f1e8 0%, rgba(245,241,232,0) 25%)'

const fondForet: React.CSSProperties = {
  backgroundImage: `${VOILE_CREME}, ${VOILE_HAUT}, url(${foret})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center, right top, right center',
  backgroundRepeat: 'no-repeat'
}

function readInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function AppShell() {
  const [collapsed, setCollapsed] = useState<boolean>(readInitialCollapsed)
  const isClientsList = useMatch('/clients')
  const isSettings = useMatch('/settings')
  const [searchParams] = useSearchParams()
  const printMode = searchParams.get('print') === '1'

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed(c => !c), [])

  if (printMode) {
    return (
      <div className="min-h-screen bg-cream">
        <Outlet context={{ printMode: true }} />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex flex-col flex-1 min-w-0" style={fondForet}>
        {isClientsList && <Header title="Clients" />}
        {isSettings && <Header title="Paramètres" />}
        {/* Plus de `bg-cream` ici : `<main>` doit laisser voir le fond du parent. */}
        <main className="flex-1 overflow-auto">
          <Outlet context={{ printMode: false }} />
        </main>
      </div>
    </div>
  )
}

// Data router (`createHashRouter`) plutôt que `<HashRouter><Routes>` : requis pour
// `useBlocker` (garde « modifications non enregistrées », cf. MesuresTab).
const router = createHashRouter([
  // Routes dédiées à la génération PDF — layout autonome, sans le shell de l'app.
  { path: '/report/:id', element: <ReportPage /> },
  { path: '/baremes', element: <BaremesPage /> },
  { path: '/qaap/:id', element: <QaapPrintPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/clients" replace /> },
      { path: '/clients', element: <ClientsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      {
        path: '/clients/:id',
        element: <ClientDetailLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          {
            path: 'dashboard',
            element: <DashboardLayout />,
            children: [
              { index: true, element: <MesuresOverview /> },
              { path: 'mesures', element: <MesuresOverview /> },
              { path: 'bilan', element: <BilanOverview /> }
            ]
          },
          { path: 'bilans', element: <BilansTab /> },
          { path: 'bilans/:bilanId', element: <BilanDetailTab /> },
          { path: 'mesures', element: <MesuresTab /> },
          { path: 'nutrition', element: <NutritionTab /> },
          { path: 'questionnaires', element: <QuestionnairesTab /> },
          { path: 'notes', element: <NotesTab /> }
        ]
      },
      { path: '*', element: <Navigate to="/clients" replace /> }
    ]
  }
])

export function App() {
  return (
    <UpdateProvider>
      <RouterProvider router={router} />
      <UpdateToast />
    </UpdateProvider>
  )
}
