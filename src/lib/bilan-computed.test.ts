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
import { buildBilanProfile, computeBilan, mergeComputedIntoBilan, type BilanProfile } from './bilan-computed.ts'
import { computeAge } from './norms/index.ts'

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

test('Nicholas — score composition ACCEPTABLE (repli ACSM : % de gras seulement)', () => {
  const r = computeBilan(RAW, NICHOLAS)
  // Chemin de repli ACSM (sexe inconnu en usage réel — la norme est toujours CPAFLA).
  // Ni l'IMC ni le tour de taille n'entrent dans la moyenne : ils sont mentionnés,
  // jamais évalués (plus de TestKey — cf. `BILAN_TO_TEST_KEY`). Il ne reste que le
  // % gras 30.2 (M 40-49 : p10=35, p25=30) → entre p25 et p10 → ACCEPTABLE → 1.
  assert.equal(r.composition.category, 'ACCEPTABLE')
  assert.equal(r.composition.score, 1)
})

test('Nicholas — norme CPAFLA : VO2max replie sur ACSM ; composition suit la méthode CPAFLA', () => {
  const cpafla: BilanProfile = { age: 48, sex: 'M', norms: 'cpafla' }
  const r = computeBilan(RAW, cpafla)
  const acsm = computeBilan(RAW, NICHOLAS)
  // VO2max n'a pas de table CPAFLA → repli sur ACSM → aérobie coté (identique à ACSM).
  assert.equal(r.aerobic.score, acsm.aerobic.score)
  assert.notEqual(r.aerobic.score, null)
  // Composition CPAFLA : IMC 32,2 (plage 30-32,4) + CT 95 (94-101) → colonne B = 2
  // (pas de mollet → repli IMC + CT). Distinct de la moyenne ACSM.
  assert.equal(r.composition.score, 2)
  assert.equal(r.composition.category, 'BIEN')
})

test('CPAFLA — note combinée musculo + dos via pondérations (H 25 ans)', () => {
  const p: BilanProfile = { age: 25, sex: 'M', norms: 'cpafla' }
  const r = computeBilan(
    {
      pushups: 36, // E (M 20-29 ≥36) → 4, poids ×2 = 8
      flexion_tronc_cm: 26, // Acceptable (M 20-29 : 25-29) → 1, ×1 = 1
      situps: 25, // E → 4, ×1 = 4
      endurance_dos_sec: 176, // E (M 20-29 ≥176) → 4, ×1 = 4 ; dos ×2 = 8
      puissance_jambes_watts: 5094, // E (legPower M 20-29 ≥5094) → 4, ×1 = 4
      puissance_calculated_auto: false
    },
    p
  )
  // Musculo : obtenue 8+1+4+4+4 = 21, max 8+4+4+4+4 = 24 → 21/24×4 = 3,5.
  // Décimales conservées (pas d'arrondi nomogramme) — cf. ADR 0028.
  assert.equal(r.musculoGlobal.score, 3.5)
  assert.equal(r.musculoGlobal.category, 'EXCELLENT')
  // Dos (taille absente → exclue) : obtenue flexion1 + situps4 + dos(4×2)=8 → 13,
  // max 4+4+8 = 16 → 13/16×4 = 3,25.
  assert.equal(r.backHealth.score, 3.25)
  assert.equal(r.backHealth.category, 'TRES_BIEN')
})

test('CPAFLA — composition corporelle : exemple du guide (femme) → Acceptable (1)', () => {
  const p: BilanProfile = { age: 50, sex: 'F', norms: 'cpafla' }
  // Femme, taille 168 / poids 72,7 → IMC 25,8 ; CT 91 ; 5 plis = 116,6 mm.
  const r = computeBilan(
    {
      taille_cm: 168,
      poids_kg: 72.7,
      tour_taille_cm: 91,
      pli_triceps: 22,
      pli_biceps: 10.2,
      pli_sous_scap: 26,
      pli_iliaque: 32,
      pli_mollet: 26.4
    },
    p
  )
  // (B=1 × 1,5 + C=2) / 2,5 = 1,4 → arrondi 1 → Acceptable.
  assert.equal(r.composition.score, 1)
  assert.equal(r.composition.category, 'ACCEPTABLE')
})

