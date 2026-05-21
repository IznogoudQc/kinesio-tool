/**
 * Tests du calcul de position pour `<CategoryRangeBar>`.
 *
 * Lancer : `node --test src/components/CategoryRangeBar.test.ts`
 *
 * Cas du brief :
 *  - VO2max 49 H 48y (ACSM M 40-49) → ~88 % sur la barre
 *  - % gras 30.2 H 48y (lowerIsBetter) → ~25-30 % sur la barre
 *  - valeur < p10 (resp. > p10 si lowerIsBetter) → marqueur tout à gauche
 *  - valeur > p90 (resp. < p90 si lowerIsBetter) → marqueur tout à droite
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculatePosition } from '../lib/range-bar-position.ts'

// VO2max H 40-49 (ACSM 11e éd. calibré v0.1.18).
const VO2MAX_M40 = { p10: 23, p25: 30, p50: 35, p75: 43, p90: 50 }

// % gras M 40-49 (lowerIsBetter, calibré v0.1.18).
const BODY_FAT_M40 = { p10: 35, p25: 30, p50: 25, p75: 20, p90: 14 }

const close = (a: number, b: number, eps = 1) => Math.abs(a - b) <= eps

test('VO2max 49 H 48y → ~88 % (dans Excellent)', () => {
  const pos = calculatePosition(49, VO2MAX_M40)
  assert.ok(close(pos, 88, 2), `attendu ~88, reçu ${pos}`)
})

test('VO2max exactement à P50 (35) → 50 %', () => {
  assert.equal(calculatePosition(35, VO2MAX_M40), 50)
})

test('VO2max < p10 (5) → marqueur tout à gauche (≤ 10)', () => {
  const pos = calculatePosition(5, VO2MAX_M40)
  assert.ok(pos <= 10, `attendu ≤10, reçu ${pos}`)
})

test('VO2max > p90 (70) → marqueur tout à droite (≥ 90, clampé 100)', () => {
  const pos = calculatePosition(70, VO2MAX_M40)
  assert.ok(pos >= 90 && pos <= 100, `attendu 90-100, reçu ${pos}`)
})

test('% gras 30.2 H 48y (lowerIsBetter) → ~25 % (Acceptable, pas Excellent)', () => {
  const pos = calculatePosition(30.2, BODY_FAT_M40, true)
  // 30.2 tombe entre p25 (30) et p10 (35) — en raison de lowerIsBetter,
  // c'est dans la zone Acceptable (20-40 %).
  assert.ok(pos >= 20 && pos <= 35, `attendu 20-35, reçu ${pos}`)
})

test('% gras 14 (P90 — très lean) → ~90 % (Excellent)', () => {
  const pos = calculatePosition(14, BODY_FAT_M40, true)
  assert.equal(pos, 90)
})

test('% gras 40 (très haut, > p10=35) → ~0-10 % (À améliorer)', () => {
  const pos = calculatePosition(40, BODY_FAT_M40, true)
  assert.ok(pos <= 10, `attendu ≤10, reçu ${pos}`)
})

test('% gras 10 (très bas, < p90=14) → marqueur clampé ≥ 90', () => {
  const pos = calculatePosition(10, BODY_FAT_M40, true)
  assert.ok(pos >= 90 && pos <= 100, `attendu 90-100, reçu ${pos}`)
})

test('Valeur NaN ou non-finie → 0', () => {
  assert.equal(calculatePosition(Number.NaN, VO2MAX_M40), 0)
  assert.equal(calculatePosition(Number.POSITIVE_INFINITY, VO2MAX_M40), 0)
})

test('Push-ups 28 H 48y (M 40-49 percentiles ≈ 9/12/16/22/28) → ~90 %', () => {
  const pushups = { p10: 9, p25: 12, p50: 16, p75: 22, p90: 28 }
  const pos = calculatePosition(28, pushups)
  assert.equal(pos, 90)
})
