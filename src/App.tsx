import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ClientsPage } from './pages/ClientsPage'
import { UpdateProvider } from './contexts/UpdateContext'
import { UpdateToast } from './components/UpdateToast'

const PAGE_TITLES: Record<string, string> = {
  clients: 'Clients'
}

const PAGES: Record<string, React.ComponentType> = {
  clients: ClientsPage
}

export function App() {
  const [activePage, setActivePage] = useState('clients')
  const PageComponent = PAGES[activePage] ?? ClientsPage
  const title = PAGE_TITLES[activePage] ?? ''

  return (
    <UpdateProvider>
      <div className="flex h-screen bg-cream overflow-hidden">
        <Sidebar activeItem={activePage} onNavChange={setActivePage} />
        <div className="flex flex-col flex-1 min-w-0">
          <Header title={title} />
          <main className="flex-1 overflow-auto bg-cream">
            <PageComponent />
          </main>
        </div>
      </div>
      <UpdateToast />
    </UpdateProvider>
  )
}
