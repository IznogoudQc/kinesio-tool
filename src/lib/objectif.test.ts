import { test } from 'node:test'
import assert from 'node:assert/strict'
import { manualMacros } from './objectif.ts'

test('manualMacros : calories déduites des grammes (P×4 + G×4 + L×9)', () => {
  const m = manualMacros({ nutritionManualProteinG: 180, nutritionManualFatG: 55, nutritionManualCarbG: 200 })
  assert.ok(m)
  assert.equal(m.proteinG, 180)
  assert.equal(m.fatG, 55)
  assert.equal(m.carbsG, 200)
  // 180×4 + 200×4 + 55×9 = 720 + 800 + 495 = 2015
  assert.equal(m.targetKcal, 2015)
})

test('manualMacros : null si une valeur manque', () => {
  assert.equal(manualMacros({ nutritionManualProteinG: 180, nutritionManualFatG: null, nutritionManualCarbG: 200 }), null)
  assert.equal(manualMacros({ nutritionManualProteinG: null, nutritionManualFatG: 55, nutritionManualCarbG: 200 }), null)
  assert.equal(manualMacros({ nutritionManualProteinG: 180, nutritionManualFatG: 55, nutritionManualCarbG: null }), null)
})
