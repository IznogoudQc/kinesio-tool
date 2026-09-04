import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/main.css'
import './editorial.css'
import { EditorialReport, FoodJournal, NutritionDocument, type StandaloneData } from './EditorialReport'
import { MesuresDocument } from './MesuresDocument'

/** Le processus principal remplace le jeton `<!--REPORT_DATA-->` du gabarit par
 *  les données du client avant d'écrire le fichier. */
declare global {
  interface Window {
    __REPORT_DATA__?: StandaloneData
  }
}

const data = window.__REPORT_DATA__

/**
 * Le titre de l'onglet — et l'en-tête de page à l'impression.
 *
 * Le gabarit est commun aux quatre documents : sans cette ligne, un suivi de
 * mesures s'imprimait sous le titre « Bilan de forme physique ».
 */
const TITRES: Record<string, string> = {
  report: 'Bilan de forme physique',
  nutrition: 'Plan nutrition',
  foodlog: 'Journal alimentaire',
  mesures: 'Suivi des mesures'
}
if (data) {
  const titre = TITRES[data.docType ?? 'report'] ?? TITRES.report
  document.title = `${titre} — ${data.client.name}`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {data ? (
      data.docType === 'foodlog' ? (
        <FoodJournal data={data} />
      ) : data.docType === 'mesures' ? (
        <MesuresDocument data={data} />
      ) : data.docType === 'nutrition' ? (
        <NutritionDocument data={data} />
      ) : (
        <EditorialReport data={data} />
      )
    ) : (
      <p style={{ padding: 32, fontFamily: 'system-ui' }}>
        Aucune donnée. Ce gabarit est rempli à la génération du document.
      </p>
    )}
  </StrictMode>
)
