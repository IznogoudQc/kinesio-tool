import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeBilanData } from './bilan-merge.ts'

test('une correction de valeur écrase l’ancienne (le bug du saut 43 → 48)', () => {
  const r = mergeBilanData({ saut_vertical_cm: 43, vo2max: 45 }, { saut_vertical_cm: 48, vo2max: 45 })
  assert.equal(r.data.saut_vertical_cm, 48)
  assert.deepEqual(r.changedKeys, ['saut_vertical_cm'])
})

test('un champ absent du .docx garde sa valeur en base', () => {
  const r = mergeBilanData({ vo2max: 45, pushups: 20 }, { vo2max: 47 })
  assert.equal(r.data.pushups, 20)
  assert.equal(r.data.vo2max, 47)
})

test('un .docx partiel n’efface rien (null / undefined / chaîne vide ignorés)', () => {
  const r = mergeBilanData(
    { vo2max: 45, pushups: 20, test_aerobie: 'Bruce' },
    { vo2max: undefined, pushups: null, test_aerobie: '' }
  )
  assert.deepEqual(r.data, { vo2max: 45, pushups: 20, test_aerobie: 'Bruce' })
  assert.deepEqual(r.changedKeys, [])
})

test('un nouveau champ est ajouté', () => {
  const r = mergeBilanData({ vo2max: 45 }, { situps: 30 })
  assert.equal(r.data.situps, 30)
  assert.deepEqual(r.changedKeys, ['situps'])
})

test('import identique → aucun changement', () => {
  const r = mergeBilanData({ vo2max: 45, pushups: 20 }, { vo2max: 45, pushups: 20 })
  assert.deepEqual(r.changedKeys, [])
})

test('mettre une valeur à 0 est un vrai changement (0 n’est pas « vide »)', () => {
  const r = mergeBilanData({ pushups: 12 }, { pushups: 0 })
  assert.equal(r.data.pushups, 0)
  assert.deepEqual(r.changedKeys, ['pushups'])
})

test('un booléen false est conservé (drapeaux _auto)', () => {
  const r = mergeBilanData({ puissance_auto: true }, { puissance_auto: false })
  assert.equal(r.data.puissance_auto, false)
  assert.deepEqual(r.changedKeys, ['puissance_auto'])
})
