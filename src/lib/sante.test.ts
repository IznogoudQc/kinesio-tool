import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BODY_REGIONS, cyclePain, emptySante, normalizeZones, regionLabel, santeIsBlank } from './sante.ts'

test('emptySante — vierge (restrictions non renseignées, aucune zone)', () => {
  const d = emptySante()
  assert.equal(d.restrictions, null)
  assert.deepEqual(d.zonesDetail, {})
  assert.ok(santeIsBlank(d))
})

test('cyclePain — rien → jaune → rouge → rien', () => {
  assert.equal(cyclePain(undefined), 'jaune')
  assert.equal(cyclePain('jaune'), 'rouge')
  assert.equal(cyclePain('rouge'), undefined)
})

test('normalizeZones — convertit l’ancien zonesSeverity', () => {
  assert.deepEqual(normalizeZones({ zonesSeverity: { d_bas_dos: 'rouge' } }), {
    d_bas_dos: { severity: 'rouge' }
  })
  // zonesDetail prioritaire
  assert.deepEqual(normalizeZones({ zonesDetail: { f_cou: { severity: 'jaune', description: 'raide' } } }), {
    f_cou: { severity: 'jaune', description: 'raide' }
  })
  assert.deepEqual(normalizeZones({}), {})
})

test('santeIsBlank — faux dès qu’un élément est présent', () => {
  assert.ok(!santeIsBlank({ conditions: 'Hernie L5' }))
  assert.ok(!santeIsBlank({ zonesDetail: { d_bas_dos: { severity: 'rouge' } } }))
  // Rétro-compat : ancien zonesSeverity
  assert.ok(!santeIsBlank({ zonesSeverity: { d_bas_dos: 'rouge' } }))
  assert.ok(!santeIsBlank({ restrictions: false }))
  assert.ok(!santeIsBlank({ restrictions: true, restrictionsDetail: 'Pas de flexion lombaire' }))
  assert.ok(!santeIsBlank({ notes: 'note' }))
  // Rétro-compat : ancien format `zones`
  assert.ok(!santeIsBlank({ zones: ['Genoux'] }))
  assert.ok(santeIsBlank({ restrictions: null, conditions: '   ', zonesDetail: {} }))
})

test('BODY_REGIONS — face + dos, ids uniques, coords valides', () => {
  const ids = BODY_REGIONS.map(r => r.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(BODY_REGIONS.some(r => r.view === 'face'))
  assert.ok(BODY_REGIONS.some(r => r.view === 'dos'))
  assert.ok(BODY_REGIONS.every(r => r.rx > 0 && r.ry > 0 && r.label.length > 0))
})

test('regionLabel — libellé lisible avec la vue', () => {
  assert.equal(regionLabel('f_epaule_d'), 'Épaule D (face)')
  assert.equal(regionLabel('d_bas_dos'), 'Bas du dos (lombaires) (dos)')
  assert.equal(regionLabel('inconnu'), 'inconnu')
})
