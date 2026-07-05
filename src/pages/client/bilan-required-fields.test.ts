/**
 * Tests du garde-fou « champs importants manquants ».
 * Lancer : `node --test src/pages/client/bilan-required-fields.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { missingImportantFields, IMPORTANT_BILAN_FIELDS } from './bilan-required-fields.ts'

test('bilan vide → tous les champs importants manquent', () => {
  const missing = missingImportantFields({} as BilanData)
  assert.equal(missing.length, IMPORTANT_BILAN_FIELDS.length)
})

test('bilan complet sur les champs importants → aucun manque', () => {
  const data = {
    taille_cm: 176,
    poids_kg: 80,
    tour_taille_cm: 90,
    vo2max: 45,
    pa_systolique: 120,
    pa_diastolique: 80,
    pushups: 20,
    situps: 25
  } as unknown as BilanData
  assert.deepEqual(missingImportantFields(data), [])
})

test('bilan partiel → liste les seuls champs vides', () => {
  const data = { taille_cm: 176, poids_kg: 80, vo2max: 45 } as unknown as BilanData
  const missingKeys = missingImportantFields(data).map(f => f.key)
  assert.ok(!missingKeys.includes('taille_cm'))
  assert.ok(!missingKeys.includes('vo2max'))
  assert.ok(missingKeys.includes('tour_taille_cm'))
  assert.ok(missingKeys.includes('pa_systolique'))
  assert.ok(missingKeys.includes('pushups'))
})

test('valeur 0 compte comme renseignée (0 push-ups est une vraie donnée)', () => {
  const data = { pushups: 0 } as unknown as BilanData
  const missingKeys = missingImportantFields(data).map(f => f.key)
  assert.ok(!missingKeys.includes('pushups'))
})

test('NaN / chaîne vide comptent comme manquants', () => {
  const data = { taille_cm: NaN, poids_kg: '' } as unknown as BilanData
  const missingKeys = missingImportantFields(data).map(f => f.key)
  assert.ok(missingKeys.includes('taille_cm'))
  assert.ok(missingKeys.includes('poids_kg'))
})
