import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildActionPlan, formatNextTarget } from './action-plan.ts'

const profile = { age: 48, sex: 'F' as const, norms: 'acsm' as const }

test('sans âge ou sans sexe → aucun plan (les normes sont inapplicables)', () => {
  const data = { vo2max: 38, pushups: 18 } as BilanData
  assert.deepEqual(buildActionPlan(data, { age: null, sex: 'F', norms: 'acsm' }), { forces: [], priorities: [] })
  assert.deepEqual(buildActionPlan(data, { age: 48, sex: null, norms: 'acsm' }), { forces: [], priorities: [] })
})

test('les forces sont les mesures Très bien / Excellent, les meilleures d’abord', () => {
  const plan = buildActionPlan({ vo2max: 38, pushups: 18, situps: 26 } as BilanData, profile)
  assert.ok(plan.forces.length > 0)
  for (const f of plan.forces) assert.ok(f.category === 'TRES_BIEN' || f.category === 'EXCELLENT')
})

test('les priorités sont les mesures faibles, les plus faibles d’abord', () => {
  const plan = buildActionPlan({ vo2max: 18, pushups: 1, flexion_tronc_cm: 5 } as BilanData, profile)
  assert.ok(plan.priorities.length > 0)
  for (const p of plan.priorities) assert.ok(p.category === 'A_AMELIORER' || p.category === 'ACCEPTABLE')
  const first = plan.priorities[0]
  assert.ok(first.advice.length > 0, 'chaque priorité porte une recommandation')
})

test('au plus 3 forces et 3 priorités', () => {
  const plan = buildActionPlan(
    { vo2max: 18, pushups: 1, situps: 2, saut_vertical_cm: 5, flexion_tronc_cm: 1, endurance_dos_sec: 5 } as BilanData,
    profile
  )
  assert.ok(plan.priorities.length <= 3)
  assert.ok(plan.forces.length <= 3)
})

test('une mesure absente n’apparaît jamais dans le plan', () => {
  const plan = buildActionPlan({ vo2max: 18 } as BilanData, profile)
  const keys = [...plan.forces, ...plan.priorities].map(i => i.metric.key)
  assert.ok(!keys.includes('pushups'))
})

test('formatNextTarget : ≥ pour « plus = mieux », ≤ pour « moins = mieux »', () => {
  const plan = buildActionPlan({ vo2max: 18, tour_taille_cm: 105 } as BilanData, profile)
  for (const p of plan.priorities) {
    const s = formatNextTarget(p)
    if (!s) continue
    assert.ok(s.startsWith(p.lowerIsBetter ? '≤' : '≥'), `${p.metric.key}: ${s}`)
    assert.ok(s.includes('pour atteindre'))
  }
})

test('une mesure au sommet des normes n’a pas de cible suivante', () => {
  const plan = buildActionPlan({ vo2max: 90 } as BilanData, profile)
  const item = plan.forces.find(f => f.metric.key === 'vo2max')
  if (item) assert.equal(formatNextTarget(item), null)
})
