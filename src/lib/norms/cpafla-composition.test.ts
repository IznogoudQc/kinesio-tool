import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpaflaComposition } from './cpafla-composition.ts'

test('exemple du guide — femme IMC 25,8 · CT 91 · S5PC 116,6 → 1 (Acceptable)', () => {
  // Fig 7-5, plage 25-29,9 : CT 91 (>87) → B=1 ; S5PC 116,6 (>113) → C=2.
  // (1×1,5 + 2)/2,5 = 1,4 → arrondi → 1.
  assert.equal(cpaflaComposition({ imc: 25.8, ct: 91, s5pc: 116.6, sex: 'F' }), 1)
})

test('homme mince — IMC 22 · CT 80 · S5PC 40 → 4 (Excellent)', () => {
  // Plage 18,5-24,9 : CT 80 (<94) → B=4 ; S5PC 40 (<54) → C=4. (4×1,5+4)/2,5 = 4.
  assert.equal(cpaflaComposition({ imc: 22, ct: 80, s5pc: 40, sex: 'M' }), 4)
})

test('combinaison IMC + CT (pas de S5PC) → points colonne B', () => {
  // Homme IMC 27 (25-29,9), CT 96 (94-101) → B=3.
  assert.equal(cpaflaComposition({ imc: 27, ct: 96, s5pc: null, sex: 'M' }), 3)
})

test('combinaison IMC + S5PC (pas de CT) → points colonne C', () => {
  // Homme IMC 27, S5PC 60 (54-77) → C=3.
  assert.equal(cpaflaComposition({ imc: 27, ct: null, s5pc: 60, sex: 'M' }), 3)
})

test('CT seule → évaluée dans la plage IMC 27 (25-29,9)', () => {
  // Homme, CT 90 (<94) dans la plage 25-29,9 → B=4.
  assert.equal(cpaflaComposition({ imc: null, ct: 90, s5pc: null, sex: 'M' }), 4)
  // CT 105 (>101) → B=1.
  assert.equal(cpaflaComposition({ imc: null, ct: 105, s5pc: null, sex: 'M' }), 1)
})

test('IMC seul → colonne A', () => {
  assert.equal(cpaflaComposition({ imc: 22, ct: null, s5pc: null, sex: 'M' }), 4) // 18,5-24,9 → A=4
  assert.equal(cpaflaComposition({ imc: 31, ct: null, s5pc: null, sex: 'M' }), 2) // 30-32,4 → A=2
  assert.equal(cpaflaComposition({ imc: 40, ct: null, s5pc: null, sex: 'F' }), 0) // >35 → A=0
})

test('bornes de plage d’IMC (35,0 → plage 32,5-35 ; 35,3 → >35)', () => {
  // Homme CT 90 (<94→4 dans les deux plages hautes), donc on teste A via IMC seul.
  assert.equal(cpaflaComposition({ imc: 35.0, ct: null, s5pc: null, sex: 'M' }), 1) // 32,5-35 → A=1
  assert.equal(cpaflaComposition({ imc: 35.3, ct: null, s5pc: null, sex: 'M' }), 0) // >35 → A=0
})

test('sexe / mesures manquants → null', () => {
  assert.equal(cpaflaComposition({ imc: 25, ct: 90, s5pc: 100, sex: null }), null)
  assert.equal(cpaflaComposition({ imc: null, ct: null, s5pc: 100, sex: 'M' }), null)
})
