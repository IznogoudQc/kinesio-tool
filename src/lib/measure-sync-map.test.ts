import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CIRC_MAP, PLIS_MAP, numOrNull } from './measure-sync-map.ts'

test('CIRC_MAP — mappe poids, grandeur et les 5 circonférences', () => {
  const byBilan = Object.fromEntries(CIRC_MAP.map(m => [m.bilan, m.circ]))
  assert.equal(byBilan['poids_kg'], 'poidsKg')
  assert.equal(byBilan['taille_cm'], 'grandeurCm') // grandeur/hauteur
  assert.equal(byBilan['tour_taille_cm'], 'taille') // tour de taille
  assert.equal(byBilan['tour_hanche_cm'], 'hanche')
  assert.equal(byBilan['circ_biceps_flechi_cm'], 'bicepsG')
  assert.equal(byBilan['circ_cuisse_cm'], 'cuisseG')
  assert.equal(byBilan['circ_epaules_pec_cm'], 'epaule')
  // clés uniques des deux côtés
  assert.equal(new Set(CIRC_MAP.map(m => m.bilan)).size, CIRC_MAP.length)
  assert.equal(new Set(CIRC_MAP.map(m => m.circ)).size, CIRC_MAP.length)
})

test('PLIS_MAP — les 4 plis', () => {
  const byBilan = Object.fromEntries(PLIS_MAP.map(m => [m.bilan, m.plis]))
  assert.deepEqual(byBilan, {
    pli_triceps: 'triceps',
    pli_biceps: 'biceps',
    pli_sous_scap: 'sousscapulaire',
    pli_iliaque: 'iliaque'
  })
})

test('numOrNull — nombres finis seulement', () => {
  assert.equal(numOrNull(42), 42)
  assert.equal(numOrNull(0), 0)
  assert.equal(numOrNull('42'), null)
  assert.equal(numOrNull(undefined), null)
  assert.equal(numOrNull(NaN), null)
  assert.equal(numOrNull(Infinity), null)
})
