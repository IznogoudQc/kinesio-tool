import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  QAAP_QUESTIONS,
  QAAP_QUESTION_COUNT,
  emptyQaap,
  qaapHasWarning,
  qaapIsBlank,
  qaapIsComplete,
  qaapYesIndices,
  qaapExpiryDate,
  qaapIsExpired
} from './qaap.ts'

test('QAAP — 7 questions officielles', () => {
  assert.equal(QAAP_QUESTION_COUNT, 7)
  assert.equal(QAAP_QUESTIONS.length, 7)
  assert.ok(QAAP_QUESTIONS.every(q => typeof q === 'string' && q.length > 10))
})

test('emptyQaap — 7 réponses null, vierge', () => {
  const d = emptyQaap()
  assert.equal(d.answers.length, 7)
  assert.ok(qaapIsBlank(d))
  assert.ok(!qaapIsComplete(d))
  assert.ok(!qaapHasWarning(d))
})

test('qaapHasWarning — un seul OUI suffit', () => {
  const d = emptyQaap()
  d.answers = [false, false, false, false, false, false, false]
  assert.ok(!qaapHasWarning(d))
  d.answers[4] = true
  assert.ok(qaapHasWarning(d))
  assert.deepEqual(qaapYesIndices(d), [5])
})

test('qaapIsComplete — toutes répondues', () => {
  const d = emptyQaap()
  d.answers = [false, false, false, false, false, false, false]
  assert.ok(qaapIsComplete(d))
  d.answers[2] = null
  assert.ok(!qaapIsComplete(d))
})

test('qaapExpiryDate — +12 mois', () => {
  assert.equal(qaapExpiryDate('2026-07-17'), '2027-07-17')
  assert.equal(qaapExpiryDate('2025-01-31'), '2026-01-31')
})

test('qaapExpiryDate — 29 février retombe sur le 28', () => {
  // 2024-02-29 + 12 mois → 2025-02-28 (2025 non bissextile)
  assert.equal(qaapExpiryDate('2024-02-29'), '2025-02-28')
})

test('qaapExpiryDate — date invalide → null', () => {
  assert.equal(qaapExpiryDate('pas une date'), null)
})

test('qaapIsExpired — avant / après échéance', () => {
  assert.ok(!qaapIsExpired('2026-07-17', '2027-07-17')) // pile à l'échéance = encore valide
  assert.ok(!qaapIsExpired('2026-07-17', '2026-12-01'))
  assert.ok(qaapIsExpired('2026-07-17', '2027-07-18'))
})
