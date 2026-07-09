import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectHealthFlags } from './health-flags.ts'

const ids = (data: Record<string, unknown>, sex: 'F' | 'M' | null = 'M'): string[] =>
  detectHealthFlags(data as BilanData, sex).map(f => f.id)

test('bilan sain → aucun signal', () => {
  assert.deepEqual(ids({ pa_systolique: 118, pa_diastolique: 76, imc: 22.4, tour_taille_cm: 84, fc_repos: 58 }), [])
})

test('PA ≥ 140/90 → alerte hypertension', () => {
  assert.ok(ids({ pa_systolique: 145, pa_diastolique: 85 }).includes('pa-hta'))
  assert.ok(ids({ pa_systolique: 125, pa_diastolique: 92 }).includes('pa-hta'))
})

test('PA ≥ 180/110 prime sur le seuil 140/90', () => {
  const f = ids({ pa_systolique: 185, pa_diastolique: 115 })
  assert.deepEqual(f, ['pa-crise'])
})

test('PA en zone limite → avertissement, pas alerte', () => {
  const flags = detectHealthFlags({ pa_systolique: 134, pa_diastolique: 82 } as BilanData, 'M')
  assert.equal(flags.length, 1)
  assert.equal(flags[0].id, 'pa-limite')
  assert.equal(flags[0].level, 'warn')
})

test('tour de taille : seuils distincts homme / femme', () => {
  assert.ok(ids({ tour_taille_cm: 95 }, 'M').includes('taille-modere'))
  assert.ok(ids({ tour_taille_cm: 95 }, 'F').includes('taille-eleve'))
  assert.ok(ids({ tour_taille_cm: 105 }, 'M').includes('taille-eleve'))
})

test('tour de taille ignoré si le sexe est inconnu', () => {
  assert.deepEqual(ids({ tour_taille_cm: 120 }, null), [])
})

test('IMC : obésité, embonpoint, insuffisance pondérale', () => {
  assert.ok(ids({ imc: 31 }).includes('imc-obesite'))
  assert.ok(ids({ imc: 27 }).includes('imc-embonpoint'))
  assert.ok(ids({ imc: 17 }).includes('imc-insuffisance'))
  assert.deepEqual(ids({ imc: 22 }), [])
})

test('FC de repos : tachycardie et zone limite', () => {
  assert.ok(ids({ fc_repos: 104 }).includes('fc-tachy'))
  assert.ok(ids({ fc_repos: 92 }).includes('fc-limite'))
  assert.deepEqual(ids({ fc_repos: 62 }), [])
})

test('les alertes sont triées avant les avertissements', () => {
  const flags = detectHealthFlags(
    { imc: 27, pa_systolique: 150, pa_diastolique: 95 } as BilanData,
    'M'
  )
  assert.equal(flags[0].level, 'alert')
  assert.equal(flags[1].level, 'warn')
})

test('champs absents → aucun signal (pas de faux positif sur 0/undefined)', () => {
  assert.deepEqual(ids({}), [])
})
