import { useState } from 'react'
import { Eye, EyeOff, Loader2, X } from 'lucide-react'
import {
  REPORT_SECTIONS,
  hiddenSummary,
  parseHiddenSections,
  serializeHiddenSections,
  type ReportSectionKey
} from '../../../lib/report-sections'

/**
 * Choix des sections à inclure dans le rapport, pour CE client.
 *
 * Réglage par dossier (et non global) : un client qui n'a pas fait de test
 * aérobie n'a pas la même feuille qu'un autre. Un seul réglage vaut pour le PDF
 * **et** pour le document HTML — ce que Marie masque disparaît des deux.
 *
 * L'œil ouvert = la section part au client. Fermé = elle est retirée.
 */
export function ReportSectionsPanel({
  clientName,
  hiddenRaw,
  onSave,
  onClose
}: {
  clientName: string
  /** Valeur brute du dossier (`clients.reportHiddenSections`). */
  hiddenRaw: string | null
  /** Persiste la nouvelle valeur. Reçoit `null` quand tout est montré. */
  onSave: (value: string | null) => Promise<void>
  onClose: () => void
}) {
  const [hidden, setHidden] = useState<Set<ReportSectionKey>>(() => parseHiddenSections(hiddenRaw))
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  function basculer(key: ReportSectionKey) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function enregistrer() {
    setSaving(true)
    setErreur(null)
    try {
      await onSave(serializeHiddenSections(hidden))
      onClose()
    } catch {
      // On garde la fenêtre ouverte : les choix de Marie ne doivent pas
      // disparaître parce que l'enregistrement a échoué.
      setErreur('Le réglage n’a pas pu être enregistré. Réessayez.')
      setSaving(false)
    }
  }

  const resume = hiddenSummary(hidden)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-marine/40 backdrop-blur-sm p-4">
      <div className="bg-cream rounded-lg shadow-2xl border border-cream-dark w-full max-w-xl max-h-[calc(100dvh-2rem)] flex flex-col">
        <header className="px-5 py-4 border-b border-cream-dark flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-marine font-semibold text-lg">Contenu du rapport</h3>
            <p className="text-marine/50 text-sm mt-0.5">
              Ce qui part à {clientName.split(' ')[0]}, dans le PDF comme dans le document interactif.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-marine/50 hover:text-marine transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-3 overflow-y-auto min-h-0 divide-y divide-cream-dark/50">
          {REPORT_SECTIONS.map(section => {
            const visible = !hidden.has(section.key)
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => basculer(section.key)}
                aria-pressed={visible}
                className="w-full flex items-start gap-3 py-3 text-left group"
              >
                <span
                  className={`mt-0.5 shrink-0 transition-colors ${
                    visible ? 'text-marine/70 group-hover:text-marine' : 'text-marine/25 group-hover:text-marine/40'
                  }`}
                >
                  {visible ? <Eye size={18} /> : <EyeOff size={18} />}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${visible ? 'text-marine' : 'text-marine/35 line-through'}`}
                  >
                    {section.label}
                  </span>
                  <span className={`block text-xs mt-0.5 ${visible ? 'text-marine/50' : 'text-marine/30'}`}>
                    {section.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {erreur && <p className="px-5 pb-2 text-red-700 text-sm shrink-0">{erreur}</p>}

        <footer className="px-5 py-3 border-t border-cream-dark flex items-center justify-between gap-3 shrink-0">
          {/* Rappel constant de l'état : Marie doit savoir qu'elle s'apprête à
              envoyer un rapport allégé, même si elle a réglé ça il y a un mois. */}
          <span className={`text-sm ${resume ? 'text-amber-700 font-medium' : 'text-marine/45'}`}>
            {resume ?? 'Toutes les sections sont incluses'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-marine/70 font-semibold rounded-md text-sm hover:bg-cream-dark/40 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrer}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
