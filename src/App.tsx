import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useMatch, useSearchParams } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ClientsPage } from './pages/ClientsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ClientDetailLayout } from './pages/client/ClientDetailLayout'
import { DashboardTab } from './pages/client/tabs/DashboardTab'
import { BilansTab } from './pages/client/tabs/BilansTab'
import { BilanDetailTab } from './pages/client/tabs/BilanDetailTab'
import { PlaceholderTab } from './pages/client/tabs/PlaceholderTab'
import { UpdateProvider } from './contexts/UpdateContext'
import { UpdateToast } from './components/UpdateToast'

const SIDEBAR_STORAGE_KEY = 'sidebar.collapsed'

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
      <div className="flex flex-col flex-1 min-w-0">
        {isClientsList && <Header title="Clients" />}
        {isSettings && <Header title="Paramètres" />}
        <main className="flex-1 overflow-auto bg-cream">
          <Outlet context={{ printMode: false }} />
        </main>
      </div>
    </div>
  )
}

export function App() {
  return (
    <UpdateProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/clients" replace />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/clients/:id" element={<ClientDetailLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardTab />} />
              <Route path="bilans" element={<BilansTab />} />
              <Route path="bilans/:bilanId" element={<BilanDetailTab />} />
              <Route path="mesures" element={<PlaceholderTab title="Mesures" />} />
              <Route path="notes" element={<PlaceholderTab title="Notes" />} />
              <Route path="historique" element={<PlaceholderTab title="Historique" />} />
            </Route>
            <Route path="*" element={<Navigate to="/clients" replace />} />
          </Route>
        </Routes>
      </HashRouter>
      <UpdateToast />
    </UpdateProvider>
  )
}
