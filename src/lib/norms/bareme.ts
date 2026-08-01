/**
 * Rendu des barèmes de référence — source unique pour les trois surfaces qui en
 * affichent un : le dashboard (`MusculoRadar`), le rapport PDF
 * (`NormReferenceTable`) et la feuille imprimable (`BaremesPage`).
 *
 * Les trois le faisaient chacun de leur côté, et les trois divergeaient :
 *
 *  - Le PDF titrait « Barème de référence — ACSM » et signait « ACSM Guidelines,
 *    11ᵉ éd. » alors qu'il affichait des chiffres CPAFLA. Même défaut que celui
 *    corrigé en v0.9.64 sur `BaremesPage` : une source écrite à la main finit
 *    par mentir. Ici on la **déduit** de la table réellement retenue.
 *
 *  - Le PDF et `BaremesPage` rendaient des plages qui **se chevauchent**
 *    (`18–24` puis `24–29`), alors que `categorize()` tranche à `value >= p25` :
 *    24 est « Bien », pas « Acceptable ». Le dashboard, lui, affichait
 *    correctement `18–23` / `24–28`. Un client pouvait lire sa valeur dans deux
 *    colonnes de couleurs différentes.
 */

import { ACSM_TABLES } from './acsm.ts'
import { CPAFLA_TABLES } from './cpafla.ts'
import type { Category, NormPercentiles, NormRange, TestKey } from './types.ts'

/** Provenance du barème réellement appliqué à un test. */
export interface NormSource {
  /** Pour un titre : « CPAFLA », « ACSM ». */
  short: string
  /** Pour une note de bas de tableau, sans le « Source : ». */
  full: string
}

/** Tables musculosquelettiques — Figures 7-18 / 7-19 du guide. */
const CPAFLA_GUIDE: NormSource = {
  short: 'CPAFLA',
  full: 'CPAFLA / ÉCPHV — Guide du conseiller, 3ᵉ éd.'
}
/**
 * Capacité aérobie — **tableau 4.10** du guide, « VO2max estimé : évaluation des
 * avantages pour la santé ».
 *
 * On garde une entrée distincte de `CPAFLA_GUIDE` pour citer le bon numéro de
 * tableau : les tables musculo viennent des figures 7-18 / 7-19, celle-ci du
 * chapitre 4. Marie doit pouvoir retrouver la page dans son guide.
 *
 * Cette source a d'abord été attribuée à l'aide-mémoire SPAP-SCPE (outil n° 26),
 * qui reproduit ce même tableau — les valeurs encodées étaient donc justes, mais
 * la feuille des barèmes citait un document que Marie n'a pas sous la main.
 */
const CPAFLA_AEROBIE: NormSource = {
  short: 'CPAFLA',
  full: 'CPAFLA / ÉCPHV — Guide du conseiller, 3ᵉ éd., tableau 4.10'
}
const ACSM_SOURCE: NormSource = {
  short: 'ACSM',
  full: 'ACSM Guidelines, 11ᵉ édition'
}

/** Publication CPAFLA d'origine, par test. Défaut : le guide. */
const CPAFLA_SOURCE_BY_TEST: Partial<Record<TestKey, NormSource>> = {
  vo2max: CPAFLA_AEROBIE
}

/** Une table CPAFLA existe-t-elle pour ce test ? Même résolution que `getRange`
 *  (CPAFLA d'abord, ACSM en repli) — c'est ce qui rend la source fiable. */
export function hasCpaflaTable(test: TestKey): boolean {
  const t = CPAFLA_TABLES[test] as NormRange[] | null
  return Boolean(t && t.length > 0)
}

/** Source du barème appliqué à ce test — déduite, jamais écrite à la main. */
export function normSourceForTest(test: TestKey): NormSource {
  if (!hasCpaflaTable(test)) return ACSM_SOURCE
  return CPAFLA_SOURCE_BY_TEST[test] ?? CPAFLA_GUIDE
}

/** Source commune à un groupe de tests, ou `null` si le groupe est mixte —
 *  auquel cas l'appelant doit afficher la source ligne par ligne plutôt que de
 *  coiffer le tableau d'un libellé qui vaudrait pour une partie seulement. */
export function commonNormSource(tests: TestKey[]): NormSource | null {
  if (tests.length === 0) return null
  const first = normSourceForTest(tests[0])
  return tests.every(t => normSourceForTest(t).short === first.short) ? first : null
}

/** Repli ACSM disponible pour un test sans table CPAFLA (sert au rendu). */
export function hasAcsmTable(test: TestKey): boolean {
  const t = ACSM_TABLES[test] as NormRange[] | null
  return Boolean(t && t.length > 0)
}

/**
 * Pas d'affichage entre deux catégories contiguës.
 *
 * Les bornes de `categorize()` sont inclusives d'un côté et exclusives de
 * l'autre : la case précédente s'arrête juste **en dessous** du seuil suivant.
 * Sur une échelle entière (reps, cm, secondes, watts) c'est « seuil − 1 ». Sur
 * une échelle décimale (VO2max, % de gras) on descend au dixième, sinon on
 * afficherait `18–23` là où 23,5 existe et appartient bien à la case du bas.
 */
function stepFor(p: NormPercentiles): number {
  const allInt = [p.p10, p.p25, p.p50, p.p75].every(v => Number.isInteger(v))
  return allInt ? 1 : 0.1
}

function fmt(v: number, step: number): string {
  return v.toLocaleString('fr-CA', {
    minimumFractionDigits: step < 1 ? 1 : 0,
    maximumFractionDigits: step < 1 ? 1 : 0
  })
}

/**
 * Plages affichables des 5 catégories, **sans chevauchement** et fidèles aux
 * bornes de `categorize()`.
 *
 * `lowerIsBetter` inverse tout : les percentiles sont alors en ordre
 * décroissant (p10 > p25 > … > p75) et les comparaisons sont strictes.
 */
export function categoryCells(p: NormPercentiles, lowerIsBetter: boolean): Record<Category, string> {
  const s = stepFor(p)
  const f = (v: number) => fmt(v, s)
  if (lowerIsBetter) {
    // `value < p75` → Excellent ; `value >= p10` → À améliorer.
    return {
      EXCELLENT: `< ${f(p.p75)}`,
      TRES_BIEN: `${f(p.p75)}–${f(p.p50 - s)}`,
      BIEN: `${f(p.p50)}–${f(p.p25 - s)}`,
      ACCEPTABLE: `${f(p.p25)}–${f(p.p10 - s)}`,
      A_AMELIORER: `≥ ${f(p.p10)}`
    }
  }
  // `value >= p75` → Excellent ; `value < p10` → À améliorer.
  return {
    A_AMELIORER: `≤ ${f(p.p10 - s)}`,
    ACCEPTABLE: `${f(p.p10)}–${f(p.p25 - s)}`,
    BIEN: `${f(p.p25)}–${f(p.p50 - s)}`,
    TRES_BIEN: `${f(p.p50)}–${f(p.p75 - s)}`,
    EXCELLENT: `≥ ${f(p.p75)}`
  }
}
