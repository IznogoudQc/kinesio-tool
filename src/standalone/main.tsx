import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/main.css'
import { StandaloneReport, type StandaloneData } from './StandaloneReport'

/** Le processus principal remplace ce jeton par les données du client avant
 *  d'écrire le fichier. En dev (`npm run dev:standalone`), il reste tel quel. */
declare global {
  interface Window {
    __REPORT_DATA__?: StandaloneData
  }
}

const data = window.__REPORT_DATA__

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {data ? (
      <StandaloneReport data={data} />
    ) : (
      <p style={{ padding: 32, fontFamily: 'system-ui' }}>
        Aucune donnée. Ce gabarit est rempli à la génération du document.
      </p>
    )}
  </StrictMode>
)
