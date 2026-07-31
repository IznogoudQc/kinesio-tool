/**
 * Tests de l'organisation du dossier client.
 *
 * Lancer : `node --test src/lib/client-folders.test.ts`
 *
 * Ces noms deviennent de vrais répertoires sur le disque de Marie-Eve. Une
 * faute de frappe entre le code qui écrit et celui qui ouvre créerait un
 * dossier fantôme, et elle chercherait ses documents dans le mauvais — sans
 * qu'aucune erreur ne s'affiche.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CLIENT_FOLDERS,
  CLIENT_FOLDER_NAMES,
  isValidFolderName,
  type ClientFolderKind
} from './client-folders.ts'

test('les trois dossiers demandés par Marie, au mot près', () => {
  assert.equal(CLIENT_FOLDERS.bilans, 'Bilan et mesure')
  assert.equal(CLIENT_FOLDERS.nutrition, 'Nutrition')
  assert.equal(CLIENT_FOLDERS.questionnaires, 'Questionnaires et Notes')
})

test('la liste ordonnée couvre exactement les trois rayons', () => {
  assert.equal(CLIENT_FOLDER_NAMES.length, 3)
  assert.deepEqual([...CLIENT_FOLDER_NAMES].sort(), [...Object.values(CLIENT_FOLDERS)].sort())
})

test('aucun doublon — deux rayons partageant un dossier mélangeraient les documents', () => {
  assert.equal(new Set(Object.values(CLIENT_FOLDERS)).size, 3)
})

test('chaque nom est un nom de dossier valide sous Windows', () => {
  for (const nom of CLIENT_FOLDER_NAMES) {
    assert.ok(isValidFolderName(nom), `« ${nom} » ne peut pas être créé tel quel`)
  }
})

test('les espaces INTERNES sont acceptés — deux des trois noms en contiennent', () => {
  assert.ok(isValidFolderName('Bilan et mesure'))
  assert.ok(isValidFolderName('Questionnaires et Notes'))
})

test('les noms invalides sont refusés', () => {
  const refuses = ['', '   ', 'a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'fin.', ' bord ']
  for (const nom of refuses) {
    assert.equal(isValidFolderName(nom), false, `« ${nom} » aurait dû être refusé`)
  }
})

test('chaque rayon du type a bien une entrée — pas de trou silencieux', () => {
  const rayons: ClientFolderKind[] = ['bilans', 'nutrition', 'questionnaires']
  for (const r of rayons) {
    assert.equal(typeof CLIENT_FOLDERS[r], 'string')
    assert.ok(CLIENT_FOLDERS[r].length > 0)
  }
})
