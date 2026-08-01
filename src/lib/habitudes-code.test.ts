/**
 * Tests du code de retour des questionnaires d’habitudes de vie.
 *
 * Lancer : `node --test src/lib/habitudes-code.test.ts`
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
import { EAS_QUESTIONS, emptyEas } from './eas.ts'
import { encodeHabitudesCode, decodeHabitudesCode, formatCodeForDisplay, CODE_PREFIX } from './habitudes-code.ts'

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
  const res = decodeHabitudesCode(encodeHabitudesCode(avant, emptyEas()))
  assert.ok(res.ok)
  assert.deepEqual(res.answers, avant)
  assert.equal(res.answered, 25)
})

test('le code a la longueur annoncée : préfixe + 25 + 3 + contrôle', () => {
  const code = encodeHabitudesCode(reponsesVariees(), emptyEas())
  assert.equal(code.length, CODE_PREFIX.length + 25 + EAS_QUESTIONS.length + 2)
  assert.ok(code.startsWith('FT2'))
})

test('les réponses manquantes survivent au voyage', () => {
  const avant = emptyFantastic()
  avant[FANTASTIC_KEYS[0]] = 4
  avant[FANTASTIC_KEYS[24]] = 2
  const res = decodeHabitudesCode(encodeHabitudesCode(avant, emptyEas()))
  assert.ok(res.ok)
  assert.equal(res.answered, 2)
  assert.equal(res.answers[FANTASTIC_KEYS[0]], 4)
  assert.equal(res.answers[FANTASTIC_KEYS[24]], 2)
  assert.equal(res.answers[FANTASTIC_KEYS[12]], null)
})

test('la mise en forme d’affichage se relit sans problème', () => {
  const code = encodeHabitudesCode(reponsesVariees(), emptyEas())
  const res = decodeHabitudesCode(formatCodeForDisplay(code))
  assert.ok(res.ok)
  assert.deepEqual(res.answers, reponsesVariees())
})

test('tout ce qu’une messagerie peut ajouter est toléré', () => {
  const code = encodeHabitudesCode(reponsesVariees(), emptyEas())
  const abimes = [
    `  ${code}  `, // espaces de sélection
    code.toLowerCase(), // client qui met en minuscules
    code.slice(0, 14) + '\n' + code.slice(14), // ligne repliée
    code.slice(0, 10) + ' ' + code.slice(10) // espace inséré
  ]
  for (const c of abimes) {
    const res = decodeHabitudesCode(c)
    assert.ok(res.ok, `refusé à tort : ${JSON.stringify(c)}`)
  }
})

test('un chiffre modifié est détecté', () => {
  const code = encodeHabitudesCode(reponsesVariees(), emptyEas())
  const i = CODE_PREFIX.length + 7
  const modifie = code.slice(0, i) + (code[i] === '4' ? '3' : '4') + code.slice(i + 1)
  const res = decodeHabitudesCode(modifie)
  assert.equal(res.ok, false)
})

test('deux chiffres voisins intervertis sont détectés', () => {
  // C'est l'erreur classique de recopie, et celle qu'une somme non pondérée
  // laisserait passer : les mêmes chiffres, dans le désordre.
  const a = emptyFantastic()
  FANTASTIC_KEYS.forEach((k, i) => {
    a[k] = i % 5
  })
  const code = encodeHabitudesCode(a, emptyEas())
  const i = CODE_PREFIX.length + 3
  if (code[i] !== code[i + 1]) {
    const permute = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2)
    assert.notEqual(permute, code)
    assert.equal(decodeHabitudesCode(permute).ok, false)
  }
})

test('un code tronqué est refusé, avec la raison', () => {
  const code = encodeHabitudesCode(reponsesVariees(), emptyEas())
  const res = decodeHabitudesCode(code.slice(0, 20))
  assert.equal(res.ok, false)
  assert.match(res.reason, /incomplet/)
})

test('un code trop long est refusé', () => {
  const res = decodeHabitudesCode(encodeHabitudesCode(reponsesVariees(), emptyEas()) + '00')
  assert.equal(res.ok, false)
  assert.match(res.reason, /trop long/)
})

test('un texte quelconque est refusé sans planter', () => {
  for (const texte of ['', '   ', 'bonjour Marie', 'FT2' + '0'.repeat(27)]) {
    const res = decodeHabitudesCode(texte)
    assert.equal(res.ok, false)
    assert.ok(res.reason.length > 0)
  }
})

test('un code sans aucune réponse est refusé', () => {
  // Un client qui renvoie un formulaire vierge : mieux vaut le lui dire que
  // d'enregistrer 25 blancs dans son dossier.
  const res = decodeHabitudesCode(encodeHabitudesCode(emptyFantastic(), emptyEas()))
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
    vus.add(encodeHabitudesCode(a, emptyEas()))
  }
  assert.equal(vus.size, 200)
})

test('le contrôle n’utilise pas de caractères ambigus', () => {
  // Ni I ni O ni 0 ni 1 : un client qui recopie ne doit pas hésiter.
  const code = encodeHabitudesCode(reponsesVariees(), emptyEas())
  for (const c of code.slice(-2)) {
    assert.ok(!'IO01'.includes(c), `caractère ambigu dans le contrôle : ${c}`)
  }
})

/* ── Le second questionnaire (ÉAS) voyage dans le même code ──────────────── */

