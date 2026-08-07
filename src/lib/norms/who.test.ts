/**
 * Tests du risque cardio-métabolique — tour de taille, ratio T/H.
 *
 * Depuis le 2026-08-04, le **tour de taille** suit les normes de Statistique
 * Canada (variable HWMDWSTA — voir `clinical.ts`) ; seul le **ratio** reste sur
 * les seuils OMS 2008.
 *
 * À noter : aucun test d'origine ne sondait 88-89 cm chez les femmes ni la borne
 * haute exacte, si bien qu'un changement de seuil leur restait invisible. Les
 * tests ajoutés en fin de fichier comparent la barre à la cote sur toute la
 * plage, et vérifient que la borne haute est bien inclusive.
 *
 * Lancer : `node --test src/lib/norms/who.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateRiskBarPosition, getRatioRisk, getWaistRisk, WAIST_RISK_LABELS, WHO_RISK_LABELS } from './who.ts'
import { waistRating, WAIST_BOUNDS } from './clinical.ts'

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

// ── Ajouts 2026-08-04 — cohérence avec le barème de Marie ───────────────────

test('la barre du tour de taille et la cote disent la même chose', () => {
  // Le projet a compté jusqu'à quatre tables de tour de taille. Celle-ci était
  // la dernière à garder 88 cm chez les femmes là où l'ancien logiciel dit 90 :
  // la carte Mesures affichait donc une catégorie, le bilan une autre.
  for (const sex of ['M', 'F'] as const) {
    for (let cm = 60; cm <= 160; cm += 0.5) {
      const barre = getWaistRisk(cm, sex)
      const cote = waistRating(cm, sex)
      assert.ok(barre && cote)
      assert.equal(
        WAIST_RISK_LABELS[barre.level],
        cote.label,
        'désaccord à ' + cm + ' cm (' + sex + ') — la barre et la cote ont divergé'
      )
    }
  }
})

test('les bornes de la barre viennent du barème, pas d’une copie', () => {
  for (const sex of ['M', 'F'] as const) {
    const [excellent, hautPotentiel] = WAIST_BOUNDS[sex]
    assert.equal(getWaistRisk(excellent - 0.1, sex)?.level, 'low')
    assert.equal(getWaistRisk(excellent, sex)?.level, 'high')
    // Borne haute INCLUSE : c'est au-delà que la classe change.
    assert.equal(getWaistRisk(hautPotentiel, sex)?.level, 'high')
    assert.equal(getWaistRisk(hautPotentiel + 0.1, sex)?.level, 'very_high')
  }
})

test('la plage 88-89 cm chez les femmes — celle qui manquait', () => {
  // Trou des tests d'origine : aucun ne sondait cette plage. Sous Statistique
  // Canada (« plus de 87 »), elle est « Risque considérable ».
  assert.equal(getWaistRisk(87, 'F')?.level, 'high')
  assert.equal(getWaistRisk(88, 'F')?.level, 'very_high')
  assert.equal(getWaistRisk(89, 'F')?.level, 'very_high')
})

test('le ratio taille/hanche garde ses seuils ET ses libellés OMS', () => {
  // Seul le tour de taille a changé de référentiel.
  assert.equal(WHO_RISK_LABELS.high, 'Élevé')
  assert.notEqual(WHO_RISK_LABELS.high, WAIST_RISK_LABELS.high)
  assert.equal(getRatioRisk(0.86, 'F')?.level, 'very_high')
})
