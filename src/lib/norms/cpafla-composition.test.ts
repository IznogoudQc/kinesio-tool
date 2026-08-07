import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpaflaComposition, cpaflaCompositionDetail } from './cpafla-composition.ts'

test('exemple du guide — femme IMC 25,8 · CT 91 · S5PC 116,6 → 1 (Acceptable)', () => {
  // Fig 7-5, plage 25-29,9 : CT 91 (>87) → B=1 ; S5PC 116,6 (>113) → C=2.
  // (1×1,5 + 2)/2,5 = 1,4 → arrondi → 1.
  assert.equal(cpaflaComposition({ imc: 25.8, ct: 91, s5pc: 116.6, sex: 'F' }), 1)
})

test('homme mince — IMC 22 · CT 80 · S5PC 40 → 4 (Excellent)', () => {
  // Plage 18,5-24,9 : CT 80 (<94) → B=4 ; S5PC 40 (<54) → C=4. (4×1,5+4)/2,5 = 4.
  assert.equal(cpaflaComposition({ imc: 22, ct: 80, s5pc: 40, sex: 'M' }), 4)
})

test('combinaison IMC + CT (pas de S5PC) → points colonne B', () => {
  // Homme IMC 27 (25-29,9), CT 96 (94-101) → B=3.
  assert.equal(cpaflaComposition({ imc: 27, ct: 96, s5pc: null, sex: 'M' }), 3)
})

test('combinaison IMC + S5PC (pas de CT) → points colonne C', () => {
  // Homme IMC 27, S5PC 60 (54-77) → C=3.
  assert.equal(cpaflaComposition({ imc: 27, ct: null, s5pc: 60, sex: 'M' }), 3)
})

test('CT seule → évaluée dans la plage IMC 27 (25-29,9)', () => {
  // Homme, CT 90 (<94) dans la plage 25-29,9 → B=4.
  assert.equal(cpaflaComposition({ imc: null, ct: 90, s5pc: null, sex: 'M' }), 4)
  // CT 105 (>101) → B=1.
  assert.equal(cpaflaComposition({ imc: null, ct: 105, s5pc: null, sex: 'M' }), 1)
})

test('IMC seul → colonne A', () => {
  assert.equal(cpaflaComposition({ imc: 22, ct: null, s5pc: null, sex: 'M' }), 4) // 18,5-24,9 → A=4
  assert.equal(cpaflaComposition({ imc: 31, ct: null, s5pc: null, sex: 'M' }), 2) // 30-32,4 → A=2
  assert.equal(cpaflaComposition({ imc: 40, ct: null, s5pc: null, sex: 'F' }), 0) // >35 → A=0
})

test('bornes de plage d’IMC (34,9 → plage 32,5-34,9 ; 35,0 → dernière plage)', () => {
  // Corrigé le 2026-08-04 : Statistique Canada écrit « BMI > 34,99 », donc 35,0
  // appartient à la DERNIÈRE plage. Notre borne était à 35,05, ce qui plaçait
  // 35,0 un cran trop bas — et affectait les points A et B, pas seulement les plis.
  assert.equal(cpaflaComposition({ imc: 34.9, ct: null, s5pc: null, sex: 'M' }), 1) // 32,5-34,9 → A=1
  assert.equal(cpaflaComposition({ imc: 35.0, ct: null, s5pc: null, sex: 'M' }), 0) // ≥35 → A=0
  assert.equal(cpaflaComposition({ imc: 35.3, ct: null, s5pc: null, sex: 'M' }), 0)
})

test('sexe / mesures manquants → null', () => {
  assert.equal(cpaflaComposition({ imc: 25, ct: 90, s5pc: 100, sex: null }), null)
  assert.equal(cpaflaComposition({ imc: null, ct: null, s5pc: 100, sex: 'M' }), null)
})

// ── Vérification contre Statistique Canada (2026-08-04) ─────────────────────
// Enquête canadienne sur les mesures de la santé, variable dérivée SFMDS5A
// (« Somme de 5 mesures des plis cutanés — Normes »), tableau 21. C'est la
// spécification publique du même barème que les figures 7-4 / 7-5, transcrite
// ici en conditions littérales. Elle a révélé trois écarts de borne, corrigés :
//   • IMC 35,0 appartenait chez nous à la bande 32,5-35,0 ; StatCan le place
//     dans la dernière bande (« BMI > 34,99 »).
//   • Une somme de 55 mm (hommes) et de 84 mm (femmes) sous IMC 18,5 valait 3
//     chez nous, 4 chez StatCan.

