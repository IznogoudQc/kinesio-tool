/**
 * Séries des courbes de tendance.
 *
 * Deux règles à verrouiller, et ce sont les deux qui feraient mentir un
 * graphique sans qu'on s'en aperçoive :
 *
 *  · le SENS — les bilans arrivent du plus récent au plus ancien, les courbes
 *    se lisent dans l'autre sens. Inversé, le progrès devient une régression ;
 *  · les TROUS — un bilan sans mesure est retiré, jamais tracé à zéro. Une
 *    valeur manquante n'est pas une valeur basse.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { serieGras, serieScore } from './trend-series.ts'

const BILANS = [
  { date: '2026-06-01', data: { pourcentage_gras: 23.1 } },
  { date: '2025-09-01', data: { pourcentage_gras: 29.8 } },
  { date: '2024-06-01', data: { pourcentage_gras: 32.4 } }
]

test('la courbe se lit du plus ANCIEN au plus récent', () => {
  // Les bilans arrivent dans l'ordre de la base : le plus récent d'abord.
  const s = serieGras(BILANS)
  assert.deepEqual(
    s.map(p => p.date),
    ['2024-06-01', '2025-09-01', '2026-06-01']
  )
  assert.equal(s[0].pct, 32.4, 'le premier point est le plus ancien')
  assert.equal(s[s.length - 1].pct, 23.1, 'le dernier point est le plus récent')
})

test('un bilan sans mesure est RETIRÉ, pas tracé à zéro', () => {
  const s = serieGras([
    { date: '2026-06-01', data: { pourcentage_gras: 23.1 } },
    { date: '2025-09-01', data: {} },
    { date: '2024-06-01', data: { pourcentage_gras: 32.4 } }
  ])
  assert.equal(s.length, 2)
  assert.ok(
    s.every(p => p.pct > 0),
    'aucun point à zéro : la courbe ne doit pas plonger sur un bilan incomplet'
  )
})

test('NaN est traité comme une absence', () => {
  const s = serieGras([{ date: '2026-06-01', data: { pourcentage_gras: Number.NaN } }])
  assert.deepEqual(s, [])
})

test('aucun bilan → série vide, jamais une erreur', () => {
  assert.deepEqual(serieGras(null), [])
  assert.deepEqual(serieGras(undefined), [])
  assert.deepEqual(serieGras([]), [])
})

test('la série de score suit les mêmes règles', () => {
  const bilans = [
    { date: '2026-06-01', score: 4 },
    { date: '2025-09-01', score: null },
    { date: '2024-06-01', score: 2 }
  ]
  const s = serieScore(bilans, b => b.score)
  assert.deepEqual(s, [
    { date: '2024-06-01', score: 2 },
    { date: '2026-06-01', score: 4 }
  ])
})

test('un score de zéro est une VRAIE valeur et reste', () => {
  // Le piège classique du filtre : `filter(Boolean)` supprimerait ce point,
  // et la pire note du client disparaîtrait de sa courbe.
  const s = serieScore([{ date: '2026-06-01', score: 0 }], b => b.score)
  assert.deepEqual(s, [{ date: '2026-06-01', score: 0 }])
})
