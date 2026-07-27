import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2 } from 'lucide-react'
import { bilansService } from '../../services/bilans'
import { BilanForm, deriveBilanFields } from './BilanForm'
import { BILAN_FIELD_GROUPS, formatBilanDate, countFilledFields } from './bilanFields'
import { missingImportantFields, type ImportantField } from './bilan-required-fields'
import { MissingFieldsDialog, StepperHeader } from './CreateBilanModal'
import { clientsService } from '../../services/clients'
import { computeAge } from '../../lib/norms'

interface ImportBilanModalProps {
  clientId: string
  fileName: string
  result: ImportBilanResult
  onCancel: () => void
  onSaved: (summary: ImportBilansSummary) => void
  /** Sexe/âge/unités du client — nécessaires au calcul VO2max (Bruce) et aux
   *  percentiles dans l'aperçu du formulaire. Sinon « Sexe du client requis ». */
  client: Pick<Client, 'birthdate' | 'sex' | 'unitLength' | 'unitWeight'>
}

export function ImportBilanModal({ clientId, fileName, result, onCancel, onSaved, client }: ImportBilanModalProps) {
  const [date, setDate] = useState(result.extracted.date)
  const [data, setData] = useState<BilanData>(result.extracted.data)
  const [includeHistorical, setIncludeHistorical] = useState<boolean[]>(
    result.historical.map(() => true)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportBilansSummary | null>(null)
  // Mêmes options que la saisie manuelle : mode d'affichage, comparaison au
  // bilan précédent et récapitulatif des champs manquants (cf. CreateBilanModal).
  const [mode, setMode] = useState<'scroll' | 'guided'>('scroll')
  const [stepIndex, setStepIndex] = useState(0)
  const [previous, setPrevious] = useState<Bilan | null>(null)
  const [pendingMissing, setPendingMissing] = useState<ImportantField[] | null>(null)

  useEffect(() => {
    bilansService
      .getBilansForClient(clientId)
      .then(list => setPrevious(list[0] ?? null))
      .catch(() => setPrevious(null))
  }, [clientId])

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('La date du bilan est requise.')
      return
    }
    // Même garde-fou doux que la saisie manuelle : on signale les mesures
    // importantes absentes du document, sans jamais bloquer.
    const missing = missingImportantFields(data)
    if (missing.length > 0) {
      setPendingMissing(missing)
      return
    }
    void persist()
  }

  async function persist() {
    setSaving(true)
    try {
      // Recalcule les valeurs dérivées (VO2max, IMC, % gras, scores composites)
      // au lieu de conserver celles imprimées par le logiciel d'origine : l'app
      // doit rester la seule source de vérité. L'âge est celui **à la date du
      // bilan**, pas aujourd'hui — les bilans historiques peuvent avoir 15 ans.
      const derive = (d: BilanData, isoDate: string): BilanData =>
        deriveBilanFields(d, computeAge(client.birthdate, new Date(`${isoDate}T00:00:00`)), client.sex)

      const items: { date: string; data: BilanData }[] = [{ date, data: derive(data, date) }]
      result.historical.forEach((h, i) => {
        if (includeHistorical[i]) items.push({ date: h.date, data: derive(h.data, h.date) })
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
          <div className="flex items-start gap-3 mb-5">
            <div className="flex-1 min-w-0">
              <h2 className="text-marine font-semibold text-xl mb-1">Importer un bilan</h2>
              <p className="text-marine/55 text-base flex items-center gap-2">
                <FileText size={15} className="text-gold shrink-0" />
                <span className="truncate">{fileName}</span>
              </p>
            </div>
            <div className="flex rounded-md border border-cream-dark overflow-hidden shrink-0 text-sm">
              <button
                type="button"
                onClick={() => setMode('scroll')}
                className={`px-3 py-1.5 transition-colors ${mode === 'scroll' ? 'bg-gold text-marine font-semibold' : 'bg-white/60 text-marine/60 hover:text-marine'}`}
              >
                Tout afficher
              </button>
              <button
                type="button"
                onClick={() => { setMode('guided'); setStepIndex(0) }}
                className={`px-3 py-1.5 transition-colors ${mode === 'guided' ? 'bg-gold text-marine font-semibold' : 'bg-white/60 text-marine/60 hover:text-marine'}`}
              >
                Guidé
              </button>
            </div>
          </div>

          {mode === 'guided' && (
            <StepperHeader stepIndex={stepIndex} titles={BILAN_FIELD_GROUPS.map(g => g.title)} />
          )}

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
                client={client}
                onUnitsChange={u => {
                  clientsService.update(clientId, u).catch(() => {})
                }}
                showSynthesis
                previousData={previous?.data}
                visibleSectionIds={mode === 'guided' ? [BILAN_FIELD_GROUPS[stepIndex].id] : undefined}
                collapsible={mode === 'guided' ? false : undefined}
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
            {mode === 'guided' && stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-marine border border-cream-dark rounded-md text-base hover:bg-white transition-colors"
              >
                <ArrowLeft size={15} /> Précédent
              </button>
            )}
            {mode === 'guided' && stepIndex < BILAN_FIELD_GROUPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStepIndex(i => Math.min(BILAN_FIELD_GROUPS.length - 1, i + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-marine text-cream font-semibold rounded-md text-base hover:bg-marine-light transition-colors"
              >
                Section suivante <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Enregistrement…' : mode === 'guided' ? 'Vérifier & enregistrer' : 'Sauvegarder'}
              </button>
            )}
          </div>
        </form>
      </div>

      {pendingMissing && (
        <MissingFieldsDialog
          missing={pendingMissing}
          guided={mode === 'guided'}
          onComplete={() => {
            setPendingMissing(null)
            if (mode === 'guided') setStepIndex(0)
          }}
          onSaveAnyway={() => {
            setPendingMissing(null)
            void persist()
          }}
        />
      )}
    </div>
  )
}
