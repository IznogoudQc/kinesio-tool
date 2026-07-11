import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bodyFatRisk, bodyFatRiskZones } from './body-fat-risk.ts'

test('sexe inconnu → pas d’échelle', () => {
  assert.equal(bodyFatRisk(30, null), null)
})

test('femme 43 % → « Risques élevés » (≥ 42)', () => {
  assert.equal(bodyFatRisk(43, 'F')!.current?.key, 'eleve')
})

test('femme : les 5 zones aux bornes 15/25/34/42', () => {
  assert.equal(bodyFatRisk(10, 'F')!.current?.key, 'potentiel')
  assert.equal(bodyFatRisk(20, 'F')!.current?.key, 'optimal')
  assert.equal(bodyFatRisk(30, 'F')!.current?.key, 'sante')
  assert.equal(bodyFatRisk(38, 'F')!.current?.key, 'modere')
  assert.equal(bodyFatRisk(42, 'F')!.current?.key, 'eleve')
})

test('bornes incluses en bas, exclues en haut (femme, 25 %)', () => {
  assert.equal(bodyFatRisk(24.9, 'F')!.current?.key, 'optimal')
  assert.equal(bodyFatRisk(25, 'F')!.current?.key, 'sante')
})

test('homme 32,8 % → « Risques élevés » (≥ 32,1)', () => {
  assert.equal(bodyFatRisk(32.8, 'M')!.current?.key, 'eleve')
  assert.equal(bodyFatRisk(31, 'M')!.current?.key, 'modere')
  assert.equal(bodyFatRisk(12, 'M')!.current?.key, 'optimal')
})

test('5 zones contiguës, la dernière sans plafond', () => {
  for (const sex of ['F', 'M'] as const) {
    const z = bodyFatRiskZones(sex)
    assert.equal(z.length, 5)
    for (let i = 1; i < z.length; i++) assert.equal(z[i].min, z[i - 1].max)
    assert.equal(z[z.length - 1].max, null)
  }
})

test('repère borné entre 0 et 1', () => {
  assert.equal(bodyFatRisk(0, 'F')!.markerRatio, 0)
  assert.equal(bodyFatRisk(999, 'F')!.markerRatio, 1)
  assert.equal(bodyFatRisk(null, 'F')!.markerRatio, null)
})
