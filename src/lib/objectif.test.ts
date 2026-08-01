import { test } from 'node:test'
import assert from 'node:assert/strict'
import { manualMacros } from './objectif.ts'
import { fiberTargetG } from './nutrition.ts'

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

test('manualMacros : les fibres de Marie priment sur le calcul automatique', () => {
  const base = { nutritionManualProteinG: 180, nutritionManualFatG: 55, nutritionManualCarbG: 200 }
  // 2015 kcal → 14 g / 1000 kcal. La valeur imposée doit s'en écarter, sinon
  // le test passerait même si le remplacement n'était pas branché.
  const auto = fiberTargetG(2015)
  const impose = auto + 12
  assert.equal(manualMacros({ ...base, nutritionManualFiberG: impose })?.fiberG, impose)
})

test('manualMacros : sans fibres imposées, retour aux 14 g / 1000 kcal', () => {
  const base = { nutritionManualProteinG: 180, nutritionManualFatG: 55, nutritionManualCarbG: 200 }
  const auto = fiberTargetG(2015)
  assert.equal(manualMacros(base)?.fiberG, auto)
  assert.equal(manualMacros({ ...base, nutritionManualFiberG: null })?.fiberG, auto)
})

test('manualMacros : fibres à 0 respectées (0 n’est pas « absent »)', () => {
  const m = manualMacros({
    nutritionManualProteinG: 180,
    nutritionManualFatG: 55,
    nutritionManualCarbG: 200,
    nutritionManualFiberG: 0
  })
  assert.equal(m?.fiberG, 0)
})
