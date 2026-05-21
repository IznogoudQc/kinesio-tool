/** Placeholder pour les tables CPAFLA (Société canadienne de physiologie de
 *  l'exercice — Canadian Physical Activity, Fitness and Lifestyle Approach).
 *
 *  À venir dans une future version. Tant que les tables ne sont pas encodées,
 *  `getCpaflaRange` retourne `null` pour tout. La fonction publique
 *  `getCategorization` retombe alors sur "pas de catégorie" — c'est à l'UI de
 *  basculer sur l'ACSM (voir messaging dans SettingsPage) ou d'afficher "—".
 */

import type { NormRange, NormSet, TestKey } from './types'

export function getCpaflaRange(_test: TestKey, _age: number, _sex: 'F' | 'M'): NormRange | null {
  return null
}

export const cpaflaNorms: NormSet = {
  getRange: getCpaflaRange
}
