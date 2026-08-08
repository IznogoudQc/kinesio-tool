import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyBloodPressure,
  bloodPressureBar,
  waistRating,
  waistRatingExplanation
} from './clinical.ts'

test('classification PA — systolique', () => {
  assert.equal(classifyBloodPressure(117, 'systolic')!.zone, 'Optimale')
  assert.equal(classifyBloodPressure(125, 'systolic')!.zone, 'Normale')
  assert.equal(classifyBloodPressure(135, 'systolic')!.zone, 'Pré-hypertension')
  assert.equal(classifyBloodPressure(150, 'systolic')!.zone, 'Hypertension 1')
  assert.equal(classifyBloodPressure(170, 'systolic')!.zone, 'Hypertension 2')
})

test('classification PA — diastolique, bornes de l’ancien logiciel', () => {
  // Capture de sa fenêtre d'affichage (2026-08-07) : 75 / 80 / 90 / 100.
  // L'app affichait 80 / 85 / 90 / 100 — deux zones décalées de 5 mmHg.
  assert.equal(classifyBloodPressure(74, 'diastolic')!.zone, 'Optimale')
  assert.equal(classifyBloodPressure(75, 'diastolic')!.zone, 'Normale')
  assert.equal(classifyBloodPressure(79, 'diastolic')!.zone, 'Normale')
  assert.equal(classifyBloodPressure(80, 'diastolic')!.zone, 'Pré-hypertension')
  assert.equal(classifyBloodPressure(87, 'diastolic')!.zone, 'Pré-hypertension')
  assert.equal(classifyBloodPressure(90, 'diastolic')!.zone, 'Hypertension 1')
  assert.equal(classifyBloodPressure(100, 'diastolic')!.zone, 'Hypertension 2')
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

test('tour de taille — fenêtre Propriétés de l’ancien logiciel, aux bornes exactes', () => {
  // Capture du 2026-08-08, onglet Classification : « = Scores < » 94 / 102 chez
  // l'homme, 80 / 90 chez la femme, tous les âges.
  assert.deepEqual(waistRating(93.9, 'M'), { cote: 4, label: 'Excellent' })
  assert.deepEqual(waistRating(94, 'M'), { cote: 3, label: 'Risque potentiel' })
  assert.deepEqual(waistRating(101.9, 'M'), { cote: 3, label: 'Risque potentiel' })
  assert.deepEqual(waistRating(102, 'M'), { cote: 1, label: 'Risque considérable' })
  assert.deepEqual(waistRating(79.9, 'F'), { cote: 4, label: 'Excellent' })
  assert.deepEqual(waistRating(80, 'F'), { cote: 3, label: 'Risque potentiel' })
  assert.deepEqual(waistRating(89.9, 'F'), { cote: 3, label: 'Risque potentiel' })
  assert.deepEqual(waistRating(90, 'F'), { cote: 1, label: 'Risque considérable' })
})

test('tour de taille — la borne haute est EXCLUSIVE', () => {
  // La fenêtre écrit « Scores < 102 » : 101,5 cm reste « Risque potentiel ».
  // Ce test a longtemps affirmé l'inverse, quand les bornes venaient de
  // Statistique Canada (« plus de 101 »). La capture de l'ancien logiciel a
  // changé la source ET la façon de comparer — les deux allaient ensemble.
  assert.equal(waistRating(101.5, 'M')?.cote, 3)
  assert.equal(waistRating(102, 'M')?.cote, 1)
  assert.equal(waistRating(89.5, 'F')?.cote, 3)
  assert.equal(waistRating(90, 'F')?.cote, 1)
})

test('tour de taille — la cote 2 n’existe pas, et la 0 non plus', () => {
  // La fenêtre Propriétés imprime 4, 3, 1. Normaliser en 4/3/2 inventerait une
  // cote que l'ancien logiciel n'attribue jamais.
  const cotes = new Set<number>()
  for (const sex of ['M', 'F'] as const) {
    for (let cm = 50; cm <= 200; cm += 0.5) cotes.add(waistRating(cm, sex)!.cote)
  }
  assert.deepEqual([...cotes].sort(), [1, 3, 4])
})

test('tour de taille — le seuil féminin est 90, pas 87', () => {
  // Statistique Canada (HWMDWSTA) dit 87 ; la fenêtre Propriétés dit 90. Elle
  // avait été écartée en août faute d'être visible — la capture du 2026-08-08 la
  // montre, et c'est le logiciel que l'app remplace qui fait foi.
  //
  // C'est exactement la plage où les deux sources divergent : 88 et 89 cm.
  assert.equal(waistRating(87, 'F')?.cote, 3)
  assert.equal(waistRating(88, 'F')?.cote, 3)
  assert.equal(waistRating(89, 'F')?.cote, 3)
  assert.equal(waistRating(90, 'F')?.cote, 1)
})

test('tour de taille — sexe ou valeur manquants → null, jamais de cote inventée', () => {
  assert.equal(waistRating(95, null), null)
  assert.equal(waistRating(null, 'M'), null)
  assert.equal(waistRating(Number.NaN, 'F'), null)
})

test('tour de taille — la raison nomme la borne franchie', () => {
  // Homme : bornes 94 et 102.
  assert.match(waistRatingExplanation(93, 'M')!, /93 cm, sous la barre des 94 cm/)
  assert.match(waistRatingExplanation(94, 'M')!, /au-dessus de 94 cm, sous la barre des 102 cm/)
  assert.match(waistRatingExplanation(105, 'M')!, /à 102 cm ou plus/)
  // Femme : bornes 80 et 90.
  assert.match(waistRatingExplanation(79, 'F')!, /sous la barre des 80 cm/)
  assert.match(waistRatingExplanation(85, 'F')!, /au-dessus de 80 cm, sous la barre des 90 cm/)
  assert.match(waistRatingExplanation(95, 'F')!, /à 90 cm ou plus/)
})

test('tour de taille — la raison suit toujours la cote, sans contradiction', () => {
  for (const sex of ['M', 'F'] as const) {
    for (let cm = 60; cm <= 160; cm += 0.5) {
      const cote = waistRating(cm, sex)!
      const raison = waistRatingExplanation(cm, sex)!
      // Une phrase qui dirait « sous la barre » pour une cote 1 serait pire que
      // pas de phrase du tout.
      if (cote.cote === 4) assert.match(raison, /^[\d,]+ cm, sous la barre/, `${cm} ${sex}`)
      if (cote.cote === 3) assert.match(raison, /au-dessus de .* sous la barre/, `${cm} ${sex}`)
      if (cote.cote === 1) assert.match(raison, /ou plus\.$/, `${cm} ${sex}`)
    }
  }
})

test('tour de taille — pas de raison sans valeur ni sexe', () => {
  assert.equal(waistRatingExplanation(null, 'M'), null)
  assert.equal(waistRatingExplanation(95, null), null)
})