function pointsPlisStatCan(sex: 'M' | 'F', bmi: number, s5: number): number | null {
  if (sex === 'M') {
    if (bmi > 34.99 && s5 > 77.0) return 0
    if (bmi > 32.49 && bmi < 35.0 && s5 > 77.0) return 1
    if ((bmi < 32.5 && s5 > 77.0) || (bmi > 32.49 && bmi < 35.0 && s5 > 53.9 && s5 < 77.1)) return 2
    if (
      (bmi < 18.5 && (s5 < 25.0 || (s5 > 55.0 && s5 < 77.1))) ||
      (bmi > 18.49 && bmi < 32.5 && s5 > 53.9 && s5 < 77.1)
    ) {
      return 3
    }
    if ((bmi < 18.5 && s5 > 24.9 && s5 < 55.1) || (bmi > 18.49 && s5 > 0 && s5 < 54.0)) return 4
    return null
  }
  if (bmi > 34.99 && s5 > 113.0) return 0
  if (bmi > 32.49 && bmi < 35.0 && s5 > 113.0) return 1
  if ((bmi < 32.5 && s5 > 113.0) || (bmi > 32.49 && bmi < 35.0 && s5 > 82.9 && s5 < 113.1)) return 2
  if (
    (bmi < 18.5 && (s5 < 46.0 || (s5 > 84.0 && s5 < 113.1))) ||
    (bmi > 18.49 && bmi < 32.5 && s5 > 82.9 && s5 < 113.1)
  ) {
    return 3
  }
  if ((bmi < 18.5 && s5 > 45.9 && s5 < 84.1) || (bmi > 18.49 && s5 > 0 && s5 < 83.0)) return 4
  return null
}

test('colonne des plis — accord total avec Statistique Canada (tableau 21)', () => {
  const ecarts: string[] = []
  let compares = 0
  for (const sex of ['M', 'F'] as const) {
    for (let bmi = 16; bmi <= 40; bmi += 0.25) {
      for (let s5 = 15; s5 <= 140; s5 += 0.5) {
        const attendu = pointsPlisStatCan(sex, bmi, s5)
        if (attendu === null) continue // combinaison non couverte par la spec
        const nous = cpaflaCompositionDetail({ sex, imc: bmi, ct: 95, s5pc: s5 }).c
        if (nous === null) continue
        compares++
        if (nous !== attendu) ecarts.push(`${sex} IMC ${bmi} S5 ${s5} : ${nous} ≠ ${attendu}`)
      }
    }
  }
  assert.ok(compares > 40000, `couverture trop faible : ${compares}`)
  assert.deepEqual(ecarts.slice(0, 5), [], `${ecarts.length} écarts avec Statistique Canada`)
})

test('bandes d’IMC — 35,0 tombe dans la dernière, pas dans 32,5-34,9', () => {
  // StatCan écrit « BMI > 34,99 ». Notre borne était à 35,05, ce qui plaçait
  // 35,0 un cran trop bas — et changeait aussi les points A et B, pas seulement
  // ceux des plis.
  for (const sex of ['M', 'F'] as const) {
    const seuil = sex === 'M' ? 78 : 114
    assert.equal(cpaflaCompositionDetail({ sex, imc: 34.9, ct: 95, s5pc: seuil }).c, 1)
    assert.equal(cpaflaCompositionDetail({ sex, imc: 35.0, ct: 95, s5pc: seuil }).c, 0)
  }
})

test('sous IMC 18,5 — la borne haute du « 4 » est incluse', () => {
  assert.equal(cpaflaCompositionDetail({ sex: 'M', imc: 18, ct: 80, s5pc: 55 }).c, 4)
  assert.equal(cpaflaCompositionDetail({ sex: 'M', imc: 18, ct: 80, s5pc: 55.5 }).c, 3)
  assert.equal(cpaflaCompositionDetail({ sex: 'F', imc: 18, ct: 75, s5pc: 84 }).c, 4)
  assert.equal(cpaflaCompositionDetail({ sex: 'F', imc: 18, ct: 75, s5pc: 84.5 }).c, 3)
})
