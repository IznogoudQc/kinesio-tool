/**
 * Tests du questionnaire FANTASTIC.
 *
 * Lancer : `node --test src/lib/fantastic.test.ts`
 *
 * Le contenu a été transcrit depuis des photos de la feuille papier de
 * Marie-Eve. Une transcription se relit mal à l'œil : ces tests verrouillent ce
 * qui rendrait le questionnaire faux sans que rien ne plante — un énoncé perdu,
 * une échelle à l'envers, un total qui ne tombe plus sur 100.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FANTASTIC_SECTIONS,
  FANTASTIC_ITEMS,
  FANTASTIC_KEYS,
  FANTASTIC_MAX,
  FANTASTIC_LEVELS,
  emptyFantastic,
  fantasticScore,
  fantasticLevel,
  itemKey
} from './fantastic.ts'

test('9 sections, dans l’ordre de la feuille', () => {
  assert.deepEqual(
    FANTASTIC_SECTIONS.map(s => s.key),
    ['famille', 'activite', 'alimentation', 'tabac', 'alcool', 'sommeil', 'comportement', 'emotions', 'travail']
  )
})

test('25 énoncés — c’est ce qui fait tomber le score sur 100', () => {
  assert.equal(FANTASTIC_ITEMS.length, 25)
  assert.equal(FANTASTIC_MAX, 100)
})

test('le nombre d’énoncés par section correspond à la feuille', () => {
  assert.deepEqual(
    FANTASTIC_SECTIONS.map(s => s.items.length),
    [2, 2, 3, 4, 3, 5, 2, 3, 1]
  )
})

test('chaque énoncé a exactement 5 colonnes', () => {
  for (const item of FANTASTIC_ITEMS) {
    assert.equal(item.choices.length, 5, `« ${item.label} » n’a pas 5 colonnes`)
  }
})

test('toutes les clés sont uniques — une collision écraserait une réponse', () => {
  assert.equal(new Set(FANTASTIC_KEYS).size, 25)
})

test('les clés sont bien « section.item »', () => {
  assert.equal(itemKey(FANTASTIC_SECTIONS[0], FANTASTIC_SECTIONS[0].items[0]), 'famille.confident')
  assert.ok(FANTASTIC_KEYS.includes('alcool.conduite'))
  assert.ok(FANTASTIC_KEYS.includes('travail.satisfaction'))
})

test('les énoncés inversés se lisent bien du pire au meilleur', () => {
  // « Je me sens pressé(e) » : être pressé presque TOUJOURS est le pire cas,
  // donc c'est la colonne 0. Si cette échelle était à l'endroit, le score
  // récompenserait le stress.
  const presse = FANTASTIC_ITEMS.find(i => i.key === 'presse')!
  assert.equal(presse.choices[0], 'Presque toujours')
  assert.equal(presse.choices[4], 'Presque jamais')

  // À l'inverse, « Je suis positif(ve) » va bien du moins au plus favorable.
  const optimiste = FANTASTIC_ITEMS.find(i => i.key === 'optimiste')!
  assert.equal(optimiste.choices[0], 'Presque jamais')
  assert.equal(optimiste.choices[4], 'Presque toujours')
})

test('les deux énoncés à colonnes vides gardent leurs extrêmes', () => {
  // Sur la feuille, « drogues » et « conduite » n'ont que deux libellés
  // imprimés ; les trois colonnes du milieu sont des cases nues.
  for (const key of ['drogues', 'conduite']) {
    const item = FANTASTIC_ITEMS.find(i => i.key === key)!
    assert.equal(item.choices[0], 'Parfois')
    assert.equal(item.choices[4], 'Jamais')
    assert.deepEqual(item.choices.slice(1, 4), ['', '', ''])
  }
})

test('un questionnaire vierge ne vaut pas zéro — il vaut « pas de score »', () => {
  // Un blanc n'est pas un 0 : afficher 0/100 à quelqu'un qui n'a rien rempli
  // serait faux, et décourageant.
  const s = fantasticScore(emptyFantastic())
  assert.equal(s.sur100, null)
  assert.equal(s.answered, 0)
  assert.equal(s.complete, false)
})

test('tout au maximum donne 100', () => {
  const answers = Object.fromEntries(FANTASTIC_KEYS.map(k => [k, 4]))
  const s = fantasticScore(answers)
  assert.equal(s.points, 100)
  assert.equal(s.sur100, 100)
  assert.equal(s.complete, true)
  assert.equal(fantasticLevel(s.sur100), 'Excellent')
})

test('tout au minimum donne 0, et le questionnaire est bien complet', () => {
  const answers = Object.fromEntries(FANTASTIC_KEYS.map(k => [k, 0]))
  const s = fantasticScore(answers)
  assert.equal(s.points, 0)
  assert.equal(s.sur100, 0)
  assert.equal(s.complete, true)
  assert.equal(fantasticLevel(s.sur100), 'À améliorer')
})

test('un questionnaire partiel est ramené sur 100 au prorata, pas pénalisé', () => {
  // 5 énoncés à 3/4 → 15/20 → 75 %. Compter les 20 blancs comme des zéros
  // donnerait 15/100, un résultat qui ne veut rien dire cliniquement.
  const answers = emptyFantastic()
  for (const k of FANTASTIC_KEYS.slice(0, 5)) answers[k] = 3
  const s = fantasticScore(answers)
  assert.equal(s.answered, 5)
  assert.equal(s.points, 15)
  assert.equal(s.sur100, 75)
  assert.equal(s.complete, false)
})

test('les réponses aberrantes sont ignorées, pas comptées', () => {
  const answers = emptyFantastic()
  answers[FANTASTIC_KEYS[0]] = 4
  answers[FANTASTIC_KEYS[1]] = 9 // hors échelle
  answers[FANTASTIC_KEYS[2]] = -1 // hors échelle
  answers[FANTASTIC_KEYS[3]] = 2.5 // non entier
  const s = fantasticScore(answers)
  assert.equal(s.answered, 1)
  assert.equal(s.points, 4)
})

test('les paliers couvrent 0 à 100 sans trou', () => {
  for (let n = 0; n <= 100; n++) {
    assert.ok(fantasticLevel(n) !== null, `aucun palier pour ${n}`)
  }
})

test('les bornes de chaque palier', () => {
  assert.equal(fantasticLevel(100), 'Excellent')
  assert.equal(fantasticLevel(85), 'Excellent')
  assert.equal(fantasticLevel(84), 'Très bien')
  assert.equal(fantasticLevel(70), 'Très bien')
  assert.equal(fantasticLevel(69), 'Bien')
  assert.equal(fantasticLevel(55), 'Bien')
  assert.equal(fantasticLevel(54), 'Passable')
  assert.equal(fantasticLevel(35), 'Passable')
  assert.equal(fantasticLevel(34), 'À améliorer')
  assert.equal(fantasticLevel(0), 'À améliorer')
})

test('un score absent n’invente pas de palier', () => {
  assert.equal(fantasticLevel(null), null)
})

test('les paliers sont ordonnés du meilleur au moins bon', () => {
  // L'ordre décroissant est ce qui fait fonctionner le `.find()` de
  // fantasticLevel : une inversion renverrait « À améliorer » pour tout le monde.
  for (let i = 1; i < FANTASTIC_LEVELS.length; i++) {
    assert.ok(FANTASTIC_LEVELS[i].min < FANTASTIC_LEVELS[i - 1].min)
  }
})

test('aucun énoncé n’a de libellé vide', () => {
  for (const item of FANTASTIC_ITEMS) {
    assert.ok(item.label.trim().length > 0)
  }
})
