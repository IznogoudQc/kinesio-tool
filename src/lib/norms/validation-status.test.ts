import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VALIDATION,
  VALIDATION_STATUS_LABELS,
  aValider,
  compteParStatut
} from './validation-status.ts'

test('chaque entrée est complète et cohérente avec son statut', () => {
  for (const e of VALIDATION) {
    assert.ok(e.id.trim() !== '', 'id vide')
    assert.ok(e.label.trim() !== '', `label vide pour ${e.id}`)
    assert.ok(e.source.trim() !== '', `source vide pour ${e.id}`)
    // Le contrat du fichier : confirmé ⇒ rien à demander ; sinon ⇒ dire quoi.
    if (e.statut === 'confirme') {
      assert.equal(e.manque, null, `${e.id} : confirmé mais il manque encore quelque chose`)
    } else {
      assert.ok(
        e.manque !== null && e.manque.trim() !== '',
        `${e.id} : non confirmé sans dire ce qu'il faut demander — l'entrée serait inutile`
      )
    }
  }
})

test('les identifiants sont uniques', () => {
  const ids = VALIDATION.map(e => e.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('aValider ne remonte que l’ouvert, le plus lourd d’abord', () => {
  const ouverts = aValider()
  assert.ok(ouverts.length > 0, 'tout serait confirmé — vérifier avant de le croire')
  assert.ok(ouverts.every(e => e.statut !== 'confirme'))
  // Ce qui fausse une note passe avant ce qui ne touche qu'un libellé.
  const rangs = ouverts.map(e => Number(e.entreDansLeScore))
  assert.deepEqual(rangs, [...rangs].sort((a, b) => b - a))
})

test('la PA systolique reste « déduit » tant que sa table manque', () => {
  // Garde-fou : ce barème vient d'un rétro-calcul sur 4 points et entre dans le
  // score. Le passer à « confirmé » sans la fenêtre Propriétés ferait cesser les
  // questions sur le seul chiffre qu'on sait fragile.
  const pa = VALIDATION.find(e => e.id === 'pa-systolique-cote')
  assert.ok(pa)
  assert.equal(pa.statut, 'deduit')
  assert.equal(pa.entreDansLeScore, true)
  assert.match(pa.manque ?? '', /Propriétés/)
})

test('la composition corporelle reste à confirmer — elle entre dans le score', () => {
  const compo = VALIDATION.find(e => e.id === 'composition-cpafla')
  assert.ok(compo)
  assert.notEqual(compo.statut, 'confirme')
  assert.equal(compo.entreDansLeScore, true)
})

test('les compteurs couvrent toutes les entrées, sans trou', () => {
  const n = compteParStatut()
  assert.equal(n.confirme + n.a_confirmer + n.deduit, VALIDATION.length)
  for (const s of Object.keys(n) as (keyof typeof n)[]) {
    assert.ok(VALIDATION_STATUS_LABELS[s], `libellé manquant pour ${s}`)
  }
})
