import { test } from 'node:test'
import assert from 'node:assert/strict'
import { manualMacros } from './objectif.ts'

test('manualMacros : glucides déduits des calories', () => {
  const m = manualMacros({ nutritionTargetKcal: 2000, nutritionManualProteinG: 180, nutritionManualFatG: 55 })
  assert.ok(m)
  assert.equal(m.targetKcal, 2000)
  assert.equal(m.proteinG, 180)
  assert.equal(m.fatG, 55)
  // (2000 − 180×4 − 55×9) / 4 = (2000 − 720 − 495) / 4 = 196.25 → 196
  assert.equal(m.carbsG, 196)
})

test('manualMacros : glucides jamais négatifs', () => {
  const m = manualMacros({ nutritionTargetKcal: 800, nutritionManualProteinG: 200, nutritionManualFatG: 60 })
  assert.ok(m)
  assert.equal(m.carbsG, 0)
})

test('manualMacros : null si une valeur manque', () => {
  assert.equal(manualMacros({ nutritionTargetKcal: 2000, nutritionManualProteinG: null, nutritionManualFatG: 55 }), null)
  assert.equal(manualMacros({ nutritionTargetKcal: null, nutritionManualProteinG: 180, nutritionManualFatG: 55 }), null)
})
