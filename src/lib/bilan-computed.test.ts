/**
 * Tests d'intégration de `computeBilan` — cas Nicholas Jean (H 48 ans).
 *
 * Lancer : `node --test src/lib/bilan-computed.test.ts`
 *
 * Valeurs attendues (matchent le bilan officiel) :
 *   - taille 176, poids 99.8 → IMC 32.2
 *   - plis 10/7/25/33 → % gras Durnin ≈ 30.2
 *   - Bruce 13:33 → VO2max ≈ 49, MET ≈ 14
 *   - FC max prédite Tanaka (48 ans) = 208 − 0.7×48 = 174.4 → 174
 *   - saut 48 + poids 99.8 → puissance Sayers = 5380 W
 *   - poids optimal max (IMC 25) = 25 × 1.76² = 77.4 kg
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeBilan, mergeComputedIntoBilan, type BilanProfile } from './bilan-computed.ts'

const NICHOLAS: BilanProfile = { age: 48, sex: 'M', norms: 'acsm' }

const RAW: BilanData = {
  taille_cm: 176,
  poids_kg: 99.8,
  tour_taille_cm: 95,
  tour_hanche_cm: 105,
  pli_triceps: 10,
  pli_biceps: 7,
  pli_sous_scap: 25,
  pli_iliaque: 33,
  aerobie_test_type: 'bruce',
  bruce_duration_sec: 13 * 60 + 33,
  saut_vertical_cm: 48
}

test('Saut vertical = finale − départ (feuille papier)', () => {
  const r = computeBilan({ saut_depart_cm: 220, saut_finale_cm: 265, poids_kg: 80 }, NICHOLAS)
  assert.equal(r.sautVerticalCm, 45)
  // La puissance (Sayers) est calculée sur le saut dérivé (45 cm), pas 0.
  assert.ok(r.puissanceJambesW !== null && r.puissanceJambesW > 0)
  const merged = mergeComputedIntoBilan({ saut_depart_cm: 220, saut_finale_cm: 265, poids_kg: 80 }, r)
  assert.equal(merged.saut_vertical_cm, 45)
})

test('Saut vertical — rétro-compat : valeur directe si pas de départ/finale', () => {
  const r = computeBilan({ saut_vertical_cm: 48, poids_kg: 80 }, NICHOLAS)
  assert.equal(r.sautVerticalCm, 48)
})

test('Indice de santé du dos — taille + IMC contribuent (nouvelle formule)', () => {
  // Ancienne formule (situps/flexion/extension seulement) → score null sans ces tests.
  // Nouvelle formule (taille + IMC + tests) → score non-null grâce à taille + IMC.
  const r = computeBilan({ tour_taille_cm: 80, taille_cm: 175, poids_kg: 75 }, NICHOLAS)
  assert.ok(r.backHealth.score !== null)
})

test('Nicholas — IMC 32.2', () => {
  const r = computeBilan(RAW, NICHOLAS)
  assert.equal(r.imc, 32.2)
})

test('Nicholas — poids optimal max ≈ 77.4 kg (IMC 25)', () => {
  const r = computeBilan(RAW, NICHOLAS)
  // 25 * 1.76² = 25 * 3.0976 = 77.44
  assert.ok(r.poidsOptimalMaxKg !== null && Math.abs(r.poidsOptimalMaxKg - 77.4) < 0.1)
})

test('Nicholas — ratio taille/hanche', () => {
  const r = computeBilan(RAW, NICHOLAS)
  // 95 / 105 = 0.9047 → 0.9
  assert.ok(r.ratioTailleHanche !== null && Math.abs(r.ratioTailleHanche - 0.9) < 0.01)
})

test('Nicholas — % gras Durnin ≈ 30.2', () => {
  const r = computeBilan(RAW, NICHOLAS)
  assert.ok(r.pourcentageGrasDurnin !== null && Math.abs(r.pourcentageGrasDurnin - 30.2) < 0.5)
})

test('Nicholas — VO2max Bruce 13:33 ≈ 49', () => {
  const r = computeBilan(RAW, NICHOLAS)
  // Foster/Pollock T=13.55 : 14.76 - 1.379·13.55 + 0.451·13.55² - 0.012·13.55³
  //                       = 14.76 - 18.685 + 82.802 - 29.829 = 49.05
  assert.ok(r.vo2max !== null && Math.abs(r.vo2max - 49) < 1)
})

test('Nicholas — MET équivalent ≈ 14', () => {
  const r = computeBilan(RAW, NICHOLAS)
  assert.ok(r.metEquivalent !== null && Math.abs(r.metEquivalent - 14) < 0.2)
})

test('Nicholas — FC max prédite Tanaka 174', () => {
  const r = computeBilan(RAW, NICHOLAS)
  // 208 - 0.7*48 = 208 - 33.6 = 174.4 → arrondi 174
  assert.equal(r.fcMaxPredite, 174)
})

test('Nicholas — FC zones cohérentes', () => {
  const r = computeBilan(RAW, NICHOLAS)
  assert.ok(r.fcZones !== null)
  // z60 ≈ 174 * 0.6 = 104
  assert.equal(r.fcZones?.z60, 104)
  assert.equal(r.fcZones?.z90, Math.round(174 * 0.9))
})

test('Nicholas — puissance Sayers = 5380 W', () => {
  const r = computeBilan(RAW, NICHOLAS)
  assert.equal(r.puissanceJambesW, 5380)
})

test('Nicholas — score aérobie EXCELLENT (VO2max 49 chez M 40-49)', () => {
  const r = computeBilan(RAW, NICHOLAS)
  // M 40-49 (calibré v0.1.18) : p10=23, p25=30, p50=35, p75=43, p90=50
  // 49 ≥ p75 (43) → EXCELLENT → score 4 (échelle 0-4)
  assert.equal(r.aerobic.category, 'EXCELLENT')
  assert.equal(r.aerobic.score, 4)
})

test('Nicholas — score composition ACCEPTABLE (IMC obèse + %gras élevé + tour taille)', () => {
  const r = computeBilan(RAW, NICHOLAS)
  // IMC 32.2 (lowerIsBetter, p10=30) → > p10 → A_AMELIORER → 0
  // % gras 30.2 (M 40-49 : p10=35, p25=30) → entre p25 (30) et p10 (35) → ACCEPTABLE → 1
  // tour taille 95 H (lowerIsBetter, p10=102, p25=94) → entre p25 et p10 → ACCEPTABLE → 1
  // Moyenne (0 + 1 + 1)/3 = 0.67 → ACCEPTABLE
  assert.equal(r.composition.category, 'ACCEPTABLE')
  assert.ok(r.composition.score !== null && r.composition.score > 0.5 && r.composition.score < 1.5)
})

test('Nicholas — score global calculé', () => {
  const r = computeBilan(RAW, NICHOLAS)
  // composition ≈ 0.67, aerobic 4, dos ≈ 0.5 (taille+IMC seuls), force musculaire = 4 (échelle 0-4).
  // overall = avg(0.67, 4, 0.5, 4) ≈ 2.3 (dos inclus quand SHOW_BACK_HEALTH = true)
  assert.ok(r.overall.score !== null, 'overall score doit être calculable')
  assert.ok(r.overall.score! > 1.5 && r.overall.score! < 3.5, `overall ${r.overall.score} hors plage attendue [1.5, 3.5]`)
})

test('Profil incomplet (sex null) → scores null', () => {
  const r = computeBilan(RAW, { age: 48, sex: null, norms: 'acsm' })
  // Les calculs purs marchent (IMC, FC max)…
  assert.equal(r.imc, 32.2)
  assert.equal(r.fcMaxPredite, 174)
  // …mais les scores qui dépendent de la catégorisation tombent en null.
  assert.equal(r.aerobic.score, null)
  assert.equal(r.composition.score, null)
  assert.equal(r.overall.score, null)
})

test('Bilan vide → tous calculs null', () => {
  const r = computeBilan({}, NICHOLAS)
  assert.equal(r.imc, null)
  assert.equal(r.vo2max, null)
  assert.equal(r.puissanceJambesW, null)
  assert.equal(r.overall.score, null)
})
