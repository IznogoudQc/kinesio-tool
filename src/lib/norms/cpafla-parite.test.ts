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
import { systolicRating } from './clinical.ts'

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

  // 4 sept. 2025 : composition 0 + aérobie 4 + dos 3 + musculo 4, et la PA à 129.
  //
  // L'ancien logiciel imprime 2,2, ce qui suppose PA = 0. Depuis le 2026-08-07 la
  // cote suit les zones cliniques du logiciel lui-même (capture de sa fenêtre
  // d'affichage) : 129 tombe dans « Normale » → 3, et le global devient 2,8.
  // Écart assumé, pas régression — voir `systolicRating` et le test suivant.
  const sept = computeBilan(
    { taille_cm: 176, poids_kg: 99.8, tour_taille_cm: 103, pushups: 28, situps: 25,
      flexion_tronc_cm: 22, endurance_dos_sec: 180, saut_vertical_cm: 48, vo2max: 49,
      pa_systolique: 129 },
    { ...P, age: 48 }
  )
  assert.equal(round1g(sept.overall.score), 2.8)
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

test('PA : la cote suit les cinq zones cliniques', () => {
  assert.equal(systolicRating(112), 4) // Optimale
  assert.equal(systolicRating(122), 3) // Normale
  assert.equal(systolicRating(135), 2) // Pré-hypertension
  assert.equal(systolicRating(148), 1) // Hypertension 1
  assert.equal(systolicRating(165), 0) // Hypertension 2
  assert.equal(systolicRating(undefined), null) // non mesurée → exclue
})

/**
 * ÉCART CONNU ET ASSUMÉ avec l'ancien logiciel — ne pas « corriger » sans
 * l'accord de Nicholas (décision du 2026-08-07).
 *
 * L'ancien logiciel donne 0 à une PA de 122 : c'est la seule règle qui
 * reproduisait ses scores globaux imprimés. Les zones cliniques lui donnent 3.
 * Nicholas a tranché en faveur des zones — la barre que voit le client et la cote
 * qui entre dans son score disent désormais la même chose — en acceptant que deux
 * de ses propres rapports ne soient plus reproduits.
 *
 * Ce test ne vérifie pas un comportement : il garde l'écart chiffré, pour que
 * personne ne « répare » plus tard une parité qui a été abandonnée sciemment.
 */
test('PA : l’écart avec les rapports de 2011 et 2025-09 est documenté', () => {
  const global = (cotes: number[]) => (cotes.reduce((a, b) => a + b, 0) / (cotes.length * 4)) * 4
  // Nick 2025-09 — comp 0, aéro 4, PA (122), dos 3, musculo 4. Imprimé : 2,2.
  assert.equal(round1(global([0, 4, 0, 3, 4])), 2.2) // avec l'ancienne règle
  assert.equal(round1(global([0, 4, systolicRating(122) as number, 3, 4])), 2.8) // avec les zones
  // Nick 2011-08 — comp 2, aéro 4, PA (129), dos 2, musculo 3. Imprimé : 2,2.
  assert.equal(round1(global([2, 4, 0, 2, 3])), 2.2)
  assert.equal(round1(global([2, 4, systolicRating(129) as number, 2, 3])), 2.8)
})

test('Sabrina 2026-01 : la 6ᵉ composante est le questionnaire, coté 2', () => {
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
  assert.equal(systolicRating(117), 4)
  assert.equal(6 - 4, 2)
  // IDENTIFIÉE : la fenêtre Propriétés de l'ancien logiciel liste sept
  // composantes — [Questionnaire combiné], [Composition corporelle], [Pression
  // artérielle systolique], [METS max], [Indice de santé du dos], [Aptitudes
  // musculosquelettiques] et [166], toutes ×1. Marie n'utilise pas le 166 et ne
  // fait pas le questionnaire à chaque fois : ce jour-là elle l'avait fait, d'où
  // la 6ᵉ composante. Coté 2, il donne 9/6 = 1,5 — la seule valeur qui colle.
  const cotes = [0, 0, 1, 2, 4, 2] // + questionnaire 2
  assert.equal(r1(cotes.reduce((a, b) => a + b, 0) / cotes.length), 1.5)
})
