/**
 * Composition des aliments proposés.
 *
 * Le test qui compte est le premier : chaque proposition doit avoir sa
 * composition. Ajouter une suggestion sans son entrée la laisserait muette à
 * l'écran, et personne ne s'en apercevrait — l'absence d'un chiffre ne saute pas
 * aux yeux comme un chiffre faux.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MACROS_PAR_100G, etiquetteMacro, macrosDe } from './food-macros.ts'
import {
  SUGGESTIONS_PROTEINES,
  SUGGESTIONS_GLUCIDES,
  SUGGESTIONS_LIPIDES
} from './food-suggestions.ts'

test('chaque proposition par défaut a sa composition', () => {
  for (const [nom, liste] of [
    ['protéines', SUGGESTIONS_PROTEINES],
    ['glucides', SUGGESTIONS_GLUCIDES],
    ['lipides', SUGGESTIONS_LIPIDES]
  ] as [string, string[]][]) {
    for (const a of liste) {
      assert.ok(macrosDe(a), `${nom} : « ${a} » n'a pas de composition`)
    }
  }
})

test('un aliment ajouté par Marie n’invente pas de valeur', () => {
  // Cas normal : elle tape ce qu'elle veut. Mieux vaut rien qu'un chiffre pris
  // sur un aliment qui ressemble — « Fromage de chèvre » ne vaut pas la feta.
  assert.equal(macrosDe('Fromage de chèvre'), null)
  assert.equal(etiquetteMacro('Fromage de chèvre', 'p'), null)
  assert.equal(macrosDe(''), null)
})

test('l’étiquette met en avant le macro de sa colonne', () => {
  assert.equal(etiquetteMacro('Poulet, dinde', 'p'), '≈ 31 g P')
  assert.equal(etiquetteMacro('Riz brun', 'g'), '≈ 23 g G')
  assert.equal(etiquetteMacro('Huile d’olive', 'l'), '≈ 100 g L')
})

test('les valeurs restent physiquement possibles', () => {
  for (const [nom, m] of Object.entries(MACROS_PAR_100G)) {
    const somme = m.p + m.g + m.l
    assert.ok(somme <= 100, `${nom} : ${somme} g de macros dans 100 g d'aliment`)
    for (const [k, v] of Object.entries(m)) {
      assert.ok(v >= 0 && v <= 100, `${nom} : ${k} = ${v}`)
    }
  }
})

test('chaque aliment est cohérent avec la colonne qui le propose', () => {
  // Un aliment proposé comme source de protéines doit en être une. Sans ça, une
  // erreur de frappe dans une valeur passerait inaperçue.
  for (const a of SUGGESTIONS_PROTEINES) {
    const m = macrosDe(a)!
    assert.ok(m.p >= 9, `« ${a} » proposé en protéines mais n'en contient que ${m.p} g`)
  }
  for (const a of SUGGESTIONS_GLUCIDES) {
    const m = macrosDe(a)!
    assert.ok(m.g >= 12, `« ${a} » proposé en glucides mais n'en contient que ${m.g} g`)
  }
  for (const a of SUGGESTIONS_LIPIDES) {
    const m = macrosDe(a)!
    assert.ok(m.l >= 11, `« ${a} » proposé en lipides mais n'en contient que ${m.l} g`)
  }
})

test('les valeurs sont des entiers — pas de fausse précision', () => {
  for (const [nom, m] of Object.entries(MACROS_PAR_100G)) {
    for (const [k, v] of Object.entries(m)) {
      assert.equal(v, Math.round(v), `${nom} : ${k} = ${v}, une décimale sur une catégorie`)
    }
  }
})
