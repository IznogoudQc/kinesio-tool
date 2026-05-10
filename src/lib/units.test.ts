/**
 * Tests des conversions d'unités.
 *
 * Lancer : `node --test src/lib/units.test.ts` (Node ≥ 22.6 — strip-types).
 *
 * Vérifie l'invariant clé : la DB stocke en métrique (cm, kg) et un aller-retour
 * saisie → stockage → réaffichage redonne la valeur saisie à 0,1 près.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cmToIn,
  cmToLengthInput,
  formatLength,
  formatWeight,
  inToCm,
  kgToLb,
  kgToWeightInput,
  lbToKg,
  lengthInputToCm,
  weightInputToKg
} from './units.ts'

const close = (a: number, b: number, eps = 0.1): boolean => Math.abs(a - b) <= eps

test('conversions de base longueur', () => {
  assert.ok(close(inToCm(1), 2.54))
  assert.ok(close(cmToIn(2.54), 1))
  assert.ok(close(inToCm(38), 96.52))
})

test('conversions de base poids', () => {
  assert.ok(close(kgToLb(1), 2.2046226218))
  assert.ok(close(lbToKg(2.2046226218), 1))
  assert.ok(close(lbToKg(220), 99.79, 0.01))
})

test('aller-retour : client en pouces / livres (220 lb, 38 po)', () => {
  // Saisie utilisateur en unités préférées → stockage métrique
  const poidsKg = weightInputToKg(220, 'lb')
  const tailleCm = lengthInputToCm(38, 'in')

  // En base : doit être stocké en kg / cm, pas en lb / po
  assert.ok(close(poidsKg, 99.79, 0.01), `poids stocké ${poidsKg} kg`)
  assert.ok(close(tailleCm, 96.52, 0.01), `taille stockée ${tailleCm} cm`)
  assert.notEqual(Math.round(poidsKg), 220)
  assert.notEqual(Math.round(tailleCm), 38)

  // Réaffichage : on relit le métrique et on reconvertit → on retrouve 220 lb / 38 po
  assert.ok(close(kgToWeightInput(poidsKg, 'lb'), 220), `réaffichage ${kgToWeightInput(poidsKg, 'lb')} lb`)
  assert.ok(close(cmToLengthInput(tailleCm, 'in'), 38), `réaffichage ${cmToLengthInput(tailleCm, 'in')} po`)
  assert.equal(formatWeight(poidsKg, 'lb'), '220')
  assert.equal(formatLength(tailleCm, 'in'), '38')
})

test('client en métrique : aucune conversion, valeur exacte', () => {
  assert.equal(lengthInputToCm(97.1, 'cm'), 97.1)
  assert.equal(weightInputToKg(74.5, 'kg'), 74.5)
  assert.equal(cmToLengthInput(97.1, 'cm'), 97.1)
  assert.equal(kgToWeightInput(74.5, 'kg'), 74.5)
  assert.equal(formatLength(97.1, 'cm'), '97,1')
  assert.equal(formatWeight(74.5, 'kg'), '74,5')
})

test('valeurs nulles → tiret', () => {
  assert.equal(formatLength(null, 'cm'), '—')
  assert.equal(formatLength(null, 'in'), '—')
  assert.equal(formatWeight(null, 'kg'), '—')
  assert.equal(formatWeight(null, 'lb'), '—')
})
