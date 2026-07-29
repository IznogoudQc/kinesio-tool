/**
 * Tests de la portée temporelle d'un rapport.
 *
 * Lancer : `node --test src/lib/report-scope.test.ts`
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareCandidates, scopeBilansTo, type DatedBilan } from './report-scope.ts'

/** Les vrais bilans de Nicholas, du plus récent au plus ancien (ordre de l'app). */
const BILANS: DatedBilan[] = [
  { id: 'e', date: '2026-06-25' },
  { id: 'd', date: '2025-12-04' },
  { id: 'c', date: '2025-09-04' },
  { id: 'b', date: '2024-06-10' },
  { id: 'a', date: '2011-08-17' }
]

test('sans bilan ciblé, tout l’historique reste visible', () => {
  assert.deepEqual(scopeBilansTo(BILANS, null), BILANS)
  assert.deepEqual(scopeBilansTo(BILANS, undefined), BILANS)
  assert.deepEqual(scopeBilansTo(BILANS, ''), BILANS)
})

test('un vieux bilan ne voit jamais ce qui vient après lui', () => {
  assert.deepEqual(scopeBilansTo(BILANS, 'b').map(b => b.id), ['b', 'a'])
  assert.deepEqual(scopeBilansTo(BILANS, 'a').map(b => b.id), ['a'])
  // Le plus récent voit tout.
  assert.deepEqual(scopeBilansTo(BILANS, 'e').map(b => b.id), BILANS.map(b => b.id))
})

test('la cible elle-même est incluse', () => {
  for (const b of BILANS) {
    assert.ok(scopeBilansTo(BILANS, b.id).some(x => x.id === b.id), `${b.id} devrait être inclus`)
  }
})

test('id introuvable → tout montrer plutôt que rien', () => {
  // Un rapport vide serait bien pire qu'un rapport complet.
  assert.deepEqual(scopeBilansTo(BILANS, 'inexistant'), BILANS)
})

test('aucune fuite de données postérieures, quel que soit le bilan ciblé', () => {
  for (const cible of BILANS) {
    const scope = scopeBilansTo(BILANS, cible.id)
    for (const b of scope) {
      assert.ok(b.date <= cible.date, `${b.date} est postérieur à ${cible.date}`)
    }
  }
})

test('« Comparer à » ne propose que des dates antérieures', () => {
  const scope = scopeBilansTo(BILANS, 'c')
  const options = compareCandidates(scope, { id: 'c', date: '2025-09-04' }, 'b')
  assert.deepEqual(options.map(o => o.id), ['a'])
  for (const o of options) assert.ok(o.date < '2025-09-04')
})

test('« Comparer à » exclut le bilan affiché et le précédent (déjà proposé à part)', () => {
  const options = compareCandidates(BILANS, { id: 'e', date: '2026-06-25' }, 'd')
  assert.ok(!options.some(o => o.id === 'e'), 'le bilan affiché ne doit pas être proposé')
  assert.ok(!options.some(o => o.id === 'd'), 'le précédent a déjà son entrée dédiée')
  assert.deepEqual(options.map(o => o.id), ['c', 'b', 'a'])
})

test('le plus ancien bilan n’a rien à quoi se comparer', () => {
  const scope = scopeBilansTo(BILANS, 'a')
  assert.deepEqual(compareCandidates(scope, { id: 'a', date: '2011-08-17' }, null), [])
})

test('les options sortent du plus récent au plus ancien', () => {
  const options = compareCandidates(BILANS, { id: 'e', date: '2026-06-25' }, null)
  const dates = options.map(o => o.date)
  assert.deepEqual(dates, [...dates].sort().reverse())
})
