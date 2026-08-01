import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GUIDE_ALIMENTAIRE_VOLETS,
  GUIDE_ALIMENTAIRE_SOURCE,
  guideAlimentaireConseils
} from './guide-alimentaire.ts'

test('les huit recommandations du Guide alimentaire canadien, mot pour mot', () => {
  // Texte officiel : toute retouche de formulation serait une réécriture d'un
  // message de santé publique. Verrouillé mot pour mot, exprès.
  assert.deepEqual(guideAlimentaireConseils(), [
    'Mangez des légumes et des fruits en abondance',
    'Consommez des aliments protéinés',
    'Choisissez des aliments à grains entiers',
    'Faites de l’eau votre boisson de choix',
    'Prenez conscience de vos habitudes alimentaires',
    'Cuisinez plus souvent',
    'Savourez vos aliments',
    'Prenez vos repas en bonne compagnie'
  ])
})

test('deux volets de quatre : aliments d’un côté, habitudes de l’autre', () => {
  assert.equal(GUIDE_ALIMENTAIRE_VOLETS.length, 2)
  for (const volet of GUIDE_ALIMENTAIRE_VOLETS) {
    assert.equal(volet.conseils.length, 4, volet.titre)
    assert.ok(volet.titre.trim() !== '')
  }
})

test('aucun conseil vide ni dupliqué', () => {
  const tous = guideAlimentaireConseils()
  assert.ok(tous.every(c => c.trim() !== ''))
  assert.equal(new Set(tous).size, tous.length)
})

test('la source est attribuée — jamais de conseils sans provenance', () => {
  assert.match(GUIDE_ALIMENTAIRE_SOURCE, /Guide alimentaire canadien/)
  assert.match(GUIDE_ALIMENTAIRE_SOURCE, /2019/)
})
