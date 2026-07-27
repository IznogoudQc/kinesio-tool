import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractCurrent } from './bilan-parser.ts'

// Reproduit la structure d'un bilan du logiciel d'origine : l'en-tête
// anthropométrique contient « Ratio Taille/Hanche » suivi de la taille
// « 5' 9" », et la vraie circonférence de hanche vit plus bas dans la
// section « Circonférences ». Le parser doit lire 112,0 (hanche) et NON 5.
const FIXTURE = [
  'Taille',
  'Poids',
  'IMC',
  'Somme des 5 plis',
  'Circonfér. de la taille',
  'Ratio Taille/Hanche',
  '5\' 9"\t175,0 cm',
  '218,8 lbs\t99,2 kg',
  '32 kg/m2',
  '93,0 Mm',
  '99 cm',
  '0,88 ► Sain',
  'Composition Corporelle ► 2,0 points',
  '',
  'Circonférences cm',
  'Hanche',
  '112,0'
].join('\n')

test('hanche : lit la circonférence (112,0) et non le « 5 » de « 5\' 9" »', () => {
  const data = extractCurrent(FIXTURE)
  assert.equal(data.tour_hanche_cm, 112)
})

test('hanche : ne confond pas avec l’en-tête « Ratio Taille/Hanche »', () => {
  const data = extractCurrent(FIXTURE)
  assert.notEqual(data.tour_hanche_cm, 5)
})

test('anthropométrie : taille (175) et tour de taille (99) restent corrects', () => {
  const data = extractCurrent(FIXTURE)
  assert.equal(data.taille_cm, 175)
  assert.equal(data.tour_taille_cm, 99)
})

// Ancien logiciel : la section « Circonférences » liste Biceps / Poitrine / Hanche /
// Cuisse. Mapping vers les champs de Marie : Biceps→biceps fléchi, Poitrine→épaules
// et pec, Cuisse→cuisse. Les plis (Biceps, Cuisse aussi) ne doivent PAS être confondus.
const FIXTURE_CIRC = [
  'Plis Cutanés mm',
  'Triceps', '7,0',
  'Biceps', '5,5',
  'Sous-scapulaire', '18,5',
  'Crête iliaque', '15,0',
  'Circonférences cm',
  'Biceps', '40,0',
  'Poitrine', '130,0',
  'Hanche', '107,0',
  'Cuisse', '52,0'
].join('\n')

test('circonférences : mapping Biceps→fléchi, Poitrine→épaules/pec, Cuisse, Hanche', () => {
  const data = extractCurrent(FIXTURE_CIRC)
  assert.equal(data.circ_biceps_flechi_cm, 40)
  assert.equal(data.circ_epaules_pec_cm, 130)
  assert.equal(data.circ_cuisse_cm, 52)
  assert.equal(data.tour_hanche_cm, 107)
})

test('circonférences : les plis Biceps (5,5) ne polluent pas la circonférence Biceps (40)', () => {
  const data = extractCurrent(FIXTURE_CIRC)
  assert.equal(data.pli_biceps, 5.5)
  assert.equal(data.circ_biceps_flechi_cm, 40)
})
