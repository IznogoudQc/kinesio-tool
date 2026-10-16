/**
 * Tests du brouillon des questionnaires.
 *
 * Lancer : `node --test src/lib/questionnaire-brouillon.test.ts`
 *
 * Les deux qui comptent : un brouillon ne traverse jamais d'un client à
 * l'autre, et une recopie qui échoue ne fait pas tomber la saisie.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  PEREMPTION_JOURS,
  cleBrouillon,
  ecrireBrouillon,
  effacerBrouillon,
  heureBrouillon,
  lireBrouillon,
  memeContenu,
  type StockageSimple
} from './questionnaire-brouillon.ts'

/** Un stockage de test — la même forme que `window.localStorage`. */
function stockage(initial: Record<string, string> = {}): StockageSimple & { contenu: Record<string, string> } {
  const contenu = { ...initial }
  return {
    contenu,
    getItem: (c: string) => (c in contenu ? contenu[c] : null),
    setItem: (c: string, v: string) => {
      contenu[c] = v
    },
    removeItem: (c: string) => {
      delete contenu[c]
    }
  }
}

// ── Aller-retour ────────────────────────────────────────────────────────────

test('ce qui est écrit se relit tel quel', () => {
  const s = stockage()
  ecrireBrouillon(s, 'cl-1', 'sante', { id: null, date: '2026-10-15', data: { douleur: 'épaule' } })

  const relu = lireBrouillon(s, 'cl-1', 'sante')
  assert.equal(relu?.id, null)
  assert.equal(relu?.date, '2026-10-15')
  assert.deepEqual(relu?.data, { douleur: 'épaule' })
})

test('rien d’enregistré, rien à reprendre', () => {
  assert.equal(lireBrouillon(stockage(), 'cl-1', 'sante'), null)
})

test('l’écriture rend l’enregistrement rangé, avec son heure', () => {
  const quand = new Date('2026-10-15T18:32:00.000Z')
  const range = ecrireBrouillon(stockage(), 'cl-1', 'qaap', { id: 'q-9', date: '2026-10-15', data: {} }, quand)
  assert.equal(range?.version, 1)
  assert.equal(range?.enregistreLe, quand.toISOString())
  assert.equal(range?.id, 'q-9')
})

test('effacer, c’est effacer', () => {
  const s = stockage()
  ecrireBrouillon(s, 'cl-1', 'sante', { id: null, date: '2026-10-15', data: { a: 1 } })
  effacerBrouillon(s, 'cl-1', 'sante')
  assert.equal(lireBrouillon(s, 'cl-1', 'sante'), null)
})

// ── Cloisonnement ───────────────────────────────────────────────────────────

test('un brouillon ne traverse pas d’un client à l’autre', () => {
  const s = stockage()
  ecrireBrouillon(s, 'cl-1', 'sante', { id: null, date: '2026-10-15', data: { douleur: 'épaule' } })

  assert.equal(lireBrouillon(s, 'cl-2', 'sante'), null)
})

test('un brouillon ne traverse pas d’un type à l’autre', () => {
  const s = stockage()
  ecrireBrouillon(s, 'cl-1', 'sante', { id: null, date: '2026-10-15', data: { douleur: 'épaule' } })

  assert.equal(lireBrouillon(s, 'cl-1', 'qaap'), null)
  // Et ouvrir un Q-AAP n'écrase pas le questionnaire de santé commencé avant.
  ecrireBrouillon(s, 'cl-1', 'qaap', { id: null, date: '2026-10-15', data: { q1: 'non' } })
  assert.deepEqual(lireBrouillon(s, 'cl-1', 'sante')?.data, { douleur: 'épaule' })
})

test('la clé porte le client et le type', () => {
  assert.notEqual(cleBrouillon('cl-1', 'sante'), cleBrouillon('cl-2', 'sante'))
  assert.notEqual(cleBrouillon('cl-1', 'sante'), cleBrouillon('cl-1', 'qaap'))
})

// ── Ce qu'on refuse de restaurer ────────────────────────────────────────────

test('un brouillon illisible est ignoré, et effacé pour ne pas revenir', () => {
  const cle = cleBrouillon('cl-1', 'sante')
  const s = stockage({ [cle]: '{ ceci n’est pas du JSON' })

  assert.equal(lireBrouillon(s, 'cl-1', 'sante'), null)
  assert.equal(cle in s.contenu, false)
})

test('une autre version est ignorée plutôt que devinée', () => {
  const cle = cleBrouillon('cl-1', 'sante')
  const s = stockage({
    [cle]: JSON.stringify({ version: 2, enregistreLe: new Date().toISOString(), id: null, date: '2026-10-15', data: {} })
  })

  assert.equal(lireBrouillon(s, 'cl-1', 'sante'), null)
})

