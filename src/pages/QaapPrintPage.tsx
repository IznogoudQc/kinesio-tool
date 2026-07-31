import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { clientsService } from '../services/clients'
import { questionnairesService } from '../services/questionnaires'
import {
  QAAP_QUESTIONS,
  QAAP_VALIDITY_MONTHS,
  qaapExpiryDate,
  qaapHasWarning,
  qaapIsSigned,
  qaapSignatureStale,
  qaapYesIndices,
  type QaapData
} from '../lib/qaap'
import logo from '../assets/logo-conseil.png'
import '../print.css'

const MARINE = '#0a1c5e'
const GOLD = '#b8834a'
const INK_SOFT = '#5b6178'
const GRID = '#ddd6c8'
const CREAM = '#f6f1e8'

/**
 * Q-AAP imprimable — le formulaire tel que le client l'a rempli et signé.
 *
 * Rendu dans une fenêtre cachée puis converti en PDF (`generateQaapPdf`). Une
 * signature qui ne peut pas être produite hors de l'application ne sert à rien :
 * c'est justement en cas de contestation qu'il faut sortir le document.
 *
 * Le document dit ce qui s'est passé, sans arrangement : si des réponses ont été
 * modifiées après la signature, il le mentionne au lieu de laisser croire que le
 * client a attesté le contenu affiché.
 */
