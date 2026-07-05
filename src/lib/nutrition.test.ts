/**
 * Tests du moteur objectif chiffré & nutrition — cas Nicholas Jean (H 48 ans).
 *
 * Lancer : `node --test src/lib/nutrition.test.ts`
 *
 * Référence (calculs vérifiés à la main) :
 *   poids 99.8 kg, %gras 30.2, cible 15 %, taille 176, âge 48, H, activité modérée
 *   - masse maigre = 99.8 × 0.698 = 69.66 kg
 *   - poids-cible  = 69.66 / 0.85 = 81.95 → 82.0 kg
 *   - à perdre     = 99.8 − 81.95 = 17.85 → 17.8 kg (≈ 39 lb)
 *   - BMR Mifflin  = 10×99.8 + 6.25×176 − 5×48 + 5 = 1863
 *   - TDEE modéré  = 1863 × 1.55 = 2888
 *   - cible kcal   = 2888 × 0.8 = 2310
 *   - protéines    = 82.0 × 2.0 = 164 g ; lipides = 2310×0.25/9 = 64 g
 *   - glucides     = (2310 − 656 − 576)/4 = 270 g
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bodyFatGoal, mifflinBmr, estimateMacros } from './nutrition.ts'

const close = (a: number, b: number, eps = 0.15) => Math.abs(a - b) <= eps

test('bodyFatGoal — Nicholas 99.8 kg / 30.2 % → cible 15 %', () => {
  const g = bodyFatGoal(99.8, 30.2, 15)
  assert.ok(g !== null)
  assert.ok(close(g!.leanKg, 69.7), `leanKg ${g!.leanKg}`)
  assert.ok(close(g!.goalKg, 82.0), `goalKg ${g!.goalKg}`)
  assert.ok(close(g!.toLoseKg, 17.8), `toLoseKg ${g!.toLoseKg}`)
})

test('bodyFatGoal — déjà à la cible → rien à perdre', () => {
  const g = bodyFatGoal(80, 15, 15)
  assert.ok(g !== null)
  assert.ok(Math.abs(g!.toLoseKg) < 0.2, `toLoseKg ${g!.toLoseKg}`)
})

test('bodyFatGoal — sous la cible (plus lean) → toLose négatif', () => {
  const g = bodyFatGoal(80, 12, 15)
  assert.ok(g !== null && g!.toLoseKg < 0)
})

test('bodyFatGoal — données manquantes / invalides → null', () => {
  assert.equal(bodyFatGoal(null, 30, 15), null)
  assert.equal(bodyFatGoal(99.8, undefined, 15), null)
  assert.equal(bodyFatGoal(99.8, 30, null), null)
  assert.equal(bodyFatGoal(99.8, 30, 0), null)
  assert.equal(bodyFatGoal(99.8, 100, 15), null)
  assert.equal(bodyFatGoal(0, 30, 15), null)
})

test('mifflinBmr — Nicholas → 1863', () => {
  assert.equal(mifflinBmr({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M' }), 1863)
})

test('mifflinBmr — femme (−161)', () => {
  // 10×60 + 6.25×165 − 5×30 − 161 = 600 + 1031.25 − 150 − 161 = 1320.25 → 1320
  assert.equal(mifflinBmr({ weightKg: 60, heightCm: 165, age: 30, sex: 'F' }), 1320)
})

test('mifflinBmr — sexe/données manquantes → null', () => {
  assert.equal(mifflinBmr({ weightKg: 99.8, heightCm: 176, age: 48, sex: null }), null)
  assert.equal(mifflinBmr({ weightKg: null, heightCm: 176, age: 48, sex: 'M' }), null)
})

test('estimateMacros — Nicholas activité modérée, cible 82 kg', () => {
  const m = estimateMacros({
    weightKg: 99.8,
    heightCm: 176,
    age: 48,
    sex: 'M',
    activity: 'modere',
    goalKg: 82.0
  })
  assert.ok(m !== null)
  assert.equal(m!.bmr, 1863)
  assert.equal(m!.tdee, 2888)
  assert.equal(m!.targetKcal, 2310)
  assert.equal(m!.proteinG, 164)
  assert.equal(m!.fatG, 64)
  assert.equal(m!.carbsG, 270)
})

test('estimateMacros — sans goalKg utilise le poids actuel pour les protéines', () => {
  const m = estimateMacros({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M', activity: 'modere' })
  assert.ok(m !== null)
  assert.equal(m!.proteinG, Math.round(99.8 * 2.0)) // 200
})

test('estimateMacros — cible kcal jamais sous le BMR', () => {
  // Sédentaire : TDEE 1863×1.2 = 2236 ; 0.8× = 1789 < BMR 1863 → clampé au BMR.
  const m = estimateMacros({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M', activity: 'sedentaire' })
  assert.ok(m !== null && m!.targetKcal >= m!.bmr)
})

test('estimateMacros — activité/données manquantes → null', () => {
  assert.equal(estimateMacros({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M', activity: null }), null)
  assert.equal(estimateMacros({ weightKg: null, heightCm: 176, age: 48, sex: 'M', activity: 'modere' }), null)
})
