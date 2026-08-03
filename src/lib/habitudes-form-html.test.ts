/**
 * Tests du formulaire d’habitudes de vie autonome.
 *
 * Lancer : `node --test src/lib/habitudes-form-html.test.ts`
 *
 * Ce fichier part chez de vraies personnes, sur de vrais appareils, sans que
 * personne ne puisse le déboguer une fois parti. Deux choses doivent être vraies
 * en permanence :
 *
 *  1. **Il est vraiment autonome** — aucune ressource distante. Un client hors
 *     ligne, ou dont la messagerie bloque les images externes, doit voir la même
 *     page que les autres.
 *  2. **Son encodeur inline est identique au nôtre.** Le script de la page
 *     duplique `encodeHabitudesCode` (une page isolée ne peut rien importer).
 *     S'ils divergent, le client remplit tout, renvoie son code, et
 *     l'application le refuse — travail perdu et confiance entamée.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FANTASTIC_ITEMS,
  FANTASTIC_SECTIONS,
  FANTASTIC_KEYS,
  emptyFantastic,
  selectableChoices
} from './fantastic.ts'
import { encodeHabitudesCode, decodeHabitudesCode } from './habitudes-code.ts'
import { EAS_QUESTIONS, emptyEas } from './eas.ts'
import { renderHabitudesForm } from './habitudes-form-html.ts'

const html = renderHabitudesForm({ clientName: 'Nicholas Jean', kineName: 'Marie-Eve' })

/**
 * Récupère l'encodeur RÉELLEMENT inclus dans la page et le rend appelable.
 *
 * On l'extrait du HTML produit plutôt que d'importer la constante : c'est ce qui
 * part chez le client qu'on veut tester, pas une copie voisine.
 */
function encodeurDeLaPage(): (a: Record<string, number | null>, e: Record<string, number | null>) => string {
  const debut = html.indexOf('const CTRL=')
  const fin = html.indexOf('return PREFIX+body+checksum(PREFIX+body);', debut)
  assert.ok(debut > 0 && fin > debut, 'encodeur introuvable dans la page générée')
  const source = html.slice(debut, fin + 'return PREFIX+body+checksum(PREFIX+body);'.length) + '\n}'
  const fabrique = new Function('KEYS', 'PREFIX', 'EAS_KEYS', source + '\nreturn encode;')
  return fabrique(
    FANTASTIC_KEYS,
    'FT2',
    EAS_QUESTIONS.map(q => q.key)
  ) as (a: Record<string, number | null>, e: Record<string, number | null>) => string
}

test('l’encodeur de la page produit exactement les mêmes codes que le nôtre', () => {
  const encodePage = encodeurDeLaPage()
  // 300 jeux variés, dont des questionnaires partiels, et un ÉAS dont chaque
  // question a son propre nombre de réponses (3, 3, puis 5).
  for (let i = 0; i < 300; i++) {
    const a = emptyFantastic()
    FANTASTIC_KEYS.forEach((k, j) => {
      const v = (i * 3 + j * 7 + Math.floor(i / 5)) % 6
      a[k] = v === 5 ? null : v // 5 → laissé sans réponse
    })
    const e = emptyEas()
    EAS_QUESTIONS.forEach((q, j) => {
      const v = (i + j * 2) % (q.choices.length + 1)
      e[q.key] = v === q.choices.length ? null : v
    })
    assert.equal(encodePage(a, e), encodeHabitudesCode(a, e), `divergence au tour ${i}`)
  }
})

test('un code produit par la page est accepté par l’application', () => {
  // Le test qui compte vraiment : le trajet complet, du clic du client à
  // l'import chez Marie — les deux questionnaires compris.
  const encodePage = encodeurDeLaPage()
  const a = emptyFantastic()
  FANTASTIC_KEYS.forEach((k, j) => {
    a[k] = j % 5
  })
  const e = { frequence: 0, intensite: 1, perception: 3 }
  const res = decodeHabitudesCode(encodePage(a, e))
  assert.ok(res.ok)
  assert.deepEqual(res.answers, a)
  assert.deepEqual(res.eas, e)
})

