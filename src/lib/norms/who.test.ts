/**
 * Tests des seuils OMS — risque cardio-métabolique (tour de taille, ratio T/H).
 * Source : WHO 2008 + Santé Canada.
 *
 * Lancer : `node --test src/lib/norms/who.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateRiskBarPosition, getRatioRisk, getWaistRisk } from './who.ts'

// ── Tour de taille — Hommes ──────────────────────────────────────────────────
test('Waist H 80 → low', () => {
  assert.equal(getWaistRisk(80, 'M')?.level, 'low')
})
test('Waist H 95 → high', () => {
  assert.equal(getWaistRisk(95, 'M')?.level, 'high')
})
test('Waist H 102 (borne) → very_high', () => {
  assert.equal(getWaistRisk(102, 'M')?.level, 'very_high')
})
test('Waist H 110 → very_high', () => {
  assert.equal(getWaistRisk(110, 'M')?.level, 'very_high')
})

// ── Tour de taille — Femmes ──────────────────────────────────────────────────
test('Waist F 75 → low', () => {
  assert.equal(getWaistRisk(75, 'F')?.level, 'low')
})
test('Waist F 85 → high', () => {
  assert.equal(getWaistRisk(85, 'F')?.level, 'high')
})
test('Waist F 90 → very_high', () => {
  assert.equal(getWaistRisk(90, 'F')?.level, 'very_high')
})

// ── Ratio T/H — Hommes ───────────────────────────────────────────────────────
test('Ratio H 0.85 → low (sain)', () => {
  assert.equal(getRatioRisk(0.85, 'M')?.level, 'low')
})
test('Ratio H 0.95 → high (modéré)', () => {
  assert.equal(getRatioRisk(0.95, 'M')?.level, 'high')
})
test('Ratio H 1.05 → very_high (élevé)', () => {
  assert.equal(getRatioRisk(1.05, 'M')?.level, 'very_high')
})

// ── Ratio T/H — Femmes ───────────────────────────────────────────────────────
test('Ratio F 0.75 → low', () => {
  assert.equal(getRatioRisk(0.75, 'F')?.level, 'low')
})
test('Ratio F 0.83 → high', () => {
  assert.equal(getRatioRisk(0.83, 'F')?.level, 'high')
})
test('Ratio F 0.90 → very_high', () => {
  assert.equal(getRatioRisk(0.9, 'F')?.level, 'very_high')
})

// ── Valeurs invalides ────────────────────────────────────────────────────────
test('Waist 0 → null', () => {
  assert.equal(getWaistRisk(0, 'M'), null)
})
test('Ratio NaN → null', () => {
  assert.equal(getRatioRisk(Number.NaN, 'F'), null)
})

// ── Position du marqueur ─────────────────────────────────────────────────────
test('Nicholas waist 95 H → ~37 % (dans Élevé)', () => {
  const t = getWaistRisk(95, 'M')!.thresholds
  const pos = calculateRiskBarPosition(95, t)
  // Segment Élevé est 33.33 → 66.66 %, 95 entre 94 (low) et 102 (high)
  // → 33.33 + (95-94)/(102-94) × 33.33 = 33.33 + 4.17 = 37.5
  assert.ok(pos >= 33 && pos <= 42, `attendu 33-42, reçu ${pos}`)
})

test('Waist H 100 (presque très élevé) → ~58 %', () => {
  const t = getWaistRisk(100, 'M')!.thresholds
  const pos = calculateRiskBarPosition(100, t)
  // 33.33 + (100-94)/(102-94) × 33.33 = 33.33 + 25 = 58.33
  assert.ok(pos >= 55 && pos <= 65, `attendu 55-65, reçu ${pos}`)
})

test('Waist H 80 (sain) → premier segment (<33)', () => {
  const t = getWaistRisk(80, 'M')!.thresholds
  const pos = calculateRiskBarPosition(80, t)
  assert.ok(pos < 33, `attendu < 33, reçu ${pos}`)
})

test('Waist H 130 (très haut) → clampé à 100', () => {
  const t = getWaistRisk(130, 'M')!.thresholds
  const pos = calculateRiskBarPosition(130, t)
  assert.equal(pos, 100)
})
