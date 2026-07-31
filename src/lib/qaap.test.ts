import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  QAAP_QUESTIONS,
  QAAP_QUESTION_COUNT,
  emptyQaap,
  qaapHasWarning,
  qaapIsBlank,
  qaapIsSigned,
  qaapSignatureStale,
  type QaapData,
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

// ── Signature électronique ───────────────────────────────────────────────────

const SIG_PNG = 'data:image/png;base64,iVBORw0KGgo='

function signe(answers: (boolean | null)[]): QaapData {
  return {
    answers: [...answers],
    signature: {
      dataUrl: SIG_PNG,
      signerName: 'Nicholas Jean',
      signedAt: '2026-07-29T20:15:00.000Z',
      answersAtSigning: [...answers]
    }
  }
}

test('un Q-AAP sans signature n’est pas signé', () => {
  assert.equal(qaapIsSigned(emptyQaap()), false)
  assert.equal(qaapIsSigned({ answers: [false, false, false, false, false, false, false] }), false)
})

test('signature vide ou absente → non signé (pas de faux positif)', () => {
  const base = emptyQaap()
  assert.equal(qaapIsSigned({ ...base, signature: undefined }), false)
  assert.equal(
    qaapIsSigned({
      ...base,
      signature: { dataUrl: '', signerName: 'X', signedAt: '2026-07-29T00:00:00Z', answersAtSigning: base.answers }
    }),
    false
  )
})

test('signature valide → signé', () => {
  assert.equal(qaapIsSigned(signe([false, false, false, false, false, false, false])), true)
})

test('réponses inchangées depuis la signature → signature valable', () => {
  assert.equal(qaapSignatureStale(signe([false, true, false, false, false, false, false])), false)
})

test('UNE réponse modifiée après la signature → signature périmée', () => {
  // Le cas qui compte : le document ne doit plus prétendre que le client a
  // attesté CE contenu-là.
  const d = signe([false, false, false, false, false, false, false])
  d.answers[3] = true
  assert.equal(qaapSignatureStale(d), true)
})

test('une réponse effacée après la signature compte aussi comme un changement', () => {
  const d = signe([true, false, false, false, false, false, false])
  d.answers[0] = null
  assert.equal(qaapSignatureStale(d), true)
})

test('sans signature, rien n’est périmé', () => {
  assert.equal(qaapSignatureStale(emptyQaap()), false)
})

test('nombre de réponses différent → périmé (données incohérentes)', () => {
  const d = signe([false, false, false, false, false, false, false])
  d.answers = d.answers.slice(0, 5)
  assert.equal(qaapSignatureStale(d), true)
})

test('la signature n’empêche pas les autres règles de fonctionner', () => {
  const d = signe([false, true, false, false, false, false, false])
  assert.equal(qaapHasWarning(d), true, 'un OUI reste un OUI, signé ou non')
  assert.equal(qaapIsComplete(d), true)
  assert.deepEqual(qaapYesIndices(d), [2])
})
