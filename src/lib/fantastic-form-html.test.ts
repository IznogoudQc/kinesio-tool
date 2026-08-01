/**
 * Tests du formulaire FANTASTIC autonome.
 *
 * Lancer : `node --test src/lib/fantastic-form-html.test.ts`
 *
 * Ce fichier part chez de vraies personnes, sur de vrais appareils, sans que
 * personne ne puisse le déboguer une fois parti. Deux choses doivent être vraies
 * en permanence :
 *
 *  1. **Il est vraiment autonome** — aucune ressource distante. Un client hors
 *     ligne, ou dont la messagerie bloque les images externes, doit voir la même
 *     page que les autres.
 *  2. **Son encodeur inline est identique au nôtre.** Le script de la page
 *     duplique `encodeFantasticCode` (une page isolée ne peut rien importer).
 *     S'ils divergent, le client remplit tout, renvoie son code, et
 *     l'application le refuse — travail perdu et confiance entamée.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FANTASTIC_ITEMS, FANTASTIC_SECTIONS, FANTASTIC_KEYS, emptyFantastic } from './fantastic.ts'
import { encodeFantasticCode, decodeFantasticCode } from './fantastic-code.ts'
import { renderFantasticForm } from './fantastic-form-html.ts'

const html = renderFantasticForm({ clientName: 'Nicholas Jean', kineName: 'Marie-Eve' })

/**
 * Récupère l'encodeur RÉELLEMENT inclus dans la page et le rend appelable.
 *
 * On l'extrait du HTML produit plutôt que d'importer la constante : c'est ce qui
 * part chez le client qu'on veut tester, pas une copie voisine.
 */
function encodeurDeLaPage(): (answers: Record<string, number | null>) => string {
  const debut = html.indexOf('const CTRL=')
  const fin = html.indexOf('return PREFIX+body+checksum(PREFIX+body);', debut)
  assert.ok(debut > 0 && fin > debut, 'encodeur introuvable dans la page générée')
  const source = html.slice(debut, fin + 'return PREFIX+body+checksum(PREFIX+body);'.length) + '\n}'
  const fabrique = new Function('KEYS', 'PREFIX', source + '\nreturn encode;')
  return fabrique(FANTASTIC_KEYS, 'FT1') as (a: Record<string, number | null>) => string
}

test('l’encodeur de la page produit exactement les mêmes codes que le nôtre', () => {
  const encodePage = encodeurDeLaPage()
  // 300 jeux de réponses variés, dont des questionnaires partiels.
  for (let i = 0; i < 300; i++) {
    const a = emptyFantastic()
    FANTASTIC_KEYS.forEach((k, j) => {
      const v = (i * 3 + j * 7 + Math.floor(i / 5)) % 6
      a[k] = v === 5 ? null : v // 5 → laissé sans réponse
    })
    assert.equal(encodePage(a), encodeFantasticCode(a), `divergence au tour ${i}`)
  }
})

test('un code produit par la page est accepté par l’application', () => {
  // Le test qui compte vraiment : le trajet complet, du clic du client à
  // l'import chez Marie.
  const encodePage = encodeurDeLaPage()
  const a = emptyFantastic()
  FANTASTIC_KEYS.forEach((k, j) => {
    a[k] = j % 5
  })
  const res = decodeFantasticCode(encodePage(a))
  assert.ok(res.ok)
  assert.deepEqual(res.answers, a)
})

test('aucune ressource distante', () => {
  // Ni CDN, ni police Google, ni image distante : la page doit s'afficher
  // identiquement hors ligne.
  assert.equal(/https?:\/\//.test(html), false, 'la page référence une adresse distante')
  assert.equal(/<link[^>]+href/i.test(html), false, 'la page charge une feuille de style externe')
  assert.equal(/<script[^>]+src=/i.test(html), false, 'la page charge un script externe')
})

test('les 25 énoncés sont présents', () => {
  for (const item of FANTASTIC_ITEMS) {
    // Les apostrophes typographiques passent telles quelles ; seuls &<>" sont échappés.
    const attendu = item.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    assert.ok(html.includes(attendu), `énoncé absent : ${item.label}`)
  }
})

test('les 9 sections sont présentes', () => {
  for (const s of FANTASTIC_SECTIONS) {
    assert.ok(html.includes(s.title), `section absente : ${s.title}`)
  }
})

test('chaque énoncé a ses 5 boutons radio, sous son propre nom', () => {
  for (const key of FANTASTIC_KEYS) {
    const occurrences = html.split(`name="${key}"`).length - 1
    assert.equal(occurrences, 5, `${key} a ${occurrences} choix au lieu de 5`)
  }
})

test('le nom du client est pré-rempli et échappé', () => {
  assert.ok(renderFantasticForm({ clientName: 'Nicholas Jean' }).includes('value="Nicholas Jean"'))
  const mechant = renderFantasticForm({ clientName: '<script>alert(1)</script>' })
  assert.equal(mechant.includes('<script>alert(1)</script>'), false)
  assert.ok(mechant.includes('&lt;script&gt;'))
})

test('une adresse de retour contenant une balise ne casse pas le script', () => {
  const h = renderFantasticForm({ replyTo: '</script><script>alert(1)</script>' })
  // La séquence littérale refermerait la balise ; elle doit être échappée.
  assert.equal(h.includes('</script><script>alert(1)'), false)
})

test('le score n’est jamais montré au client', () => {
  // Décision explicite : le FANTASTIC se lit avec un professionnel. Aucun
  // total, aucun palier ne doit apparaître dans la page envoyée.
  for (const mot of ['sur 100', 'Excellent', 'Très bien', 'Passable', 'À améliorer']) {
    assert.equal(html.includes(mot), false, `« ${mot} » ne devrait pas être visible du client`)
  }
})

test('le formulaire s’ouvre sans nom ni kinésiologue', () => {
  const nu = renderFantasticForm()
  assert.ok(nu.includes('<!doctype html>'))
  assert.ok(nu.includes('value=""'))
})

test('la page est imprimable et lisible sur téléphone', () => {
  assert.ok(html.includes('@media print'))
  assert.ok(html.includes('@media (max-width:640px)'))
  assert.ok(html.includes('name="viewport"'))
})

test('le document est bien formé', () => {
  assert.ok(html.startsWith('<!doctype html>'))
  assert.ok(html.trimEnd().endsWith('</html>'))
  assert.equal(html.split('<body>').length - 1, 1)
  assert.equal(html.split('</body>').length - 1, 1)
})
