import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireSaisiePlis } from './plis-moyenne.ts'

test('une valeur seule est rendue telle quelle, sans arrondi', () => {
  assert.deepEqual(lireSaisiePlis('5'), { valeur: 5, prises: 1 })
  assert.deepEqual(lireSaisiePlis('18.5'), { valeur: 18.5, prises: 1 })
  // Pas d'arrondi ici : on ne réécrit pas ce que Marie a mesuré.
  assert.deepEqual(lireSaisiePlis('5.55'), { valeur: 5.55, prises: 1 })
})

test('deux prises séparées par une barre oblique donnent leur moyenne', () => {
  assert.deepEqual(lireSaisiePlis('5/5.5'), { valeur: 5.3, prises: 2 })
  assert.deepEqual(lireSaisiePlis('6/7/6.5'), { valeur: 6.5, prises: 3 })
})

test('la virgule décimale est acceptée — on écrit 5,5 au Québec', () => {
  assert.deepEqual(lireSaisiePlis('5,5'), { valeur: 5.5, prises: 1 })
  assert.deepEqual(lireSaisiePlis('5/5,5'), { valeur: 5.3, prises: 2 })
})

test('les espaces autour des prises ne changent rien', () => {
  assert.deepEqual(lireSaisiePlis(' 6 / 7 '), { valeur: 6.5, prises: 2 })
})

test('pendant la frappe, « 5/ » vaut encore 5', () => {
  // Sinon la valeur clignoterait entre la barre oblique et le chiffre suivant.
  assert.deepEqual(lireSaisiePlis('5/'), { valeur: 5, prises: 1 })
  assert.deepEqual(lireSaisiePlis('5//6'), { valeur: 5.5, prises: 2 })
})

test('un champ vide ne retient rien', () => {
  assert.deepEqual(lireSaisiePlis(''), { valeur: null, prises: 0 })
  assert.deepEqual(lireSaisiePlis('  '), { valeur: null, prises: 0 })
  assert.deepEqual(lireSaisiePlis('/'), { valeur: null, prises: 0 })
})

test('une saisie illisible ou négative ne retient rien', () => {
  assert.equal(lireSaisiePlis('abc').valeur, null)
  assert.equal(lireSaisiePlis('5/abc').valeur, null)
  assert.equal(lireSaisiePlis('-5').valeur, null)
})

test('la moyenne est arrondie au dixième, pas la mesure', () => {
  // 5 + 5.5 + 6 = 16.5 / 3 = 5.5 exactement
  assert.equal(lireSaisiePlis('5/5.5/6').valeur, 5.5)
  // 5 + 6 + 6 = 17 / 3 = 5.666… → 5.7
  assert.equal(lireSaisiePlis('5/6/6').valeur, 5.7)
})
