/**
 * Sections de notes.
 *
 * Le test qui compte est celui des CLÉS : elles sont écrites en base, et les
 * renommer rendrait orphelines toutes les notes déjà prises. Le libellé, lui,
 * peut changer sans conséquence.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NOTE_SECTIONS, NOTE_SECTION_KEYS, libelleSection } from './note-sections.ts'

test('les clés stockées en base ne changent pas', () => {
  assert.deepEqual(NOTE_SECTION_KEYS, ['composition', 'aerobie', 'musculo', 'objectif', 'general'])
})

test('les cinq sections demandées sont là, dans l’ordre', () => {
  assert.deepEqual(
    NOTE_SECTIONS.map(s => s.label),
    [
      'Composition corporelle',
      'Aptitude aérobie',
      'Aptitude musculosquelettique globale',
      'Objectif du client',
      'Général'
    ]
  )
})

test('une note sans section n’est rattachée à aucune', () => {
  // Les notes d'avant les sections : elles restent dans le journal complet
  // plutôt que d'être rangées d'office sous « Général ».
  assert.equal(libelleSection(null), null)
  assert.equal(libelleSection(undefined), null)
  assert.equal(libelleSection('inconnue'), null)
})

test('chaque clé rend son libellé', () => {
  assert.equal(libelleSection('musculo'), 'Aptitude musculosquelettique globale')
  assert.equal(libelleSection('general'), 'Général')
})
