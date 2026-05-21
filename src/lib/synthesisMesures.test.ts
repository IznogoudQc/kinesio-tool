/**
 * Tests de la synthèse des mesures — agrégation latest-non-null par champ
 * pour les circonférences, union des dates circ + plis.
 *
 * Lancer : `node --test src/lib/synthesisMesures.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildPreviousSynthesisCirc,
  buildSynthesisCirc,
  buildUnifiedDates,
  findCircAtOrBefore,
  findPlisAtOrBefore
} from './synthesisMesures.ts'

/** Construit une session circ : tous les champs `null` sauf ceux fournis. */
function fakeCirc(date: string, fields: Partial<MesureCirconferences> = {}): MesureCirconferences {
  return {
    id: `c-${date}`,
    clientId: 'c1',
    date,
    poidsKg: null,
    cou: null,
    epaule: null,
    bicepsG: null,
    bicepsD: null,
    poitrine: null,
    taille: null,
    abdomen: null,
    hanche: null,
    cuisseG: null,
    cuisseD: null,
    molletG: null,
    molletD: null,
    notes: null,
    createdAt: `${date}T12:00:00.000Z`,
    ...fields
  }
}

function fakePlis(date: string): MesurePlisCutanes {
  return {
    id: `p-${date}`,
    clientId: 'c1',
    date,
    triceps: 10,
    biceps: 8,
    sousscapulaire: 12,
    iliaque: 14,
    somme4Plis: 44,
    densiteCorporelle: 1.05,
    pourcentageGrasSiri: 20,
    pourcentageGrasBrozek: 20,
    ageAuCalcul: 40,
    sexeAuCalcul: 'M',
    notes: null,
    createdAt: `${date}T12:00:00.000Z`
  }
}

test('1 seule session → la synthèse en est une copie des champs renseignés', () => {
  const r = buildSynthesisCirc([fakeCirc('2025-12-15', { taille: 90, poidsKg: 80 })])
  assert.equal(r.data.taille, 90)
  assert.equal(r.data.poidsKg, 80)
  assert.equal(r.latestContributionDate, '2025-12-15')
  assert.equal(r.fieldOriginDates.taille, '2025-12-15')
})

test('3 sessions partielles → synthèse = latest non-null par champ', () => {
  const circList = [
    fakeCirc('2025-12-15', { taille: 88 }),
    fakeCirc('2025-06-15', { taille: 92, hanche: 100 }),
    fakeCirc('2025-01-15', { taille: 95, hanche: 104, cou: 40 })
  ]
  const r = buildSynthesisCirc(circList)
  // taille : prise de la plus récente
  assert.equal(r.data.taille, 88)
  assert.equal(r.fieldOriginDates.taille, '2025-12-15')
  // hanche : absente de la plus récente → prise de juin
  assert.equal(r.data.hanche, 100)
  assert.equal(r.fieldOriginDates.hanche, '2025-06-15')
  // cou : seulement dans la plus ancienne
  assert.equal(r.data.cou, 40)
  assert.equal(r.fieldOriginDates.cou, '2025-01-15')
  assert.equal(r.latestContributionDate, '2025-12-15')
})

test('buildPreviousSynthesisCirc → 2e valeur non-null par champ', () => {
  const circList = [
    fakeCirc('2025-12-15', { taille: 88, hanche: 99 }),
    fakeCirc('2025-06-15', { taille: 92 }),
    fakeCirc('2025-01-15', { taille: 95, hanche: 104 })
  ]
  const r = buildPreviousSynthesisCirc(circList)
  // taille : 2e valeur rencontrée
  assert.equal(r.data.taille, 92)
  // hanche : 2e valeur (vient de janvier, le 2e à la renseigner)
  assert.equal(r.data.hanche, 104)
})

test('buildPreviousSynthesisCirc → vide si un champ n\'apparait qu\'une fois', () => {
  const r = buildPreviousSynthesisCirc([fakeCirc('2025-12-15', { taille: 88 })])
  assert.equal(r.data.taille, undefined)
})

test('Liste circ vide → synthèse vide', () => {
  const r = buildSynthesisCirc([])
  assert.deepEqual(r.data, {})
  assert.equal(r.latestContributionDate, null)
})

test('buildUnifiedDates → fusion des dates circ + plis, triée desc', () => {
  const circList = [fakeCirc('2025-12-15'), fakeCirc('2025-06-15')]
  const plisList = [fakePlis('2025-12-15'), fakePlis('2025-03-15')]
  const dates = buildUnifiedDates(circList, plisList)
  assert.deepEqual(dates, [
    { date: '2025-12-15', hasCirc: true, hasPlis: true },
    { date: '2025-06-15', hasCirc: true, hasPlis: false },
    { date: '2025-03-15', hasCirc: false, hasPlis: true }
  ])
})

test('findCircAtOrBefore → session ≤ date cible, null si aucune antérieure', () => {
  const circList = [fakeCirc('2025-12-15'), fakeCirc('2025-06-15')]
  assert.equal(findCircAtOrBefore(circList, '2025-08-01')?.date, '2025-06-15')
  assert.equal(findCircAtOrBefore(circList, '2025-12-15')?.date, '2025-12-15')
  assert.equal(findCircAtOrBefore(circList, '2025-01-01'), null)
})

test('findPlisAtOrBefore → session ≤ date cible', () => {
  const plisList = [fakePlis('2025-12-15'), fakePlis('2025-03-15')]
  assert.equal(findPlisAtOrBefore(plisList, '2025-06-01')?.date, '2025-03-15')
  assert.equal(findPlisAtOrBefore(plisList, '2025-02-01'), null)
})