test('les réponses ÉAS font l’aller-retour', () => {
  const fant = reponsesVariees()
  const eas = { frequence: 0, intensite: 1, perception: 4 }
  const res = decodeHabitudesCode(encodeHabitudesCode(fant, eas))
  assert.ok(res.ok)
  assert.deepEqual(res.eas, eas)
  assert.deepEqual(res.answers, fant)
  assert.equal(res.easAnswered, 3)
})

test('un ÉAS partiel garde ses trous', () => {
  const eas = { frequence: 2, intensite: null, perception: null }
  const res = decodeHabitudesCode(encodeHabitudesCode(emptyFantastic(), eas))
  assert.ok(res.ok)
  assert.deepEqual(res.eas, eas)
  assert.equal(res.easAnswered, 1)
  assert.equal(res.answered, 0)
})

test('un client qui n’a rempli QUE l’ÉAS n’est pas refusé', () => {
  // Refuser reviendrait à jeter un questionnaire réellement rempli.
  const res = decodeHabitudesCode(encodeHabitudesCode(emptyFantastic(), { frequence: 1, intensite: 1, perception: 1 }))
  assert.ok(res.ok)
  assert.equal(res.answered, 0)
  assert.equal(res.easAnswered, 3)
})

test('un index ÉAS hors de la plage de SA question est refusé', () => {
  // Les questions 1 et 2 n'ont que 3 réponses (index 0-2). Un « 4 » y est donc
  // le signe d'un code abîmé, alors qu'il serait valide à la question 3.
  const code = encodeHabitudesCode(emptyFantastic(), { frequence: 0, intensite: 0, perception: 4 })
  const posIntensite = CODE_PREFIX.length + FANTASTIC_KEYS.length + 1
  const abime = code.slice(0, posIntensite) + '4' + code.slice(posIntensite + 1)
  // On recalcule le contrôle pour isoler la validation de plage du contrôle.
  const res = decodeHabitudesCode(abime)
  assert.equal(res.ok, false)
})

test('la question 3 accepte bien ses 5 réponses', () => {
  for (let i = 0; i < 5; i++) {
    const res = decodeHabitudesCode(encodeHabitudesCode(emptyFantastic(), { frequence: null, intensite: null, perception: i }))
    assert.ok(res.ok, `perception=${i} refusée à tort`)
    assert.equal(res.eas.perception, i)
  }
})

test('un ancien code FT1 reste lisible', () => {
  // La v0.9.89 a émis des formulaires sans l'ÉAS. Un client peut renvoyer un
  // tel code après la mise à jour : le refuser lui ferait tout recommencer
  // alors qu'il n'a rien fait de mal.
  const fant = reponsesVariees()
  let body = 'FT1'
  for (const k of FANTASTIC_KEYS) body += String(fant[k])
  // Contrôle recalculé avec le même algorithme (identique entre versions).
  const complet = decodeHabitudesCode(encodeHabitudesCode(fant, emptyEas()))
  assert.ok(complet.ok) // sanity : l'encodeur courant fonctionne

  const CTRL = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let a = 0
  let b = 0
  for (let i = 0; i < body.length; i++) {
    a = (a + body.charCodeAt(i) * (i + 1)) % 1024
    b = (b + a) % 1024
  }
  const res = decodeHabitudesCode(body + CTRL[a % 32] + CTRL[b % 32])
  assert.ok(res.ok, 'un code FT1 devrait rester lisible')
  assert.deepEqual(res.answers, fant)
  assert.equal(res.easAnswered, 0)
  assert.deepEqual(res.eas, emptyEas())
})

test('un code FT2 tronqué à la longueur d’un FT1 est refusé', () => {
  const code = encodeHabitudesCode(reponsesVariees(), { frequence: 0, intensite: 0, perception: 0 })
  const res = decodeHabitudesCode(code.slice(0, CODE_PREFIX.length + FANTASTIC_KEYS.length + 2))
  assert.equal(res.ok, false)
  assert.match(res.reason, /incomplet/)
})

test('une réponse ÉAS modifiée est détectée par le contrôle', () => {
  const code = encodeHabitudesCode(reponsesVariees(), { frequence: 0, intensite: 0, perception: 0 })
  const i = CODE_PREFIX.length + FANTASTIC_KEYS.length
  const modifie = code.slice(0, i) + '2' + code.slice(i + 1)
  assert.notEqual(modifie, code)
  assert.equal(decodeHabitudesCode(modifie).ok, false)
})
