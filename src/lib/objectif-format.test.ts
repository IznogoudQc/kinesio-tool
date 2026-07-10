import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dualRate, dualWeight, estimatedGoalDate, formatWeeks } from './objectif-format.ts'

test('dualWeight montre l’unité préférée d’abord, l’autre entre parenthèses', () => {
  assert.equal(dualWeight(90, 'lb'), '198 lb (90 kg)')
  assert.equal(dualWeight(90, 'kg'), '90 kg (198 lb)')
  assert.equal(dualWeight(null, 'kg'), '—')
})

test('formatWeeks : pas de décimale, ni d’artefact binaire', () => {
  // `weeksToGoal` est une division : 6 kg ÷ 0,79 kg/sem = 7.6000000000000005
  assert.equal(formatWeeks(7.6000000000000005), '8')
  assert.equal(formatWeeks(9), '9')
  assert.equal(formatWeeks(2.4), '2')
})

test('formatWeeks : jamais « 0 semaine » — on plancher à 1', () => {
  assert.equal(formatWeeks(0.2), '1')
})

test('formatWeeks : valeur absente ou non finie → tiret', () => {
  assert.equal(formatWeeks(null), '—')
  assert.equal(formatWeeks(Number.POSITIVE_INFINITY), '—')
  assert.equal(formatWeeks(NaN), '—')
})

test('estimatedGoalDate ajoute les semaines sans décalage de fuseau', () => {
  assert.equal(estimatedGoalDate('2026-06-25', 8), 'août 2026')
  assert.equal(estimatedGoalDate('pas-une-date', 8), null)
})

test('dualRate montre le rythme dans les deux unités', () => {
  assert.equal(dualRate(0.79, 'lb'), '1,7 lb (0,8 kg) par semaine')
  assert.equal(dualRate(0.5, 'kg'), '0,5 kg (1,1 lb) par semaine')
  assert.equal(dualRate(null, 'kg'), '—')
})
