/**
 * Tests du mapping BilanData → normes, et du sens de progression des mesures.
 *
 * Lancer : `node --test src/lib/norms/bilan-keys.test.ts`
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BILAN_LOWER_IS_BETTER, BILAN_TO_TEST_KEY, isLowerBetter } from './bilan-keys.ts'
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

test('mesure inconnue → plus haut est mieux (défaut explicite)', () => {
  assert.equal(isLowerBetter('poids_kg'), false)
})
