/**
 * Tests du mapping BilanData → normes, et du sens de progression des mesures.
 *
 * Lancer : `node --test src/lib/norms/bilan-keys.test.ts`
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BILAN_GOAL_DEPENDENT,
  BILAN_LOWER_IS_BETTER,
  BILAN_TO_TEST_KEY,
  isLowerBetter
} from './bilan-keys.ts'
import { getNormPercentiles } from './index.ts'

test('IMC et tour de taille : baisser est une amélioration', () => {
  // Le PDF affichait « ▼ -2,4 kg/m² » en ROUGE parce qu'il déduisait le sens de
  // la table de normes, absente pour ces deux mesures.
  assert.equal(isLowerBetter('imc'), true)
  assert.equal(isLowerBetter('tour_taille_cm'), true)
  // …et elles n'ont toujours pas de barème : le sens ne doit donc pas en dépendre.
  assert.equal(BILAN_TO_TEST_KEY.imc, undefined)
  assert.equal(BILAN_TO_TEST_KEY.tour_taille_cm, undefined)
})

test('le sens déclaré s’accorde avec les tables de normes, partout où les deux existent', () => {
  for (const [key, declared] of Object.entries(BILAN_LOWER_IS_BETTER)) {
    const testKey = BILAN_TO_TEST_KEY[key as keyof typeof BILAN_TO_TEST_KEY]
    if (!testKey) continue
    const range = getNormPercentiles(testKey, 45, 'M', 'cpafla')
    if (!range) continue
    assert.equal(
      range.lowerIsBetter ?? false,
      declared,
      `${key} : la table dit ${range.lowerIsBetter}, la déclaration dit ${declared}`
    )
  }
})

test('toute mesure cotée a un sens déclaré', () => {
  // Sans quoi elle retomberait silencieusement sur « plus haut = mieux ».
  for (const key of Object.keys(BILAN_TO_TEST_KEY)) {
    assert.ok(
      key in BILAN_LOWER_IS_BETTER,
      `${key} est coté mais son sens de progression n'est pas déclaré`
    )
  }
})

test('mesure non déclarée → plus haut est mieux (défaut explicite)', () => {
  // La grandeur n'est ni meilleure haute ni meilleure basse : elle n'est pas
  // déclarée, donc elle retombe sur le défaut.
  assert.equal(isLowerBetter('taille_cm'), false)
})

// ── Mesures dépendant de l'objectif du client ────────────────────────────────

test('poids et tour de hanche suivent l’objectif, pas la mesure', () => {
  // Le tour de hanche était figé « baisse = mieux » dans le graphique de
  // progression et dépendant de l'objectif dans l'onglet Mesures : deux écrans,
  // deux verdicts sur le même chiffre.
  for (const key of ['poids_kg', 'tour_hanche_cm'] as const) {
    assert.ok(BILAN_GOAL_DEPENDENT.has(key), `${key} devrait dépendre de l'objectif`)
    assert.equal(isLowerBetter(key, true), true, `${key} en perte de poids`)
    assert.equal(isLowerBetter(key, false), false, `${key} en prise de masse`)
  }
})

test('l’objectif n’influence QUE les mesures qui en dépendent', () => {
  for (const key of Object.keys(BILAN_LOWER_IS_BETTER) as (keyof typeof BILAN_LOWER_IS_BETTER)[]) {
    if (BILAN_GOAL_DEPENDENT.has(key)) continue
    assert.equal(
      isLowerBetter(key, true),
      isLowerBetter(key, false),
      `${key} ne devrait pas dépendre de l'objectif`
    )
  }
})

test('objectif par défaut = perte de poids', () => {
  assert.equal(isLowerBetter('poids_kg'), isLowerBetter('poids_kg', true))
})

test('plis cutanés : moins est mieux ; circonférences musculaires : plus est mieux', () => {
  for (const k of ['pli_triceps', 'pli_biceps', 'pli_sous_scap', 'pli_iliaque', 'pli_mollet'] as const) {
    assert.equal(isLowerBetter(k), true, `${k} : moins de gras est l'objectif`)
  }
  for (const k of ['circ_biceps_flechi_cm', 'circ_cuisse_cm', 'circ_epaules_pec_cm'] as const) {
    assert.equal(isLowerBetter(k), false, `${k} : site musculaire, grossir est l'objectif`)
  }
  // Le tour de taille reste de l'adiposité, jamais du muscle.
  assert.equal(isLowerBetter('tour_taille_cm'), true)
})
