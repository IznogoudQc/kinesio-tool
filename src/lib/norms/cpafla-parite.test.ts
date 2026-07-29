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

// ── Santé et condition physique globale (structure reconstituée, ADR 0030) ────

import { computeBilan, type BilanProfile } from '../bilan-computed.ts'
import { systolicRatingLegacy } from './clinical.ts'

const round1g = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10)

test('score global = rapports de l’ancien logiciel (bilans complets)', () => {
  const P: BilanProfile = { age: 49, sex: 'M', norms: 'cpafla' }
  // 25 juin 2026 : toutes les composantes cotées Excellent → 20/20 → 4,0.
  const juin = computeBilan(
    { taille_cm: 176, poids_kg: 91.8, tour_taille_cm: 93, pushups: 55, situps: 49,
      flexion_tronc_cm: 27, endurance_dos_sec: 180, saut_vertical_cm: 48, vo2max: 57.6,
      pa_systolique: 112 },
    P
  )
  assert.equal(round1g(juin.overall.score), 4)

  // 4 sept. 2025 : composition 0 + aérobie 4 + PA 0 + dos 3 + musculo 4 = 11/20 → 2,2.
  const sept = computeBilan(
    { taille_cm: 176, poids_kg: 99.8, tour_taille_cm: 103, pushups: 28, situps: 25,
      flexion_tronc_cm: 22, endurance_dos_sec: 180, saut_vertical_cm: 48, vo2max: 49,
      pa_systolique: 129 },
    { ...P, age: 48 }
  )
  assert.equal(round1g(sept.overall.score), 2.2)
})

test('score global : une composante non mesurée est exclue (pas comptée 0)', () => {
  const P: BilanProfile = { age: 48, sex: 'M', norms: 'cpafla' }
  // Reproduit les bilans de déc. 2025 / janv. / févr. 2026 : seuls le tour de taille
  // et le poids sont pris. Composition ET indice du dos restent calculables (le tour
  // de taille suffit au dos), aérobie / PA / musculo sont exclus → moyenne sur 2.
  const r = computeBilan({ taille_cm: 176, poids_kg: 96.1, tour_taille_cm: 100 }, P)
  const mesurees = r.overallDetail.rows.filter(x => x.cote !== null).map(x => x.key)
  assert.deepEqual(mesurees, ['composition', 'backHealth'])
  // Les deux cotées Bien (2) → 2,0, exactement ce qu'imprime l'ancien logiciel.
  assert.equal(round1g(r.overall.score), 2)
})

test('barème PA provisoire : seuil à 120 (cohérent avec les 4 points connus)', () => {
  assert.equal(systolicRatingLegacy(112), 4)
  assert.equal(systolicRatingLegacy(113), 4)
  assert.equal(systolicRatingLegacy(122), 0)
  assert.equal(systolicRatingLegacy(129), 0)
  assert.equal(systolicRatingLegacy(undefined), null) // non mesurée → exclue
})

// ── Pistes ÉCARTÉES pour le barème PA (ne pas les retenter) ──────────────────
//
// Nicholas a proposé de coter la PA systolique sur 5 niveaux, comme la barre
// « Optimale / Normale / Pré-hypertension / Hypertension 1 / Hypertension 2 »
// qu'affiche l'ancien logiciel. L'idée est bonne mais les chiffres la refusent.

test('PA : le barème clinique standard (120/130/140/160) est incompatible', () => {
  const cote5 = (v: number, t: [number, number, number, number]) =>
    v < t[0] ? 4 : v < t[1] ? 3 : v < t[2] ? 2 : v < t[3] ? 1 : 0
  const std: [number, number, number, number] = [120, 130, 140, 160]
  // Les deux valeurs basses passent…
  assert.equal(cote5(112, std), 4)
  assert.equal(cote5(113, std), 4)
  // …mais les deux hautes donnent 3 là où l'ancien logiciel impose 0.
  assert.equal(cote5(122, std), 3)
  assert.equal(cote5(129, std), 3)
  assert.notEqual(cote5(122, std), 0)
})

test('PA : toute échelle à 5 niveaux exigerait des zones d’environ 1 mmHg', () => {
  // Recherche exhaustive des seuils compatibles avec les 4 points connus.
  const cote5 = (v: number, t: number[]) =>
    v < t[0] ? 4 : v < t[1] ? 3 : v < t[2] ? 2 : v < t[3] ? 1 : 0
  const points: [number, number][] = [[112, 4], [113, 4], [122, 0], [129, 0]]
  const compatibles: number[][] = []
  for (let a = 100; a <= 180; a++)
    for (let b = a + 1; b <= 181; b++)
      for (let c = b + 1; c <= 182; c++)
        for (let d = c + 1; d <= 183; d++)
          if (points.every(([v, exp]) => cote5(v, [a, b, c, d]) === exp)) compatibles.push([a, b, c, d])

  assert.ok(compatibles.length > 0, 'des solutions existent, mais…')
  // …toutes tiennent dans une fenêtre de 9 mmHg, soit ~1 mmHg par zone.
  const min = Math.min(...compatibles.map(t => t[0]))
  const max = Math.max(...compatibles.map(t => t[3]))
  assert.equal(min, 114)
  assert.equal(max, 122)
  assert.ok(max - min <= 9, 'un barème de PA réaliste ne tient pas dans 9 mmHg')
  // Conclusion : la règle binaire « < 120 → 4, sinon 0 » reste la seule tenable.
})

test('Sabrina 2026-01 : n doit valoir 6, et la composante manquante vaut 2', () => {
  const r1 = (n: number) => Math.round(n * 10) / 10
  const connu = 0 + 0 + 1 + 2 // composition, aérobie, dos, musculo
  const sommesPour = (n: number) =>
    Array.from({ length: 4 * n + 1 }, (_, s) => s).filter(s => r1(s / n) === 1.5)

  // Une moyenne de cotes entières ne peut donner 1,5 que pour n pair.
  for (const n of [3, 5, 7]) assert.deepEqual(sommesPour(n), [], `n=${n} devrait être impossible`)
  assert.deepEqual(sommesPour(4), [6])
  assert.deepEqual(sommesPour(6), [9])

  // n=4 est exclu : les 4 composantes connues somment déjà à 3, pas 6.
  assert.notEqual(connu, 6)
  // Donc n=6 : il reste 9 − 3 = 6 pour la PA + la composante inconnue.
  assert.equal(9 - connu, 6)
  // PA 117 < 120 → 4 selon la règle en vigueur, donc l'inconnue vaut 2.
  assert.equal(systolicRatingLegacy(117), 4)
  assert.equal(6 - 4, 2)
})
