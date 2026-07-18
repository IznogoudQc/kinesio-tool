import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SANTE_ZONES, emptySante, santeIsBlank, toggleZone } from './sante.ts'

test('emptySante — vierge (restrictions non renseignées)', () => {
  const d = emptySante()
  assert.equal(d.restrictions, null)
  assert.ok(santeIsBlank(d))
})

test('toggleZone — ajoute puis retire, garde l’ordre de SANTE_ZONES', () => {
  let z = toggleZone(undefined, 'Genoux')
  assert.deepEqual(z, ['Genoux'])
  z = toggleZone(z, 'Nuque / cou')
  // 'Nuque / cou' est avant 'Genoux' dans SANTE_ZONES
  assert.deepEqual(z, ['Nuque / cou', 'Genoux'])
  z = toggleZone(z, 'Genoux')
  assert.deepEqual(z, ['Nuque / cou'])
})

test('santeIsBlank — faux dès qu’un élément est présent', () => {
  assert.ok(!santeIsBlank({ conditions: 'Hernie L5' }))
  assert.ok(!santeIsBlank({ zones: ['Genoux'] }))
  assert.ok(!santeIsBlank({ restrictions: false }))
  assert.ok(!santeIsBlank({ restrictions: true, restrictionsDetail: 'Pas de flexion lombaire' }))
  assert.ok(!santeIsBlank({ notes: 'note' }))
  assert.ok(santeIsBlank({ restrictions: null, conditions: '   ', zones: [] }))
})

test('SANTE_ZONES — liste non vide, libellés uniques', () => {
  assert.ok(SANTE_ZONES.length >= 8)
  assert.equal(new Set(SANTE_ZONES).size, SANTE_ZONES.length)
})
