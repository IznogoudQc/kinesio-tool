import { useEffect, useState } from 'react'
import { useUpdate } from '../contexts/UpdateContext'

export function UpdateToast() {
  const { status, latestVersion, quitAndInstall } = useUpdate()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (status === 'downloaded' && !dismissed) {
      setVisible(true)
    }
  }, [status, dismissed])

  if (!visible) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 bg-marine border border-marine-light/40 rounded-lg px-5 py-4 shadow-2xl w-72">
      <p className="text-cream text-sm font-medium mb-1">
        Mise à jour prête&nbsp;(v{latestVersion})
      </p>
      <p className="text-cream/60 text-xs mb-3">
        Redémarrez pour installer la nouvelle version.
      </p>
      <div className="flex gap-2">
        <button
          onClick={quitAndInstall}
          className="flex-1 bg-gold text-marine text-xs font-semibold py-1.5 px-3 rounded hover:bg-gold-light transition-colors"
        >
          Redémarrer
        </button>
        <button
          onClick={() => { setVisible(false); setDismissed(true) }}
          className="flex-1 text-cream/60 text-xs py-1.5 px-3 rounded border border-marine-light/40 hover:text-cream/90 transition-colors"
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}
