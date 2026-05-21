/**
 * Construit un « bilan synthèse » virtuel à partir de la liste des bilans
 * triés du plus récent au plus ancien (sortie naturelle de
 * `bilansService.list`). Pour chaque champ de `BilanData`, on conserve la
 * valeur **la plus récente non-null/non-undefined**. Pour la comparaison
 * ▲▼ (« précédent »), on prend la **2e valeur non-null** rencontrée pour
 * chaque champ.
 *
 * Pourquoi : les bilans .docx historiques sont souvent partiels (taille +
 * plis seulement, ou VO2max + push-ups seulement…). Le mode synthèse évite
 * à Marie-Eve de naviguer bilan par bilan pour reconstituer l'état le plus
 * à jour pour chaque champ.
 *
 * Voir ADR 0009 pour le rationale.
 */

/** Valeur « renseignée » au sens de la synthèse : pas null, pas undefined,
 *  pas chaîne vide. Les `0` numériques restent valides (par ex. push-ups = 0
 *  est une vraie donnée). */
function isFilled(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

export interface SynthesisResult {
  data: BilanData
  /** Date du bilan le plus récent ayant contribué au moins un champ. */
  latestContributionDate: string | null
  /** Pour chaque champ : date ISO du bilan d'origine. Utile pour tooltips
   *  « donnée extraite du 4 sept 2025 » (déféré en v0.1.33). */
  fieldOriginDates: Partial<Record<keyof BilanData, string>>
  /** Pour chaque champ : nombre de bilans qui le renseignaient. Utile pour
   *  désactiver la comparaison ▲▼ si == 1. */
  fieldCounts: Partial<Record<keyof BilanData, number>>
}

/**
 * Pour chaque champ de BilanData, prend la première valeur renseignée
 * rencontrée dans l'ordre de la liste (≈ la plus récente).
 */
export function buildSynthesisBilan(bilans: Bilan[]): SynthesisResult {
  const data: BilanData = {}
  const fieldOriginDates: Partial<Record<keyof BilanData, string>> = {}
  const fieldCounts: Partial<Record<keyof BilanData, number>> = {}
  let latestContributionDate: string | null = null

  for (const bilan of bilans) {
    for (const [k, v] of Object.entries(bilan.data) as [keyof BilanData, BilanData[keyof BilanData]][]) {
      if (!isFilled(v)) continue
      fieldCounts[k] = (fieldCounts[k] ?? 0) + 1
      if (data[k] !== undefined) continue
      ;(data as Record<string, unknown>)[k as string] = v
      fieldOriginDates[k] = bilan.date
      if (!latestContributionDate || bilan.date > latestContributionDate) {
        latestContributionDate = bilan.date
      }
    }
  }

  return { data, latestContributionDate, fieldOriginDates, fieldCounts }
}

/**
 * Construit le bilan synthèse « précédent » pour la comparaison ▲▼.
 *
 * Pour chaque champ, prend la **2e valeur renseignée** rencontrée. Si un
 * champ n'apparait que dans un seul bilan historique, il est absent du
 * résultat → le delta ne sera pas calculable (et MeasureDelta affichera
 * « Première mesure »).
 */
export function buildPreviousSynthesisBilan(bilans: Bilan[]): { data: BilanData } {
  const data: BilanData = {}
  const seenCount: Partial<Record<keyof BilanData, number>> = {}

  for (const bilan of bilans) {
    for (const [k, v] of Object.entries(bilan.data) as [keyof BilanData, BilanData[keyof BilanData]][]) {
      if (!isFilled(v)) continue
      const count = seenCount[k] ?? 0
      if (count === 1) {
        ;(data as Record<string, unknown>)[k as string] = v
      }
      seenCount[k] = count + 1
    }
  }

  return { data }
}
