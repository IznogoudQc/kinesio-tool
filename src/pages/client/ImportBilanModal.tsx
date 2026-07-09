import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, Loader2 } from 'lucide-react'
import { bilansService } from '../../services/bilans'
import { BilanForm } from './BilanForm'
import { formatBilanDate, countFilledFields } from './bilanFields'

interface ImportBilanModalProps {
  clientId: string
  fileName: string
  result: ImportBilanResult
  onCancel: () => void
  onSaved: (summary: ImportBilansSummary) => void
}

export function ImportBilanModal({ clientId, fileName, result, onCancel, onSaved }: ImportBilanModalProps) {
  const [date, setDate] = useState(result.extracted.date)
  const [data, setData] = useState<BilanData>(result.extracted.data)
  const [includeHistorical, setIncludeHistorical] = useState<boolean[]>(
    result.historical.map(() => true)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportBilansSummary | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || saving) return
      if (summary) onSaved(summary)
      else onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, onSaved, saving, summary])

  function toggleHistorical(index: number) {
    setIncludeHistorical(prev => prev.map((v, i) => (i === index ? !v : v)))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('La date du bilan est requise.')
      return
    }
    setSaving(true)
    try {
      const items: { date: string; data: BilanData }[] = [{ date, data }]
      result.historical.forEach((h, i) => {
        if (includeHistorical[i]) items.push({ date: h.date, data: h.data })
      })
      const s = await bilansService.importBilans(clientId, items)
      setSummary(s)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (summary) {
    const total = summary.imported + summary.updated + summary.skipped
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
        <div className="bg-cream rounded-lg shadow-2xl w-full max-w-md border border-cream-dark p-6">
          <div className="flex items-center gap-2.5 mb-3">
            <CheckCircle2 size={20} className="text-green-600 shrink-0" />
            <h2 className="text-marine font-semibold text-xl">Import terminé</h2>
          </div>
          <p className="text-marine/55 text-sm mb-4">
            {total} bilan{total > 1 ? 's' : ''} traité{total > 1 ? 's' : ''} depuis le document.
          </p>
          <ul className="space-y-1.5 text-marine text-base mb-6">
            <li><span className="font-semibold text-green-700">{summary.imported}</span> importé{summary.imported > 1 ? 's' : ''}</li>
            <li><span className="font-semibold text-gold-dark">{summary.updated}</span> mis à jour <span className="text-marine/45 text-sm">(valeurs corrigées ou ajoutées)</span></li>
            <li><span className="font-semibold text-marine/50">{summary.skipped}</span> ignoré{summary.skipped > 1 ? 's' : ''} <span className="text-marine/45 text-sm">(identique{summary.skipped > 1 ? 's' : ''} à ce qui est déjà en base)</span></li>
          </ul>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onSaved(summary)}
              className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-6">
      <div className="bg-cream rounded-lg shadow-2xl w-full max-w-3xl border border-cream-dark max-h-[92vh] flex flex-col">
        <form onSubmit={handleSave} className="p-6 flex flex-col min-h-0 flex-1">
          <h2 className="text-marine font-semibold text-xl mb-1">Importer un bilan</h2>
          <p className="text-marine/55 text-base mb-5 flex items-center gap-2">
            <FileText size={15} className="text-gold shrink-0" />
            <span className="truncate">{fileName}</span>
          </p>

          <div className="space-y-6 overflow-y-auto pr-1 flex-1 min-h-0">
            {error && (
              <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <p className="text-marine/55 text-sm mb-3">
                Vérifiez les valeurs extraites avant de sauvegarder. Les champs vides peuvent être complétés à la main.
              </p>
              <BilanForm
                variant="light"
                date={date}
                data={data}
                onDateChange={setDate}
                onDataChange={setData}
              />
            </div>

            {result.historical.length > 0 && (
              <div className="border-t border-cream-dark pt-5">
                <h3 className="text-marine font-semibold text-base mb-1">
                  Bilans plus anciens trouvés dans le document
                </h3>
                <p className="text-marine/55 text-sm mb-3">
                  Le tableau de comparaison contient {result.historical.length} bilan
                  {result.historical.length > 1 ? 's' : ''} antérieur{result.historical.length > 1 ? 's' : ''}.
                  Cochez ceux à importer pour reconstituer l'historique.
                </p>
                <div className="space-y-2">
                  {result.historical.map((h, i) => (
                    <label
                      key={`${h.date}-${i}`}
                      className="flex items-start gap-3 bg-white border border-cream-dark rounded-md px-3.5 py-3 cursor-pointer hover:border-gold/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={includeHistorical[i]}
                        onChange={() => toggleHistorical(i)}
                        className="mt-1 accent-gold"
                      />
                      <div className="min-w-0">
                        <p className="text-marine font-medium text-base">
                          Bilan du {formatBilanDate(h.date)}
                        </p>
                        <p className="text-marine/50 text-sm mt-0.5">
                          {countFilledFields(h.data)} mesure{countFilledFields(h.data) > 1 ? 's' : ''}
                          {h.data.imc !== undefined && ` · IMC ${h.data.imc}`}
                          {h.data.pourcentage_gras !== undefined && ` · ${h.data.pourcentage_gras} % gras`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-marine/65 text-base hover:text-marine transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
