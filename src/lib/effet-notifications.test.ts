/**
 * Tests de la veille sur les messages d'Effet.
 *
 * Lancer : `node --test src/lib/effet-notifications.test.ts`
 *
 * Le test qui compte le plus est le dernier : AUCUN texte de message ne doit
 * sortir de ce module. C'est la règle la plus facile à casser par accident, en
 * ajoutant un jour un « aperçu » à la notification pour rendre service.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  construireNotification,
  filsANotifier,
  lireEtatVu,
  majEtatVu,
  prenomDe,
  type FilCoach
} from './effet-notifications.ts'

/** Le texte qu'aucune sortie ne doit jamais contenir. */
const SECRET = 'Est-ce que je peux sauter mon entraînement de jeudi ?'

function fil(partiel: Partial<FilCoach> = {}): FilCoach {
  return {
    clientId: 'c1',
    nom: 'Julie Tremblay',
    derniere: '2026-09-29T18:04:11.000Z',
    apercu: SECRET,
    auteurDernier: 'cliente',
    nonLus: 2,
    ...partiel
  }
}

// ── Ce qui déclenche une notification ────────────────────────────────────────

test('une cliente qui écrit déclenche une notification', () => {
  assert.equal(filsANotifier([fil()], {}).length, 1)
})

test('un message dont l’auteur est la coach ne notifie rien', () => {
  assert.equal(filsANotifier([fil({ auteurDernier: 'coach' })], {}).length, 0)
})

test('un fil sans non-lus ne notifie rien', () => {
  assert.equal(filsANotifier([fil({ nonLus: 0 })], {}).length, 0)
})

test('un fil vide (jamais de message) ne notifie rien', () => {
  assert.equal(filsANotifier([fil({ derniere: null, auteurDernier: null, nonLus: 0 })], {}).length, 0)
})

test('le même message ne notifie pas deux fois', () => {
  const fils = [fil()]
  const premier = filsANotifier(fils, {})
  assert.equal(premier.length, 1)
  // Ce qu'on aurait écrit sur le disque après la première annonce.
  const etat = majEtatVu({}, fils)
  assert.equal(filsANotifier(fils, etat).length, 0, 'le second passage doit se taire')
})

test('relancer l’outil ne renotifie pas ce qui a déjà été vu', () => {
  const fils = [fil()]
  // L'état relu depuis le fichier JSON après redémarrage.
  const etatRelu = lireEtatVu(JSON.parse(JSON.stringify(majEtatVu({}, fils))))
  assert.equal(filsANotifier(fils, etatRelu).length, 0)
})

test('un message PLUS RÉCENT que le dernier vu notifie à nouveau', () => {
  const etat = majEtatVu({}, [fil()])
  const suite = fil({ derniere: '2026-09-29T19:00:00.000Z', nonLus: 3 })
  assert.equal(filsANotifier([suite], etat).length, 1)
})

test('un message de la coach est mémorisé sans être annoncé', () => {
  // Sinon la première réponse de la cliente rejouerait tout l'échange.
  const reponseCoach = fil({ auteurDernier: 'coach', nonLus: 0, derniere: '2026-09-29T20:00:00.000Z' })
  const etat = majEtatVu({}, [reponseCoach])
  assert.equal(etat['c1'], '2026-09-29T20:00:00.000Z')
  assert.equal(filsANotifier([reponseCoach], etat).length, 0)
})

test('une cliente absente de la réponse garde sa date', () => {
  // L'API ne renvoie que les fils actifs ; oublier une cliente la ferait
  // renotifier le jour où elle réécrit.
  const etat = majEtatVu({ c9: '2026-01-01T00:00:00.000Z' }, [fil()])
  assert.equal(etat['c9'], '2026-01-01T00:00:00.000Z')
})

// ── Le texte affiché ─────────────────────────────────────────────────────────

