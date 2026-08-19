/**
 * Tri et recherche des clients.
 *
 * Les deux tests qui comptent portent sur les ACCENTS : en comparaison
 * binaire, « Émilie » passe après « Zoé » et une recherche de « Benoit » ne
 * trouve pas « Benoît ». Ce sont exactement les cas qui feraient croire à Marie
 * qu'un client a disparu de son fichier.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filtrerClients, trierClients } from './client-search.ts'

const c = (name: string) => ({ name })

test('l’ordre alphabétique place les accents à leur vraie lettre', () => {
  const tri = trierClients([c('Zoé Tremblay'), c('Émilie Roy'), c('Alain Côté')])
  assert.deepEqual(
    tri.map(x => x.name),
    ['Alain Côté', 'Émilie Roy', 'Zoé Tremblay']
  )
})

test('les majuscules ne passent pas avant les minuscules', () => {
  const tri = trierClients([c('bernard Roy'), c('Alice Roy'), c('Charles Roy')])
  assert.deepEqual(
    tri.map(x => x.name),
    ['Alice Roy', 'bernard Roy', 'Charles Roy']
  )
})

test('les nombres se suivent dans l’ordre humain', () => {
  const tri = trierClients([c('Client 10'), c('Client 2')])
  assert.deepEqual(
    tri.map(x => x.name),
    ['Client 2', 'Client 10']
  )
})

test('le tableau d’origine n’est PAS modifié', () => {
  // Trier sur place une liste venue d'un état React la ferait muter à l'insu
  // de React, qui ne redessinerait pas.
  const source = [c('Zoé'), c('Alain')]
  const copie = [...source]
  trierClients(source)
  assert.deepEqual(source, copie)
})

test('la recherche ignore les accents et la casse', () => {
  const liste = [c('Benoît Côté'), c('Marie-Eve Riendeau')]
  assert.deepEqual(filtrerClients(liste, 'benoit').map(x => x.name), ['Benoît Côté'])
  assert.deepEqual(filtrerClients(liste, 'MARIE').map(x => x.name), ['Marie-Eve Riendeau'])
})

test('la recherche trouve aussi au milieu du nom', () => {
  const liste = [c('Nicholas Jean'), c('Sabrina Dumais')]
  assert.deepEqual(filtrerClients(liste, 'jean').map(x => x.name), ['Nicholas Jean'])
  assert.deepEqual(filtrerClients(liste, 'dum').map(x => x.name), ['Sabrina Dumais'])
})

test('une requête vide rend TOUT le monde', () => {
  const liste = [c('Alain'), c('Zoé')]
  assert.equal(filtrerClients(liste, '').length, 2)
  assert.equal(filtrerClients(liste, '   ').length, 2)
})

test('le courriel n’est pas fouillé', () => {
  // Sinon taper « gmail » remonterait la moitié du fichier.
  const liste = [{ name: 'Alain Côté', email: 'alain@gmail.com' }]
  assert.deepEqual(filtrerClients(liste, 'gmail'), [])
})
