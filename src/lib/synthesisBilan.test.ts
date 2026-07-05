/**
 * Tests du bilan synthèse — agrégation latest-non-null par champ.
 *
 * Lancer : `node --test src/lib/synthesisBilan.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPreviousSynthesisBilan, buildSynthesisBilan } from './synthesisBilan.ts'

function fakeBilan(date: string, data: Record<string, unknown>): Bilan {
  return {
    id: `b-${date}`,
    clientId: 'c1',
    date,
    data: data as unknown as BilanData,
    source: 'manuel',
    createdAt: `${date}T12:00:00.000Z`
  }
}

test('1 seul bilan → la synthèse en est une copie', () => {
  const b = fakeBilan('2025-09-04', { vo2max: 49, imc: 32 })
  const r = buildSynthesisBilan([b])
  assert.equal(r.data.vo2max, 49)
  assert.equal(r.data.imc, 32)
  assert.equal(r.latestContributionDate, '2025-09-04')
  assert.equal(r.fieldOriginDates.vo2max, '2025-09-04')
})

test('2 bilans : champs préférés du plus récent, complétés par les anciens', () => {
  const bilans = [
    fakeBilan('2025-09-04', { vo2max: 49, taille_cm: 176 }),
    fakeBilan('2024-01-15', { vo2max: 42, imc: 30, pushups: 18 })
  ]
  const r = buildSynthesisBilan(bilans)
  // vo2max : pris du plus récent (49)
  assert.equal(r.data.vo2max, 49)
  assert.equal(r.fieldOriginDates.vo2max, '2025-09-04')
  // imc : seulement dans le plus ancien → pris quand même
  assert.equal(r.data.imc, 30)
  assert.equal(r.fieldOriginDates.imc, '2024-01-15')
  // pushups : seulement dans le plus ancien
  assert.equal(r.data.pushups, 18)
  // taille : seulement dans le plus récent
  assert.equal(r.data.taille_cm, 176)
  // latestContributionDate : la plus récente parmi les contributeurs
  assert.equal(r.latestContributionDate, '2025-09-04')
})

test('Valeurs `null` / `undefined` / `\'\'` ignorées', () => {
  const bilans = [
    fakeBilan('2025-09-04', { vo2max: null, imc: undefined, taille_cm: '' }),
    fakeBilan('2024-01-15', { vo2max: 42, imc: 30, taille_cm: 176 })
  ]
  const r = buildSynthesisBilan(bilans)
  assert.equal(r.data.vo2max, 42)
  assert.equal(r.data.imc, 30)
  assert.equal(r.data.taille_cm, 176)
  assert.equal(r.fieldOriginDates.vo2max, '2024-01-15')
})

test('Valeur 0 est valide (ex: 0 push-ups)', () => {
  const bilans = [
    fakeBilan('2025-09-04', { pushups: 0 }),
    fakeBilan('2024-01-15', { pushups: 10 })
  ]
  const r = buildSynthesisBilan(bilans)
  assert.equal(r.data.pushups, 0)
})

test('fieldCounts compte tous les bilans qui renseignent un champ', () => {
  const bilans = [
    fakeBilan('2025-09-04', { vo2max: 49 }),
    fakeBilan('2024-09-01', { vo2max: 45 }),
    fakeBilan('2024-01-15', { vo2max: 42, imc: 30 })
  ]
  const r = buildSynthesisBilan(bilans)
  assert.equal(r.fieldCounts.vo2max, 3)
  assert.equal(r.fieldCounts.imc, 1)
})

test('buildPreviousSynthesisBilan : 2e valeur rencontrée par champ', () => {
  const bilans = [
    fakeBilan('2025-09-04', { vo2max: 49 }),
    fakeBilan('2024-09-01', { vo2max: 45, imc: 30 }),
    fakeBilan('2024-01-15', { vo2max: 42, imc: 28, pushups: 18 })
  ]
  const r = buildPreviousSynthesisBilan(bilans)
  assert.equal(r.data.vo2max, 45) // 2e valeur de vo2max
  assert.equal(r.data.imc, 28)    // 2e valeur de imc (28 vient du 3e bilan)
  // pushups n'apparait que dans 1 bilan → pas de précédent
  assert.equal(r.data.pushups, undefined)
})

test('fieldOriginDates : chaque champ pointe le bon bilan quand ils diffèrent (tooltip UI)', () => {
  // Cas réaliste : bilans .docx partiels, chaque métrique vient d'une date différente.
  const bilans = [
    fakeBilan('2025-09-04', { vo2max: 49 }),           // aérobie récent
    fakeBilan('2025-03-01', { tour_taille_cm: 102 }),  // circonférence intermédiaire
    fakeBilan('2024-06-10', { imc: 31, pourcentage_gras: 28 }) // composition ancienne
  ]
  const r = buildSynthesisBilan(bilans)
  assert.equal(r.fieldOriginDates.vo2max, '2025-09-04')
  assert.equal(r.fieldOriginDates.tour_taille_cm, '2025-03-01')
  assert.equal(r.fieldOriginDates.imc, '2024-06-10')
  assert.equal(r.fieldOriginDates.pourcentage_gras, '2024-06-10')
})

test('Liste vide → synthèse vide', () => {
  const r = buildSynthesisBilan([])
  assert.deepEqual(r.data, {})
  assert.equal(r.latestContributionDate, null)
})
