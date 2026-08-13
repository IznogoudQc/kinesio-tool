/**
 * Lecture des listes d'aliments saisies à la main.
 *
 * Le cas qui a motivé ce fichier : la fiche d'un client contenait « Poulet, »
 * avec une virgule de fin. Le prompt annonçait « Poulet,, Yogourt grec » et la
 * pastille « Poulet » restait décochée — signalé le 2026-08-12.
 *
 * Le test le plus important est celui des virgules INTERNES : découper une
 * liste sur les virgules casserait la moitié des propositions par défaut.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleListe, elementsListe, listeLisible } from './nutrition-lists.ts'
import {
  SUGGESTIONS_PROTEINES,
  SUGGESTIONS_GLUCIDES,
  SUGGESTIONS_LIPIDES
} from './food-suggestions.ts'

test('une virgule de fin ne survit pas', () => {
  assert.deepEqual(elementsListe('Poulet,\nYogourt grec\nFromage cottage'), [
    'Poulet',
    'Yogourt grec',
    'Fromage cottage'
  ])
  assert.equal(listeLisible('Poulet,\nYogourt grec'), 'Poulet, Yogourt grec')
})

test('la virgule À L’INTÉRIEUR d’un aliment est intacte', () => {
  // Le piège : découper sur les virgules ferait de « Amandes, noix de Grenoble »
  // deux aliments, dont un « noix de Grenoble » que Marie n'a jamais écrit.
  assert.deepEqual(elementsListe('Amandes, noix de Grenoble\nAvocat'), [
    'Amandes, noix de Grenoble',
    'Avocat'
  ])
  assert.deepEqual(elementsListe('Poisson blanc (morue, tilapia)'), [
    'Poisson blanc (morue, tilapia)'
  ])
})

test('aucune proposition par défaut n’est abîmée par le nettoyage', () => {
  for (const a of [...SUGGESTIONS_PROTEINES, ...SUGGESTIONS_GLUCIDES, ...SUGGESTIONS_LIPIDES]) {
    assert.deepEqual(elementsListe(a), [a], `« ${a} » est modifié par le nettoyage`)
  }
})

test('lignes vides, puces et tirets sont écartés', () => {
  assert.deepEqual(elementsListe('Poulet\n\n  \n- Avocat\n• Quinoa\n'), [
    'Poulet',
    'Avocat',
    'Quinoa'
  ])
  assert.deepEqual(elementsListe(',,,'), [])
})

test('rien à lire → liste vide, pas une ligne vide', () => {
  assert.deepEqual(elementsListe(''), [])
  assert.deepEqual(elementsListe(undefined), [])
  assert.deepEqual(elementsListe(null), [])
  assert.equal(listeLisible(''), '')
})

test('la clé de comparaison recolle l’aliment à sa proposition', () => {
  // C'est ce qui décide si la pastille se coche : « Poulet, » doit valoir
  // « Poulet », sinon Marie ajoute l'aliment une deuxième fois.
  assert.equal(cleListe('Poulet,'), 'poulet')
  assert.equal(cleListe('  YOGOURT GREC  '), 'yogourt grec')
  assert.equal(cleListe('Amandes, noix de Grenoble'), 'amandes, noix de grenoble')
})
