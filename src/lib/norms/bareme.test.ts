/**
 * Tests du rendu partagé des barèmes.
 *
 * Lancer : `node --test src/lib/norms/bareme.test.ts`
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categoryCells, commonNormSource, normSourceForTest } from './bareme.ts'
import { getCategorization } from './index.ts'
import { getCpaflaRange } from './cpafla.ts'
import type { Category, TestKey } from './types.ts'

// ── Source déduite ───────────────────────────────────────────────────────────

test('les six tests musculo sont cotés en CPAFLA (le PDF annonçait ACSM)', () => {
  const musculo: TestKey[] = ['pushups', 'situps', 'trunkFlexion', 'backEndurance', 'verticalJump', 'legPower']
  for (const t of musculo) {
    assert.equal(normSourceForTest(t).short, 'CPAFLA', `${t} devrait être CPAFLA`)
  }
  assert.equal(commonNormSource(musculo)?.short, 'CPAFLA')
})

test('le VO2max reste ACSM — aucune table CPAFLA fiable pour le mCAFT', () => {
  assert.equal(normSourceForTest('vo2max').short, 'ACSM')
})

test('un groupe mixte ne reçoit pas de source unique', () => {
  assert.equal(commonNormSource(['pushups', 'vo2max']), null)
  assert.equal(commonNormSource([]), null)
})

// ── Plages sans chevauchement ────────────────────────────────────────────────

/** Reconstruit la catégorie annoncée pour une valeur, en relisant les cases. */
const CATS: Category[] = ['A_AMELIORER', 'ACCEPTABLE', 'BIEN', 'TRES_BIEN', 'EXCELLENT']

test('flexion du tronc H 40-49 : 24 est « Bien » seul, plus « Acceptable » aussi', () => {
  const range = getCpaflaRange('trunkFlexion', 45, 'M')
  assert.ok(range, 'table CPAFLA attendue')
  const cells = categoryCells(range.percentiles, range.lowerIsBetter ?? false)
  // Le PDF affichait « 18–24 » puis « 24–29 » : 24 dans deux colonnes.
  assert.equal(cells.ACCEPTABLE, '18–23')
  assert.equal(cells.BIEN, '24–28')
  assert.equal(cells.TRES_BIEN, '29–34')
  assert.equal(cells.EXCELLENT, '≥ 35')
  assert.equal(cells.A_AMELIORER, '≤ 17')
})

test('chaque borne affichée retombe bien dans la catégorie que categorize() donne', () => {
  const tests: TestKey[] = ['pushups', 'situps', 'trunkFlexion', 'backEndurance', 'verticalJump', 'legPower']
  for (const t of tests) {
    const range = getCpaflaRange(t, 45, 'M')
    if (!range) continue
    const p = range.percentiles
    const cells = categoryCells(p, range.lowerIsBetter ?? false)
    // Pour chaque seuil, la valeur exacte doit appartenir à la case qui l'ouvre,
    // et la valeur juste en dessous à la case précédente.
    const pairs: [number, Category, Category][] = [
      [p.p10, 'ACCEPTABLE', 'A_AMELIORER'],
      [p.p25, 'BIEN', 'ACCEPTABLE'],
      [p.p50, 'TRES_BIEN', 'BIEN'],
      [p.p75, 'EXCELLENT', 'TRES_BIEN']
    ]
    for (const [threshold, atOrAbove, below] of pairs) {
      assert.equal(getCategorization(t, threshold, 45, 'M', 'cpafla'), atOrAbove, `${t} @ ${threshold}`)
      assert.equal(getCategorization(t, threshold - 1, 45, 'M', 'cpafla'), below, `${t} @ ${threshold - 1}`)
    }
    // Aucune case vide.
    for (const c of CATS) assert.ok(cells[c].length > 0, `${t} / ${c}`)
  }
})

test('échelle décimale : on descend au dixième, pas à l’unité', () => {
  const cells = categoryCells({ p10: 20.5, p25: 30.2, p50: 40, p75: 50.8, p90: 60 }, false)
  assert.equal(cells.A_AMELIORER, '≤ 20,4')
  assert.equal(cells.ACCEPTABLE, '20,5–30,1')
  assert.equal(cells.EXCELLENT, '≥ 50,8')
})

test('lowerIsBetter : l’ordre s’inverse et les bornes restent jointives', () => {
  // Percentiles décroissants (somme des plis : moins = mieux).
  const cells = categoryCells({ p10: 60, p25: 50, p50: 40, p75: 30, p90: 20 }, true)
  assert.equal(cells.EXCELLENT, '< 30')
  assert.equal(cells.TRES_BIEN, '30–39')
  assert.equal(cells.BIEN, '40–49')
  assert.equal(cells.ACCEPTABLE, '50–59')
  assert.equal(cells.A_AMELIORER, '≥ 60')
})
