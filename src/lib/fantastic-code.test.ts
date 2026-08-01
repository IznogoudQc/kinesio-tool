/**
 * Tests du code de retour FANTASTIC.
 *
 * Lancer : `node --test src/lib/fantastic-code.test.ts`
 *
 * Ce qu'on protège ici : un code abîmé pendant le voyage — recopié à la main,
 * replié par une messagerie, tronqué à la sélection — ne doit **jamais**
 * s'importer en silence. De mauvaises réponses écrites sans erreur visible dans
 * le dossier d'un client seraient invisibles jusqu'à ce que Marie s'étonne d'un
 * score qui ne ressemble pas à son client.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FANTASTIC_KEYS, emptyFantastic } from './fantastic.ts'
import { encodeFantasticCode, decodeFantasticCode, formatCodeForDisplay, CODE_PREFIX } from './fantastic-code.ts'

/** Réponses de test : 0,1,2,3,4,0,1,… sur les 25 énoncés. */
function reponsesVariees() {
  const a = emptyFantastic()
  FANTASTIC_KEYS.forEach((k, i) => {
    a[k] = i % 5
  })
  return a
}

test('aller-retour : ce qui sort est exactement ce qui est entré', () => {
  const avant = reponsesVariees()
  const res = decodeFantasticCode(encodeFantasticCode(avant))
  assert.ok(res.ok)
  assert.deepEqual(res.answers, avant)
  assert.equal(res.answered, 25)
})

test('le code a la longueur annoncée : préfixe + 25 + contrôle', () => {
  const code = encodeFantasticCode(reponsesVariees())
  assert.equal(code.length, CODE_PREFIX.length + 25 + 2)
  assert.ok(code.startsWith('FT1'))
})

test('les réponses manquantes survivent au voyage', () => {
  const avant = emptyFantastic()
  avant[FANTASTIC_KEYS[0]] = 4
  avant[FANTASTIC_KEYS[24]] = 2
  const res = decodeFantasticCode(encodeFantasticCode(avant))
  assert.ok(res.ok)
  assert.equal(res.answered, 2)
  assert.equal(res.answers[FANTASTIC_KEYS[0]], 4)
  assert.equal(res.answers[FANTASTIC_KEYS[24]], 2)
  assert.equal(res.answers[FANTASTIC_KEYS[12]], null)
})

test('la mise en forme d’affichage se relit sans problème', () => {
  const code = encodeFantasticCode(reponsesVariees())
  const res = decodeFantasticCode(formatCodeForDisplay(code))
  assert.ok(res.ok)
  assert.deepEqual(res.answers, reponsesVariees())
})

test('tout ce qu’une messagerie peut ajouter est toléré', () => {
  const code = encodeFantasticCode(reponsesVariees())
  const abimes = [
    `  ${code}  `, // espaces de sélection
    code.toLowerCase(), // client qui met en minuscules
    code.slice(0, 14) + '\n' + code.slice(14), // ligne repliée
    code.slice(0, 10) + ' ' + code.slice(10) // espace inséré
  ]
  for (const c of abimes) {
    const res = decodeFantasticCode(c)
    assert.ok(res.ok, `refusé à tort : ${JSON.stringify(c)}`)
  }
})

test('un chiffre modifié est détecté', () => {
  const code = encodeFantasticCode(reponsesVariees())
  const i = CODE_PREFIX.length + 7
  const modifie = code.slice(0, i) + (code[i] === '4' ? '3' : '4') + code.slice(i + 1)
  const res = decodeFantasticCode(modifie)
  assert.equal(res.ok, false)
})

test('deux chiffres voisins intervertis sont détectés', () => {
  // C'est l'erreur classique de recopie, et celle qu'une somme non pondérée
  // laisserait passer : les mêmes chiffres, dans le désordre.
  const a = emptyFantastic()
  FANTASTIC_KEYS.forEach((k, i) => {
    a[k] = i % 5
  })
  const code = encodeFantasticCode(a)
  const i = CODE_PREFIX.length + 3
  if (code[i] !== code[i + 1]) {
    const permute = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2)
    assert.notEqual(permute, code)
    assert.equal(decodeFantasticCode(permute).ok, false)
  }
})

test('un code tronqué est refusé, avec la raison', () => {
  const code = encodeFantasticCode(reponsesVariees())
  const res = decodeFantasticCode(code.slice(0, 20))
  assert.equal(res.ok, false)
  assert.match(res.reason, /incomplet/)
})

test('un code trop long est refusé', () => {
  const res = decodeFantasticCode(encodeFantasticCode(reponsesVariees()) + '00')
  assert.equal(res.ok, false)
  assert.match(res.reason, /trop long/)
})

test('un texte quelconque est refusé sans planter', () => {
  for (const texte of ['', '   ', 'bonjour Marie', 'FT2' + '0'.repeat(27)]) {
    const res = decodeFantasticCode(texte)
    assert.equal(res.ok, false)
    assert.ok(res.reason.length > 0)
  }
})

test('un code sans aucune réponse est refusé', () => {
  // Un client qui renvoie un formulaire vierge : mieux vaut le lui dire que
  // d'enregistrer 25 blancs dans son dossier.
  const res = decodeFantasticCode(encodeFantasticCode(emptyFantastic()))
  assert.equal(res.ok, false)
  assert.match(res.reason, /aucune réponse/)
})

test('deux jeux de réponses différents ne donnent jamais le même code', () => {
  // On écrit `i` en base 5 sur les quatre premiers énoncés : chaque tour produit
  // donc un jeu de réponses réellement distinct des autres.
  const vus = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const a = emptyFantastic()
    for (const k of FANTASTIC_KEYS) a[k] = 2
    a[FANTASTIC_KEYS[0]] = i % 5
    a[FANTASTIC_KEYS[1]] = Math.floor(i / 5) % 5
    a[FANTASTIC_KEYS[2]] = Math.floor(i / 25) % 5
    a[FANTASTIC_KEYS[3]] = Math.floor(i / 125) % 5
    vus.add(encodeFantasticCode(a))
  }
  assert.equal(vus.size, 200)
})

test('le contrôle n’utilise pas de caractères ambigus', () => {
  // Ni I ni O ni 0 ni 1 : un client qui recopie ne doit pas hésiter.
  const code = encodeFantasticCode(reponsesVariees())
  for (const c of code.slice(-2)) {
    assert.ok(!'IO01'.includes(c), `caractère ambigu dans le contrôle : ${c}`)
  }
})
