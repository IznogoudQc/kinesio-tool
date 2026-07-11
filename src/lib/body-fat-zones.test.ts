import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bodyFatScale, bodyFatZones } from './body-fat-zones.ts'

test('sexe inconnu → pas d’échelle', () => {
  assert.equal(bodyFatScale(22, null, 40), null)
})

test('homme 25 ans, 23 % → « Acceptable » (14–24 à 20-29)', () => {
  assert.equal(bodyFatScale(23, 'M', 25)!.current?.key, 'acceptable')
})

test('homme 25 ans, 25 % → « Obésité » ; 24,9 % reste « Acceptable »', () => {
  assert.equal(bodyFatScale(25, 'M', 25)!.current?.key, 'obesite')
  assert.equal(bodyFatScale(24.9, 'M', 25)!.current?.key, 'acceptable')
})

test('ajustement selon l’âge : 25 % chez l’homme', () => {
  // 20-29 : obésité dès 25. 60+ : encore « Acceptable » (18–28).
  assert.equal(bodyFatScale(25, 'M', 25)!.current?.key, 'obesite')
  assert.equal(bodyFatScale(25, 'M', 65)!.current?.key, 'acceptable')
})

test('femme : la zone acceptable monte avec l’âge (jusqu’à 35 à 60+)', () => {
  // 34 % : obésité à 20-29 (≥32), mais « Acceptable » à 60+ (25–35).
  assert.equal(bodyFatScale(34, 'F', 25)!.current?.key, 'obesite')
  assert.equal(bodyFatScale(34, 'F', 65)!.current?.key, 'acceptable')
})

test('femme 30 ans, 18 % → « En forme » (15–21)', () => {
  assert.equal(bodyFatScale(18, 'F', 30)!.current?.key, 'forme')
})

test('âge inconnu → tranche 20-29 par défaut', () => {
  assert.deepEqual(
    bodyFatZones('M', null).map(z => z.max),
    bodyFatZones('M', 25).map(z => z.max)
  )
})

test('4 zones contiguës, la dernière sans plafond', () => {
  for (const sex of ['F', 'M'] as const) {
    const z = bodyFatZones(sex, 45)
    assert.equal(z.length, 4)
    for (let i = 1; i < z.length; i++) assert.equal(z[i].min, z[i - 1].max)
    assert.equal(z[z.length - 1].max, null)
  }
})

test('repère borné entre 0 et 1', () => {
  assert.equal(bodyFatScale(0, 'F', 40)!.markerRatio, 0)
  assert.equal(bodyFatScale(999, 'F', 40)!.markerRatio, 1)
  assert.equal(bodyFatScale(null, 'F', 40)!.markerRatio, null)
})
