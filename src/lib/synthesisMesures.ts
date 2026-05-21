/**
 * Synthèse des prises de mesures — équivalent de `synthesisBilan.ts` pour le
 * sous-onglet Mesures du dashboard.
 *
 * Les circonférences historiques sont souvent partielles (une session ne
 * mesure parfois que taille + hanche). Le mode synthèse reconstruit la
 * dernière valeur connue *champ par champ*. Les plis, eux, sont mesurés en
 * bloc (les 4 plis ensemble) — agréger champ par champ n'aurait pas de sens,
 * donc la synthèse plis = la dernière session complète.
 *
 * Voir ADR 0010 pour le rationale.
 */

/** Champs numériques agrégés (on ignore id, clientId, date, createdAt, notes). */
const NUMERIC_FIELDS: (keyof MesureCirconferences)[] = [
  'poidsKg', 'cou', 'epaule', 'bicepsG', 'bicepsD', 'poitrine',
  'taille', 'abdomen', 'hanche', 'cuisseG', 'cuisseD', 'molletG', 'molletD'
]

/**
 * Construit une « session circonférences virtuelle » — pour chaque champ,
 * retourne la valeur la plus récente non-null parmi toutes les sessions.
 * `circList` est trié récent → ancien (convention partout dans le code).
 */
export function buildSynthesisCirc(circList: MesureCirconferences[]): {
  data: Partial<MesureCirconferences>
  fieldOriginDates: Partial<Record<keyof MesureCirconferences, string>>
  latestContributionDate: string | null
} {
  const data: Partial<MesureCirconferences> = {}
  const fieldOriginDates: Partial<Record<keyof MesureCirconferences, string>> = {}
  let latestContributionDate: string | null = null

  for (const session of circList) {
    for (const field of NUMERIC_FIELDS) {
      const v = session[field]
      if (v === null || v === undefined) continue
      if (data[field] !== undefined) continue
      // @ts-expect-error — assignation indexée par une clé `keyof`.
      data[field] = v
      fieldOriginDates[field] = session.date
      if (!latestContributionDate || session.date > latestContributionDate) {
        latestContributionDate = session.date
      }
    }
  }
  return { data, fieldOriginDates, latestContributionDate }
}

/**
 * 2e valeur non-null par champ — pour la comparaison ▲▼ en mode Synthèse.
 */
export function buildPreviousSynthesisCirc(circList: MesureCirconferences[]): {
  data: Partial<MesureCirconferences>
  fieldOriginDates: Partial<Record<keyof MesureCirconferences, string>>
} {
  const data: Partial<MesureCirconferences> = {}
  const fieldOriginDates: Partial<Record<keyof MesureCirconferences, string>> = {}
  const seenCount: Partial<Record<keyof MesureCirconferences, number>> = {}

  for (const session of circList) {
    for (const field of NUMERIC_FIELDS) {
      const v = session[field]
      if (v === null || v === undefined) continue
      const count = seenCount[field] ?? 0
      if (count === 1) {
        // @ts-expect-error — assignation indexée par une clé `keyof`.
        data[field] = v
        fieldOriginDates[field] = session.date
      }
      seenCount[field] = count + 1
    }
  }
  return { data, fieldOriginDates }
}

/**
 * Pour les plis : on prend la dernière session complète. Les 4 plis sont
 * mesurés en bloc dans la pratique, donc agréger champ par champ n'a pas
 * vraiment de sens. Le bilan synthèse plis = la dernière session.
 */
export function findLatestPlis(plisList: MesurePlisCutanes[]): MesurePlisCutanes | null {
  return plisList[0] ?? null
}

export function findPreviousPlis(plisList: MesurePlisCutanes[]): MesurePlisCutanes | null {
  return plisList[1] ?? null
}

/**
 * Pour le mode « date spécifique » : trouve la session ≤ targetDate.
 * Retourne null si aucune session n'est antérieure ou égale.
 */
export function findCircAtOrBefore(
  circList: MesureCirconferences[],
  targetDate: string
): MesureCirconferences | null {
  for (const session of circList) {
    if (session.date <= targetDate) return session
  }
  return null
}

export function findPlisAtOrBefore(
  plisList: MesurePlisCutanes[],
  targetDate: string
): MesurePlisCutanes | null {
  for (const session of plisList) {
    if (session.date <= targetDate) return session
  }
  return null
}

/**
 * Construit la liste unifiée des dates uniques (union circ + plis), triée du
 * plus récent au plus ancien. Pour chaque date, indique quels types de
 * mesures ont été pris ce jour-là — utile pour les indicateurs sur les pills.
 */
export function buildUnifiedDates(
  circList: MesureCirconferences[],
  plisList: MesurePlisCutanes[]
): { date: string; hasCirc: boolean; hasPlis: boolean }[] {
  const map = new Map<string, { hasCirc: boolean; hasPlis: boolean }>()
  for (const c of circList) {
    map.set(c.date, { hasCirc: true, hasPlis: map.get(c.date)?.hasPlis ?? false })
  }
  for (const p of plisList) {
    map.set(p.date, { hasCirc: map.get(p.date)?.hasCirc ?? false, hasPlis: true })
  }
  return Array.from(map.entries())
    .map(([date, flags]) => ({ date, ...flags }))
    .sort((a, b) => b.date.localeCompare(a.date))
}
