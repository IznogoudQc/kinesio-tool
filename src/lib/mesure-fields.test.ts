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
  const rows = mesureRows(null)
  assert.equal(rows.length, 6)
  assert.deepEqual([rows[0][0]?.key, rows[0][1]?.key], ['cou', 'epaule'])
  assert.deepEqual([rows[5][0]?.key, rows[5][1]?.key], ['molletG', 'molletD'])
})

test('masquer « Cou » laisse sa place vide — « Biceps G » ne remonte pas', () => {
  const enabled = MESURE_FIELDS.map(f => f.key).filter(k => k !== 'cou')
  const rows = mesureRows(enabled)
  assert.equal(rows.length, 6)
  // Ligne 1 : plus de cou à gauche, l'épaule reste à droite.
  assert.equal(rows[0][0], null)
  assert.equal(rows[0][1]?.key, 'epaule')
  // Ligne 2 : biceps G toujours à sa ligne anatomique.
  assert.equal(rows[1][0]?.key, 'bicepsG')
})

test('masquer un seul côté ne décale pas l’autre colonne', () => {
  const enabled = MESURE_FIELDS.map(f => f.key).filter(k => k !== 'molletD')
  const rows = mesureRows(enabled)
  const last = rows[rows.length - 1]
  assert.equal(last[0]?.key, 'molletG')
  assert.equal(last[1], null)
})

test('une ligne dont les deux côtés sont masqués disparaît', () => {
  const enabled = MESURE_FIELDS.map(f => f.key).filter(k => k !== 'molletG' && k !== 'molletD')
  const rows = mesureRows(enabled)
  assert.equal(rows.length, 5)
  assert.deepEqual([rows[4][0]?.key, rows[4][1]?.key], ['cuisseG', 'cuisseD'])
})

test('tout décocher ne laisse que la ligne Taille / Hanche… à leurs lignes d’origine', () => {
  const rows = mesureRows([])
  // Taille est à droite de la ligne 3, Hanche à droite de la ligne 4.
  assert.equal(rows.length, 2)
  assert.deepEqual([rows[0][0], rows[0][1]?.key], [null, 'taille'])
  assert.deepEqual([rows[1][0], rows[1][1]?.key], [null, 'hanche'])
})