test('une seule cliente : on la nomme par son prénom', () => {
  const n = construireNotification(filsANotifier([fil()], {}))
  assert.equal(n?.corps, 'Julie t’a écrit')
  assert.equal(n?.chemin, '/coach/notes/c1')
})

test('plusieurs clientes : on compte, sans nommer personne', () => {
  const fils = [fil({ clientId: 'c1', nonLus: 2 }), fil({ clientId: 'c2', nom: 'Sophie Gagnon', nonLus: 1 })]
  const n = construireNotification(filsANotifier(fils, {}))
  assert.equal(n?.corps, '3 nouveaux messages')
  assert.equal(n?.chemin, '/coach/notes', 'sans cliente unique, on ouvre la liste')
  assert.ok(!n?.corps.includes('Julie'), 'aucun nom quand elles sont plusieurs')
  assert.ok(!n?.corps.includes('Sophie'))
})

test('rien à annoncer : pas de notification', () => {
  assert.equal(construireNotification([]), null)
})

test('un nom en un seul mot reste entier', () => {
  assert.equal(prenomDe('Julie'), 'Julie')
  assert.equal(prenomDe('  Marie-Eve  Riendeau '), 'Marie-Eve')
})

// ── Robustesse de l'état sur disque ──────────────────────────────────────────

test('un fichier d’état abîmé ne fait pas tomber l’outil', () => {
  assert.deepEqual(lireEtatVu(null), {})
  assert.deepEqual(lireEtatVu('bricolé à la main'), {})
  assert.deepEqual(lireEtatVu([1, 2, 3]), {})
  assert.deepEqual(lireEtatVu({ c1: 42, c2: 'pas une date' }), {}, 'les valeurs douteuses sont écartées')
  assert.deepEqual(lireEtatVu({ c1: '2026-09-29T18:04:11.000Z' }), { c1: '2026-09-29T18:04:11.000Z' })
})

// ── LA RÈGLE QUI PRIME ───────────────────────────────────────────────────────

test('AUCUN texte de message ne sort du module', () => {
  const fils = [
    fil({ clientId: 'c1', apercu: SECRET }),
    fil({ clientId: 'c2', nom: 'Sophie Gagnon', apercu: 'Un autre message confidentiel' })
  ]

  // 1. Ce qu'on retient pour notifier ne porte aucun aperçu.
  const aNotifier = filsANotifier(fils, {})
  const serialiseANotifier = JSON.stringify(aNotifier)
  assert.ok(!serialiseANotifier.includes(SECRET), 'la liste à notifier ne doit pas porter l’aperçu')
  assert.ok(!serialiseANotifier.includes('confidentiel'))
  for (const f of aNotifier) {
    assert.ok(!('apercu' in f), 'le champ apercu ne doit pas être recopié')
  }

  // 2. La notification affichée sur le bureau.
  for (const liste of [filsANotifier([fils[0]], {}), aNotifier]) {
    const n = construireNotification(liste)
    const serialiseNotif = JSON.stringify(n)
    assert.ok(!serialiseNotif.includes(SECRET), 'la notification ne doit pas porter le message')
    assert.ok(!serialiseNotif.includes('confidentiel'))
    assert.ok(!serialiseNotif.includes('entraînement'), 'même un fragment du message est de trop')
  }

  // 3. L'état écrit sur le disque : des dates, rien d'autre.
  const etat = majEtatVu({}, fils)
  const serialiseEtat = JSON.stringify(etat)
  assert.ok(!serialiseEtat.includes(SECRET), 'l’état local ne doit pas porter le message')
  assert.ok(!serialiseEtat.includes('confidentiel'))
  for (const valeur of Object.values(etat)) {
    assert.ok(Number.isFinite(Date.parse(valeur)), 'l’état ne contient que des dates')
  }
  // Et pas même le nom des clientes : l'état n'en a pas besoin.
  assert.ok(!serialiseEtat.includes('Julie'))
  assert.ok(!serialiseEtat.includes('Sophie'))
})
