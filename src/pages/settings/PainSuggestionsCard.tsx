import { useEffect, useState } from 'react'
import { Check, HeartPulse, Loader2, Plus, RotateCcw, X } from 'lucide-react'
import { settingsService } from '../../services/settings'
import { PAIN_FAMILIES, type PainSuggestionLib } from '../../lib/pain-suggestions'

type Status = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Éditeur de la bibliothèque de suggestions de douleur (globale, tous clients).
 * Les phrases proposées quand Marie marque une zone sur la silhouette du
 * questionnaire de santé, regroupées par famille de zones. Voir ADR 0021.
 */
export function PainSuggestionsCard() {
  const [lib, setLib] = useState<PainSuggestionLib | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    settingsService.getPainSuggestions().then(setLib).catch(() => setLib({}))
  }, [])

  function update(family: string, list: string[]) {
    setLib(prev => ({ ...(prev ?? {}), [family]: list }))
    setDirty(true)
    setStatus('idle')
  }
  function addPhrase(family: string, phrase: string) {
    const p = phrase.trim()
    if (!p) return
    const cur = lib?.[family] ?? []
    if (cur.some(x => x.toLowerCase() === p.toLowerCase())) return
    update(family, [...cur, p])
  }
  function removePhrase(family: string, phrase: string) {
    update(family, (lib?.[family] ?? []).filter(x => x !== phrase))
  }

  async function save() {
    if (!lib) return
    setStatus('saving')
    try {
      await settingsService.setPainSuggestions(lib)
      setDirty(false)
      setStatus('saved')
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2500)
    } catch {
      setStatus('error')
    }
  }
  async function reset() {
    try {
      const def = await settingsService.getDefaultPainSuggestions()
      setLib(def)
      setDirty(true)
      setStatus('idle')
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="bg-white border border-cream-dark rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <HeartPulse size={18} className="text-gold-dark" />
        <h2 className="text-marine font-semibold text-lg">Suggestions de douleur</h2>
      </div>
      <p className="text-marine/55 text-sm mb-4">
        Phrases proposées quand vous marquez une zone sur la silhouette (questionnaire de santé). Regroupées par
        famille de zones ; le « Commun » s'affiche pour toutes les zones.
      </p>

      {lib === null ? (
        <p className="text-marine/40 text-sm">Chargement…</p>
      ) : (
        <div className="space-y-4">
          {PAIN_FAMILIES.map(fam => (
            <FamilyEditor
              key={fam.key}
              label={fam.label}
              phrases={lib[fam.key] ?? []}
              onAdd={p => addPhrase(fam.key, p)}
              onRemove={p => removePhrase(fam.key, p)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mt-5">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status === 'saving'}
          className="inline-flex items-center gap-2 px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Enregistrer
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-marine/60 hover:text-marine text-sm transition-colors"
        >
          <RotateCcw size={14} /> Réinitialiser
        </button>
        {status === 'saved' && <span className="text-green-600 text-sm">Enregistré ✓</span>}
        {status === 'error' && <span className="text-red-600 text-sm">Erreur d'enregistrement</span>}
      </div>
    </section>
  )
}

function FamilyEditor({
  label,
  phrases,
  onAdd,
  onRemove
}: {
  label: string
  phrases: string[]
  onAdd: (p: string) => void
  onRemove: (p: string) => void
}) {
  const [draft, setDraft] = useState('')
  function commit() {
    onAdd(draft)
    setDraft('')
  }
  return (
    <div className="border border-cream-dark/50 rounded-lg p-3 bg-cream/20">
      <p className="text-marine font-medium text-sm mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {phrases.length === 0 && <span className="text-marine/35 text-sm">Aucune suggestion.</span>}
        {phrases.map(p => (
          <span
            key={p}
            className="inline-flex items-center gap-1 bg-white border border-cream-dark rounded-full pl-2.5 pr-1 py-0.5 text-sm text-marine"
          >
            {p}
            <button
              type="button"
              onClick={() => onRemove(p)}
              className="text-marine/40 hover:text-red-600 transition-colors"
              aria-label={`Retirer ${p}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder="Ajouter une suggestion…"
          className="flex-1 px-2.5 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm placeholder-marine/30 focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-marine text-cream rounded-md text-sm hover:bg-marine-light transition-colors disabled:opacity-40"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
    </div>
  )
}
