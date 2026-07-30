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

// ── Aucune victoire : la section ne doit RIEN afficher ───────────────────────
//
// Décision de Nicholas : « quand la personne n'a pas de victoire, on ne
// mentionne rien, pour ne pas décourager la personne ». Le dashboard et le
// document HTML masquent la section sur `wins.length > 0` ; encore faut-il que
// cette liste soit réellement vide dans les cas sans progrès. C'est ce que ces
// trois cas verrouillent.

test('client qui a RÉGRESSÉ partout → aucune victoire, jamais un message négatif', () => {
  const p = { ...profile, age: 48, sex: 'M' as const }
  const avant = computeBilan(
    { taille_cm: 176, poids_kg: 85, tour_taille_cm: 88, vo2max: 55, pushups: 50, situps: 45,
      flexion_tronc_cm: 30, endurance_dos_sec: 180, saut_vertical_cm: 50 },
    p
  )
  const apres = computeBilan(
    { taille_cm: 176, poids_kg: 105, tour_taille_cm: 108, vo2max: 30, pushups: 8, situps: 5,
      flexion_tronc_cm: 12, endurance_dos_sec: 40, saut_vertical_cm: 20 },
    p
  )
  const wins = detectWins({
    computed: apres,
    previous: avant,
    bilans: [bilan('b2', '2026-06-25', {}), bilan('b1', '2025-06-25', {})],
    currentData: {} as BilanData
  })
  assert.deepEqual(wins, [], 'un client en régression ne doit voir aucune ligne')
})

test('premier bilan (aucun précédent) → aucune victoire', () => {
  const p = { ...profile, age: 48, sex: 'M' as const }
  const wins = detectWins({
    computed: computeBilan({ taille_cm: 176, poids_kg: 91.8, vo2max: 57.6 }, p),
    previous: undefined,
    bilans: [bilan('b1', '2026-06-25', { vo2max: 57.6 })],
    currentData: {} as BilanData
  })
  assert.deepEqual(wins, [], 'sans point de comparaison, rien à célébrer')
})

test('bilan identique au précédent → aucune victoire', () => {
  const p = { ...profile, age: 48, sex: 'M' as const }
  const data = { taille_cm: 176, poids_kg: 91.8, tour_taille_cm: 93, vo2max: 50, pushups: 30 }
  const c = computeBilan(data, p)
  const wins = detectWins({
    computed: c,
    previous: c,
    bilans: [bilan('b2', '2026-06-25', data), bilan('b1', '2025-06-25', data)],
    currentData: {} as BilanData
  })
  assert.deepEqual(wins, [], 'aucun changement = aucune victoire, pas un message de stagnation')
})
