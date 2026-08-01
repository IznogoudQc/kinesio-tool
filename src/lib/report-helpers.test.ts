/**
 * Tests des helpers du rapport PDF.
 * Lancer : `node --test src/lib/report-helpers.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasRecoveryData, recoveryRows, aerobicProtocolLabel } from './report-helpers.ts'
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

/* ── Récupération : les deux modèles ─────────────────────────────────────── */

test('le modèle simplifié ouvre la section — défaut de la v0.3.3', () => {
  // `hasRecoveryData` ne regardait que le modèle 1/3/5 min : Marie saisissait
  // sa PA de récupération depuis le 17 juillet et la section du rapport ne
  // s'ouvrait jamais.
  assert.equal(hasRecoveryData({ pa_recup_sys: 130 }), true)
  assert.equal(hasRecoveryData({ pa_recup_dia: 78 }), true)
  assert.equal(hasRecoveryData({ fc_recup: 96 }), true)
})

test('le modèle détaillé continue d’ouvrir la section', () => {
  assert.equal(hasRecoveryData({ recup_1min_fc: 120 }), true)
  assert.equal(hasRecoveryData({ recup_5min_pa_dia: 80 }), true)
})

test('aucune valeur de récupération → section fermée', () => {
  assert.equal(hasRecoveryData({}), false)
  assert.equal(hasRecoveryData({ fc_repos: 60, pa_systolique: 120 }), false)
  // Une valeur non numérique ne compte pas.
  assert.equal(hasRecoveryData({ fc_recup: 'oui' }), false)
})

test('le modèle simplifié donne UNE ligne, avec ses trois valeurs', () => {
  const rows = recoveryRows({ fc_recup: 96, pa_recup_sys: 130, pa_recup_dia: 78 })
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], { label: 'Récupération', fc: 96, sys: 130, dia: 78 })
})

test('le modèle simplifié partiel garde ses trous plutôt que d’inventer', () => {
  const rows = recoveryRows({ fc_recup: 96 })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].fc, 96)
  assert.equal(rows[0].sys, null)
  assert.equal(rows[0].dia, null)
})

test('le modèle simplifié prime sur le détaillé', () => {
  // Cas improbable mais possible sur un bilan importé puis complété à la main :
  // c'est la saisie actuelle qui fait foi, pas l'import historique.
  const rows = recoveryRows({ fc_recup: 96, recup_1min_fc: 120, recup_3min_fc: 100 })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, 'Récupération')
  assert.equal(rows[0].fc, 96)
})

test('le modèle détaillé rend ses lignes, dans l’ordre', () => {
  const rows = recoveryRows({
    recup_1min_fc: 120, recup_1min_pa_sys: 150, recup_1min_pa_dia: 85,
    recup_3min_fc: 100, recup_3min_pa_sys: 135, recup_3min_pa_dia: 80,
    recup_5min_fc: 88, recup_5min_pa_sys: 125, recup_5min_pa_dia: 78
  })
  assert.deepEqual(rows.map(r => r.label), ['1 min', '3 min', '5 min'])
  assert.equal(rows[0].fc, 120)
  assert.equal(rows[2].dia, 78)
})

test('une ligne détaillée entièrement vide n’est pas affichée', () => {
  // Une ligne « 5 min » à trois tirets se lirait comme une mesure ratée.
  const rows = recoveryRows({ recup_1min_fc: 120, recup_3min_fc: 100 })
  assert.deepEqual(rows.map(r => r.label), ['1 min', '3 min'])
})

test('aucune donnée → aucune ligne', () => {
  assert.deepEqual(recoveryRows({}), [])
})