export function QaapPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<QaapData | null>(null)
  const [meta, setMeta] = useState<{ clientName: string; birthdate: string | null; date: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    async function charger() {
      if (!id) {
        setError('Questionnaire introuvable.')
        return
      }
      try {
        const q = await questionnairesService.getById(id)
        if (!q) {
          setError('Questionnaire introuvable.')
          return
        }
        const clients = await clientsService.list()
        const c = clients.find(x => x.id === q.clientId) ?? null
        if (annule) return
        setData(JSON.parse(String(q.data)) as QaapData)
        setMeta({ clientName: c?.name ?? '—', birthdate: c?.birthdate ?? null, date: q.date })
      } catch (e) {
        if (!annule) setError(e instanceof Error ? e.message : 'Lecture impossible.')
      }
    }
    void charger()
    return () => {
      annule = true
    }
  }, [id])

  // Signale au générateur que la page est prête à être imprimée.
  useEffect(() => {
    if (data === null && error === null) return
    const t = setTimeout(() => {
      ;(window as unknown as { __REPORT_READY__?: boolean }).__REPORT_READY__ = true
    }, 120)
    return () => clearTimeout(t)
  }, [data, error])

  if (error) {
    return <div className="report-body" style={{ padding: '20mm', color: '#b91c1c' }}>{error}</div>
  }
  if (!data || !meta) {
    return <div className="report-body" style={{ padding: '20mm', color: MARINE }}>Préparation du document…</div>
  }

  const oui = qaapYesIndices(data)
  const avertissement = qaapHasWarning(data)
  const signe = qaapIsSigned(data)
  const caduque = qaapSignatureStale(data)
  const expiration = qaapExpiryDate(meta.date)
  const dateLongue = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <article className="report-body" style={{ color: MARINE, background: '#fff' }}>
      <section className="report-page" style={{ width: '210mm', padding: '0 16mm', boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8mm' }}>
          <img src={logo} alt="Kinésio Conseil" style={{ height: '14mm', width: 'auto' }} />
          <p style={{ fontSize: '8.5pt', letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>
            Q-AAP · Aptitude à l'activité physique
          </p>
        </header>

        <h1 className="report-display" style={{ fontSize: '24pt', fontWeight: 600, lineHeight: 1.1, marginBottom: '2mm' }}>
          Questionnaire sur l'aptitude à l'activité physique
        </h1>
        <p style={{ fontSize: '9.5pt', color: INK_SOFT, marginBottom: '7mm' }}>
          Version SCPE révisée 2002 · pour les personnes de 15 à 69 ans
        </p>

        <div
          style={{
            background: CREAM,
            borderRadius: '3mm',
            padding: '4mm 6mm',
            marginBottom: '7mm',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8mm',
            fontSize: '10pt'
          }}
        >
          <span>
            <span style={{ color: INK_SOFT }}>Nom </span>
            <strong>{meta.clientName}</strong>
          </span>
          {meta.birthdate && (
            <span>
              <span style={{ color: INK_SOFT }}>Naissance </span>
              <strong>{dateLongue(meta.birthdate)}</strong>
            </span>
          )}
          <span>
            <span style={{ color: INK_SOFT }}>Rempli le </span>
            <strong>{dateLongue(meta.date)}</strong>
          </span>
          {expiration && (
            <span>
              <span style={{ color: INK_SOFT }}>Valide jusqu'au </span>
              <strong>{dateLongue(expiration)}</strong>
            </span>
          )}
        </div>

        <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
          {QAAP_QUESTIONS.map((q, i) => {
            const rep = data.answers[i]
            return (
              <li
                key={i}
                className="break-inside-avoid"
                style={{ display: 'flex', gap: '4mm', padding: '2.5mm 0', borderBottom: `0.2mm solid ${GRID}`, fontSize: '10pt' }}
              >
                <span style={{ color: GOLD, fontWeight: 700, width: '6mm', flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ flex: 1, lineHeight: 1.45 }}>{q}</span>
                <span
                  style={{
                    width: '18mm',
                    textAlign: 'right',
                    flexShrink: 0,
                    fontWeight: 700,
                    color: rep === true ? '#b45309' : rep === false ? MARINE : INK_SOFT
                  }}
                >
                  {rep === true ? 'OUI' : rep === false ? 'NON' : '—'}
                </span>
              </li>
            )
          })}
        </ol>

        {avertissement && (
          <div
            className="break-inside-avoid"
            style={{ marginTop: '6mm', border: '0.3mm solid #d97706', background: '#fffbeb', borderRadius: '3mm', padding: '4mm 6mm' }}
          >
            <p style={{ fontSize: '10pt', fontWeight: 700, color: '#92400e', marginBottom: '1.5mm' }}>
              Réponse « OUI » à la question {oui.join(', ')}
            </p>
            <p style={{ fontSize: '9.5pt', color: '#92400e', lineHeight: 1.5 }}>
              Consultez votre médecin AVANT d'entreprendre ou d'augmenter votre pratique d'activité physique,
              et précisez-lui à quelles questions vous avez répondu « OUI ».
            </p>
          </div>
        )}

        {data.precision?.trim() && (
          <div className="break-inside-avoid" style={{ marginTop: '6mm' }}>
            <p style={{ fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, fontWeight: 700, marginBottom: '1.5mm' }}>
              Précisions
            </p>
            <p style={{ fontSize: '10pt', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{data.precision}</p>
          </div>
        )}

        {/* ── Attestation ───────────────────────────────────────────────── */}
        <div className="break-inside-avoid" style={{ marginTop: '8mm', borderTop: `0.4mm solid ${GRID}`, paddingTop: '5mm' }}>
          <p style={{ fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.1em', color: GOLD, fontWeight: 700, marginBottom: '2mm' }}>
            Attestation
          </p>
          <p style={{ fontSize: '10pt', lineHeight: 1.5, marginBottom: '4mm' }}>
            « J'atteste avoir lu, compris et rempli ce questionnaire à ma satisfaction, et avoir répondu
            honnêtement à chacune des sept questions. »
          </p>

          {signe ? (
            <>
              <img
                src={data.signature!.dataUrl}
                alt={`Signature de ${data.signature!.signerName}`}
                style={{ height: '18mm', display: 'block' }}
              />
              <div style={{ borderTop: `0.3mm solid ${MARINE}`, width: '80mm', marginTop: '1mm', paddingTop: '1.5mm' }}>
                <p style={{ fontSize: '10pt', fontWeight: 600 }}>{data.signature!.signerName}</p>
                <p style={{ fontSize: '8.5pt', color: INK_SOFT }}>
                  Signé le{' '}
                  {new Date(data.signature!.signedAt).toLocaleString('fr-CA', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              {caduque && (
                // Le document ne masque pas ce défaut : il vaut mieux un document
                // qui dit « attention » qu'un document qui laisse croire.
                <p style={{ fontSize: '9pt', color: '#b45309', marginTop: '3mm', lineHeight: 1.45 }}>
                  <strong>Attention :</strong> des réponses ont été modifiées après cette signature. Elle
                  n'atteste donc pas le contenu ci-dessus.
                </p>
              )}
            </>
          ) : (
            <div style={{ marginTop: '10mm' }}>
              <div style={{ borderTop: `0.3mm solid ${MARINE}`, width: '80mm', paddingTop: '1.5mm' }}>
                <p style={{ fontSize: '9pt', color: INK_SOFT }}>Signature du client · date</p>
              </div>
              <p style={{ fontSize: '9pt', color: INK_SOFT, marginTop: '3mm' }}>
                Ce questionnaire n'a pas été signé dans l'application.
              </p>
            </div>
          )}
        </div>

        <p style={{ marginTop: '10mm', paddingTop: '4mm', borderTop: `0.2mm solid ${GRID}`, fontSize: '8pt', color: INK_SOFT, lineHeight: 1.45 }}>
          Le Q-AAP est valide {QAAP_VALIDITY_MONTHS} mois à compter de la date de passation, ou moins si
          l'état de santé change. Source : Société canadienne de physiologie de l'exercice (SCPE),
          version révisée 2002.
        </p>
      </section>
    </article>
  )
}
