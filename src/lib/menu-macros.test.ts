/**
 * Macros calculées depuis les poids écrits dans un menu.
 *
 * Les tests qui comptent le plus sont ceux d'ATTRIBUTION : une ligne contient
 * plusieurs aliments connus et un seul poids par source. Attribuer un poids au
 * mauvais aliment donne un chiffre faux avec l'air d'être juste — le pire
 * résultat possible pour un outil de vérification.
 *
 * Vient ensuite le refus de deviner : un aliment absent de la table est
 * signalé, jamais remplacé par celui qui lui ressemble.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { macrosDeJournee, macrosDeLigne } from './menu-macros.ts'

test('les trois sources d’un repas sont comptées', () => {
  // poulet 150 g → 46,5 P / 0 G / 6 L
  // quinoa 150 g → 6 P / 27 G / 3 L
  // huile 15 ml  → 13,8 g d'huile → 0 P / 0 G / 13,8 L
  const r = macrosDeLigne(
    "Dîner : poulet grillé (150 g), quinoa (150 g), concombre et huile d'olive (15 ml)"
  )
  assert.equal(r.p, 53)
  assert.equal(r.g, 27)
  assert.equal(r.l, 23)
  // Atwater : 4×53 + 4×27 + 9×23 = 527
  assert.equal(r.kcal, 527)
})

test('les millilitres d’huile ne pèsent pas des grammes', () => {
  // 15 ml d'huile font 13,8 g. Les compter comme 15 g gonflerait chaque repas.
  const avecMl = macrosDeLigne("Souper : huile d'olive (15 ml)")
  const avecG = macrosDeLigne("Souper : huile d'olive (15 g)")
  assert.equal(avecMl.l, 14)
  assert.equal(avecG.l, 15)
})

test('« huile d’olive » n’est pas comptée comme des olives', () => {
  // Le piège d'inclusion : « olive » est dans « huile d'olive ». Les olives
  // font 11 g de lipides aux 100 g, l'huile 100 — neuf fois plus.
  const r = macrosDeLigne("Souper : brocoli à l'huile d'olive (10 g)")
  assert.equal(r.portions[0].aliment, 'Huile d’olive')
  assert.equal(r.l, 10)
})

test('le haut de cuisse n’est pas compté comme de la poitrine', () => {
  // « hauts de cuisse de poulet » contient « poulet », et ce mot arrive APRÈS :
  // la règle de proximité seule choisirait la poitrine (31 g) au lieu du haut
  // de cuisse (25 g).
  const r = macrosDeLigne('Souper : hauts de cuisse de poulet au citron (180 g)')
  assert.equal(r.portions[0].aliment, 'Poulet, haut de cuisse')
  assert.equal(r.p, 45)
})

test('la poitrine reste de la poitrine', () => {
  const r = macrosDeLigne('Dîner : salade de poulet grillé (180 g)')
  assert.equal(r.portions[0].aliment, 'Poulet, dinde')
  assert.equal(r.p, 56)
})

test('c’est l’aliment le PLUS PROCHE du poids qui est pesé', () => {
  const r = macrosDeLigne('Dîner : salade de lentilles au poulet grillé (180 g), tomates')
  assert.equal(r.portions[0].aliment, 'Poulet, dinde')
  assert.equal(r.p, 56)
})

test('un aliment nommé mais non pesé est SIGNALÉ', () => {
  // Le cas des menus écrits avant le passage aux trois poids : le quinoa et
  // l'huile sont là, sans quantité, et disparaissent donc des totaux. Sans
  // signalement, la journée afficherait 470 kcal au lieu de 1400.
  const r = macrosDeLigne("Dîner : poulet grillé (150 g), quinoa, tomates et huile d'olive")
  assert.equal(r.p, 47, 'le poulet pesé est bien compté')
  assert.equal(r.g, 0, 'le quinoa sans poids ne peut pas être compté')
  assert.deepEqual(r.nonPeses.sort(), ['Huile d’olive', 'Quinoa'])
})

test('rien à signaler quand tout est pesé', () => {
  const r = macrosDeLigne("Dîner : poulet grillé (150 g), quinoa (150 g), huile d'olive (10 ml)")
  assert.deepEqual(r.nonPeses, [])
})

test('les légumes ne sont jamais réclamés', () => {
  // Ils n'ont pas de synonyme : les exiger pesés rendrait les menus illisibles
  // pour un apport marginal.
  const r = macrosDeLigne('Souper : saumon (150 g), brocoli à l’ail, épinards et citron')
  assert.deepEqual(r.nonPeses, [])
})

test('un aliment inconnu est SIGNALÉ, jamais remplacé', () => {
  // La dorade n'est pas dans la table. La compter comme un saumon donnerait
  // 40 g de protéines sortis de nulle part.
  const r = macrosDeLigne('Souper : dorade au four (180 g)')
  assert.equal(r.p, 0)
  assert.equal(r.kcal, 0)
  assert.equal(r.inconnus.length, 1)
  assert.match(r.inconnus[0], /180 g/)
  assert.equal(r.portions[0].macros, null)
})

test('une mesure de supplément est comptée, et l’hypothèse est déclarée', () => {
  const r = macrosDeLigne(
    'Déjeuner : yogourt grec 0 % (300 g), petits fruits (+ 1 mesure de protéine whey)'
  )
  assert.equal(r.hypothese, true, 'la dose supposée doit être signalée')
  assert.equal(r.p, 54) // yogourt 30 + mesure 24
})

test('sans supplément, aucune hypothèse n’est déclarée', () => {
  const r = macrosDeLigne('Dîner : salade de thon (150 g)')
  assert.equal(r.hypothese, false)
  assert.equal(r.p, 38)
})

test('une ligne sans aucun poids ne fabrique rien', () => {
  const r = macrosDeLigne('Souper : légumes rôtis, salade verte')
  assert.deepEqual({ p: r.p, g: r.g, l: r.l, kcal: r.kcal }, { p: 0, g: 0, l: 0, kcal: 0 })
  assert.deepEqual(r.portions, [])
  assert.deepEqual(r.inconnus, [])
})

test('les accents et la casse ne changent rien', () => {
  const avec = macrosDeLigne('Dîner : salade de LÉGUMINEUSES (200 g)')
  const sans = macrosDeLigne('Dîner : salade de legumineuses (200 g)')
  assert.deepEqual({ p: avec.p, g: avec.g }, { p: sans.p, g: sans.g })
  assert.equal(avec.p, 18)
})

test('ce qui se compte à l’unité est converti', () => {
  // 3 œufs ≈ 150 g à 13 g/100 g → 20 g de protéines.
  const r = macrosDeLigne('Souper : omelette (3 œufs), salade verte')
  assert.equal(r.p, 20)
  assert.equal(r.portions[0].aliment, 'Œufs')
})

test('une journée additionne ses repas', () => {
  const r = macrosDeJournee([
    'Déjeuner : yogourt grec 0 % (300 g), petits fruits (100 g)',
    'Dîner : poulet grillé (180 g), quinoa (150 g)',
    'Souper : saumon (150 g), patate douce (200 g)'
  ])
  // Protéines, repas par repas puis arrondies :
  //   déjeuner  yogourt 30 + fruits 1            = 31
  //   dîner     poulet 55,8 + quinoa 6 → 61,8    = 62
  //   souper    saumon 33 + patate douce 4       = 37
  assert.equal(r.p, 130)
  assert.equal(r.hypothese, false)
  // Les calories de la journée sont la somme de celles des repas.
  assert.ok(r.kcal > 0)
})

test('« 0 % » n’est pas lu comme un poids', () => {
  const r = macrosDeLigne('Déjeuner : yogourt grec 0 % (300 g)')
  assert.equal(r.portions.length, 1)
  assert.equal(r.portions[0].grammes, 300)
})
