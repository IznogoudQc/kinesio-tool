/**
 * Tests des bornes de plausibilité des champs de bilan.
 *
 * Lancer : `node --test src/lib/bilan-bounds.test.ts` (Node ≥ 22.6 — strip-types).
 *
 * Invariant clé : les bornes dures ne rejettent JAMAIS une donnée réelle —
 * le cas Nicholas Jean (bilan .docx importé) doit passer intégralement.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateBilanField } from './bilan-bounds.ts'

test('taille : plage normale, inhabituelle, impossible', () => {
  assert.equal(validateBilanField('taille_cm', 176).level, 'ok')
  assert.equal(validateBilanField('taille_cm', 95).level, 'warn')
  assert.equal(validateBilanField('taille_cm', 300).level, 'error')
  assert.equal(validateBilanField('taille_cm', -5).level, 'error')
})

test('flexion du tronc : le négatif est légitime (sit-and-reach)', () => {
  assert.equal(validateBilanField('flexion_tronc_cm', -10).level, 'ok')
  assert.equal(validateBilanField('flexion_tronc_cm', -20).level, 'warn')
  assert.equal(validateBilanField('flexion_tronc_cm', -40).level, 'error')
})

test('vo2max : bornes physiologiques', () => {
  assert.equal(validateBilanField('vo2max', 49).level, 'ok')
  assert.equal(validateBilanField('vo2max', 95).level, 'warn')
  assert.equal(validateBilanField('vo2max', 120).level, 'error')
  assert.equal(validateBilanField('vo2max', -1).level, 'error')
})

test('champ sans borne (puissance des jambes) : toujours ok', () => {
  assert.equal(validateBilanField('puissance_jambes_watts', 6500).level, 'ok')
  assert.equal(validateBilanField('puissance_jambes_watts', -100).level, 'ok')
  assert.equal(validateBilanField('met_equivalent', 14).level, 'ok')
})

test('valeur absente ou NaN : ok', () => {
  assert.equal(validateBilanField('taille_cm', undefined).level, 'ok')
  assert.equal(validateBilanField('taille_cm', null).level, 'ok')
  assert.equal(validateBilanField('taille_cm', NaN).level, 'ok')
})

test('les messages précisent la plage attendue', () => {
  const err = validateBilanField('taille_cm', 300)
  assert.ok(err.message?.includes('0') && err.message.includes('260'))
  const warn = validateBilanField('fc_repos', 20)
  assert.equal(warn.level, 'warn')
  assert.ok(warn.message?.includes('30') && warn.message.includes('120'))
})

test('cas Nicholas Jean (bilan réel importé) : aucune valeur rejetée ni signalée', () => {
  const nicholas: Record<string, number> = {
    taille_cm: 176,
    poids_kg: 99.8,
    imc: 32.2,
    tour_taille_cm: 106,
    tour_hanche_cm: 116,
    pli_triceps: 15,
    pli_biceps: 10,
    pli_sous_scap: 30,
    pli_iliaque: 32,
    pourcentage_gras: 30.2,
    vo2max: 49,
    fc_repos: 66,
    pa_systolique: 129,
    pa_diastolique: 82,
    pushups: 28,
    situps: 25,
    saut_vertical_cm: 48,
    flexion_tronc_cm: 30,
    endurance_dos_sec: 180
  }
  for (const [key, value] of Object.entries(nicholas)) {
    assert.equal(validateBilanField(key, value).level, 'ok', `${key}=${value} devrait être ok`)
  }
})
