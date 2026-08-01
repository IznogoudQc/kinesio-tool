import { createContext, useContext, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { ReportSectionKey } from '../lib/report-sections'

/**
 * L'œil « inclure / retirer du rapport », posé dans le coin de chaque carte.
 *
 * ── Pourquoi un contexte plutôt que des props ───────────────────────────────
 * Les cartes sont réparties dans une dizaine de fichiers et imbriquées à
 * plusieurs niveaux (`HealthRiskLine`, `CompositionCpaflaCard`, `MusculoRadar`…).
 * Les traverser à coups de props obligerait chacune à porter deux paramètres
 * qui ne la concernent pas.
 *
 * ── Et surtout : l'œil ne doit JAMAIS partir chez le client ─────────────────
 * `HealthRiskLine` et `TrainingZones` sont partagés avec le document HTML remis
 * au client. Sans fournisseur, `ReportEye` ne rend **rien** — le document ne
 * peut donc pas afficher un bouton de réglage, même par accident. C'est plus sûr
 * qu'un drapeau qu'on oublierait de passer.
 */
interface ReportVisibility {
  hidden: Set<ReportSectionKey>
  toggle: (key: ReportSectionKey) => void
}

const Ctx = createContext<ReportVisibility | null>(null)

export function ReportVisibilityProvider({
  value,
  children
}: {
  /** `null` = pas d'yeux du tout (mode impression, document client). */
  value: ReportVisibility | null
  children: ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Œil de la carte. À poser dans le coin haut-droit, à côté du bouton « Barème »
 * là où il y en a un.
 *
 * Ouvert = la carte part au client. Barré = elle est retirée du PDF **et** du
 * document interactif. La carte reste visible ici : c'est l'outil de travail de
 * Marie, seul le document remis change.
 */
export function ReportEye({ section }: { section: ReportSectionKey }) {
  const ctx = useContext(Ctx)
  if (!ctx) return null

  const masquee = ctx.hidden.has(section)
  return (
    <button
      type="button"
      onClick={() => ctx.toggle(section)}
      aria-pressed={!masquee}
      title={
        masquee
          ? 'Retiré du rapport — cliquez pour l’inclure à nouveau'
          : 'Inclus dans le rapport (PDF et document interactif) — cliquez pour le retirer'
      }
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-md p-1.5 transition-colors ${
        masquee
          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 pr-2'
          : 'text-marine/30 hover:bg-cream-dark/50 hover:text-marine/70'
      }`}
    >
      {masquee ? <EyeOff size={15} /> : <Eye size={15} />}
      {/* Le libellé accompagne l'œil barré plutôt que de vivre dans un bandeau
          séparé : un seul point d'insertion par carte, donc aucun risque
          d'oublier le bandeau là où l'œil est posé — c'est exactement ce qui
          venait d'arriver. */}
      {masquee && <span className="text-[11px] font-medium whitespace-nowrap">Retiré du rapport</span>}
    </button>
  )
}
