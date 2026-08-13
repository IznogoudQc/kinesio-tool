/**
 * Protéines calculées depuis les poids écrits dans un menu.
 *
 * Le test qui compte le plus est « l'aliment pesé est le plus proche du
 * poids » : une ligne contient souvent deux aliments connus (« salade de
 * lentilles au poulet grillé (180 g) ») et un seul est pesé. Prendre le premier
 * rencontré donne un chiffre faux avec l'air d'être juste — le pire résultat
 * possible pour un outil de vérification.
 *
 * Vient ensuite le refus de deviner : un aliment absent de la table est
 * signalé, jamais remplacé par celui qui lui ressemble.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { proteinesDeJournee, proteinesDeLigne } from './menu-macros.ts'

test('un poids et une table suffisent', () => {
  // Saumon : 22 g de protéines pour 100 g → 150 g en apportent 33.
  const r = proteinesDeLigne('Souper : filet de saumon au citron (150 g), patate douce rôtie')
  assert.equal(r.totalG, 33)
  assert.equal(r.inconnus.length, 0)
  assert.equal(r.hypothese, false)
})

test('c’est l’aliment le PLUS PROCHE du poids qui est pesé', () => {
  // Deux aliments connus, un seul pesé. Le poulet (31 g/100 g) donne 56 ;
  // les lentilles (9 g/100 g) donneraient 16 — l'erreur serait invisible.
  const r = proteinesDeLigne(
    'Dîner : salade de lentilles au poulet grillé (180 g), tomates, concombre'
  )
  assert.equal(r.portions[0].aliment, 'Poulet, dinde')
  assert.equal(r.totalG, 56)
})

test('plusieurs aliments pesés sur la même ligne', () => {
  const r = proteinesDeLigne(
    'Déjeuner : fromage cottage (250 g) et yogourt grec 0 % (150 g), petits fruits'
  )
  assert.deepEqual(
    r.portions.map(p => p.aliment),
    ['Fromage cottage', 'Yogourt grec']
  )
  // cottage 11 g/100 → 27,5 ; yogourt 10 g/100 → 15 ; total arrondi 43.
  assert.equal(r.totalG, 43)
})

test('ce qui se compte à l’unité est converti', () => {
  // 3 œufs ≈ 150 g à 13 g/100 g → 20 g (19,5 arrondi).
  const r = proteinesDeLigne('Souper : omelette aux épinards et feta (3 œufs), salade verte')
  assert.equal(r.totalG, 20)
  assert.equal(r.portions[0].aliment, 'Œufs')
})

test('un aliment inconnu est SIGNALÉ, jamais remplacé', () => {
  // La dorade n'est pas dans la table. La compter comme un saumon donnerait
  // 40 g sortis de nulle part.
  const r = proteinesDeLigne('Souper : dorade au four aux olives (180 g), riz brun')
  assert.equal(r.totalG, 0)
  assert.equal(r.inconnus.length, 1)
  assert.match(r.inconnus[0], /180 g/)
  assert.equal(r.portions[0].proteinesG, null)
})

test('une mesure de supplément est comptée, et l’hypothèse est déclarée', () => {
  const r = proteinesDeLigne(
    'Déjeuner : yogourt grec 0 % (300 g), petits fruits (+ 1 mesure de protéine whey)'
  )
  assert.equal(r.hypothese, true, 'la dose supposée doit être signalée')
  // yogourt 30 + une mesure 24 = 54.
  assert.equal(r.totalG, 54)
})

test('sans supplément, aucune hypothèse n’est déclarée', () => {
  const r = proteinesDeLigne('Dîner : salade de thon (150 g), concombre et huile d’olive')
  assert.equal(r.hypothese, false)
  assert.equal(r.totalG, 38) // thon 25 g/100 → 37,5
})

test('une ligne sans aucun poids ne fabrique rien', () => {
  const r = proteinesDeLigne('Souper : légumes rôtis, riz brun, salade verte')
  assert.equal(r.totalG, 0)
  assert.deepEqual(r.portions, [])
  assert.deepEqual(r.inconnus, [])
})

test('les accents et la casse ne changent rien', () => {
  const avec = proteinesDeLigne('Dîner : salade de LÉGUMINEUSES (200 g)')
  const sans = proteinesDeLigne('Dîner : salade de legumineuses (200 g)')
  assert.equal(avec.totalG, sans.totalG)
  assert.equal(avec.totalG, 18) // 9 g/100 g
})

test('une journée additionne ses repas', () => {
  const r = proteinesDeJournee([
    'Déjeuner : yogourt grec 0 % (300 g), amandes',
    'Dîner : salade de poulet grillé (180 g), quinoa',
    'Souper : filet de saumon (150 g), patate douce'
  ])
  assert.equal(r.totalG, 30 + 56 + 33)
  assert.equal(r.hypothese, false)
})

test('« 0 % » n’est pas lu comme un poids', () => {
  // Le piège : un chiffre collé à une unité qui n'est pas le gramme.
  const r = proteinesDeLigne('Déjeuner : yogourt grec 0 % (300 g)')
  assert.equal(r.portions.length, 1)
  assert.equal(r.portions[0].grammes, 300)
})