test('les trois questions de l’ÉAS sont dans la page, avec leurs réponses', () => {
  for (const q of EAS_QUESTIONS) {
    const occurrences = html.split(`name="eas.${q.key}"`).length - 1
    assert.equal(occurrences, q.choices.length, `${q.key} : mauvais nombre de réponses`)
    for (const c of q.choices) {
      assert.ok(html.includes(c.label), `réponse absente : ${c.label}`)
    }
  }
})

test('le formulaire annonce ses deux parties', () => {
  assert.ok(html.includes('Partie 1'))
  assert.ok(html.includes('Partie 2'))
})

test('la page ne demande jamais le sexe du client', () => {
  // La cotation de l'ÉAS en dépend, mais c'est l'application qui cote, avec le
  // dossier. Redemander au client une information déjà connue serait inutile,
  // et ferait circuler une donnée de plus.
  for (const mot of ['Sexe', 'sexe', 'Homme', 'Femme']) {
    assert.equal(html.includes(mot), false, `« ${mot} » ne devrait pas apparaître`)
  }
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

test('chaque énoncé offre exactement les réponses de la feuille papier', () => {
  // 5 pour la plupart, mais 2 pour les deux énoncés dont la feuille ne propose
  // que « Parfois » et « Jamais ». C'est le défaut signalé en v0.9.89 : les
  // trois cases vides du milieu étaient rendues cliquables, donc le client se
  // voyait offrir trois réponses qui n'existent pas.
  for (const section of FANTASTIC_SECTIONS) {
    for (const item of section.items) {
      const key = `${section.key}.${item.key}`
      const occurrences = html.split(`name="${key}"`).length - 1
      assert.equal(occurrences, selectableChoices(item).length, `${key} : mauvais nombre de choix`)
    }
  }
})

test('les deux énoncés binaires n’offrent QUE Parfois et Jamais', () => {
  for (const key of ['tabac.drogues', 'alcool.conduite']) {
    const occurrences = html.split(`name="${key}"`).length - 1
    assert.equal(occurrences, 2, `${key} devrait n’avoir que 2 réponses`)
  }
})

test('aucune case de réponse vide ne subsiste dans la page', () => {
  // Une case sans libellé n'est pas une réponse : elle ne doit plus exister.
  assert.equal(html.includes('class="vide"'), false)
  assert.equal(/<span class="txt">\s*<\/span>/.test(html), false)
})

test('le nom du client est pré-rempli et échappé', () => {
  assert.ok(renderHabitudesForm({ clientName: 'Nicholas Jean' }).includes('value="Nicholas Jean"'))
  const mechant = renderHabitudesForm({ clientName: '<script>alert(1)</script>' })
  assert.equal(mechant.includes('<script>alert(1)</script>'), false)
  assert.ok(mechant.includes('&lt;script&gt;'))
})

test('une adresse de retour contenant une balise ne casse pas le script', () => {
  const h = renderHabitudesForm({ replyTo: '</script><script>alert(1)</script>' })
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
  const nu = renderHabitudesForm()
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

test('le nombre de colonnes passe par --cols, jamais par un style en ligne', () => {
  // Régression v0.9.90 → v0.9.111 : le nombre de colonnes, devenu variable pour
  // les énoncés à 2 choix, était posé en `style="grid-template-columns:…"`.
  // Un style en ligne bat la feuille de style, media query comprise : la bascule
  // mobile ne s'appliquait jamais et les 5 choix restaient écrasés côte à côte
  // sur un téléphone, débordant de la carte.
  const html = renderHabitudesForm()
  assert.equal(
    html.includes('style="grid-template-columns'),
    false,
    'grid-template-columns en ligne : la media query mobile ne pourra pas gagner'
  )
  assert.ok(html.includes('style="--cols:5"'), 'les rangées à 5 choix doivent porter --cols:5')
  assert.ok(html.includes('style="--cols:2"'), 'les rangées à 2 choix doivent porter --cols:2')
  // La feuille de style doit consommer la variable, avec un repli.
  assert.ok(html.includes('grid-template-columns:repeat(var(--cols,5),1fr)'))
})

test('la bascule mobile ramène les choix sur une seule colonne', () => {
  const html = renderHabitudesForm()
  const mq = html.slice(html.indexOf('@media (max-width:640px)'))
  assert.ok(mq.includes('.choix-rangee{grid-template-columns:1fr'))
  // Et elle doit venir APRÈS la règle de base, sinon elle perd la cascade.
  assert.ok(
    html.indexOf('@media (max-width:640px)') > html.indexOf('.choix-rangee{display:grid'),
    'la règle mobile doit suivre la règle de base'
  )
})

test('le bouton « Préparer le courriel » construit un mailto complet', () => {
  const html = renderHabitudesForm({ clientName: 'Sabrina Dumais', replyTo: 'marie@exemple.ca' })
  assert.ok(html.includes('id="courriel"'), 'le bouton doit exister')
  // Destinataire, objet et corps : les trois, sinon le client doit encore taper.
  assert.ok(html.includes("'mailto:' + dest"))
  // L'adresse passe par une liste blanche, pas encodeURIComponent : le « @ »
  // deviendrait « %40 », et un « ? » injecterait un en-tête (bcc/cc).
  assert.ok(html.includes("REPLY.replace(/[^A-Za-z0-9@._+-]/g, '')"))
  assert.ok(html.includes("'?subject=' + encodeURIComponent(objet)"))
  assert.ok(html.includes("'&body=' + encodeURIComponent(corps)"))
  // Tout doit être encodé : un « + » ou un « & » non échappé tronquerait le code
  // dans le corps du courriel, et le client renverrait un code invalide.
  assert.equal(html.includes('?subject=' + "' + objet"), false)
})

test('le repli mailto est prévu et masqué au départ', () => {
  const html = renderHabitudesForm({ replyTo: 'marie@exemple.ca' })
  // mailto: peut ne rien ouvrir (webmail seul, aucun client configuré) sans
  // lever d'erreur. Le client doit savoir quoi faire dans ce cas.
  assert.ok(html.includes('id="repli"'))
  assert.ok(html.includes('.repli{'), 'la classe de repli doit être stylée')
  assert.ok(/\.repli\{[^}]*display:none/.test(html), 'masqué tant qu’il n’y a rien à dire')
  assert.ok(html.includes('Copier le code »'), 'le repli doit renvoyer vers la copie')
})

test('le nom du courriel vient du champ, pas de la valeur pré-remplie', () => {
  const html = renderHabitudesForm({ clientName: 'Sabrina Dumais' })
  // Un client qui corrige son nom doit voir la correction dans l'objet.
  assert.ok(html.includes('var nom = nomClient();'))
})

test('LE SCRIPT DE LA PAGE SE PARSE — sinon rien ne fonctionne', () => {
  // v0.9.116 : la v0.9.115 est partie chez des clients avec un script qui ne se
  // parsait pas. Un « \n » écrit dans une chaîne JS de ce template literal est
  // interprété par TypeScript à la génération : il insère un vrai saut de ligne
  // et coupe la chaîne en deux. Résultat, TOUT le script tombe — compteur figé,
  // date non remplie, bouton Terminer mort — sans le moindre signe visible.
  //
  // Les tests d'alors ne vérifiaient que la présence de bouts de texte. Celui-ci
  // parse le script entier, ce qu'aucun autre ne faisait.
  const html = renderHabitudesForm({ clientName: 'Sabrina Dumais', replyTo: 'marie@exemple.ca' })
  const blocs = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  assert.ok(blocs.length > 0, 'la page doit contenir au moins un script')
  for (const [i, bloc] of blocs.entries()) {
    assert.doesNotThrow(
      () => new Function(bloc[1]),
      `le bloc script ${i} ne se parse pas — la page serait totalement inerte`
    )
  }
})
