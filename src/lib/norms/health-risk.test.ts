/**
 * Tests du risque santé IMC (aide-mémoire ÉAS, SPAP-SCPE).
 *
 * Lancer : `node --test src/lib/norms/health-risk.test.ts`
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BMI_BANDS, bmiRisk, HEALTH_RISK_ORDER } from './health-risk.ts'

test('les six bandes de la feuille, à leurs bornes exactes', () => {
  assert.equal(bmiRisk(18.4)?.risk, 'ACCRU')
  assert.equal(bmiRisk(18.5)?.risk, 'MOINDRE')
  assert.equal(bmiRisk(24.9)?.risk, 'MOINDRE')
  assert.equal(bmiRisk(25)?.risk, 'ACCRU')
  assert.equal(bmiRisk(29.9)?.risk, 'ACCRU')
  assert.equal(bmiRisk(30)?.risk, 'ELEVE')
  assert.equal(bmiRisk(34.9)?.risk, 'ELEVE')
  assert.equal(bmiRisk(35)?.risk, 'TRES_ELEVE')
  assert.equal(bmiRisk(39.9)?.risk, 'TRES_ELEVE')
  assert.equal(bmiRisk(40)?.risk, 'EXTREMEMENT_ELEVE')
  assert.equal(bmiRisk(55)?.risk, 'EXTREMEMENT_ELEVE')
})

test('le risque remonte des deux côtés : maigreur et excès sont tous deux « Accru »', () => {
  // Ce n'est pas une échelle monotone — c'est bien ce qu'imprime la feuille.
  assert.equal(bmiRisk(17)?.risk, 'ACCRU')
  assert.equal(bmiRisk(27)?.risk, 'ACCRU')
  assert.equal(bmiRisk(22)?.risk, 'MOINDRE')
})

test('le libellé de bande situe la valeur', () => {
  assert.equal(bmiRisk(32.2)?.band, '30,0–34,9')
  assert.equal(bmiRisk(22)?.band, '18,5–24,9')
  assert.equal(bmiRisk(41)?.band, '40 et plus')
})

test('valeur absente ou aberrante → null (jamais de risque inventé)', () => {
  for (const v of [null, undefined, Number.NaN, 0, -3]) {
    assert.equal(bmiRisk(v as number | null | undefined), null)
  }
})

test('les bandes couvrent la droite réelle sans trou ni chevauchement', () => {
  // Chaque borne supérieure est strictement croissante, et la dernière est
  // ouverte : aucun IMC positif ne peut retomber en dehors.
  for (let i = 1; i < BMI_BANDS.length; i++) {
    assert.ok(BMI_BANDS[i].ltImc > BMI_BANDS[i - 1].ltImc, `bande ${i} mal ordonnée`)
  }
  assert.equal(BMI_BANDS[BMI_BANDS.length - 1].ltImc, Infinity)
  for (let imc = 0.1; imc < 80; imc += 0.1) {
    assert.ok(bmiRisk(imc) !== null, `IMC ${imc.toFixed(1)} non classé`)
  }
})

test('l’ordre de gravité est complet et sans doublon', () => {
  assert.equal(new Set(HEALTH_RISK_ORDER).size, HEALTH_RISK_ORDER.length)
  for (const b of BMI_BANDS) assert.ok(HEALTH_RISK_ORDER.includes(b.risk))
})
