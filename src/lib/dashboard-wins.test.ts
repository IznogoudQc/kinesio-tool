import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectWins } from './dashboard-wins.ts'
import { computeBilan } from './bilan-computed.ts'

const profile = { norms: 'acsm' as const }

function bilan(id: string, date: string, data: Record<string, unknown>): Bilan {
  return { id, clientId: 'c1', date, data: data as BilanData, createdAt: date, updatedAt: date } as Bilan
}

test('objectif atteint → victoire 🎯', () => {
  const data = { taille: 175, poids: 70 } as BilanData
  const wins = detectWins({
    computed: computeBilan(data, profile),
    bilans: [bilan('b1', '2026-01-01', data)],
    currentData: data,
    objectifAtGoal: true
  })
  assert.ok(wins.some(w => w.icon === '🎯'))
})

test('record personnel VO2max (meilleur strict de l’historique) → 🏆', () => {
  const b1 = bilan('b1', '2025-01-01', { taille: 180, poids: 80, vo2max: 40 })
  const b2 = bilan('b2', '2026-01-01', { taille: 180, poids: 80, vo2max: 52 })
  const wins = detectWins({
    computed: computeBilan(b2.data, profile),
    bilans: [b1, b2],
    currentData: b2.data
  })
  assert.ok(wins.some(w => w.icon === '🏆' && /VO2max/.test(w.text)))
})

test('pas de record si la valeur courante n’est pas la meilleure', () => {
  const b1 = bilan('b1', '2025-01-01', { taille: 180, poids: 80, vo2max: 55 })
  const b2 = bilan('b2', '2026-01-01', { taille: 180, poids: 80, vo2max: 48 })
  const wins = detectWins({
    computed: computeBilan(b2.data, profile),
    bilans: [b1, b2],
    currentData: b2.data
  })
  assert.ok(!wins.some(w => w.icon === '🏆'))
})

test('une seule mesure d’un champ → pas de record', () => {
  const data = { taille: 180, poids: 80, vo2max: 60 } as BilanData
  const wins = detectWins({
    computed: computeBilan(data, profile),
    bilans: [bilan('b1', '2026-01-01', data)],
    currentData: data
  })
  assert.ok(!wins.some(w => w.icon === '🏆'))
})

test('aucune victoire sur un bilan isolé sans progrès ni objectif', () => {
  const data = { taille: 180, poids: 80, vo2max: 45 } as BilanData
  const wins = detectWins({
    computed: computeBilan(data, profile),
    bilans: [bilan('b1', '2026-01-01', data)],
    currentData: data
  })
  assert.equal(wins.length, 0)
})
