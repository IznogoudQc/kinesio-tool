import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloaded' | 'error'

interface UpdateContextValue {
  currentVersion: string
  latestVersion: string | null
  status: UpdateStatus
  errorMessage: string | null
  quitAndInstall: () => void
}

const UpdateContext = createContext<UpdateContextValue>({
  currentVersion: '',
  latestVersion: null,
  status: 'idle',
  errorMessage: null,
  quitAndInstall: () => {}
})

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState('')
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    window.api.app.getVersion().then(setCurrentVersion)

    window.api.update.onChecking(() => setStatus('checking'))
    window.api.update.onAvailable(({ version }) => {
      setLatestVersion(version)
      setStatus('available')
    })
    window.api.update.onNotAvailable(() => setStatus('not-available'))
    window.api.update.onDownloaded(({ version }) => {
      setLatestVersion(version)
      setStatus('downloaded')
    })
    window.api.update.onError(({ message }) => {
      setErrorMessage(message)
      setStatus('error')
    })
  }, [])

  const quitAndInstall = useCallback(() => {
    window.api.update.quitAndInstall()
  }, [])

  return (
    <UpdateContext.Provider value={{ currentVersion, latestVersion, status, errorMessage, quitAndInstall }}>
      {children}
    </UpdateContext.Provider>
  )
}

export function useUpdate() {
  return useContext(UpdateContext)
}