test('CPAFLA — composition : sans mollet → repli auto IMC + tour de taille (colonne B)', () => {
  const p: BilanProfile = { age: 50, sex: 'F', norms: 'cpafla' }
  const r = computeBilan({ taille_cm: 168, poids_kg: 72.7, tour_taille_cm: 91 }, p)
  // Pas de S5PC → IMC (25-29,9) + CT 91 (>87) → colonne B = 1.
  assert.equal(r.composition.score, 1)
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

test('import .doc : les scores du vieux rapport sont ÉCRASÉS par le calcul de l’app', () => {
  // Le parser recopie les scores imprimés par le logiciel d'origine. On vérifie
  // qu'ils ne survivent pas : `mergeComputedIntoBilan` (appelé par l'import et
  // par chaque sauvegarde) les remplace par ceux calculés à partir des mesures.
  // Mesures réelles du bilan du 25 juin 2026 (H 49 ans) → dos 3,6 · musculo 3,7.
  const raw: BilanData = {
    taille_cm: 176,
    poids_kg: 91.8,
    tour_taille_cm: 93,
    pushups: 55,
    situps: 49,
    flexion_tronc_cm: 27,
    endurance_dos_sec: 180,
    puissance_jambes_watts: 4725,
    puissance_calculated_auto: false,
    vo2max: 57.6,
    // Valeurs « importées » volontairement absurdes : elles doivent disparaître.
    indice_sante_dos: 99,
    score_musculo_global: 99,
    score_composition: 99
  }
  const p: BilanProfile = { age: 49, sex: 'M', norms: 'cpafla' }
  const merged = mergeComputedIntoBilan(raw, computeBilan(raw, p))

  assert.equal(merged.indice_sante_dos, 3.6)
  assert.equal(merged.score_musculo_global, 3.7)
  assert.equal(merged.score_composition, 4)
})

test('import : la puissance des jambes est recalculée (Sayers), pas recopiée', () => {
  // Champ « calculé » (jamais saisi à la main) → l'app doit en être la seule source.
  // Bilan du 4 sept. 2025 : saut 48 cm, poids 99,8 kg → Sayers = 5380 W.
  const raw: BilanData = {
    poids_kg: 99.8,
    saut_vertical_cm: 48,
    puissance_jambes_watts: 1234, // valeur « importée » absurde
    puissance_calculated_auto: false
  }
  const p: BilanProfile = { age: 48, sex: 'M', norms: 'cpafla' }
  const merged = mergeComputedIntoBilan(raw, computeBilan(raw, p))
  assert.equal(merged.puissance_jambes_watts, 5380)
  assert.equal(merged.puissance_calculated_auto, true)
})

test('import : puissance conservée si Sayers est impossible (saut ou poids manquant)', () => {
  // Sans saut vertical, on ne peut pas recalculer → ne pas perdre la donnée.
  const raw: BilanData = {
    poids_kg: 91.8,
    puissance_jambes_watts: 4725,
    puissance_calculated_auto: false
  }
  const p: BilanProfile = { age: 49, sex: 'M', norms: 'cpafla' }
  const merged = mergeComputedIntoBilan(raw, computeBilan(raw, p))
  assert.equal(merged.puissance_jambes_watts, 4725)
})

// ── Profil partagé dashboard / PDF / HTML ────────────────────────────────────
//
// Le dashboard, le rapport PDF et le rapport HTML autonome construisaient leur
// `BilanProfile` chacun de leur côté, et ils ont divergé : le HTML tirait sa
// norme du réglage `categorization_norms`, retiré en v0.9.31, si bien que sa
// lecture retombait toujours sur ACSM. Le document remis au client affichait
// une composition corporelle de 3,0 là où Marie-Eve lisait 4,0 à l'écran.
// Les trois passent désormais par `buildBilanProfile`.

test('buildBilanProfile : cote en CPAFLA, jamais en ACSM', () => {
  const p = buildBilanProfile({ birthdate: '1977-03-14', sex: 'M' })
  assert.equal(p.norms, 'cpafla')
})

test('buildBilanProfile : âge dérivé de la date de naissance, sexe repris tel quel', () => {
  const p = buildBilanProfile({ birthdate: '1977-03-14', sex: 'F' })
  assert.equal(p.age, computeAge('1977-03-14'))
  assert.equal(p.sex, 'F')
})

test('buildBilanProfile : client absent ou incomplet → âge et sexe nuls (pas de plantage)', () => {
  for (const c of [null, undefined, {}, { birthdate: null, sex: null }] as const) {
    const p = buildBilanProfile(c)
    assert.equal(p.age, null)
    assert.equal(p.sex, null)
    assert.equal(p.norms, 'cpafla')
  }
})

test('le profil partagé reproduit les scores du dashboard (et pas ceux d’ACSM)', () => {
  // Bilan réel Nicholas du 25 juin 2026, tel qu'affiché à l'écran.
  const raw: BilanData = {
    taille_cm: 176,
    poids_kg: 91.8,
    tour_taille_cm: 93,
    pushups: 55,
    situps: 49,
    flexion_tronc_cm: 27,
    endurance_dos_sec: 180,
    saut_vertical_cm: 48,
    vo2max: 57.6,
    pa_systolique: 112,
    pli_triceps: 7,
    pli_biceps: 5.5,
    pli_sous_scap: 18.5,
    pli_iliaque: 17
  }
  const shared = buildBilanProfile({ birthdate: '1977-03-14', sex: 'M' })
  const r = computeBilan(raw, { ...shared, age: 49 })
  const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)
  assert.equal(r1(r.composition.score), 4)
  assert.equal(r1(r.musculoGlobal.score), 3.7)
  assert.equal(r1(r.overall.score), 4)

  // L'ancienne norme du HTML donnait d'autres chiffres : c'est bien un écart
  // visible par le client, pas une subtilité d'arrondi.
  const acsm = computeBilan(raw, { age: 49, sex: 'M', norms: 'acsm' })
  assert.notEqual(r1(acsm.composition.score), r1(r.composition.score))
})

// ── FC max ajustable par client (zones d'entraînement) ───────────────────────
//
// Marie-Eve peut saisir la FC max réellement observée : un client sous
// bêta-bloquants ou très entraîné s'écarte beaucoup de Tanaka, et prescrire des
// zones fausses n'a aucun intérêt. L'ajustement voyage dans le PROFIL, donc il
// atteint le dashboard, le PDF et le document HTML sans câblage par surface.

test('sans ajustement : FC max prédite par Tanaka', () => {
  const c = computeBilan({ vo2max: 50 }, buildBilanProfile({ birthdate: '1977-03-14', sex: 'M' }))
  assert.equal(c.fcMaxSource, 'tanaka')
  // 208 − 0,7 × 49 = 173,7 → 174
  assert.equal(c.fcMaxPredite, 174)
})

test('avec ajustement : la FC max saisie remplace la prédiction', () => {
  const c = computeBilan({ vo2max: 50 }, buildBilanProfile({ birthdate: '1977-03-14', sex: 'M', fcMaxManuel: 186 }))
  assert.equal(c.fcMaxSource, 'manuel')
  assert.equal(c.fcMaxPredite, 186)
})

test('les CINQ zones se recalculent, pas seulement l’affichage', () => {
  const base = computeBilan({}, buildBilanProfile({ birthdate: '1977-03-14', sex: 'M' }))
  const ajuste = computeBilan({}, buildBilanProfile({ birthdate: '1977-03-14', sex: 'M', fcMaxManuel: 186 }))
  assert.ok(base.fcZones && ajuste.fcZones)
  for (const k of ['z60', 'z65', 'z70', 'z75', 'z80', 'z85', 'z90'] as const) {
    assert.ok(ajuste.fcZones[k] > base.fcZones[k], `${k} devrait monter avec une FC max plus haute`)
  }
  // Et proportionnellement : 60 % de 186 = 111,6 → 112.
  assert.equal(ajuste.fcZones.z60, Math.round(186 * 0.6))
  assert.equal(ajuste.fcZones.z90, Math.round(186 * 0.9))
})

test('bêta-bloquants : une FC max BASSE abaisse bien les zones', () => {
  const c = computeBilan({}, buildBilanProfile({ birthdate: '1977-03-14', sex: 'M', fcMaxManuel: 140 }))
  assert.equal(c.fcMaxPredite, 140)
  assert.equal(c.fcZones?.z60, 84)
  // Sans l'ajustement, la zone 1 démarrerait à 104 bpm — au-dessus du seuil
  // lactique réel de ce client. C'est tout l'intérêt de la fonctionnalité.
  assert.ok((c.fcZones?.z60 ?? 0) < 104)
})

test('ajustement absent, nul ou aberrant → on retombe sur Tanaka', () => {
  for (const fcMaxManuel of [null, undefined, Number.NaN]) {
    const c = computeBilan({}, { age: 49, sex: 'M', norms: 'cpafla', fcMaxManuel })
    assert.equal(c.fcMaxSource, 'tanaka', String(fcMaxManuel))
    assert.equal(c.fcMaxPredite, 174)
  }
})

test('sans date de naissance ET sans ajustement : aucune zone', () => {
  const c = computeBilan({}, buildBilanProfile({ sex: 'M' }))
  assert.equal(c.fcMaxPredite, null)
  assert.equal(c.fcMaxSource, null)
  assert.equal(c.fcZones, null)
})

test('sans date de naissance MAIS avec ajustement : les zones existent quand même', () => {
  // Un client sans date de naissance n'a pas de prédiction ; la valeur mesurée
  // suffit pourtant à prescrire des zones.
  const c = computeBilan({}, buildBilanProfile({ sex: 'M', fcMaxManuel: 180 }))
  assert.equal(c.fcMaxPredite, 180)
  assert.equal(c.fcMaxSource, 'manuel')
  assert.equal(c.fcZones?.z60, 108)
})

test('buildBilanProfile transporte l’ajustement — c’est ce qui synchronise les 3 surfaces', () => {
  assert.equal(buildBilanProfile({ fcMaxManuel: 186 }).fcMaxManuel, 186)
  assert.equal(buildBilanProfile({ birthdate: '1977-03-14' }).fcMaxManuel, null)
  assert.equal(buildBilanProfile(null).fcMaxManuel, null)
})
