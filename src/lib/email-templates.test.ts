import { test } from 'node:test'
import assert from 'node:assert/strict'
import { corrigerConsigneOuverture, DEFAULT_BILAN_EMAIL, DEFAULT_MESURES_EMAIL, DEFAULT_NUTRITION_EMAIL } from './email-templates.ts'

const ANCIEN_MODELE = `Bonjour {{client_name}},

Vous trouverez ci-joint votre bilan de forme physique daté du {{date}}, sous deux formes.

1. Le rapport PDF — la version complète, à consulter, imprimer ou conserver.

2. Le document interactif (fichier .html) — ouvrez-le dans votre navigateur en double-cliquant dessus. Il fonctionne sans connexion Internet.

{{signature}}`

test('la consigne qui échoue est remplacée', () => {
  const corrige = corrigerConsigneOuverture(ANCIEN_MODELE)
  assert.ok(corrige !== null)
  assert.equal(corrige.includes('double-cliquant'), false)
  assert.ok(corrige.includes('clic droit'))
  assert.ok(corrige.includes('Ouvrir avec'))
})

test('tout le reste du message est conservé', () => {
  const corrige = corrigerConsigneOuverture(ANCIEN_MODELE)!
  // Variables, numérotation, signature : rien ne bouge.
  assert.ok(corrige.startsWith('Bonjour {{client_name}},'))
  assert.ok(corrige.endsWith('{{signature}}'))
  assert.ok(corrige.includes('1. Le rapport PDF — la version complète, à consulter, imprimer ou conserver.'))
  assert.ok(corrige.includes('Il fonctionne sans connexion Internet.'))
})

test('un modèle réécrit par Marie-Eve n’est pas touché', () => {
  assert.equal(corrigerConsigneOuverture('Salut ! Ton bilan est en pièce jointe. À bientôt.'), null)
})

test('la reprise est idempotente', () => {
  const corrige = corrigerConsigneOuverture(ANCIEN_MODELE)!
  assert.equal(corrigerConsigneOuverture(corrige), null)
})

test('la phrase est remplacée partout où elle apparaît', () => {
  const deuxFois = `A : ouvrez-le dans votre navigateur en double-cliquant dessus.
B : ouvrez-le dans votre navigateur en double-cliquant dessus.`
  const corrige = corrigerConsigneOuverture(deuxFois)!
  assert.equal(corrige.includes('double-cliquant'), false)
  assert.equal(corrige.split('clic droit').length - 1, 2)
})

test('un corps vide ne déclenche rien', () => {
  assert.equal(corrigerConsigneOuverture(''), null)
})

test('aucun modèle par défaut ne porte plus la consigne qui échoue', () => {
  // Le garde-fou : si quelqu'un réintroduit « double-cliquez » dans un texte
  // par défaut, ce test le refuse avant que le courriel ne parte.
  for (const modele of [DEFAULT_BILAN_EMAIL, DEFAULT_NUTRITION_EMAIL, DEFAULT_MESURES_EMAIL]) {
    assert.equal(corrigerConsigneOuverture(modele.body), null, modele.subject)
    assert.equal(modele.body.includes('double-clic'), false, modele.subject)
  }
})
