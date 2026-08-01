/**
 * Tests des sections masquables du rapport.
 *
 * Lancer : `node --test src/lib/report-sections.test.ts`
 *
 * Ce que ça protège : un réglage illisible ne doit JAMAIS faire disparaître une
 * section. Marie enverrait un rapport amputé sans le savoir, et le client ne
 * saurait pas ce qui manque. En cas de doute, on montre.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  REPORT_SECTIONS,
  hiddenSummary,
  isSectionVisible,
  parseHiddenSections,
  serializeHiddenSections,
  type ReportSectionKey
} from './report-sections.ts'

test('une section par carte du dashboard, sans doublon', () => {
  // Découpe revue avec Nicholas : un œil par carte blanche, et non huit grands
  // thèmes. Son exemple — masquer « Risque pour la santé » seul — ne marchait
  // pas avec la découpe grossière.
  assert.equal(new Set(REPORT_SECTIONS.map(s => s.key)).size, REPORT_SECTIONS.length)
  for (const attendue of ['risqueSante', 'pourcentageGras', 'composition', 'cardio', 'pressionArterielle']) {
    assert.ok(REPORT_SECTIONS.some(s => s.key === attendue), attendue + ' manquante')
  }
})

test('chaque section a un libellé et une explication', () => {
  for (const s of REPORT_SECTIONS) {
    assert.ok(s.label.trim().length > 0, `${s.key} sans libellé`)
    assert.ok(s.hint.trim().length > 0, `${s.key} sans explication`)
  }
})

test('un dossier sans réglage montre TOUT', () => {
  for (const raw of [null, undefined, '']) {
    const h = parseHiddenSections(raw)
    assert.equal(h.size, 0)
    for (const s of REPORT_SECTIONS) assert.equal(isSectionVisible(s.key, h), true)
  }
})

test('un réglage illisible montre tout — jamais l’inverse', () => {
  // Un JSON cassé ou d'un type inattendu ne doit pas amputer le rapport en
  // silence : c'est le défaut le plus difficile à remarquer.
  for (const raw of ['pas du json', '{}', '42', '"cardio"', '[', 'null']) {
    assert.equal(parseHiddenSections(raw).size, 0, `« ${raw} » aurait dû ne rien masquer`)
  }
})

test('les clés inconnues sont ignorées', () => {
  // Un réglage venu d'une version plus récente, ou une section supprimée.
  const h = parseHiddenSections('["cardio","section-inventee","nutrition"]')
  assert.deepEqual([...h].sort(), ['cardio', 'nutrition'])
})

test('aller-retour : ce qui est masqué le reste', () => {
  const masque: ReportSectionKey[] = ['cardio', 'motKine', 'nutrition']
  const relu = parseHiddenSections(serializeHiddenSections(masque))
  assert.deepEqual([...relu].sort(), [...masque].sort())
})

test('la sérialisation est stable, quel que soit l’ordre des clics', () => {
  // Deux réglages identiques doivent produire la MÊME chaîne : sinon un
  // export/import ou une comparaison de dossiers signale une différence
  // inexistante.
  const a = serializeHiddenSections(['motKine', 'cardio'])
  const b = serializeHiddenSections(['cardio', 'motKine'])
  assert.equal(a, b)
})

test('rien de masqué → null en base, pas une chaîne vide', () => {
  assert.equal(serializeHiddenSections([]), null)
  assert.equal(serializeHiddenSections(new Set()), null)
})

test('un doublon ne compte qu’une fois', () => {
  const s = serializeHiddenSections(['cardio', 'cardio'])
  assert.equal(parseHiddenSections(s).size, 1)
})

test('isSectionVisible dit bien le contraire de « masqué »', () => {
  const h = parseHiddenSections('["cardio"]')
  assert.equal(isSectionVisible('cardio', h), false)
  assert.equal(isSectionVisible('composition', h), true)
})

test('le résumé n’apparaît que s’il y a quelque chose à signaler', () => {
  assert.equal(hiddenSummary(new Set()), null)
  assert.equal(hiddenSummary(parseHiddenSections('["cardio"]')), '1 section masquée')
  assert.equal(hiddenSummary(parseHiddenSections('["cardio","nutrition"]')), '2 sections masquées')
})

test('masquer les huit reste possible — et se relit', () => {
  // Cas extrême mais légitime : un rapport réduit à la vue d'ensemble.
  const toutes = REPORT_SECTIONS.map(s => s.key)
  const relu = parseHiddenSections(serializeHiddenSections(toutes))
  assert.equal(relu.size, REPORT_SECTIONS.length)
  assert.equal(hiddenSummary(relu), REPORT_SECTIONS.length + ' sections masquées')
})
