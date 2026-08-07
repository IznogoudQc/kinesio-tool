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

/**
 * Tableau 14 (HWMDWSTA, « Tour de taille — Normes »), règles évaluées dans
 * l'ordre 0 → 4, première atteinte — comme une spécification de variable dérivée.
 *
 * ⚠️ Coquille dans la page source : la ligne « 1 » répète chez la femme
 * l'intervalle 79,9-87,1, identique à la ligne « 3 ». Lue au pied de la lettre,
 * elle laisse 5 796 combinaisons sans aucune règle applicable — une femme d'IMC
 * normal à plus de 87 cm ne serait couverte par rien. On lit donc « > 87 », par
 * symétrie avec les hommes (« > 101 »), ce qui rend la spécification complète.
 */
function pointsTourDeTailleStatCan(sex: 'M' | 'F', bmi: number, w: number): number | null {
  const M = sex === 'M'
  if (bmi > 29.99 && ((M && w > 101.0) || (!M && w > 87.0))) return 0
  if (bmi > 18.49 && bmi < 30.0 && ((M && w > 101.0) || (!M && w > 87.0))) return 1
  if (bmi > 29.99 && ((M && w > 93.9 && w < 101.1) || (!M && w > 79.9 && w < 87.1))) return 2
  if (
    M
      ? bmi < 18.5 || (bmi > 18.49 && bmi < 30.0 && w > 93.9 && w < 101.1)
      : bmi < 18.5 || (bmi > 18.49 && bmi < 30.0 && w > 79.9 && w < 87.1)
  ) {
    return 3
  }
  if ((M && w > 0 && w < 94.0) || (!M && w > 0 && w < 80.0)) return 4
  return null
}

test('colonne du tour de taille — accord total avec Statistique Canada (tableau 14)', () => {
  // C'est LA colonne qui compte : Marie ne mesurant pas le mollet, la note de
  // composition vaut exactement ces points. Nos 6 bilans réels n'en couvraient
  // que 4 cases sur 36 ; cette spécification couvre le reste.
  const ecarts: string[] = []
  let compares = 0
  for (const sex of ['M', 'F'] as const) {
    for (let bmi = 16; bmi <= 42; bmi += 0.25) {
      for (let w = 60; w <= 150; w += 0.5) {
        const attendu = pointsTourDeTailleStatCan(sex, bmi, w)
        assert.notEqual(attendu, null, `aucune règle pour ${sex} IMC ${bmi} TT ${w}`)
        const nous = cpaflaCompositionDetail({ sex, imc: bmi, ct: w, s5pc: null }).b
        compares++
        if (nous !== attendu) ecarts.push(`${sex} IMC ${bmi} TT ${w} : ${nous} ≠ ${attendu}`)
      }
    }
  }
  assert.ok(compares > 35000, `couverture trop faible : ${compares}`)
  assert.deepEqual(ecarts.slice(0, 5), [], `${ecarts.length} écarts avec Statistique Canada`)
})

test('tour de taille — les cases courantes que nos bilans ne couvraient pas', () => {
  // Un homme en surpoids avec un tour de taille modéré : profil très fréquent,
  // et aucun de nos 6 bilans ne le traverse. Confirmé à 3 points.
  assert.equal(cpaflaCompositionDetail({ sex: 'M', imc: 27, ct: 97, s5pc: null }).b, 3)
  assert.equal(cpaflaCompositionDetail({ sex: 'M', imc: 22, ct: 105, s5pc: null }).b, 1)
  assert.equal(cpaflaCompositionDetail({ sex: 'F', imc: 27, ct: 84, s5pc: null }).b, 3)
  assert.equal(cpaflaCompositionDetail({ sex: 'F', imc: 22, ct: 92, s5pc: null }).b, 1)
  // Un tour de taille sous le seuil vaut 4, quel que soit l'IMC — sauf en
  // maigreur, où la règle « IMC < 18,5 → 3 » passe avant.
  assert.equal(cpaflaCompositionDetail({ sex: 'M', imc: 38, ct: 90, s5pc: null }).b, 4)
  assert.equal(cpaflaCompositionDetail({ sex: 'M', imc: 17, ct: 80, s5pc: null }).b, 3)
})

test('résultat publié à une décimale (Statistique Canada, tableau 16)', () => {
  // Round((B × 1,5 + C) / 2,5, .1) — une décimale, pas un entier. `score` reste
  // la cote entière, qui seule entre dans le score global.
  const d = cpaflaCompositionDetail({ sex: 'F', imc: 25.8, ct: 91, s5pc: 40 })
  assert.equal(d.combo, 'imc+ct+s5pc')
  assert.equal(d.b, 1)
  assert.equal(d.c, 4)
  assert.equal(d.valeur, 2.2) // (1×1,5 + 4) ÷ 2,5
  assert.equal(d.score, 2)
})

test('la cote entière et la classification ne se contredisent jamais', () => {
  // Les bornes de classification tombent sur les demis (< 0,5 · < 1,5 …) et
  // Math.round arrondit le demi vers le haut : les deux coïncident toujours.
  // Si ce n'était pas le cas, la carte afficherait 3,6 « Très bien » pendant que
  // le score global compterait 4.
  for (const sex of ['M', 'F'] as const) {
    for (let b = 0; b <= 4; b++) {
      for (let c = 0; c <= 4; c++) {
        const brut = (b * 1.5 + c) / 2.5
        const attendu = brut < 0.5 ? 0 : brut < 1.5 ? 1 : brut < 2.5 ? 2 : brut < 3.5 ? 3 : 4
        assert.equal(Math.round(brut), attendu, `${sex} B=${b} C=${c} → ${brut}`)
      }
    }
  }
})

test('sans les cinq plis, la valeur reste entière', () => {
  // Marie ne mesure pas le mollet : c'est le cas courant. Aucune décimale ne
  // doit apparaître là où la note vaut simplement la colonne B.
  const d = cpaflaCompositionDetail({ sex: 'M', imc: 29.6, ct: 93, s5pc: null })
  assert.equal(d.combo, 'imc+ct')
  assert.equal(d.valeur, 4)
  assert.equal(d.score, 4)
})
