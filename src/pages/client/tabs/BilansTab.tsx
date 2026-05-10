import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Eraser, FileUp, Loader2, PencilLine, Trash2 } from 'lucide-react'
import { useClient } from '../ClientDetailLayout'
import { bilansService } from '../../../services/bilans'
import { ImportBilanModal } from '../ImportBilanModal'
import { DedupeBilansModal } from '../DedupeBilansModal'
import { formatBilanDate } from '../bilanFields'

interface PendingImport {
  fileName: string
  result: ImportBilanResult
}

export function BilansTab() {
  const client = useClient()
  const navigate = useNavigate()
  const [list, setList] = useState<Bilan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [deleting, setDeleting] = useState<Bilan | null>(null)
  const [showDedupe, setShowDedupe] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await bilansService.list(client.id))
    } catch {
      setError('Impossible de charger les bilans.')
    } finally {
      setLoading(false)
    }
  }, [client.id])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const hasDuplicates = useMemo(() => {
    const seen = new Set<string>()
    for (const b of list) {
      if (seen.has(b.date)) return true
      seen.add(b.date)
    }
    return false
  }, [list])

  async function handleImport() {
    setError(null)
    let picked: PickedDocx
    try {
      picked = await bilansService.pickDocxFile()
    } catch {
      setError('Impossible d\'ouvrir le sélecteur de fichier.')
      return
    }
    if (picked.canceled || !picked.filePath) return

    setImporting(true)
    try {
      const result = await bilansService.import_docx(client.id, picked.filePath)
      setPending({ fileName: picked.fileName ?? 'bilan', result })
    } catch (err) {
      setError(cleanIpcError(err, 'Le document n\'a pas pu être analysé.'))
    } finally {
      setImporting(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const dateLabel = formatBilanDate(deleting.date)
    try {
      await bilansService.delete(deleting.id)
      setDeleting(null)
      setToast(`Bilan du ${dateLabel} supprimé`)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
      setDeleting(null)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <span className="text-marine/50 text-base">
          {!loading && `${list.length} bilan${list.length !== 1 ? 's' : ''} enregistré${list.length !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            disabled
            title="Disponible dans une prochaine version"
            className="inline-flex items-center gap-2 px-4 py-2 border border-cream-dark text-marine/30 rounded-md text-base cursor-not-allowed"
          >
            <PencilLine size={16} />
            Saisie manuelle
          </button>
          {hasDuplicates && (
            <button
              type="button"
              onClick={() => setShowDedupe(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 rounded-md text-base hover:bg-amber-100 transition-colors"
            >
              <Eraser size={16} />
              Nettoyer les doublons
            </button>
          )}
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {importing ? 'Analyse…' : 'Importer un bilan (.doc, .docx)'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-5">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-marine/40 text-base">Chargement…</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-cream-dark rounded-full flex items-center justify-center mb-4">
            <ClipboardList size={28} className="text-marine/25" />
          </div>
          <p className="text-marine/50 text-base font-medium">Aucun bilan enregistré pour ce client</p>
          <p className="text-marine/35 text-sm mt-1">
            Importez un bilan <code className="text-marine/45">.doc</code> ou <code className="text-marine/45">.docx</code> pour commencer.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-cream-dark rounded-lg overflow-hidden">
          <table className="w-full text-base">
            <thead>
              <tr className="bg-cream/70 text-marine/55 text-sm uppercase tracking-wide">
                <th className="text-left font-medium px-4 py-3">Date</th>
                <th className="text-left font-medium px-4 py-3">Score global</th>
                <th className="text-left font-medium px-4 py-3">Source</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map(bilan => (
                <tr key={bilan.id} className="border-t border-cream-dark hover:bg-cream/40 transition-colors">
                  <td className="px-4 py-3 text-marine font-medium">{formatBilanDate(bilan.date)}</td>
                  <td className="px-4 py-3 text-marine/80">
                    {bilan.data.score_global !== undefined ? bilan.data.score_global : '—'}
                  </td>
                  <td className="px-4 py-3 text-marine/55 text-sm">
                    {bilan.source === 'import_docx' ? 'Import .docx' : 'Saisie manuelle'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${client.id}/bilans/${bilan.id}`)}
                        className="text-gold-dark hover:text-marine font-medium text-base transition-colors"
                      >
                        Voir
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(bilan)}
                        title="Supprimer ce bilan"
                        aria-label={`Supprimer le bilan du ${formatBilanDate(bilan.date)}`}
                        className="text-red-500/70 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <ImportBilanModal
          clientId={client.id}
          fileName={pending.fileName}
          result={pending.result}
          onCancel={() => setPending(null)}
          onSaved={summary => {
            setPending(null)
            const parts: string[] = []
            if (summary.imported) parts.push(`${summary.imported} importé${summary.imported > 1 ? 's' : ''}`)
            if (summary.updated) parts.push(`${summary.updated} mis à jour`)
            if (summary.skipped) parts.push(`${summary.skipped} ignoré${summary.skipped > 1 ? 's' : ''}`)
            setToast(parts.length ? parts.join(', ') : 'Aucun changement')
            reload()
            navigate(`/clients/${client.id}/bilans`)
          }}
        />
      )}

      {deleting && (
        <ConfirmDeleteBilanDialog
          dateLabel={formatBilanDate(deleting.date)}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}

      {showDedupe && (
        <DedupeBilansModal
          clientId={client.id}
          bilans={list}
          onCancel={() => setShowDedupe(false)}
          onCleaned={result => {
            setShowDedupe(false)
            setToast(
              result.removed > 0
                ? `${result.removed} doublon${result.removed > 1 ? 's' : ''} supprimé${result.removed > 1 ? 's' : ''}`
                : 'Aucun doublon à nettoyer'
            )
            reload()
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-marine text-cream text-base font-medium px-5 py-3 rounded-lg shadow-2xl border border-marine-light/40">
          {toast}
        </div>
      )}
    </div>
  )
}

/** Retire le préfixe « Error invoking remote method '…': » des erreurs IPC pour un message lisible. */
function cleanIpcError(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message) return fallback
  return err.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^(Uncaught\s+)?Error:\s*/i, '')
    .trim() || fallback
}

interface ConfirmDeleteBilanDialogProps {
  dateLabel: string
  onCancel: () => void
  onConfirm: () => Promise<void>
}

function ConfirmDeleteBilanDialog({ dateLabel, onCancel, onConfirm }: ConfirmDeleteBilanDialogProps) {
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, deleting])

  async function handleConfirm() {
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark p-6">
        <h2 className="text-marine font-semibold text-xl mb-3">Supprimer le bilan du {dateLabel}&nbsp;?</h2>
        <p className="text-marine/50 text-sm mb-5">Cette action est irréversible.</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            autoFocus
            className="px-4 py-2 text-marine/70 hover:text-marine border border-cream-dark rounded-md text-base transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white font-semibold rounded-md text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting && <Loader2 size={15} className="animate-spin" />}
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
