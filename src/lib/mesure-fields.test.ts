import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_MESURE_FIELD_KEYS, MESURE_FIELDS, mesureRows, visibleMesureFields } from './mesure-fields.ts'

const keys = (f: { key: MesureFieldKey }[]): MesureFieldKey[] => f.map(x => x.key)

test('réglage absent → défaut = les 5 circonférences du bilan, dans l’ordre', () => {
  assert.deepEqual(keys(visibleMesureFields(null)), ['taille', 'hanche', 'bicepsG', 'cuisseG', 'epaule'])
  assert.deepEqual(DEFAULT_MESURE_FIELD_KEYS, ['taille', 'hanche', 'bicepsG', 'cuisseG', 'epaule'])
})

test('libellés du bilan sur les colonnes réutilisées', () => {
  const byKey = Object.fromEntries(MESURE_FIELDS.map(f => [f.key, f.label]))
  assert.equal(byKey.bicepsG, 'Biceps fléchi')
  assert.equal(byKey.cuisseG, 'Cuisse (2 po du genou)')
  assert.equal(byKey.epaule, 'Épaules et pec')
})

test('mesureRows(null) → tabulation Taille·Hanche / Biceps·Cuisse / Épaules', () => {
  const rows = mesureRows(null)
  assert.equal(rows.length, 3)
  assert.deepEqual([rows[0][0]?.key, rows[0][1]?.key], ['taille', 'hanche'])
  assert.deepEqual([rows[1][0]?.key, rows[1][1]?.key], ['bicepsG', 'cuisseG'])
  assert.deepEqual([rows[2][0]?.key, rows[2][1]], ['epaule', null])
})

test('taille et hanche restent affichées même si retirées (ratio T/H)', () => {
  assert.deepEqual(keys(visibleMesureFields(['cou'])), ['taille', 'hanche', 'cou'])
})

test('l’ordre du catalogue est conservé', () => {
  assert.deepEqual(keys(visibleMesureFields(['molletD', 'cou', 'bicepsG'])), [
    'taille',
    'hanche',
    'bicepsG',
    'cou',
    'molletD'
  ])
})

test('activer tous les champs → 12, masquer une paire → 10', () => {
  const all = MESURE_FIELDS.map(f => f.key)
  assert.equal(visibleMesureFields(all).length, 12)
  const enabled = all.filter(k => k !== 'molletG' && k !== 'molletD')
  const visible = keys(visibleMesureFields(enabled))
  assert.ok(!visible.includes('molletG') && !visible.includes('molletD'))
  assert.equal(visible.length, 10)
})

test('masquer un seul côté ne décale pas l’autre colonne', () => {
  const enabled = MESURE_FIELDS.map(f => f.key).filter(k => k !== 'cuisseG')
  const rows = mesureRows(enabled)
  const row = rows.find(r => r[0]?.key === 'bicepsG')
  assert.ok(row)
  assert.equal(row[1], null)
})
