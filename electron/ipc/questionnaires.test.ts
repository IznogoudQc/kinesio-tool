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
import { QaapDataSchema, parseDataForType } from './questionnaires-schemas.ts'

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

/* ── FANTASTIC (habitudes de vie) ────────────────────────────────────────── */

test('les réponses FANTASTIC traversent la validation', () => {
  const data = { answers: { 'famille.confident': 4, 'alcool.conduite': 0, 'emotions.triste': null } }
  const out = parseDataForType('fantastic', data) as Record<string, unknown>
  assert.deepEqual(out.answers, data.answers)
})

test('la provenance des réponses survit — sinon Marie ne sait plus qui a répondu', () => {
  // `source` et `receivedAt` ne sont pas décoratifs : ils distinguent ce que le
  // client a déclaré lui-même de ce que Marie a transcrit pour lui.
  const out = parseDataForType('fantastic', {
    answers: { 'famille.confident': 2 },
    source: 'client',
    receivedAt: '2026-07-31T14:05:00.000Z',
    notes: 'Reçu par courriel.'
  }) as Record<string, unknown>
  assert.equal(out.source, 'client')
  assert.equal(out.receivedAt, '2026-07-31T14:05:00.000Z')
  assert.equal(out.notes, 'Reçu par courriel.')
})

test('une réponse hors de l’échelle 0-4 est refusée, pas rognée', () => {
  // Une valeur hors échelle fausserait le score sans que rien ne le signale.
  for (const mauvais of [5, -1, 2.5]) {
    assert.throws(
      () => parseDataForType('fantastic', { answers: { 'famille.confident': mauvais } }),
      `${mauvais} aurait dû être refusé`
    )
  }
})

test('une provenance inventée est refusée', () => {
  assert.throws(() => parseDataForType('fantastic', { answers: {}, source: 'inconnu' }))
})

test('un questionnaire FANTASTIC vierge reste valide', () => {
  assert.deepEqual(parseDataForType('fantastic', {}), {})
})

test('les quatre types sont reconnus, et eux seuls', () => {
  // Charge minimale valide pour chacun — le Q-AAP exige ses 7 réponses, les
  // autres se contentent d'un objet vide.
  const minimal: Record<string, unknown> = {
    qaap: { answers: REPONSES },
    objectifs: {},
    sante: {},
    fantastic: {}
  }
  for (const [t, data] of Object.entries(minimal)) {
    assert.doesNotThrow(() => parseDataForType(t, data), t)
  }
  assert.throws(() => parseDataForType('inexistant', {}), /inconnu/)
})
