import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyBloodPressure,
  bloodPressureBar,
  waistRatingLegacy,
  waistRatingExplanation
} from './clinical.ts'

test('classification PA — systolique', () => {
  assert.equal(classifyBloodPressure(117, 'systolic')!.zone, 'Optimale')
  assert.equal(classifyBloodPressure(125, 'systolic')!.zone, 'Normale')
  assert.equal(classifyBloodPressure(135, 'systolic')!.zone, 'Pré-hypertension')
  assert.equal(classifyBloodPressure(150, 'systolic')!.zone, 'Hypertension 1')
  assert.equal(classifyBloodPressure(170, 'systolic')!.zone, 'Hypertension 2')
})

test('classification PA — diastolique (87 → Pré-hypertension)', () => {
  assert.equal(classifyBloodPressure(87, 'diastolic')!.zone, 'Pré-hypertension')
  assert.equal(classifyBloodPressure(79, 'diastolic')!.zone, 'Optimale')
})

test('barre PA : 5 zones contiguës, repère borné, zone courante alignée', () => {
  const bar = bloodPressureBar(117, 'systolic')!
  assert.equal(bar.zones.length, 5)
  for (let i = 1; i < bar.zones.length; i++) assert.equal(bar.zones[i].min, bar.zones[i - 1].max)
  assert.equal(bar.current!.label, 'Optimale')
  assert.ok(bar.markerRatio! > 0 && bar.markerRatio! < 1)
  // 117 sur [90,180] → (117-90)/90 = 0,3
  assert.ok(Math.abs(bar.markerRatio! - 0.3) < 1e-9)
})

test('barre PA : repère saturé et valeur absente', () => {
  assert.equal(bloodPressureBar(250, 'systolic')!.markerRatio, 1)
  assert.equal(bloodPressureBar(50, 'systolic')!.markerRatio, 0)
  assert.equal(bloodPressureBar(null, 'systolic')!.markerRatio, null)
  assert.equal(bloodPressureBar(null, 'systolic')!.current, null)
})

test('tour de taille — barème de l’ancien logiciel, aux bornes exactes', () => {
  // Hommes : < 94 → 4 · < 102 → 3 · reste → 1
  assert.deepEqual(waistRatingLegacy(93, 'M'), { cote: 4, label: 'Excellent' })
  assert.deepEqual(waistRatingLegacy(93.9, 'M'), { cote: 4, label: 'Excellent' })
  assert.deepEqual(waistRatingLegacy(94, 'M'), { cote: 3, label: 'Risque potentiel' })
  assert.deepEqual(waistRatingLegacy(101.9, 'M'), { cote: 3, label: 'Risque potentiel' })
  assert.deepEqual(waistRatingLegacy(102, 'M'), { cote: 1, label: 'Risque considérable' })
  // Femmes : < 80 → 4 · < 90 → 3 · reste → 1
  assert.deepEqual(waistRatingLegacy(79.9, 'F'), { cote: 4, label: 'Excellent' })
  assert.deepEqual(waistRatingLegacy(80, 'F'), { cote: 3, label: 'Risque potentiel' })
  assert.deepEqual(waistRatingLegacy(89.9, 'F'), { cote: 3, label: 'Risque potentiel' })
  assert.deepEqual(waistRatingLegacy(90, 'F'), { cote: 1, label: 'Risque considérable' })
})

test('tour de taille — la cote 2 n’existe pas, et la 0 non plus', () => {
  // La fenêtre Propriétés imprime 4, 3, 1. Normaliser en 4/3/2 inventerait une
  // cote que l'ancien logiciel n'attribue jamais.
  const cotes = new Set<number>()
  for (const sex of ['M', 'F'] as const) {
    for (let cm = 50; cm <= 200; cm += 0.5) cotes.add(waistRatingLegacy(cm, sex)!.cote)
  }
  assert.deepEqual([...cotes].sort(), [1, 3, 4])
})

test('tour de taille — le seuil féminin est 90, pas 88', () => {
  // Le référentiel Santé Canada dit 88 ; l'ancien logiciel de Marie dit 90.
  // C'est le sien qui fait foi ici — vérifié sur capture.
  assert.equal(waistRatingLegacy(88, 'F')?.cote, 3)
  assert.equal(waistRatingLegacy(89, 'F')?.cote, 3)
  assert.equal(waistRatingLegacy(90, 'F')?.cote, 1)
})

test('tour de taille — sexe ou valeur manquants → null, jamais de cote inventée', () => {
  assert.equal(waistRatingLegacy(95, null), null)
  assert.equal(waistRatingLegacy(null, 'M'), null)
  assert.equal(waistRatingLegacy(Number.NaN, 'F'), null)
})

test('tour de taille — la raison nomme la borne franchie', () => {
  // Homme : bornes 94 et 102.
  assert.match(waistRatingExplanation(93, 'M')!, /93 cm, sous la barre des 94 cm/)
  assert.match(waistRatingExplanation(94, 'M')!, /au-dessus de 94 cm, mais encore sous 102 cm/)
  assert.match(waistRatingExplanation(105, 'M')!, /au-delà de 102 cm/)
  // Femme : bornes 80 et 90.
  assert.match(waistRatingExplanation(79, 'F')!, /sous la barre des 80 cm/)
  assert.match(waistRatingExplanation(85, 'F')!, /au-dessus de 80 cm, mais encore sous 90 cm/)
  assert.match(waistRatingExplanation(95, 'F')!, /au-delà de 90 cm/)
})

test('tour de taille — la raison suit toujours la cote, sans contradiction', () => {
  for (const sex of ['M', 'F'] as const) {
    for (let cm = 60; cm <= 160; cm += 0.5) {
      const cote = waistRatingLegacy(cm, sex)!
      const raison = waistRatingExplanation(cm, sex)!
      // Une phrase qui dirait « sous la barre » pour une cote 1 serait pire que
      // pas de phrase du tout.
      if (cote.cote === 4) assert.match(raison, /sous la barre/, `${cm} ${sex}`)
      if (cote.cote === 3) assert.match(raison, /mais encore sous/, `${cm} ${sex}`)
      if (cote.cote === 1) assert.match(raison, /au-delà/, `${cm} ${sex}`)
    }
  }
})

test('tour de taille — pas de raison sans valeur ni sexe', () => {
  assert.equal(waistRatingExplanation(null, 'M'), null)
  assert.equal(waistRatingExplanation(95, null), null)
})
