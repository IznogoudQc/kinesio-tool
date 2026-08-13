/**
 * Relecture d'un menu produit ailleurs.
 *
 * Deux familles de tests, et la seconde compte davantage :
 *
 *  · la tolérance de FORME — bloc ```json, phrase d'introduction, en-tête
 *    « Journée 1 : » — parce que c'est ce qu'une interface de conversation
 *    renvoie réellement, et que Marie ne doit pas avoir à nettoyer ;
 *  · la RETENUE sur le fond — une journée manquante reste vide. Compléter un
 *    trou avec la journée d'à côté donnerait un menu que personne n'a écrit.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importerMenu } from './menu-import.ts'

const TROIS = ['Déjeuner : yogourt grec (1 tasse)', 'Dîner : salade de poulet', 'Souper : saumon et riz']

/** Une réponse conforme de N journées identiques. */
function reponse(n: number): string {
  return JSON.stringify({ journees: Array.from({ length: n }, () => ({ lignes: TROIS })) })
}

test('une réponse conforme donne sept journées', () => {
  const r = importerMenu(reponse(7), 7)
  assert.ok(r.ok)
  assert.equal(r.menu.journees.length, 7)
  assert.equal(r.menu.journees[0], TROIS.join('\n\n'))
  assert.deepEqual(r.menu.avertissements, [])
})

test('un bloc de code et une phrase autour ne gênent pas', () => {
  // Exactement ce que renvoie une interface de conversation.
  const texte = 'Voici le menu de la semaine :\n\n```json\n' + reponse(7) + '\n```\n\nBon appétit !'
  const r = importerMenu(texte, 7)
  assert.ok(r.ok)
  assert.equal(r.menu.journees.filter(Boolean).length, 7)
})

test('l’en-tête « Journée N » est retiré s’il a été ajouté', () => {
  const texte = JSON.stringify({
    journees: [{ lignes: ['Journée 1 : Déjeuner : yogourt grec', 'Dîner : salade'] }]
  })
  const r = importerMenu(texte, 7)
  assert.ok(r.ok)
  assert.match(r.menu.journees[0], /^Déjeuner : yogourt grec/)
})

test('les formes relâchées passent aussi', () => {
  // Tableau nu, et journées en tableaux de chaînes plutôt qu'en objets.
  const r = importerMenu(JSON.stringify([TROIS, TROIS]), 7)
  assert.ok(r.ok)
  assert.equal(r.menu.journees.filter(Boolean).length, 2)
})

test('une journée manquante reste VIDE — rien n’est inventé', () => {
  const r = importerMenu(reponse(4), 7)
  assert.ok(r.ok)
  assert.equal(r.menu.journees.filter(Boolean).length, 4)
  assert.deepEqual(r.menu.journees.slice(4), ['', '', ''])
  assert.match(r.menu.avertissements.join(' '), /4 journée\(s\) sur 7/)
})

test('au-delà de sept journées, le surplus est écarté et signalé', () => {
  const r = importerMenu(reponse(9), 7)
  assert.ok(r.ok)
  assert.equal(r.menu.journees.length, 7)
  assert.match(r.menu.avertissements.join(' '), /9 journées reçues/)
})

test('un écart de structure est signalé, pas rejeté', () => {
  // Le menu reste importable : c'est à Marie de juger, pas au code.
  const texte = JSON.stringify({
    journees: [{ lignes: TROIS }, { lignes: ['Déjeuner : gruau', 'Dîner : salade'] }]
  })
  const r = importerMenu(texte, 7, 3)
  assert.ok(r.ok)
  assert.equal(r.menu.journees[1], 'Déjeuner : gruau\n\nDîner : salade')
  assert.match(r.menu.avertissements.join(' '), /Journée\(s\) 2 .*structure/)
})

test('rien de lisible → un message qui dit quoi coller', () => {
  for (const mauvais of ['', '   ', 'Bonjour, voici mes idées de menu.', '{ journees: ']) {
    const r = importerMenu(mauvais, 7)
    assert.ok(!r.ok, `accepté à tort : ${JSON.stringify(mauvais)}`)
    assert.match(r.erreur, /menu lisible|journees/)
  }
})

test('un JSON valide mais vide est refusé', () => {
  // Écraser sept journées écrites avec du vide serait la pire issue.
  const r = importerMenu(JSON.stringify({ journees: [] }), 7)
  assert.ok(!r.ok)
  assert.match(r.erreur, /aucun repas/)
})