test('un enregistrement amputé est ignoré', () => {
  const cle = cleBrouillon('cl-1', 'sante')
  const s = stockage({ [cle]: JSON.stringify({ version: 1, data: { a: 1 } }) })

  assert.equal(lireBrouillon(s, 'cl-1', 'sante'), null)
})

test('un brouillon périmé n’est plus proposé', () => {
  const s = stockage()
  const vieux = new Date('2026-08-01T12:00:00.000Z')
  ecrireBrouillon(s, 'cl-1', 'sante', { id: null, date: '2026-08-01', data: { a: 1 } }, vieux)

  const dansLesTemps = new Date(vieux.getTime() + (PEREMPTION_JOURS - 1) * 24 * 3600 * 1000)
  assert.ok(lireBrouillon(s, 'cl-1', 'sante', dansLesTemps), 'encore proposé la veille de la péremption')

  const tropTard = new Date(vieux.getTime() + (PEREMPTION_JOURS + 1) * 24 * 3600 * 1000)
  assert.equal(lireBrouillon(s, 'cl-1', 'sante', tropTard), null)
})

test('une horloge qui a reculé ne jette pas le brouillon', () => {
  const s = stockage()
  const ecrit = new Date('2026-10-15T18:00:00.000Z')
  ecrireBrouillon(s, 'cl-1', 'sante', { id: null, date: '2026-10-15', data: { a: 1 } }, ecrit)

  const avant = new Date('2026-10-14T08:00:00.000Z')
  assert.ok(lireBrouillon(s, 'cl-1', 'sante', avant))
})

// ── Un stockage qui refuse ──────────────────────────────────────────────────

test('un stockage plein ne fait pas tomber la saisie', () => {
  const plein: StockageSimple = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
    removeItem: () => {
      throw new Error('indisponible')
    }
  }

  // Perdre le brouillon est fâcheux ; lever ici viderait le formulaire à
  // l'écran — exactement le défaut qu'on répare.
  assert.equal(ecrireBrouillon(plein, 'cl-1', 'sante', { id: null, date: '2026-10-15', data: {} }), null)
  assert.doesNotThrow(() => effacerBrouillon(plein, 'cl-1', 'sante'))
})

// ── Comparaison de contenus ─────────────────────────────────────────────────

test('l’ordre des clés ne change rien', () => {
  assert.ok(memeContenu({ a: 1, b: 2 }, { b: 2, a: 1 }))
})

test('une clé absente et `undefined` se valent', () => {
  assert.ok(memeContenu({ a: 1 }, { a: 1, b: undefined }))
  assert.ok(memeContenu({}, {}))
})

test('une vraie différence est vue', () => {
  assert.equal(memeContenu({ a: 1 }, { a: 2 }), false)
  assert.equal(memeContenu({ a: 1 }, { a: 1, b: 3 }), false)
  assert.equal(memeContenu({ a: null }, { a: undefined }), false, 'null est une réponse, pas une absence')
})

test('les tableaux comptent, et leur ordre aussi', () => {
  assert.ok(memeContenu({ zones: ['épaule', 'genou'] }, { zones: ['épaule', 'genou'] }))
  assert.equal(memeContenu({ zones: ['épaule', 'genou'] }, { zones: ['genou', 'épaule'] }), false)
  assert.equal(memeContenu({ zones: ['épaule'] }, { zones: ['épaule', 'genou'] }), false)
  assert.equal(memeContenu([], {}), false)
})

test('un formulaire imbriqué est comparé en profondeur', () => {
  const a = { zonesDetail: [{ id: 'f_epaule_g', note: 'tire un peu' }], restrictions: null }
  const b = { zonesDetail: [{ id: 'f_epaule_g', note: 'tire un peu' }], restrictions: null }
  assert.ok(memeContenu(a, b))

  const c = { zonesDetail: [{ id: 'f_epaule_g', note: 'tire beaucoup' }], restrictions: null }
  assert.equal(memeContenu(a, c), false)
})

// ── L'heure dite à Marie ────────────────────────────────────────────────────

test('l’heure se dit en repères, pas en date complète', () => {
  const maintenant = new Date(2026, 9, 15, 20, 0, 0)

  assert.equal(heureBrouillon(new Date(2026, 9, 15, 14, 32).toISOString(), maintenant), 'aujourd’hui, 14 h 32')
  assert.equal(heureBrouillon(new Date(2026, 9, 14, 9, 5).toISOString(), maintenant), 'hier, 9 h 05')
  assert.match(heureBrouillon(new Date(2026, 9, 2, 16, 40).toISOString(), maintenant), /2 octobre, 16 h 40/)
})

test('une date illisible ne met pas de texte de travers à l’écran', () => {
  assert.equal(heureBrouillon('pas une date'), '')
})
