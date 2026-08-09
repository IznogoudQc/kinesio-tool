/**
 * Quels suppléments ont leur place dans une idée de menu.
 *
 * Un seul : celui qui apporte des protéines. Les idées de menu affichaient
 * « (+ vitamine D3+K2, oméga-3, magnésium) » à la fin d'un souper — signalé par
 * Nicholas le 2026-08-09. Une whey se boit avec le déjeuner et compte dans la
 * cible de protéines ; un magnésium n'a rien à faire dans la description d'un
 * repas, il a sa propre section avec ses consignes d'espacement.
 *
 * Le filtre est une heuristique par mots-clés : testé pour qu'un ajustement de
 * la liste ne laisse pas repasser une vitamine.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estSupplementProteine, supplementsProteines, EMPTY_SUPP_PLAN } from './nutrition-plan.ts'

test('reconnaît les sources de protéines', () => {
  for (const s of [
    'Protéine (whey)',
    'protéine whey — après l’entraînement',
    'Whey isolate 30 g',
    'Caséine au coucher',
    'Isolat de protéine de pois',
    'Hydrolysat de petit-lait'
  ]) {
    assert.ok(estSupplementProteine(s), `non reconnu : ${s}`)
  }
})

test('laisse dehors tout ce qui n’est pas une protéine', () => {
  // Exactement ce qui apparaissait à tort dans les soupers.
  for (const s of [
    'Vitamine D3+K2',
    'Oméga-3',
    'Magnésium bisglycinate',
    'Créatine monohydrate',
    'Multivitamines',
    'Zinc',
    'Probiotiques',
    'Fer avec vitamine C'
  ]) {
    assert.ok(!estSupplementProteine(s), `passe à tort : ${s}`)
  }
})

test('filtre à l’intérieur d’un moment, pas seulement entre moments', () => {
  // Le piège : un moment contenant whey ET créatine aurait tout emporté.
  const plan = {
    ...EMPTY_SUPP_PLAN,
    dejeuner: 'Protéine (whey)\nVitamine D3+K2\nOméga-3',
    souper: 'Magnésium bisglycinate'
  }
  const out = supplementsProteines(plan)
  assert.match(out ?? '', /whey/i)
  assert.ok(!/D3|Oméga|Magnésium/i.test(out ?? ''), `un non-protéiné a survécu : ${out}`)
  assert.ok(!/Souper/i.test(out ?? ''), 'un moment sans protéine apparaît quand même')
})

test('aucune protéine → rien à transmettre', () => {
  const plan = { ...EMPTY_SUPP_PLAN, souper: 'Vitamine D3+K2\nOméga-3' }
  assert.equal(supplementsProteines(plan), undefined)
  assert.equal(supplementsProteines(EMPTY_SUPP_PLAN), undefined)
})

test('garde le moment de prise, pour que l’IA vise le bon repas', () => {
  const plan = { ...EMPTY_SUPP_PLAN, apresEntrainement: 'Protéine (whey) 1 mesure' }
  const out = supplementsProteines(plan) ?? ''
  // Apostrophe DROITE : c'est celle de `SUPP_MOMENTS`, pas la typographique.
  assert.match(out, /Après l'entraînement/)
  assert.match(out, /1 mesure/, 'la dose de Marie est perdue')
})
