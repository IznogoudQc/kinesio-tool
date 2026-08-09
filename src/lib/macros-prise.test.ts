/**
 * Répartition des macros entre repas et collations.
 *
 * Testé parce que le défaut d'origine était invisible : diviser 1 967 kcal par
 * 3 repas donne 656, un chiffre parfaitement plausible — sauf qu'il ne restait
 * rien pour la collation, et que 3 × 656 = la journée entière.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { macrosParPrise, DEFAULT_RATIO_COLLATION, type MacroEstimate } from './nutrition.ts'

/** Le cas réel de la capture de Nicholas (2026-08-08). */
const JOUR: MacroEstimate = {
  bmr: 0,
  tdee: 0,
  targetKcal: 1967,
  proteinG: 165,
  fatG: 80,
  carbsG: 147,
  fiberG: 28
}

test('sans collation — le calcul ne change pas', () => {
  // Garde-fou de non-régression : qui n'utilise pas les collations ne doit voir
  // aucun de ses chiffres bouger.
  const r = macrosParPrise(JOUR, 3, 0)
  assert.equal(r.parts, 3)
  assert.equal(r.repas.targetKcal, Math.round(1967 / 3))
  assert.equal(r.collation, null, 'une collation apparaît alors qu’il n’y en a pas')
})

test('3 repas + 1 collation — la collation vaut la moitié d’un repas', () => {
  const r = macrosParPrise(JOUR, 3, 1, 50)
  assert.equal(r.parts, 3.5)
  assert.equal(r.repas.targetKcal, 562)
  assert.equal(r.collation?.targetKcal, 281)
  assert.equal(r.collation!.targetKcal * 2, r.repas.targetKcal, 'le rapport ½ n’est pas respecté')
})

test('la journée se retrouve dans les parts, à l’arrondi près', () => {
  // C'est le point qui manquait : la somme des prises doit faire la journée.
  for (const [repas, coll] of [[3, 1], [3, 2], [2, 1], [1, 3], [3, 0]] as [number, number][]) {
    const r = macrosParPrise(JOUR, repas, coll)
    const total = r.repas.targetKcal * repas + (r.collation?.targetKcal ?? 0) * coll
    assert.ok(
      Math.abs(total - JOUR.targetKcal) <= repas + coll,
      `${repas} repas + ${coll} collations → ${total} kcal au lieu de ${JOUR.targetKcal}`
    )
  }
})

test('le ratio choisi par Marie change la part de la collation', () => {
  const tiers = macrosParPrise(JOUR, 3, 1, 33)
  const deuxTiers = macrosParPrise(JOUR, 3, 1, 67)
  assert.ok(tiers.collation!.targetKcal < deuxTiers.collation!.targetKcal)
  // Plus la collation pèse, moins il reste par repas.
  assert.ok(tiers.repas.targetKcal > deuxTiers.repas.targetKcal)
})

test('le ratio par défaut est la moitié', () => {
  assert.equal(DEFAULT_RATIO_COLLATION, 50)
  const a = macrosParPrise(JOUR, 3, 1)
  const b = macrosParPrise(JOUR, 3, 1, 50)
  assert.deepEqual(a, b)
})

test('des valeurs aberrantes ne produisent ni NaN ni division par zéro', () => {
  for (const [r, c, ratio] of [[0, 0, 50], [1, 0, 0], [3, 1, -10], [3, 1, 999]] as [number, number, number][]) {
    const out = macrosParPrise(JOUR, r, c, ratio)
    assert.ok(Number.isFinite(out.repas.targetKcal), `NaN pour ${r}/${c}/${ratio}`)
    assert.ok(out.repas.targetKcal > 0, `part nulle pour ${r}/${c}/${ratio}`)
  }
})

test('toutes les macros sont réparties, pas seulement les calories', () => {
  const r = macrosParPrise(JOUR, 3, 1, 50)
  for (const k of ['proteinG', 'fatG', 'carbsG', 'fiberG'] as const) {
    assert.ok(r.repas[k] > 0, `${k} non réparti`)
    assert.ok(r.collation![k] > 0, `${k} absent de la collation`)
    assert.ok(r.collation![k] < r.repas[k], `${k} : la collation pèse autant qu'un repas`)
  }
})
