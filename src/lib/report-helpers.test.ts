/**
 * Tests des helpers du rapport PDF.
 * Lancer : `node --test src/lib/report-helpers.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasRecoveryData, aerobicProtocolLabel } from './report-helpers.ts'
import { formatMmSs } from './vo2max-calculator.ts'

test('hasRecoveryData : détecte au moins une valeur de récupération', () => {
  assert.equal(hasRecoveryData({}), false)
  assert.equal(hasRecoveryData({ vo2max: 49 }), false)
  assert.equal(hasRecoveryData({ recup_3min_fc: 110 }), true)
  assert.equal(hasRecoveryData({ recup_1min_pa_sys: 150, recup_1min_pa_dia: 90 }), true)
})

test('hasRecoveryData : ignore les valeurs non numériques', () => {
  assert.equal(hasRecoveryData({ recup_1min_fc: NaN }), false)
  assert.equal(hasRecoveryData({ recup_1min_fc: undefined }), false)
  assert.equal(hasRecoveryData({ recup_1min_fc: '110' }), false)
})

test('aerobicProtocolLabel : Bruce avec durée', () => {
  assert.equal(
    aerobicProtocolLabel({ aerobie_test_type: 'bruce', bruce_duration_sec: 810 }, formatMmSs),
    'Tapis roulant de Bruce — 13:30'
  )
})

test('aerobicProtocolLabel : Cooper et Léger', () => {
  assert.equal(
    aerobicProtocolLabel({ aerobie_test_type: 'cooper', cooper_distance_m: 2400 }, formatMmSs),
    'Test de Cooper (12 min) — 2400 m'
  )
  assert.equal(
    aerobicProtocolLabel({ aerobie_test_type: 'leger', leger_palier: 8 }, formatMmSs),
    'Test de Léger (navette 20 m) — palier 8'
  )
})

test('aerobicProtocolLabel : repli sur test_aerobie (import .docx) puis null', () => {
  assert.equal(aerobicProtocolLabel({ test_aerobie: 'Tapis Roulant de Bruce' }, formatMmSs), 'Tapis Roulant de Bruce')
  assert.equal(aerobicProtocolLabel({ aerobie_test_type: 'manual' }, formatMmSs), null)
  assert.equal(aerobicProtocolLabel({}, formatMmSs), null)
})
