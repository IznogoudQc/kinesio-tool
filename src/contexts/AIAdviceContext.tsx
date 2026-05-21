import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/** Donnée capturée quand une métrique est cochée pour l'envoi à l'IA. */
export interface MetricSelection {
  key: string
  label: string
  value: number | string
  unit?: string
  /** Catégorie ACSM/OMS si applicable — affichée au prompt pour le contexte. */
  category?: string
  /** 0-100, si calculable. */
  percentile?: number
  /** Delta % vs moyenne population (positif = mieux). */
  deltaPct?: number
}

interface AIAdviceContextValue {
  /** Le mode « sélection conseils IA » est actif (cases à cocher visibles). */
  mode: boolean
  setMode: (next: boolean) => void
  toggleMode: () => void
  /** Map des sélections courantes, indexée par key. */
  selection: Map<string, MetricSelection>
  isSelected: (key: string) => boolean
  /** Toggle une métrique. La data est requise pour pouvoir la rajouter — si on
   *  ne fait que retirer (déjà présente), elle est ignorée. */
  toggle: (key: string, data: MetricSelection) => void
  clear: () => void
  count: number
}

const AIAdviceContext = createContext<AIAdviceContextValue | null>(null)

export function AIAdviceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState(false)
  const [selection, setSelection] = useState<Map<string, MetricSelection>>(() => new Map())

  const toggleMode = useCallback(() => {
    setMode(m => {
      // Quand on désactive le mode, on nettoie aussi la sélection — sinon des
      // checkboxes invisibles continueraient d'être « cochées » sans qu'on
      // puisse voir/agir dessus.
      if (m) setSelection(new Map())
      return !m
    })
  }, [])

  const toggle = useCallback((key: string, data: MetricSelection) => {
    setSelection(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, data)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelection(new Map()), [])

  const value = useMemo<AIAdviceContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode,
      selection,
      isSelected: (key: string) => selection.has(key),
      toggle,
      clear,
      count: selection.size
    }),
    [mode, selection, toggleMode, toggle, clear]
  )

  return <AIAdviceContext.Provider value={value}>{children}</AIAdviceContext.Provider>
}

/** Hook public — sécurisé : retourne un objet « inactif » si aucun provider en haut.
 *  Permet d'instrumenter des composants potentiellement rendus hors-dashboard
 *  sans risquer un crash (par ex. dans un test isolé). */
export function useAIAdvice(): AIAdviceContextValue {
  const ctx = useContext(AIAdviceContext)
  if (!ctx) {
    return {
      mode: false,
      setMode: () => undefined,
      toggleMode: () => undefined,
      selection: new Map(),
      isSelected: () => false,
      toggle: () => undefined,
      clear: () => undefined,
      count: 0
    }
  }
  return ctx
}
