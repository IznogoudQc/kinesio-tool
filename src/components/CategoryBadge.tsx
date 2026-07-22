import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type Category
} from '../lib/norms'

interface CategoryBadgeProps {
  category: Category | null
  /** Affichage compact (sous une valeur dans un formulaire). */
  variant?: 'default' | 'compact'
  /** Couleur fallback du tiret quand la catégorisation n'est pas disponible. */
  emptyClassName?: string
  /** Libellé à afficher à la place de `CATEGORY_LABELS[category]` (garde la couleur
   *  de la catégorie). Sert au % de gras, coté selon la grille de Marie (« En santé »). */
  label?: string
}

export function CategoryBadge({ category, variant = 'default', emptyClassName, label }: CategoryBadgeProps) {
  if (category === null) {
    return <span className={emptyClassName ?? 'text-marine/30 text-sm'}>—</span>
  }
  const cls = CATEGORY_COLORS[category]
  const size = variant === 'compact' ? 'text-xs' : 'text-sm'
  return <span className={`${size} ${cls}`}>{label ?? CATEGORY_LABELS[category]}</span>
}
