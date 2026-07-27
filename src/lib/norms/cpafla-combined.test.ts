import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cpaflaCombine,
  cpaflaCombineCategories,
  cpaflaNomogramme,
  cpaflaCombineDetail,
  MUSCULO_WEIGHTS,
  BACK_HEALTH_WEIGHTS
} from './cpafla-combined.ts'

const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`)

test('exemple résolu du guide (santé du dos : 23/28) — brut puis nomogramme', () => {
  // Guide CPHV, exemple p. Santé du dos (homme 29 ans) :
  // activité E(8) + taille E(4) + flexion A(1) + redress E(4) + dos TB(6) = 23 ; max 28.
  const s = cpaflaCombine([[4, 2], [4, 1], [1, 1], [4, 1], [3, 2]])
  near(s, (23 / 28) * 4) // 3.2857… — valeur affichée par le logiciel d'origine
  assert.equal(cpaflaNomogramme(s), 3) // grille du guide
})

test('même exemple via catégories', () => {
  const s = cpaflaCombineCategories([
    ['EXCELLENT', 2], ['EXCELLENT', 1], ['ACCEPTABLE', 1], ['EXCELLENT', 1], ['TRES_BIEN', 2]
  ])
  assert.equal(cpaflaNomogramme(s), 3)
})

test('musculo obtenue 13/24 → nomogramme 2 (exemple du guide)', () => {
  // note obtenue 13 = 6+3+2+1+1, note max 24 = 8+4+4+4+4 ; 13/24×4 = 2.167 → 2.
  const s = cpaflaCombine([[3, 2], [3, 1], [2, 1], [1, 1], [1, 1]])
  near(s, (13 / 24) * 4)
  assert.equal(cpaflaNomogramme(s), 2)
})

test('le score garde ses décimales (le logiciel d’origine affiche 3,6 — pas 4)', () => {
  // Nicholas, 25 juin 2026 : taille E(4) + flexion B(2) + redress E(4) + dos E(4×2)
  // = 18 ; max 20 → 3,6. Un arrondi nomogramme donnerait 4 (régression corrigée).
  const s = cpaflaCombine([[4, 1], [2, 1], [4, 1], [4, 2]])
  near(s, 3.6)
  assert.equal(cpaflaNomogramme(s), 4)
})

test('nomogramme : arrondi à la demie inférieure (3.5 → 3, 2.5 → 2, 0.5 → 0)', () => {
  assert.equal(cpaflaNomogramme(cpaflaCombine([[3, 2], [4, 2]])), 3) // 14/16×4 = 3.5 → 3
  assert.equal(cpaflaNomogramme(cpaflaCombine([[2, 2], [3, 2]])), 2) // 10/16×4 = 2.5 → 2
  assert.equal(cpaflaNomogramme(cpaflaCombine([[1, 1], [0, 7]])), 0) // 1/32×4 = 0.125 → 0
  assert.equal(cpaflaCombine([[4, 1], [4, 1]]), 4) // ratio 1 → 4
  assert.equal(cpaflaNomogramme(null), null)
})

test('tests non mesurés (null) exclus de la note obtenue ET de la note max', () => {
  // Seul un test présent, coté Excellent → score plein.
  assert.equal(cpaflaCombine([[null, 2], [4, 1]]), 4)
  // Aucun test présent → null.
  assert.equal(cpaflaCombine([[null, 2], [null, 1]]), null)
  assert.equal(cpaflaCombine([]), null)
})

test('pondérations : extension des bras ×2 (H), flexion ×2 (F) — musculo', () => {
  assert.equal(MUSCULO_WEIGHTS.M.pushups, 2)
  assert.equal(MUSCULO_WEIGHTS.M.flexion_tronc_cm, 1)
  assert.equal(MUSCULO_WEIGHTS.F.flexion_tronc_cm, 2)
  assert.equal(MUSCULO_WEIGHTS.F.pushups, 1)
  // Préhension jamais présente (exclue).
  assert.equal('prehension' in MUSCULO_WEIGHTS.M, false)
})

test('pondérations : extension du dos ×2 partout ; taille ×2 chez la femme — dos', () => {
  assert.equal(BACK_HEALTH_WEIGHTS.M.endurance_dos_sec, 2)
  assert.equal(BACK_HEALTH_WEIGHTS.F.endurance_dos_sec, 2)
  assert.equal(BACK_HEALTH_WEIGHTS.M.tour_taille_cm, 1)
  assert.equal(BACK_HEALTH_WEIGHTS.F.tour_taille_cm, 2)
  // Activité physique jamais présente (exclue).
  assert.equal('activite' in BACK_HEALTH_WEIGHTS.M, false)
})

test('le détail explique exactement le score affiché (aucune divergence possible)', () => {
  // Nicholas, 25 juin 2026 — musculo : bras E(4)×2 + flexion B(2) + redress E(4)
  // + endurance E(4) + puissance E(4) = 22 ; max 24 → 3,67 → affiché 3,7.
  const contribs: [string, number | null, number][] = [
    ['pushups', 4, 2],
    ['flexion_tronc_cm', 2, 1],
    ['situps', 4, 1],
    ['endurance_dos_sec', 4, 1],
    ['puissance_jambes_watts', 4, 1]
  ]
  const d = cpaflaCombineDetail(contribs)
  assert.equal(d.obtenue, 22)
  assert.equal(d.max, 24)
  near(d.score, (22 / 24) * 4)
  // Invariant : le détail et le calcul simple donnent le MÊME score.
  near(d.score, cpaflaCombine(contribs.map(([, s, w]) => [s, w])) as number)
})

test('détail : un test non mesuré sort des DEUX totaux et est signalé', () => {
  const d = cpaflaCombineDetail([
    ['pushups', 4, 2],
    ['situps', null, 1], // non mesuré
    ['endurance_dos_sec', 2, 1]
  ])
  assert.equal(d.obtenue, 10) // 8 + 2
  assert.equal(d.max, 12) // 8 + 4 — le test absent ne gonfle pas le maximum
  const absent = d.rows.find(r => r.key === 'situps')
  assert.equal(absent?.cote, null)
  assert.equal(absent?.points, null)
})
