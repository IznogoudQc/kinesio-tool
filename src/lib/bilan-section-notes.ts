/**
 * Notes prises PENDANT un bilan, section par section.
 *
 * ── Où elles vivent ─────────────────────────────────────────────────────────
 *
 * Dans `bilan.data`, sous une clé par section (`note_plis`, `note_aerobie`…).
 * Le bilan porte déjà sa date : une note écrite pendant la prise de mesures est
 * datée du jour de cette prise, sans qu'on ait à la dater séparément.
 *
 * ── Pourquoi pas dans `client_notes` ────────────────────────────────────────
 *
 * Les notes du tableau de bord suivent le CLIENT et s'accumulent au fil du
 * temps. Celles-ci décrivent UNE séance de mesure — « plis difficiles à prendre
 * ce matin » n'a de sens qu'attaché à ce bilan-là. Les mélanger ferait perdre
 * ce lien.
 *
 * ⚠️ Privées comme les autres : `bilan.data` alimente les documents, mais
 * uniquement par des clés nommées une à une — aucune n'est `note_*`.
 */

/** Clé de stockage de la note d'une section de formulaire. */
export function cleNoteSection(groupId: string): string {
  return `note_${groupId}`
}

/**
 * Sous quelle section du tableau de bord une note de bilan doit apparaître.
 *
 * Plusieurs sections du formulaire mènent à la même : le poids, les
 * circonférences et les plis composent tous la note de composition
 * corporelle, et les signes vitaux se lisent avec le cardio.
 *
 * Le groupe `notes` en fait partie depuis la v0.9.191 : il porte l'objectif du
 * client et le mot qui lui est adressé, mais Marie a aussi besoin d'y écrire
 * pour elle — « chaque section » voulait dire chaque section. Sa note privée
 * remonte sous « Objectif », à côté de ces deux textes.
 */
export const SECTION_BILAN_VERS_DASHBOARD: Record<string, string> = {
  vitaux: 'aerobie',
  anthropo: 'composition',
  circonferences: 'composition',
  plis: 'composition',
  aerobie: 'aerobie',
  musculo: 'musculo',
  indices: 'general',
  notes: 'objectif'
}

/**
 * Toutes les clés de note, dans l'ordre des sections.
 *
 * Le schéma de validation des bilans s'en sert pour les autoriser. Il supprime
 * en silence toute clé qu'il ne déclare pas : une note absente de cette liste
 * disparaîtrait à l'enregistrement sans message d'erreur — c'est exactement ce
 * qui est arrivé en v0.9.189.
 */
export const CLES_NOTES_SECTIONS: string[] = Object.keys(SECTION_BILAN_VERS_DASHBOARD).map(cleNoteSection)

/** Une note de bilan prête à afficher. */
export interface NoteDeBilan {
  /** Date du bilan (ISO) — c'est elle qui date la note. */
  date: string
  /** Titre de la section de formulaire, pour situer la note. */
  section: string
  texte: string
}

/**
 * Les notes de bilan à montrer sous une section du tableau de bord.
 *
 * Rendues de la plus RÉCENTE à la plus ancienne : en rouvrant une fiche, c'est
 * la dernière séance qu'on veut relire d'abord.
 */
export function notesDeBilansPour<T extends { date: string; data: object }>(
  bilans: readonly T[] | null | undefined,
  sectionDashboard: string,
  titreDeSection: (groupId: string) => string
): NoteDeBilan[] {
  const groupes = Object.keys(SECTION_BILAN_VERS_DASHBOARD).filter(
    g => SECTION_BILAN_VERS_DASHBOARD[g] === sectionDashboard
  )
  const out: NoteDeBilan[] = []
  for (const b of bilans ?? []) {
    for (const g of groupes) {
      // `data` est une interface sans signature d'index : la lecture par clé
      // dynamique passe par un cast, fait ici une seule fois.
      const v = (b.data as Record<string, unknown>)[cleNoteSection(g)]
      if (typeof v === 'string' && v.trim()) {
        out.push({ date: b.date, section: titreDeSection(g), texte: v.trim() })
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
