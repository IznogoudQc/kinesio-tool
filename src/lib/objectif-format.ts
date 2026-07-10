/** Helpers de formatage partagés entre le rapport PDF (ReportPage) et le Dashboard
 *  (DashboardTab) pour l'objectif chiffré. Purs, sans JSX. */

import { kgToLb } from './units.ts'

/** Formate un poids (stocké en kg) en montrant les DEUX unités : l'unité préférée
 *  du client d'abord, l'autre entre parenthèses. Ex. lb → « 199 lb (90 kg) ». */
export function dualWeight(kg: number | null, unit: 'kg' | 'lb'): string {
  if (kg === null) return '—'
  const lb = Math.round(kgToLb(kg))
  const k = Math.round(kg)
  return unit === 'lb' ? `${lb} lb (${k} kg)` : `${k} kg (${lb} lb)`
}

/** Nombre de semaines, arrondi et sans décimale.
 *
 *  `weeksToGoal` est une division (6 kg ÷ 0,79 kg/sem) : la valeur brute traîne
 *  des artefacts binaires (`7.6000000000000005`) et une demi-semaine n'a de toute
 *  façon aucun sens pour un client. On garde la valeur exacte pour calculer
 *  l'échéance, et on n'arrondit qu'à l'affichage.
 */
export function formatWeeks(weeks: number | null): string {
  if (weeks === null || !Number.isFinite(weeks)) return '—'
  return String(Math.max(1, Math.round(weeks)))
}

/** Date d'échéance estimée = date de départ + `weeks` semaines, formatée « mois
 *  année » (fr-CA). Construite en composantes locales pour éviter tout décalage de
 *  fuseau horaire. `null` si la date de départ est invalide. */
export function estimatedGoalDate(startIso: string, weeks: number): string | null {
  const [y, m, d] = startIso.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + Math.round(weeks * 7))
  return date.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
}
