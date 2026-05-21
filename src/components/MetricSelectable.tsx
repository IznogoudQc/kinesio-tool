import { Check } from 'lucide-react'
import { useAIAdvice, type MetricSelection } from '../contexts/AIAdviceContext'

interface MetricSelectableProps {
  /** Identifiant unique de la métrique au sein du dashboard (sert de clé Map). */
  selectionKey: string
  /** Snapshot des données à envoyer si la métrique est sélectionnée. */
  data: MetricSelection
  /** Disponible ? Si false, la case est masquée même en mode IA (ex: valeur null). */
  available?: boolean
  children: React.ReactNode
  /** Classe additionnelle sur le wrapper. */
  className?: string
}

/**
 * Wrapper qui ajoute un overlay « case à cocher + anneau gold » sur n'importe
 * quelle card de métrique quand le mode « Conseils IA » est actif. Sinon il
 * rend ses enfants tels quels (zero overhead visuel).
 *
 * Le wrapper devient lui-même le bouton interactif quand le mode est actif
 * (sinon l'enfant garde sa propre interactivité native — un clic sur une
 * card timeline reste un clic timeline).
 */
export function MetricSelectable({
  selectionKey,
  data,
  available = true,
  children,
  className
}: MetricSelectableProps) {
  const ai = useAIAdvice()
  const enabled = ai.mode && available
  const checked = ai.isSelected(selectionKey)

  if (!enabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={e => {
        // Empêche le clic de propager vers d'éventuels handlers internes
        // (par ex. les pills timeline qui changent la sélection circ).
        e.stopPropagation()
        ai.toggle(selectionKey, data)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          ai.toggle(selectionKey, data)
        }
      }}
      className={[
        'relative cursor-pointer transition-shadow rounded-xl',
        checked ? 'ring-2 ring-gold ring-offset-1 ring-offset-cream' : 'hover:ring-1 hover:ring-gold/40',
        className ?? ''
      ].join(' ')}
    >
      {children}
      <span
        className={[
          'absolute top-2 right-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
          checked
            ? 'bg-gold border-gold text-marine'
            : 'bg-white/90 border-marine/40 text-transparent'
        ].join(' ')}
        aria-hidden
      >
        <Check size={13} strokeWidth={3} />
      </span>
    </div>
  )
}
