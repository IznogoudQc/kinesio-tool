import { useEffect, useMemo, useState } from 'react'
import { Eraser, Loader2 } from 'lucide-react'
import { bilansService } from '../../services/bilans'
import { formatBilanDate, countFilledFields } from './bilanFields'

interface DedupeBilansModalProps {
  clientId: string
  bilans: Bilan[]
  onCancel: () => void
  onCleaned: (summary: DedupeSummary) => void
}

interface DupGroup {
  date: string
  /** Bilans du groupe, du plus complet au moins complet. */
  ranked: { bilan: Bilan; filled: number }[]
}

export function DedupeBilansModal({ clientId, bilans, onCancel, onCleaned }: DedupeBilansModalProps) {
  const [cleaning, setCleaning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !cleaning) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, cleaning])

  const groups = useMemo<DupGroup[]>(() => {
    const byDate = new Map<string, Bilan[]>()
    for (const b of bilans) {
      const arr = byDate.get(b.date)
      if (arr) arr.push(b)
      else byDate.set(b.date, [b])
    }
    const out: DupGroup[] = []
    for (const [date, arr] of byDate) {
      if (arr.length < 2) continue
      const ranked = arr
        .map(bilan => ({ bilan, filled: countFilledFields(bilan.data) }))
        .sort((a, b) => b.filled - a.filled)
      out.push({ date, ranked })
    }
    // Plus récents en premier
    out.sort((a, b) => (a.date < b.date ? 1 : -1))
    return out
  }, [bilans])

  const totalRemovable = groups.reduce((n, g) => n + (g.ranked.length - 1), 0)

  async function handleClean() {
    setCleaning(true)
    setError(null)
    try {
      const summary = await bilansService.dedupe(clientId)
      onCleaned(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du nettoyage.')
      setCleaning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-2xl border border-cream-dark max-h-[90vh] flex flex-col">
        <div className="p-6 flex flex-col min-h-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1">
            <Eraser size={18} className="text-amber-600 shrink-0" />
            <h2 className="text-marine font-semibold text-xl">Nettoyer les doublons</h2>
          </div>
          <p className="text-marine/55 text-base mb-5">
            {groups.length === 0
              ? 'Aucun doublon détecté.'
              : `${groups.length} date${groups.length > 1 ? 's' : ''} avec doublons · ${totalRemovable} bilan${totalRemovable > 1 ? 's' : ''} à supprimer. Pour chaque date, on garde le bilan le plus complet (les valeurs manquantes y sont récupérées depuis les autres).`}
          </p>

          {error && (
            <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0">
            {groups.map(group => (
              <div key={group.date} className="border border-cream-dark rounded-md bg-white p-4">
                <p className="text-marine font-semibold text-base mb-2.5">{formatBilanDate(group.date)}</p>
                <ul className="space-y-1.5">
                  {group.ranked.map(({ bilan, filled }, i) => (
                    <li
                      key={bilan.id}
                      className={`flex items-center justify-between gap-3 text-base rounded-md px-3 py-2 ${
                        i === 0 ? 'bg-green-50 border border-green-200' : 'bg-cream/60 border border-cream-dark'
                      }`}
                    >
                      <span className={i === 0 ? 'text-marine font-medium' : 'text-marine/60'}>
                        {filled} mesure{filled > 1 ? 's' : ''}
                        <span className="text-marine/40 text-sm"> · {bilan.source === 'import_docx' ? 'import .docx' : 'saisie manuelle'}</span>
                      </span>
                      <span className={`text-sm font-medium ${i === 0 ? 'text-green-700' : 'text-red-500'}`}>
                        {i === 0 ? 'à garder' : 'à supprimer'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={cleaning}
              className="px-4 py-2 text-marine/65 text-base hover:text-marine transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleClean}
              disabled={cleaning || groups.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 text-white font-semibold rounded-md text-base hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cleaning && <Loader2 size={15} className="animate-spin" />}
              {cleaning ? 'Nettoyage…' : 'Tout nettoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
