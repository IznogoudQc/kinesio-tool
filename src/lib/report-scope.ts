/**
 * Portée temporelle d'un rapport — quels bilans il a le droit de montrer.
 *
 * Marie peut générer le PDF ou le document HTML d'un **vieux** bilan. Un rapport
 * daté d'août 2011 ne doit alors rien contenir de postérieur : ni courbe montant
 * jusqu'en 2026, ni proposition de se comparer à un bilan qui n'existait pas
 * encore. C'est la même règle pour le dashboard, le PDF, le document HTML et la
 * construction du payload côté Electron — d'où ce module plutôt que quatre
 * copies. Les barèmes (v0.9.64-66) et le profil de cotation (v0.9.65) ont montré
 * ce que devient une règle recopiée : elle diverge à l'endroit qu'on oublie.
 */

/** Le minimum dont on a besoin : un identifiant et une date ISO comparable. */
export interface DatedBilan {
  id: string
  date: string
}

/**
 * Les bilans visibles depuis `bilanId` : lui-même et tous les antérieurs.
 *
 * `bilanId` absent, nul, ou introuvable → la liste complète, c'est-à-dire le
 * comportement d'origine (rapport de synthèse sur tout l'historique). Un id
 * introuvable ne doit jamais vider le rapport : on préfère tout montrer plutôt
 * que rien.
 */
export function scopeBilansTo<T extends DatedBilan>(bilans: T[], bilanId?: string | null): T[] {
  if (!bilanId) return bilans
  const cible = bilans.find(b => b.id === bilanId)
  if (!cible) return bilans
  return bilans.filter(b => b.date <= cible.date)
}

/**
 * Bilans proposés dans « Comparer à ».
 *
 * Strictement **antérieurs** à celui affiché, et sans le bilan précédent
 * immédiat — celui-ci a déjà son entrée dédiée « Bilan précédent » dans le
 * sélecteur, l'y remettre ferait doublon.
 *
 * Retourne les plus récents d'abord.
 */
export function compareCandidates<T extends DatedBilan>(
  bilans: T[],
  current: DatedBilan,
  previousId?: string | null
): T[] {
  return bilans
    .filter(b => b.id !== current.id && b.id !== previousId && b.date < current.date)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
}
