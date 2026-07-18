import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OBJECTIFS_FIELDS, emptyObjectifs, objectifsIsBlank } from './objectifs.ts'

test('emptyObjectifs — vierge', () => {
  const d = emptyObjectifs()
  assert.ok(objectifsIsBlank(d))
})

test('objectifsIsBlank — faux dès qu’un champ est rempli', () => {
  assert.ok(!objectifsIsBlank({ objectif: 'Perdre 10 lbs' }))
  assert.ok(!objectifsIsBlank({ sommeil: '7h' }))
  assert.ok(!objectifsIsBlank({ notes: 'note interne' }))
  // Espaces seuls = toujours vierge
  assert.ok(objectifsIsBlank({ objectif: '   ', preferences: '' }))
})

test('OBJECTIFS_FIELDS — clés uniques et non vides', () => {
  assert.ok(OBJECTIFS_FIELDS.length >= 6)
  const keys = OBJECTIFS_FIELDS.map(f => f.key)
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(OBJECTIFS_FIELDS.every(f => f.label.length > 0 && f.rows > 0))
})
