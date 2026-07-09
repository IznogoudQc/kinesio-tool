import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MESURE_FIELDS, mesureRows, visibleMesureFields } from './mesure-fields.ts'

const keys = (f: { key: MesureFieldKey }[]): MesureFieldKey[] => f.map(x => x.key)

test('réglage absent → toutes les mesures sont affichées', () => {
  assert.equal(visibleMesureFields(null).length, MESURE_FIELDS.length)
})

test('masquer les mollets les retire des deux côtés', () => {
  const enabled = MESURE_FIELDS.map(f => f.key).filter(k => k !== 'molletG' && k !== 'molletD')
  const visible = keys(visibleMesureFields(enabled))
  assert.ok(!visible.includes('molletG'))
  assert.ok(!visible.includes('molletD'))
  assert.equal(visible.length, 10)
})

test('taille et hanche restent affichées même si retirées (ratio T/H)', () => {
  const visible = keys(visibleMesureFields(['cou']))
  assert.deepEqual(visible, ['cou', 'taille', 'hanche'])
})

test('l’ordre du catalogue est conservé', () => {
  const visible = keys(visibleMesureFields(['molletD', 'cou', 'bicepsG']))
  assert.deepEqual(visible, ['cou', 'bicepsG', 'taille', 'hanche', 'molletD'])
})

test('mesureRows apparie gauche et droite ligne par ligne', () => {
  const rows = mesureRows(visibleMesureFields(null))
  assert.equal(rows.length, 6)
  assert.deepEqual([rows[0][0]?.key, rows[0][1]?.key], ['cou', 'epaule'])
  assert.deepEqual([rows[5][0]?.key, rows[5][1]?.key], ['molletG', 'molletD'])
})

test('un champ sans partenaire reste seul sur sa ligne', () => {
  // On garde Mollet G mais pas Mollet D : la dernière ligne n'a qu'une carte.
  const enabled = MESURE_FIELDS.map(f => f.key).filter(k => k !== 'molletD')
  const rows = mesureRows(visibleMesureFields(enabled))
  const last = rows[rows.length - 1]
  assert.equal(last[0]?.key, 'molletG')
  assert.equal(last[1], null)
})

test('tout masquer ne laisse que les champs obligatoires', () => {
  assert.deepEqual(keys(visibleMesureFields([])), ['taille', 'hanche'])
})
