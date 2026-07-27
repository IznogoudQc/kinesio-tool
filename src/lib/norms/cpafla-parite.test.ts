/** Parité avec l'ancien logiciel de Marie — indice de santé du dos et aptitude
 *  musculosquelettique.
 *
 *  Étalons extraits des rapports Word réellement produits par le logiciel d'origine
 *  (Nicholas Jean, homme, 176 cm) — voir ADR 0028. Ces tests échouent si l'on
 *  réintroduit un arrondi, si l'on change les pondérations, ou si l'on recote le
 *  tour de taille autrement que par les tables de composition (Fig. 7-4).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpaflaCombine, MUSCULO_WEIGHTS, BACK_HEALTH_WEIGHTS, type CpaflaContribution } from './cpafla-combined.ts'
import { cpaflaWaistPoints } from './cpafla-composition.ts'

const H_M = 1.76
const imcOf = (kg: number): number => kg / (H_M * H_M)

/** Cotes 0-4 des tests, telles qu'imprimées par l'ancien rapport. */
interface Cotes {
  flexion_tronc_cm?: number
  situps?: number
  endurance_dos_sec?: number
  pushups?: number
  puissance_jambes_watts?: number
}

/** Reconstruit un composite comme le fait `bilan-computed` : le tour de taille est
 *  coté via Fig. 7-4 (donc selon l'IMC), les autres via leur catégorie. */
function composite(
  weights: Record<string, number>,
  cotes: Cotes,
  waistPts: number | null
): number | null {
  const contribs: CpaflaContribution[] = Object.entries(weights).map(([k, w]) =>
    k === 'tour_taille_cm' ? [waistPts, w] : [(cotes as Record<string, number | undefined>)[k] ?? null, w]
  )
  return cpaflaCombine(contribs)
}

const round1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10)

// ── Cote du tour de taille (Fig. 7-4, dépend de la bande d'IMC) ───────────────

test('tour de taille coté par les tables de composition (homme, IMC ≈ 30-32)', () => {
  assert.equal(cpaflaWaistPoints(imcOf(91.8), 93, 'M'), 4) // IMC 29,6 · < 94 cm
  assert.equal(cpaflaWaistPoints(imcOf(93.9), 97, 'M'), 2) // IMC 30,3 · 94–101
  assert.equal(cpaflaWaistPoints(imcOf(94.7), 99, 'M'), 2)
  assert.equal(cpaflaWaistPoints(imcOf(96.1), 100, 'M'), 2)
  assert.equal(cpaflaWaistPoints(imcOf(99.8), 103, 'M'), 0) // IMC 32,2 · > 101
  assert.equal(cpaflaWaistPoints(imcOf(91.8), null, 'M'), null) // pas de mesure
})

// ── Indice de santé du dos ────────────────────────────────────────────────────

test('indice de santé du dos = rapports de l’ancien logiciel', () => {
  const dos = (kg: number, ct: number, cotes: Cotes) =>
    round1(composite(BACK_HEALTH_WEIGHTS.M, cotes, cpaflaWaistPoints(imcOf(kg), ct, 'M')))

  // 4 sept. 2025 — taille 103 (0) + flexion Acceptable (1) + redress Excellent (4)
  //                + extenseurs Excellent (4×2) = 13 ; max 20 → 2,6.
  assert.equal(dos(99.8, 103, { flexion_tronc_cm: 1, situps: 4, endurance_dos_sec: 4 }), 2.6)

  // 25 juin 2026 — taille 93 (4) + flexion Bien (2) + redress Excellent (4)
  //                + extenseurs Excellent (4×2) = 18 ; max 20 → 3,6.
  assert.equal(dos(91.8, 93, { flexion_tronc_cm: 2, situps: 4, endurance_dos_sec: 4 }), 3.6)

  // Bilans où seul le tour de taille est mesuré → le score EST sa cote.
  assert.equal(dos(96.1, 100, {}), 2)
  assert.equal(dos(94.7, 99, {}), 2)
  assert.equal(dos(93.9, 97, {}), 2)
})

// ── Aptitude musculosquelettique globale ──────────────────────────────────────

test('aptitude musculosquelettique = rapports de l’ancien logiciel', () => {
  const musculo = (cotes: Cotes) => round1(composite(MUSCULO_WEIGHTS.M, cotes, null))

  // 17 août 2011 — bras TB (3×2) + flexion Bien (2) + redress Exc (4)
  //                + extenseurs Acceptable (1) + puissance Exc (4) = 17 ; max 24 → 2,8.
  assert.equal(musculo({
    pushups: 3, flexion_tronc_cm: 2, situps: 4, endurance_dos_sec: 1, puissance_jambes_watts: 4
  }), 2.8)

  // 4 sept. 2025 — 21/24 → 3,5.
  assert.equal(musculo({
    pushups: 4, flexion_tronc_cm: 1, situps: 4, endurance_dos_sec: 4, puissance_jambes_watts: 4
  }), 3.5)

  // 25 juin 2026 — 22/24 → 3,7.
  assert.equal(musculo({
    pushups: 4, flexion_tronc_cm: 2, situps: 4, endurance_dos_sec: 4, puissance_jambes_watts: 4
  }), 3.7)
})
