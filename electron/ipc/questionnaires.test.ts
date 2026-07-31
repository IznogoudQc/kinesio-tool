/**
 * Tests du schéma de validation des questionnaires.
 *
 * Lancer : `node --test electron/ipc/questionnaires.test.ts`
 *
 * Pourquoi ce fichier existe : `QaapDataSchema` utilise `.strip()`, qui supprime
 * SILENCIEUSEMENT tout champ non déclaré. La signature ajoutée en v0.9.85 s'en
 * est allée par cette porte — elle s'affichait à l'écran (état local du
 * formulaire) et disparaissait à l'enregistrement, sans la moindre erreur. Rien
 * ne le signalait avant d'ouvrir le PDF.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QaapDataSchema } from './questionnaires-schemas.ts'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
const REPONSES = [false, false, false, false, false, false, false]

const signature = {
  dataUrl: PNG,
  signerName: 'Nicholas Jean',
  signedAt: '2026-07-29T20:15:00.000Z',
  answersAtSigning: REPONSES
}

test('la signature TRAVERSE la validation — le défaut de la v0.9.85', () => {
  const out = QaapDataSchema.parse({ answers: REPONSES, signature }) as Record<string, unknown>
  assert.ok(out.signature, 'la signature ne doit pas être retirée à l’enregistrement')
  assert.deepEqual(out.signature, signature)
})

test('un Q-AAP sans signature reste valide', () => {
  const out = QaapDataSchema.parse({ answers: REPONSES }) as Record<string, unknown>
  assert.equal(out.signature, undefined)
  assert.deepEqual(out.answers, REPONSES)
})

test('les champs connus survivent tous', () => {
  const out = QaapDataSchema.parse({
    answers: REPONSES,
    precision: 'détail',
    notes: 'note interne',
    signature
  }) as Record<string, unknown>
  assert.equal(out.precision, 'détail')
  assert.equal(out.notes, 'note interne')
  assert.ok(out.signature)
})

test('un champ inconnu est bien retiré (c’est le rôle de .strip())', () => {
  const out = QaapDataSchema.parse({ answers: REPONSES, bidon: 'x' }) as Record<string, unknown>
  assert.equal(out.bidon, undefined)
})

test('le tracé doit être une image PNG, pas une chaîne quelconque', () => {
  for (const dataUrl of ['pas une image', 'data:text/html,<script>', 'data:image/svg+xml;base64,abc']) {
    assert.throws(
      () => QaapDataSchema.parse({ answers: REPONSES, signature: { ...signature, dataUrl } }),
      `« ${dataUrl} » aurait dû être refusé`
    )
  }
})

test('une signature incomplète est refusée plutôt que stockée à moitié', () => {
  const cas = [
    { ...signature, signerName: '' },
    { ...signature, signedAt: 'hier' },
    { ...signature, answersAtSigning: [true, false] }
  ]
  for (const sig of cas) {
    assert.throws(() => QaapDataSchema.parse({ answers: REPONSES, signature: sig }), JSON.stringify(sig).slice(0, 60))
  }
})

test('un tracé démesuré est refusé', () => {
  const enorme = { ...signature, dataUrl: `data:image/png;base64,${'A'.repeat(2_000_001)}` }
  assert.throws(() => QaapDataSchema.parse({ answers: REPONSES, signature: enorme }))
})

test('le nombre de réponses reste contraint à 7', () => {
  assert.throws(() => QaapDataSchema.parse({ answers: [true, false] }))
  assert.throws(() => QaapDataSchema.parse({ answers: Array(8).fill(null) }))
})
