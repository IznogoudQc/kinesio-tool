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
      className={`shrink-0 rounded-md p-1.5 transition-colors ${
        masquee
          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          : 'text-marine/30 hover:bg-cream-dark/50 hover:text-marine/70'
      }`}
    >
      {masquee ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  )
}

/**
 * Bandeau discret posé sur une carte retirée du rapport.
 *
 * Sans lui, une carte masquée reste identique à l'écran et Marie n'a aucun moyen
 * de s'en souvenir en survolant son dashboard — elle ne le verrait qu'en
 * ouvrant le PDF, ou pire, le client le verrait avant elle.
 */
export function ReportHiddenBadge({ section }: { section: ReportSectionKey }) {
  const ctx = useContext(Ctx)
  if (!ctx || !ctx.hidden.has(section)) return null
  return (
    <p className="text-amber-700/80 text-[11px] mt-2 flex items-center gap-1.5">
      <EyeOff size={12} className="shrink-0" />
      Ne figure pas dans le rapport remis au client
    </p>
  )
}
