import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_PAIN_SUGGESTIONS,
  PAIN_FAMILIES,
  REGION_FAMILY,
  familyForRegion,
  suggestionsForRegion
} from './pain-suggestions.ts'
import { BODY_REGIONS } from './sante.ts'

test('familyForRegion — mappe les régions connues, défaut commun', () => {
  assert.equal(familyForRegion('d_bas_dos'), 'dos')
  assert.equal(familyForRegion('f_genou_g'), 'genou')
  assert.equal(familyForRegion('inconnu'), 'commun')
})

test('chaque région de la silhouette a une famille', () => {
  for (const r of BODY_REGIONS) {
    assert.ok(REGION_FAMILY[r.id], `pas de famille pour ${r.id}`)
  }
})

test('chaque famille a des suggestions par défaut', () => {
  for (const f of PAIN_FAMILIES) {
    assert.ok(Array.isArray(DEFAULT_PAIN_SUGGESTIONS[f.key]), `pas de défaut pour ${f.key}`)
    assert.ok(DEFAULT_PAIN_SUGGESTIONS[f.key].length > 0)
  }
})

test('suggestionsForRegion — famille + commun, dédupliqué', () => {
  const s = suggestionsForRegion('d_bas_dos')
  assert.ok(s.includes('Douleur en flexion')) // famille dos
  assert.ok(s.includes('Douleur au repos')) // commun
  // pas de doublons
  assert.equal(new Set(s).size, s.length)
})

test('suggestionsForRegion — lib personnalisée', () => {
  const s = suggestionsForRegion('f_genou_g', { genou: ['Test genou'], commun: ['Test commun'] })
  assert.deepEqual(s, ['Test genou', 'Test commun'])
})
