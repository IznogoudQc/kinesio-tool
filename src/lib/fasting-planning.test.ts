import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  spanDaysOf,
  occurrenceStarts,
  fastingDaysInRange,
  dailyWindows,
  monthGrid,
  weekdayOfISO,
  addDaysISO,
  describeProgram,
  type FastingProgram
} from './fasting-planning.ts'

function prog(p: Partial<FastingProgram>): FastingProgram {
  return { id: 'x', label: 'Test', kind: 'extended', freq: 'once', anchorDate: '2026-01-05', ...p }
}

test('2026-01-05 est un lundi', () => {
  assert.equal(weekdayOfISO('2026-01-05'), 1)
})

test('spanDaysOf : 48 h → 2 jours, 96 h → 4, 24 h → 1, fenêtre → 1', () => {
  assert.equal(spanDaysOf(prog({ kind: 'extended', durationHours: 48 })), 2)
  assert.equal(spanDaysOf(prog({ kind: 'extended', durationHours: 96 })), 4)
  assert.equal(spanDaysOf(prog({ kind: 'extended', durationHours: 24 })), 1)
  assert.equal(spanDaysOf(prog({ kind: 'extended', durationHours: 36 })), 2)
  assert.equal(spanDaysOf(prog({ kind: 'window', windowStart: '12:00', windowEnd: '20:00' })), 1)
})

test('daily ne produit aucune occurrence calendaire', () => {
  assert.deepEqual(occurrenceStarts(prog({ freq: 'daily' }), '2026-01-01', '2026-01-31'), [])
})

test('weekly : chaque lundi du mois', () => {
  const p = prog({ freq: 'weekly', weekday: 1, durationHours: 48 })
  assert.deepEqual(occurrenceStarts(p, '2026-01-01', '2026-01-31'), [
    '2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'
  ])
})

test('biweekly : aux 2 semaines depuis l’ancre', () => {
  const p = prog({ freq: 'biweekly', weekday: 1, anchorDate: '2026-01-05' })
  assert.deepEqual(occurrenceStarts(p, '2026-01-01', '2026-02-15'), [
    '2026-01-05', '2026-01-19', '2026-02-02'
  ])
})

test('monthly : même jour chaque mois', () => {
  const p = prog({ freq: 'monthly', anchorDate: '2026-01-15', durationHours: 24 })
  assert.deepEqual(occurrenceStarts(p, '2026-01-01', '2026-03-31'), [
    '2026-01-15', '2026-02-15', '2026-03-15'
  ])
})

test('seasonal : tous les 3 mois', () => {
  const p = prog({ freq: 'seasonal', anchorDate: '2026-01-15', durationHours: 96 })
  assert.deepEqual(occurrenceStarts(p, '2026-01-01', '2026-12-31'), [
    '2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15'
  ])
})

test('once : seulement si dans la plage', () => {
  const p = prog({ freq: 'once', anchorDate: '2026-03-10' })
  assert.deepEqual(occurrenceStarts(p, '2026-01-01', '2026-02-28'), [])
  assert.deepEqual(occurrenceStarts(p, '2026-03-01', '2026-03-31'), ['2026-03-10'])
})

test('fastingDaysInRange : un jeûne 48 h le lundi couvre lundi + mardi', () => {
  const p = prog({ id: 'j48', label: 'Jeûne 48 h', freq: 'weekly', weekday: 1, durationHours: 48 })
  const map = fastingDaysInRange([p], '2026-01-01', '2026-01-31')
  // 4 lundis × 2 jours = 8 jours couverts.
  assert.equal(Object.keys(map).length, 8)
  assert.equal(map['2026-01-05'][0].isStart, true)
  assert.equal(map['2026-01-05'][0].dayNo, 1)
  assert.equal(map['2026-01-06'][0].isStart, false)
  assert.equal(map['2026-01-06'][0].dayNo, 2)
  assert.equal(map['2026-01-06'][0].spanDays, 2)
})

test('fastingDaysInRange : un span qui déborde du mois précédent est capté', () => {
  // Jeûne 48 h ponctuel commençant le 31 janvier → couvre 31 janv + 1 fév.
  const p = prog({ id: 'j', label: 'Jeûne 48 h', freq: 'once', anchorDate: '2026-01-31', durationHours: 48 })
  const feb = fastingDaysInRange([p], '2026-02-01', '2026-02-28')
  assert.ok(feb['2026-02-01'], 'le 1er février doit être couvert par le jeûne commencé le 31 janvier')
  assert.equal(feb['2026-02-01'][0].dayNo, 2)
})

test('dailyWindows : ne renvoie que les fenêtres quotidiennes', () => {
  const a = prog({ id: 'a', freq: 'daily', kind: 'window' })
  const b = prog({ id: 'b', freq: 'weekly' })
  assert.deepEqual(dailyWindows([a, b]).map(p => p.id), ['a'])
})

test('monthGrid : janvier 2026 commence un jeudi (colonne 3)', () => {
  const g = monthGrid(2026, 0)
  assert.equal(g.length, 5)
  assert.equal(g[0][0], null)
  assert.equal(g[0][2], null)
  assert.equal(g[0][3], '2026-01-01')
  assert.equal(g[4][6], null) // 31 janv = samedi → dernière case (dim) vide
})

test('addDaysISO gère le passage de mois', () => {
  assert.equal(addDaysISO('2026-01-31', 1), '2026-02-01')
})

test('describeProgram : résumé lisible', () => {
  const p = prog({ kind: 'extended', durationHours: 48, freq: 'biweekly', weekday: 1 })
  assert.equal(describeProgram(p), 'Jeûne 48 h · Aux 2 semaines · lundi')
})
