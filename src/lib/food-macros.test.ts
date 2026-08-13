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
import { MACROS_PAR_100G, etiquetteMacro, fusionnerMacros, macrosDe } from './food-macros.ts'
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

test('les ajustements de Marie passent PAR-DESSUS ceux du code', () => {
  // Le sens de la fusion est la seule chose qui compte ici. À l'envers, ses
  // valeurs seraient écrasées à chaque mise à jour de l'application.
  const fusion = fusionnerMacros({ 'Yogourt grec': { p: 12, g: 3, l: 0 } })
  assert.equal(fusion['Yogourt grec'].p, 12, 'la valeur ajustée doit gagner')
  assert.equal(
    fusion['Poulet, dinde'].p,
    MACROS_PAR_100G['Poulet, dinde'].p,
    'un aliment non ajusté garde la valeur du code'
  )
})

test('un aliment ajouté au code apparaît malgré une table déjà enregistrée', () => {
  // L'autre moitié de la règle : une table enregistrée avant l'ajout d'un
  // aliment ne doit pas le faire disparaître de l'écran.
  const fusion = fusionnerMacros({ 'Yogourt grec': { p: 12, g: 3, l: 0 } })
  assert.ok(fusion['Crevettes'], 'les aliments du code restent tous présents')
  assert.equal(Object.keys(fusion).length, Object.keys(MACROS_PAR_100G).length)
})

test('sans rien d’enregistré, la fusion rend la table du code', () => {
  assert.deepEqual(fusionnerMacros(null), MACROS_PAR_100G)
  assert.deepEqual(fusionnerMacros(undefined), MACROS_PAR_100G)
})

test('une table passée en argument remplace celle du code', () => {
  // C'est ce qui permet aux pastilles et au calcul des protéines d'utiliser
  // les valeurs de Marie sans état global.
  const perso = { 'Yogourt grec': { p: 12, g: 3, l: 0 } }
  assert.equal(macrosDe('Yogourt grec', perso)?.p, 12)
  assert.equal(etiquetteMacro('Yogourt grec', 'p', perso), '≈ 12 g P')
  assert.equal(macrosDe('Poulet, dinde', perso), null, 'la table fournie fait foi')
})

test('les valeurs sont des entiers — pas de fausse précision', () => {
  for (const [nom, m] of Object.entries(MACROS_PAR_100G)) {
    for (const [k, v] of Object.entries(m)) {
      assert.equal(v, Math.round(v), `${nom} : ${k} = ${v}, une décimale sur une catégorie`)
    }
  }
})
