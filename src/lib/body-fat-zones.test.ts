import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bodyFatScale, ACE_ZONES } from './body-fat-zones.ts'

test('sexe inconnu → pas d’échelle', () => {
  assert.equal(bodyFatScale(22, null), null)
})

test('femme : 22 % → « En forme » (ACE 21–24)', () => {
  const s = bodyFatScale(22, 'F')!
  assert.equal(s.current?.key, 'forme')
})

test('femme : 30 % → « Acceptable »', () => {
  assert.equal(bodyFatScale(30, 'F')!.current?.key, 'acceptable')
})

test('femme : 36 % → « Obésité » (risque)', () => {
  const z = bodyFatScale(36, 'F')!.current
  assert.equal(z?.key, 'obesite')
  assert.equal(z?.tone, 'risk')
})

test('homme : 16 % → « En forme », 26 % → « Obésité »', () => {
  assert.equal(bodyFatScale(16, 'M')!.current?.key, 'forme')
  assert.equal(bodyFatScale(26, 'M')!.current?.key, 'obesite')
})

test('valeur au ras d’une borne : la borne basse est incluse', () => {
  // Femme, 25 % = début d’« Acceptable »
  assert.equal(bodyFatScale(25, 'F')!.current?.key, 'acceptable')
  // 24,9 % reste « En forme »
  assert.equal(bodyFatScale(24.9, 'F')!.current?.key, 'forme')
})

test('repère borné entre 0 et 1', () => {
  assert.equal(bodyFatScale(0, 'F')!.markerRatio, 0)
  assert.equal(bodyFatScale(999, 'F')!.markerRatio, 1)
  assert.equal(bodyFatScale(null, 'F')!.markerRatio, null)
})

test('les zones sont contiguës (pas de trou entre bornes)', () => {
  for (const sex of ['F', 'M'] as const) {
    const z = ACE_ZONES[sex]
    for (let i = 1; i < z.length; i++) assert.equal(z[i].min, z[i - 1].max)
  }
})
