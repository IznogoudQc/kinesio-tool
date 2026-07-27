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

// Cas rapporté : dans certains .doc, les Circonférences viennent AVANT les Plis, et
// ce client n'a PAS de circonférence Biceps. La section Circonférences (bornée) ne
// doit PAS déborder sur le pli Biceps (7) — sinon circ_biceps = 7 par erreur.
const FIXTURE_CIRC_AVANT_PLIS = [
  'Circonférences cm',
  'Poitrine', '130,0',
  'Hanche', '107,0',
  'Cuisse', '52,0',
  'Plis Cutanés mm',
  'Triceps', '7,0',
  'Biceps', '7,0',
  'Sous-scapulaire', '18,5',
  'Crête iliaque', '15,0',
  'Aptitude Aérobie Tapis Roulant de Bruce'
].join('\n')

test('circonférences AVANT plis : le pli Biceps (7) ne devient PAS circ_biceps', () => {
  const data = extractCurrent(FIXTURE_CIRC_AVANT_PLIS)
  assert.equal(data.pli_biceps, 7) // le pli est bien lu
  assert.equal(data.circ_biceps_flechi_cm, undefined) // pas de circ Biceps → non renseignée
  assert.equal(data.circ_epaules_pec_cm, 130) // Poitrine → épaules/pec
  assert.equal(data.tour_hanche_cm, 107)
  assert.equal(data.circ_cuisse_cm, 52)
})

// Cas réel de Marie : Plis d'abord (Triceps/Biceps/Subscapulaire/Crète iliaque),
// puis Circonférences avec SEULEMENT Hanche (pas de circonférence Biceps prise).
// Le pli Biceps 6 ne doit PAS se retrouver en circonférence Biceps.
const FIXTURE_PLIS_PUIS_CIRC_HANCHE = [
  'Plis Cutanés mm',
  'Triceps', '5,0', 'Biceps', '6,0', 'Subscapulaire', '17,0',
  'Crète iliaque', '22,0',
  'Circonférences cm',
  'Hanche', '106,0',
  'Aptitude Aérobie Tapis Roulant de Bruce'
].join('\n')

test('plis puis circonférences (Hanche seule) : le pli Biceps (6) ne devient PAS circ_biceps', () => {
  const data = extractCurrent(FIXTURE_PLIS_PUIS_CIRC_HANCHE)
  assert.equal(data.pli_biceps, 6)
  assert.equal(data.circ_biceps_flechi_cm, undefined)
  assert.equal(data.tour_hanche_cm, 106)
})
