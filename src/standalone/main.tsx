import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/main.css'
import './editorial.css'
import { EditorialReport, type StandaloneData } from './EditorialReport'

/** Le processus principal remplace le jeton `<!--REPORT_DATA-->` du gabarit par
 *  les données du client avant d'écrire le fichier. */
declare global {
  interface Window {
    __REPORT_DATA__?: StandaloneData
  }
}

const data = window.__REPORT_DATA__

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {data ? (
      <EditorialReport data={data} />
    ) : (
      <p style={{ padding: 32, fontFamily: 'system-ui' }}>
        Aucune donnée. Ce gabarit est rempli à la génération du document.
      </p>
    )}
  </StrictMode>
)
