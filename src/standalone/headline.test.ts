/**
 * Le titre de la couverture du document remis au client.
 *
 * Testé parce que c'est la première phrase qu'un client lit sur son bilan, et
 * que la règle a des cas qui se croisent : une variation ET un niveau. La
 * version d'origine ne regardait que la variation — un client à 0,6 sur 4 dont
 * le score n'avait pas bougé lisait « vous tenez le cap », c'est-à-dire que le
 * cap était bon. Repéré par Nicholas le 2026-08-08.
 *
 * Lancer : `node --experimental-strip-types --test src/standalone/headline.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { headlineFor, type HeadlineScore } from './headline.ts'
import type { Category } from '../lib/norms/types.ts'

const bilan = (score: number | null, category: Category | null): HeadlineScore => ({
  overall: { score, category }
})

test('sans bilan précédent — neutre, quel que soit le niveau', () => {
  assert.equal(headlineFor('Jean', bilan(3.8, 'EXCELLENT')), 'Jean, voici où vous en êtes.')
  assert.equal(headlineFor('Jean', bilan(0.6, 'ACCEPTABLE')), 'Jean, voici où vous en êtes.')
})

test('bilan faible — jamais de félicitation, même en progressant', () => {
  // Le cas du signalement : 0,6 sur 4, score stable → « vous tenez le cap ».
  assert.equal(headlineFor('Dummy', bilan(0.6, 'ACCEPTABLE'), bilan(0.6, 'ACCEPTABLE')), 'Dummy, voici où vous en êtes.')
  // Même une hausse réelle reste sobre tant que le niveau est bas.
  assert.equal(headlineFor('Dummy', bilan(1.4, 'ACCEPTABLE'), bilan(0.6, 'A_AMELIORER')), 'Dummy, voici où vous en êtes.')
  assert.equal(headlineFor('Dummy', bilan(0.4, 'A_AMELIORER'), bilan(0.4, 'A_AMELIORER')), 'Dummy, voici où vous en êtes.')
})

test('bilan correct — la variation peut alors s’exprimer', () => {
  assert.equal(headlineFor('Marie', bilan(3.2, 'TRES_BIEN'), bilan(2.8, 'BIEN')), 'Marie, vous avez progressé.')
  assert.equal(headlineFor('Marie', bilan(2.5, 'BIEN'), bilan(2.5, 'BIEN')), 'Marie, vous tenez le cap.')
})

test('régression — on invite à faire le point, jamais de reproche', () => {
  assert.equal(headlineFor('Marie', bilan(2.4, 'BIEN'), bilan(3.1, 'TRES_BIEN')), 'Marie, faisons le point.')
  // Y compris depuis un niveau déjà faible : « faisons le point » reste neutre.
  assert.equal(headlineFor('Marie', bilan(0.5, 'A_AMELIORER'), bilan(1.2, 'ACCEPTABLE')), 'Marie, faisons le point.')
})

test('aucun titre ne félicite un bilan sous « Bien »', () => {
  // Garde-fou général : quelles que soient les variations, les deux catégories
  // basses ne doivent jamais produire une phrase valorisante.
  const valorisantes = ['progressé', 'tenez le cap']
  for (const cat of ['A_AMELIORER', 'ACCEPTABLE'] as const) {
    for (const delta of [-1, -0.5, 0, 0.5, 1]) {
      const titre = headlineFor('X', bilan(1 + delta, cat), bilan(1, cat))
      for (const mot of valorisantes) {
        assert.ok(!titre.includes(mot), `« ${titre} » félicite un bilan ${cat}`)
      }
    }
  }
})
