import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cpaflaCombine,
  cpaflaCombineCategories,
  MUSCULO_WEIGHTS,
  BACK_HEALTH_WEIGHTS
} from './cpafla-combined.ts'

test('nomogramme = exemple résolu du guide (santé du dos : 23/28 → 3)', () => {
  // Guide CPHV, exemple p. Santé du dos (homme 29 ans) :
  // activité E(8) + taille E(4) + flexion A(1) + redress E(4) + dos TB(6) = 23 ; max 28.
  const s = cpaflaCombine([[4, 2], [4, 1], [1, 1], [4, 1], [3, 2]])
  assert.equal(s, 3)
})

test('nomogramme = même exemple via catégories', () => {
  const s = cpaflaCombineCategories([
    ['EXCELLENT', 2], ['EXCELLENT', 1], ['ACCEPTABLE', 1], ['EXCELLENT', 1], ['TRES_BIEN', 2]
  ])
  assert.equal(s, 3)
})

test('nomogramme = musculo obtenue 13 → 2 (exemple du guide)', () => {
  // note obtenue 13 = 6+3+2+1+1, note max 24 = 8+4+4+4+4 ; 13/24×4 = 2.167 → 2.
  assert.equal(cpaflaCombine([[3, 2], [3, 1], [2, 1], [1, 1], [1, 1]]), 2)
})

test('arrondi à la demie inférieure : 3.5 → 3, 2.5 → 2, 0.5 → 0', () => {
  assert.equal(cpaflaCombine([[3, 2], [4, 2]]), 3) // 14/16×4 = 3.5 → 3
  assert.equal(cpaflaCombine([[2, 2], [3, 2]]), 2) // 10/16×4 = 2.5 → 2
  assert.equal(cpaflaCombine([[1, 1], [0, 7]]), 0) // 1/32×4 = 0.125 → 0
  assert.equal(cpaflaCombine([[4, 1], [4, 1]]), 4) // ratio 1 → 4
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
