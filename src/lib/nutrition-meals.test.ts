import { test } from 'node:test'
import assert from 'node:assert/strict'
import { macrosPerMeal, DEFAULT_MEALS_PER_DAY, type MacroEstimate } from './nutrition.ts'

const M: MacroEstimate = { bmr: 0, tdee: 0, targetKcal: 2400, proteinG: 180, carbsG: 240, fatG: 60 }

test('macrosPerMeal : partage à parts égales (3 repas)', () => {
  const m = macrosPerMeal(M, 3)
  assert.equal(m.targetKcal, 800)
  assert.equal(m.proteinG, 60)
  assert.equal(m.carbsG, 80)
  assert.equal(m.fatG, 20)
})

test('macrosPerMeal : arrondi (2 repas, valeurs impaires)', () => {
  const m = macrosPerMeal({ bmr: 0, tdee: 0, targetKcal: 2001, proteinG: 181, carbsG: 199, fatG: 55 }, 2)
  assert.equal(m.proteinG, 91) // 181/2 = 90.5 → 91
  assert.equal(m.carbsG, 100) // 199/2 = 99.5 → 100
  assert.equal(m.targetKcal, 1001) // 2001/2 = 1000.5 → 1001
})

test('macrosPerMeal : au moins 1 repas', () => {
  assert.deepEqual(macrosPerMeal(M, 0).proteinG, M.proteinG)
  assert.deepEqual(macrosPerMeal(M, -3).proteinG, M.proteinG)
})

test('DEFAULT_MEALS_PER_DAY = 3', () => {
  assert.equal(DEFAULT_MEALS_PER_DAY, 3)
})
