import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseSuppPlan,
  serializeSuppPlan,
  suppPlanHasSchedule,
  parseMenuPlan,
  serializeMenuPlan,
  EMPTY_SUPP_PLAN
} from './nutrition-plan.ts'

test('parseSuppPlan: vide → plan vide', () => {
  assert.deepEqual(parseSuppPlan(null), EMPTY_SUPP_PLAN)
  assert.deepEqual(parseSuppPlan('   '), EMPTY_SUPP_PLAN)
})

test('parseSuppPlan: texte libre historique → dans input', () => {
  const p = parseSuppPlan('Vitamine D3\nCréatine 5 g')
  assert.equal(p.input, 'Vitamine D3\nCréatine 5 g')
  assert.equal(suppPlanHasSchedule(p), false)
})

test('serialize/parse suppléments : aller-retour fidèle', () => {
  const plan = {
    input: 'Vitamine D3, Créatine, Magnésium',
    reveil: '',
    dejeuner: 'Vitamine D3 (2000 UI) — avec un corps gras',
    apresEntrainement: 'Créatine 5 g',
    souper: '',
    coucher: 'Magnésium 300 mg',
    interactions: 'Séparer le fer du calcium'
  }
  const json = serializeSuppPlan(plan)
  assert.ok(json && json.includes('"kind":"supp"'))
  const round = parseSuppPlan(json)
  assert.deepEqual(round, plan)
  assert.equal(suppPlanHasSchedule(round), true)
})

test('serializeSuppPlan: tout vide → null', () => {
  assert.equal(serializeSuppPlan(EMPTY_SUPP_PLAN), null)
})

test('serializeSuppPlan: input seul (pas encore organisé) → conservé', () => {
  const json = serializeSuppPlan({ ...EMPTY_SUPP_PLAN, input: 'Créatine' })
  assert.ok(json)
  assert.equal(parseSuppPlan(json).input, 'Créatine')
})

test('parseMenuPlan: texte libre → null (rendu hérité)', () => {
  assert.equal(parseMenuPlan('Journée 1\nDéjeuner : ...'), null)
  assert.equal(parseMenuPlan(null), null)
})

test('serialize/parse menu : journées séparées, vides de FIN coupées', () => {
  const json = serializeMenuPlan(['Déjeuner : gruau\nSouper : saumon', '', '  '])
  assert.ok(json && json.includes('"kind":"menu"'))
  const round = parseMenuPlan(json)
  assert.deepEqual(round, { jours: ['Déjeuner : gruau\nSouper : saumon'] })
})

test('une journée vide au MILIEU garde sa place', () => {
  // La position porte une information : les journées 6 et 7 sont la fin de
  // semaine. Retirer un trou décalerait les suivantes, et une journée de
  // weekend serait annoncée au client comme une journée de semaine.
  const jours = ['J1', '', 'J3', '', '', 'J6', 'J7']
  const round = parseMenuPlan(serializeMenuPlan(jours))
  assert.deepEqual(round?.jours, jours)
  assert.equal(round?.jours[5], 'J6', 'la 6e journée doit rester en 6e position')
})

test('les journées vides de fin ne gonflent pas l’enregistrement', () => {
  const round = parseMenuPlan(serializeMenuPlan(['J1', 'J2', '', '', '', '', '']))
  assert.deepEqual(round?.jours, ['J1', 'J2'])
})

test('serializeMenuPlan: aucune journée → null', () => {
  assert.equal(serializeMenuPlan(['', '   ']), null)
})
