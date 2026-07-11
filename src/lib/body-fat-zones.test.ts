import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bodyFatScale } from './body-fat-zones.ts'
import { getCategorization, getNormPercentiles } from './norms/index.ts'

test('sexe inconnu → pas d’échelle', () => {
  assert.equal(bodyFatScale(22, null, 40), null)
})

test('âge inconnu → pas d’échelle (les normes ACSM sont par tranche d’âge)', () => {
  assert.equal(bodyFatScale(22, 'M', null), null)
})

test('les 5 zones ACSM correspondent aux cutoffs des percentiles (H 20-29)', () => {
  const p = getNormPercentiles('bodyFat', 25, 'M', 'acsm')!.percentiles
  const zones = bodyFatScale(20, 'M', 25)!.zones
  assert.deepEqual(
    zones.map(z => [z.category, z.min, z.max]),
    [
      ['EXCELLENT', 0, p.p75],
      ['TRES_BIEN', p.p75, p.p50],
      ['BIEN', p.p50, p.p25],
      ['ACCEPTABLE', p.p25, p.p10],
      ['A_AMELIORER', p.p10, null]
    ]
  )
})

test('la zone du client coïncide toujours avec la catégorie ACSM', () => {
  for (const [pct, sex, age] of [
    [10, 'M', 25], [15, 'M', 25], [17, 'M', 25], [20, 'M', 25], [33, 'M', 25],
    [18, 'F', 30], [24, 'F', 30], [33, 'F', 65]
  ] as const) {
    assert.equal(
      bodyFatScale(pct, sex, age)!.current?.category,
      getCategorization('bodyFat', pct, age, sex, 'acsm')
    )
  }
})

test('ajustement selon l’âge — homme 25 % : « À améliorer » à 25 ans, « Bien » à 45 ans', () => {
  assert.equal(bodyFatScale(25, 'M', 25)!.current?.category, 'A_AMELIORER')
  assert.equal(bodyFatScale(25, 'M', 45)!.current?.category, 'BIEN')
})

test('ajustement selon l’âge — femme 33 % : « À améliorer » à 25 ans, « Acceptable » à 65 ans', () => {
  assert.equal(bodyFatScale(33, 'F', 25)!.current?.category, 'A_AMELIORER')
  assert.equal(bodyFatScale(33, 'F', 65)!.current?.category, 'ACCEPTABLE')
})

test('5 zones contiguës, ascendantes, la dernière sans plafond', () => {
  for (const sex of ['F', 'M'] as const) {
    const z = bodyFatScale(20, sex, 45)!.zones
    assert.equal(z.length, 5)
    for (let i = 1; i < z.length; i++) assert.equal(z[i].min, z[i - 1].max)
    assert.equal(z[z.length - 1].max, null)
  }
})

test('repère borné entre 0 et 1', () => {
  assert.equal(bodyFatScale(0, 'F', 40)!.markerRatio, 0)
  assert.equal(bodyFatScale(999, 'F', 40)!.markerRatio, 1)
  assert.equal(bodyFatScale(null, 'F', 40)!.markerRatio, null)
})
