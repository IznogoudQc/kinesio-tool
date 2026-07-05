/**
 * Tests des auto-calculs (IMC, MET, FC max prédite) et de la conversion
 * catégorie ↔ score 0-5.
 *
 * Lancer : `node --test src/lib/norms/scoring.test.ts` (Node ≥ 22.6 — strip-types).
 *
 * Cas du brief — Nicholas (H, 35 ans, taille 176, poids 99.8, VO2max 49) :
 *   IMC ≈ 32, MET = 14, FC max prédite ≈ 184.
 *
 * NB : `computeSynthesis` n'est pas testé ici parce qu'il importe `acsm.ts` /
 * `cpafla.ts` sans extension (compatible vite/tsc, pas `node --test`). Il est
 * couvert indirectement par les tests `norms.test.ts` (qui vérifient les
 * tables) et manuellement via l'UI.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  categoryToScore,
  computeBmi,
  computeFcMaxPredite,
  computeMet,
  scoreToCategory
} from './calc.ts'

const close = (a: number | null, b: number, eps = 0.5) =>
  a !== null && Math.abs(a - b) <= eps

test('computeBmi — Nicholas 176cm / 99.8kg → ~32', () => {
  const v = computeBmi(176, 99.8)
  assert.ok(close(v, 32.2))
})

test('computeBmi — données manquantes → null', () => {
  assert.equal(computeBmi(undefined, 80), null)
  assert.equal(computeBmi(170, undefined), null)
  assert.equal(computeBmi(0, 80), null)
})

test('computeMet — VO2max 49 → 14', () => {
  assert.equal(computeMet(49), 14)
})

test('computeMet — manquant → null', () => {
  assert.equal(computeMet(undefined), null)
  assert.equal(computeMet(0), null)
})

test('computeFcMaxPredite — Tanaka, 35 ans → 183.5', () => {
  const v = computeFcMaxPredite(35)
  assert.ok(close(v, 183.5, 0.01))
})

test('computeFcMaxPredite — Tanaka, 50 ans → 173', () => {
  const v = computeFcMaxPredite(50)
  assert.ok(close(v, 173, 0.01))
})

test('computeFcMaxPredite — âge null → null', () => {
  assert.equal(computeFcMaxPredite(null), null)
})

test('categoryToScore — échelle 1-5 (Excellent = 5)', () => {
  assert.equal(categoryToScore('A_AMELIORER'), 1)
  assert.equal(categoryToScore('ACCEPTABLE'), 2)
  assert.equal(categoryToScore('BIEN'), 3)
  assert.equal(categoryToScore('TRES_BIEN'), 4)
  assert.equal(categoryToScore('EXCELLENT'), 5)
  assert.equal(categoryToScore(null), null)
})

test('scoreToCategory — bornes 1.5 / 2.5 / 3.5 / 4.5', () => {
  assert.equal(scoreToCategory(1.0), 'A_AMELIORER')
  assert.equal(scoreToCategory(1.49), 'A_AMELIORER')
  assert.equal(scoreToCategory(1.5), 'ACCEPTABLE')
  assert.equal(scoreToCategory(2.49), 'ACCEPTABLE')
  assert.equal(scoreToCategory(2.5), 'BIEN')
  assert.equal(scoreToCategory(3.49), 'BIEN')
  assert.equal(scoreToCategory(3.5), 'TRES_BIEN')
  assert.equal(scoreToCategory(4.49), 'TRES_BIEN')
  assert.equal(scoreToCategory(4.5), 'EXCELLENT')
  assert.equal(scoreToCategory(5.0), 'EXCELLENT')
  assert.equal(scoreToCategory(null), null)
})
