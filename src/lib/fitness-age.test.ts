/**
 * Tests de l'« âge en forme » (VO2max → âge physiologique).
 *
 * Lancer : `node --test src/lib/fitness-age.test.ts`
 *
 * Courbe médiane H : 20→48, 30→45, 40→41, 50→37, 60→33, 70→29, 80→26.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitnessAge } from './fitness-age.ts'

test('Nicholas — VO2max 49 (H) ≥ médiane à 20 ans → plancher 20', () => {
  assert.equal(fitnessAge(49, 'M'), 20)
})

test('VO2max = médiane exacte à 40 ans (H, 41) → 40', () => {
  assert.equal(fitnessAge(41, 'M'), 40)
})

test('VO2max entre deux paliers (H, 43) → interpolé ~35', () => {
  // 43 entre 45 (30 ans) et 41 (40 ans) : t = (45−43)/(45−41)=0.5 → 35
  assert.equal(fitnessAge(43, 'M'), 35)
})

test('VO2max très bas (H, 20) → plafond 80', () => {
  assert.equal(fitnessAge(20, 'M'), 80)
})

test('Femme — VO2max 35 = médiane à 40 ans → 40', () => {
  assert.equal(fitnessAge(35, 'F'), 40)
})

test('Femme — VO2max 42 → plancher 20', () => {
  assert.equal(fitnessAge(42, 'F'), 20)
})

test('Données manquantes → null', () => {
  assert.equal(fitnessAge(null, 'M'), null)
  assert.equal(fitnessAge(45, null), null)
  assert.equal(fitnessAge(Number.NaN, 'F'), null)
})
