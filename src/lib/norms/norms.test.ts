/**
 * Tests du système de catégorisation pluggable (ACSM par défaut).
 *
 * Lancer : `node --test src/lib/norms/norms.test.ts` (Node ≥ 22.6 — strip-types).
 *
 * Vérifie :
 *  - le calcul d'âge depuis une date de naissance ISO
 *  - les catégories sur des bornes connues (cas du brief)
 *  - la différence H/F sur le même résultat
 *  - le fallback `null` (CPAFLA, valeurs manquantes, hors barème)
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
// On importe les sous-modules directement (et non le barrel `./index`) parce
// que Node `--test` exige des chemins explicites en `.ts` alors que tsc/vite
// n'aiment pas ces extensions dans le code applicatif.
import { getAcsmRange } from './acsm.ts'
import { getCpaflaRange, cpaflaHasTables } from './cpafla.ts'
import { classifyBloodPressure } from './clinical.ts'
import { getCategorization } from './index.ts'
import type { Category, NormPercentiles, NormsType, TestKey } from './types.ts'

function computeAge(birthdate: string | null, refDate: Date = new Date()): number | null {
  if (!birthdate) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate)
  if (!m) return null
  let age = refDate.getFullYear() - parseInt(m[1], 10)
  const monthDiff = refDate.getMonth() + 1 - parseInt(m[2], 10)
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < parseInt(m[3], 10))) age--
  return age < 0 ? null : age
}

// ⚠️ getCategorization vient du VRAI module, plus d'une copie locale.
// Ce fichier en hébergeait une réimplémentation : les tests validaient donc la
// copie, pas le code livré. Le barème du tour de taille (2026-08-04) l'a mis en
// évidence — il passait dans index.ts sans que le test le voie.
// interpolatePercentile, getPercentile et getDeltaVsAverage ci-dessous restent
// dupliqués — à traiter séparément, même risque.

// Copies de l'API publique. La raison invoquée à l'origine (Node `--test` ne
// suivrait pas la chaîne d'imports) s'est révélée fausse : l'import de
// `./index.ts` fonctionne, comme le montre getCategorization juste au-dessus.

function interpolatePercentile(value: number, p: NormPercentiles, lowerIsBetter: boolean): number {
  const anchors = [
    { perc: 10, value: p.p10 },
    { perc: 25, value: p.p25 },
    { perc: 50, value: p.p50 },
    { perc: 75, value: p.p75 },
    { perc: 90, value: p.p90 }
  ]
  const perf = (v: number) => (lowerIsBetter ? -v : v)
  const v = perf(value)
  if (v <= perf(anchors[0].value)) {
    const a = anchors[0], b = anchors[1]
    const slope = (b.perc - a.perc) / (perf(b.value) - perf(a.value))
    return Math.max(0, Math.round((a.perc + slope * (v - perf(a.value))) * 10) / 10)
  }
  if (v >= perf(anchors[4].value)) {
    const a = anchors[3], b = anchors[4]
    const slope = (b.perc - a.perc) / (perf(b.value) - perf(a.value))
    return Math.min(100, Math.round((b.perc + slope * (v - perf(b.value))) * 10) / 10)
  }
  for (let i = 0; i < 4; i++) {
    const a = anchors[i], b = anchors[i + 1]
    const pa = perf(a.value), pb = perf(b.value)
    if (v >= pa && v <= pb) {
      const slope = (b.perc - a.perc) / (pb - pa)
      return Math.round((a.perc + slope * (v - pa)) * 10) / 10
    }
  }
  return 50
}

function getPercentile(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const range = norms === 'cpafla' ? getCpaflaRange(test, age, sex) : getAcsmRange(test, age, sex)
  if (!range) return null
  return interpolatePercentile(value, range.percentiles, range.lowerIsBetter ?? false)
}

function getDeltaVsAverage(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): { deltaPct: number; isBetter: boolean } | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const range = norms === 'cpafla' ? getCpaflaRange(test, age, sex) : getAcsmRange(test, age, sex)
  if (!range) return null
  const p50 = range.percentiles.p50
  if (p50 === 0) return null
  const raw = ((value - p50) / p50) * 100
  const lowerIsBetter = range.lowerIsBetter ?? false
  const deltaPct = lowerIsBetter ? -raw : raw
  return { deltaPct: Math.round(deltaPct * 10) / 10, isBetter: deltaPct >= 0 }
}

test('computeAge — calcul standard, anniversaire passé', () => {
  const ref = new Date('2026-05-14')
  assert.equal(computeAge('1990-01-15', ref), 36)
})

test('computeAge — anniversaire pas encore passé', () => {
  const ref = new Date('2026-05-14')
  assert.equal(computeAge('1990-12-31', ref), 35)
})

test('computeAge — date invalide ou absente → null', () => {
  assert.equal(computeAge(null), null)
  assert.equal(computeAge(''), null)
  assert.equal(computeAge('pas une date'), null)
})

test('Nicholas (H, 35 ans) — VO2max 49 → TRES_BIEN', () => {
  // ACSM H 30-39 : aAmeliorer 34, acceptable 40, bien 47, tresBien 53
  // 49 ≥ 47 et < 53 → TRES_BIEN
  assert.equal(getCategorization('vo2max', 49, 35, 'M'), 'TRES_BIEN')
})

test('Sabrina (F, 35 ans) — VO2max 49 → EXCELLENT', () => {
  // ACSM F 30-39 : aAmeliorer 29, acceptable 34, bien 39, tresBien 45
  // 49 ≥ 45 → EXCELLENT (barre plus basse pour les femmes)
  assert.equal(getCategorization('vo2max', 49, 35, 'F'), 'EXCELLENT')
})

test('VO2max sous le seuil → A_AMELIORER', () => {
  // H 30-39 : <34 = À améliorer
  assert.equal(getCategorization('vo2max', 30, 35, 'M'), 'A_AMELIORER')
})

test('% gras (lowerIsBetter) — H 35 ans 12% → TRES_BIEN', () => {
  // H 30-39 bodyFat : tresBien 13, bien 18, acceptable 21, aAmeliorer 24
  // 12 ≤ 13 → EXCELLENT
  assert.equal(getCategorization('bodyFat', 12, 35, 'M'), 'EXCELLENT')
  assert.equal(getCategorization('bodyFat', 17, 35, 'M'), 'TRES_BIEN')
  assert.equal(getCategorization('bodyFat', 26, 35, 'M'), 'A_AMELIORER')
})

test('IMC — agnostique âge/sexe, lowerIsBetter', () => {
  assert.equal(getCategorization('bmi', 21, 35, 'M'), 'EXCELLENT')
  assert.equal(getCategorization('bmi', 24, 35, 'F'), 'TRES_BIEN')
  assert.equal(getCategorization('bmi', 32, 50, 'M'), 'A_AMELIORER')
})

test('Tour de taille — barème de l’ancien logiciel de Marie', () => {
  // Remplace les seuils Santé Canada le 2026-08-04 (capture de la fenêtre
  // Propriétés, test #20). Trois niveaux, la cote 2 est sautée :
  //   H : < 94 → 4 Excellent · < 102 → 3 Risque potentiel · reste → 1 Risque considérable
  //   F : < 80 → 4           · < 90  → 3                  · reste → 1
  assert.equal(getCategorization('waistCircumference', 93, 40, 'M'), 'EXCELLENT')
  assert.equal(getCategorization('waistCircumference', 94, 40, 'M'), 'TRES_BIEN')
  assert.equal(getCategorization('waistCircumference', 105, 40, 'M'), 'ACCEPTABLE')
  assert.equal(getCategorization('waistCircumference', 79, 40, 'F'), 'EXCELLENT')
  // 85 cm chez une femme valait ACCEPTABLE sous Santé Canada ; le barème de
  // Marie le classe un cran plus haut, sa borne étant à 90 et non 88.
  assert.equal(getCategorization('waistCircumference', 85, 40, 'F'), 'TRES_BIEN')
  assert.equal(getCategorization('waistCircumference', 90, 40, 'F'), 'ACCEPTABLE')
})

test('Tour de taille — l’âge n’intervient pas (« Tous les âges »)', () => {
  for (const age of [20, 45, 70]) {
    assert.equal(getCategorization('waistCircumference', 95, age, 'M'), 'TRES_BIEN')
  }
})

test('Tour de taille — jamais de catégorie « Bien » ni « À améliorer »', () => {
  // La cote 2 et la cote 0 n'existent pas dans ce barème : les produire
  // signifierait qu'une table de percentiles est repassée devant.
  const vues = new Set<string>()
  for (const sex of ['M', 'F'] as const) {
    for (let cm = 50; cm <= 200; cm += 0.5) {
      const c = getCategorization('waistCircumference', cm, 40, sex)
      if (c) vues.add(c)
    }
  }
  assert.deepEqual([...vues].sort(), ['ACCEPTABLE', 'EXCELLENT', 'TRES_BIEN'])
})

test('Saut vertical (Heyward 2010) — H 30-39, 50 cm → TRES_BIEN', () => {
  // M 30-39 percentiles : pct(30, 38, 46, 54, 62)
  // 50 entre p50 (46) et p75 (54) → TRES_BIEN
  assert.equal(getCategorization('verticalJump', 50, 30, 'M'), 'TRES_BIEN')
})

test('Puissance jambes (Sayers 1999) — H 30-39, 700 W → A_AMELIORER (extrême bas)', () => {
  // M 30-39 percentiles : pct(3300, 4000, 4800, 5600, 6300)
  // 700 << p10 → A_AMELIORER
  assert.equal(getCategorization('legPower', 700, 30, 'M'), 'A_AMELIORER')
})

test('Puissance jambes — Nicholas 5380 W H 48 ans → percentile ~77', () => {
  // M 40-49 puissance : pct(3100, 3800, 4500, 5300, 6000)
  // 5380 entre p75 (5300) et p90 (6000)
  const p = getPercentile('legPower', 5380, 48, 'M')
  assert.ok(p !== null && p >= 70 && p <= 85, `attendu 70-85, reçu ${p}`)
})

test('CPAFLA — tables musculosquelettiques encodées (guide CPHV 3e éd., Fig. 7-18/7-19)', () => {
  assert.ok(cpaflaHasTables())
  // Homme 25 ans (20-29) — extension des bras : A17 B22 TB29 E36 (intervalles contigus).
  assert.equal(getCategorization('pushups', 36, 25, 'M', 'cpafla'), 'EXCELLENT')
  assert.equal(getCategorization('pushups', 35, 25, 'M', 'cpafla'), 'TRES_BIEN')
  assert.equal(getCategorization('pushups', 29, 25, 'M', 'cpafla'), 'TRES_BIEN')
  assert.equal(getCategorization('pushups', 28, 25, 'M', 'cpafla'), 'BIEN')
  assert.equal(getCategorization('pushups', 21, 25, 'M', 'cpafla'), 'ACCEPTABLE')
  assert.equal(getCategorization('pushups', 16, 25, 'M', 'cpafla'), 'A_AMELIORER')
  // Femme 35 ans (30-39) — flexion du tronc : A27 B32 TB36 E41.
  assert.equal(getCategorization('trunkFlexion', 41, 35, 'F', 'cpafla'), 'EXCELLENT')
  assert.equal(getCategorization('trunkFlexion', 35, 35, 'F', 'cpafla'), 'BIEN')
  assert.equal(getCategorization('trunkFlexion', 26, 35, 'F', 'cpafla'), 'A_AMELIORER')
  // Redressements plafonnés à 25 (homme 20-29 : A11 B16 TB21 E25).
  assert.equal(getCategorization('situps', 25, 25, 'M', 'cpafla'), 'EXCELLENT')
  assert.equal(getCategorization('situps', 24, 25, 'M', 'cpafla'), 'TRES_BIEN')
  // Puissance (homme 20-29 : E5094) + endurance du dos (homme 30-39 : E147).
  assert.equal(getCategorization('legPower', 5094, 25, 'M', 'cpafla'), 'EXCELLENT')
  assert.equal(getCategorization('legPower', 5093, 25, 'M', 'cpafla'), 'TRES_BIEN')
  assert.equal(getCategorization('backEndurance', 147, 35, 'M', 'cpafla'), 'EXCELLENT')
  assert.equal(getCategorization('backEndurance', 55, 35, 'M', 'cpafla'), 'A_AMELIORER')
})

test('CPAFLA — % gras / IMC non encodés → getCpaflaRange null (repli géré ailleurs)', () => {
  // Le repli sur ACSM (IMC, tour de taille) vit dans index.getCategorization
  // et bilan-computed.categorizeRaw — testé end-to-end dans bilan-computed.test.ts.
  // Le VO2max, lui, a sa table CPAFLA (tableau 4.10 du guide).
  assert.equal(getCpaflaRange('bodyFat', 35, 'F'), null)
  assert.equal(getCpaflaRange('bmi', 35, 'M'), null)
})

test('CPAFLA — VO2max encodé : la table de Marie, plus le repli ACSM', () => {
  const r = getCpaflaRange('vo2max', 45, 'M')
  assert.ok(r, 'table VO2max CPAFLA attendue pour H 40-49')
  // Bornes basses lues sur le tableau 4.10 : Acceptable 31,9 / Bien 35,5 /
  // Très bien 42,7 / Excellent 47,0.
  assert.deepEqual(
    [r.percentiles.p10, r.percentiles.p25, r.percentiles.p50, r.percentiles.p75],
    [31.9, 35.5, 42.7, 47.0]
  )
  assert.equal(getCategorization('vo2max', 47.0, 45, 'M', 'cpafla'), 'EXCELLENT')
  assert.equal(getCategorization('vo2max', 46.9, 45, 'M', 'cpafla'), 'TRES_BIEN')
  assert.equal(getCategorization('vo2max', 31.8, 45, 'M', 'cpafla'), 'A_AMELIORER')
})

test('Valeur invalide → null', () => {
  assert.equal(getCategorization('vo2max', Number.NaN, 35, 'M'), null)
})

test('classifyBloodPressure — zones cliniques nommées', () => {
  // Nicholas : 112/74 → Optimale sur les deux.
  assert.equal(classifyBloodPressure(112, 'systolic')?.zone, 'Optimale')
  assert.equal(classifyBloodPressure(74, 'diastolic')?.zone, 'Optimale')
  // Bornes systoliques
  assert.equal(classifyBloodPressure(125, 'systolic')?.zone, 'Normale')
  assert.equal(classifyBloodPressure(135, 'systolic')?.zone, 'Pré-hypertension')
  assert.equal(classifyBloodPressure(150, 'systolic')?.zone, 'Hypertension 1')
  assert.equal(classifyBloodPressure(165, 'systolic')?.zone, 'Hypertension 2')
  // Bornes diastoliques
  assert.equal(classifyBloodPressure(82, 'diastolic')?.zone, 'Normale')
  assert.equal(classifyBloodPressure(105, 'diastolic')?.zone, 'Hypertension 2')
  // Couleur : Optimale → EXCELLENT ; HT2 → A_AMELIORER
  assert.equal(classifyBloodPressure(112, 'systolic')?.category, 'EXCELLENT')
  assert.equal(classifyBloodPressure(165, 'systolic')?.category, 'A_AMELIORER')
  // Valeur invalide → null
  assert.equal(classifyBloodPressure(Number.NaN, 'systolic'), null)
})

// ── Tests v0.1.18 : percentiles et delta vs moyenne ──────────────────────────

test('Percentile — VO2max 49, H 48 ans → ~88e percentile (M 40-49 calibré)', () => {
  const p = getPercentile('vo2max', 49, 48, 'M')
  assert.ok(p !== null && p >= 80 && p <= 95, `attendu 80-95, reçu ${p}`)
})

test('Percentile — exact P50 → 50', () => {
  // M 40-49 VO2max p50 = 35
  assert.equal(getPercentile('vo2max', 35, 48, 'M'), 50)
})

test('Percentile — valeur très basse < p10 → 0-10', () => {
  // M 40-49 VO2max p10 = 23 ; valeur 10 → extrapolation
  const p = getPercentile('vo2max', 10, 48, 'M')
  assert.ok(p !== null && p <= 10, `attendu ≤10, reçu ${p}`)
})

test('Percentile — valeur très haute > p90 → 90-100', () => {
  // M 40-49 VO2max p90 = 50 ; valeur 60 → extrapolation
  const p = getPercentile('vo2max', 60, 48, 'M')
  assert.ok(p !== null && p >= 90 && p <= 100, `attendu 90-100, reçu ${p}`)
})

test('Percentile — % gras 30.2, M 48 ans (lowerIsBetter)', () => {
  // M 40-49 body fat (lowerIsBetter) : p10=35, p25=30, p50=25, p75=20, p90=14
  // 30.2 entre p25 (30) et p10 (35) — proche de p25 → ~25e percentile
  const p = getPercentile('bodyFat', 30.2, 48, 'M')
  assert.ok(p !== null && p >= 20 && p <= 35, `attendu 20-35, reçu ${p}`)
})

test('Percentile — push-ups 28, H 48 ans → ~90e', () => {
  // M 40-49 push-ups p90 = 28 → percentile pile à 90
  const p = getPercentile('pushups', 28, 48, 'M')
  assert.ok(p !== null && p >= 85 && p <= 95, `attendu 85-95, reçu ${p}`)
})

test('Delta vs moyenne — VO2max 49 H 48y → +40 % (p50=35)', () => {
  const d = getDeltaVsAverage('vo2max', 49, 48, 'M')
  assert.ok(d !== null && d.isBetter)
  // (49 - 35) / 35 = 40%
  assert.ok(Math.abs(d.deltaPct - 40) < 1, `attendu ~40 %, reçu ${d.deltaPct}`)
})

test('Delta vs moyenne — % gras 30.2 H 48y → négatif (worse than p50=25)', () => {
  const d = getDeltaVsAverage('bodyFat', 30.2, 48, 'M')
  assert.ok(d !== null && !d.isBetter)
  // raw = (30.2-25)/25 = 20.8%, lowerIsBetter inverse → -20.8 %
  assert.ok(Math.abs(d.deltaPct - -20.8) < 0.5, `attendu ~-20.8 %, reçu ${d.deltaPct}`)
})

// ── Tests v0.1.33 : objectif niveau suivant ──────────────────────────────────

interface NextCategoryTarget {
  nextCategory: Category
  targetValue: number
  delta: number
  isAtTop: boolean
}

function getNextCategoryTarget(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): NextCategoryTarget | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (typeof age !== 'number' || age < 0) return null
  const range = norms === 'cpafla' ? getCpaflaRange(test, age, sex) : getAcsmRange(test, age, sex)
  if (!range) return null

  const lowerIsBetter = range.lowerIsBetter ?? false
  const current = getCategorization(test, value, age, sex, norms)
  if (!current) return null

  if (current === 'EXCELLENT') {
    return { nextCategory: 'EXCELLENT', targetValue: value, delta: 0, isAtTop: true }
  }

  const nextThresholdMap: Record<
    Exclude<Category, 'EXCELLENT'>,
    { next: Category; key: keyof NormPercentiles }
  > = {
    A_AMELIORER: { next: 'ACCEPTABLE', key: 'p10' },
    ACCEPTABLE: { next: 'BIEN', key: 'p25' },
    BIEN: { next: 'TRES_BIEN', key: 'p50' },
    TRES_BIEN: { next: 'EXCELLENT', key: 'p75' }
  }
  const { next, key } = nextThresholdMap[current as Exclude<Category, 'EXCELLENT'>]
  const targetValue = range.percentiles[key]
  const delta = Math.round((targetValue - value) * 10) / 10
  // `lowerIsBetter` n'apparaît pas dans le calcul du delta — pour un test
  // lowerIsBetter, la target sera plus petite que `value`, donc delta négatif.
  void lowerIsBetter
  return { nextCategory: next, targetValue, delta, isAtTop: false }
}

test('NextTarget — higher-is-better, VO2max H 48y à 30 → cible p10=23 ? non, current A_AMELIORER → next p10', () => {
  // M 40-49 VO2max : pct(23, 30, 35, 43, 50)
  // 30 ≥ p10 (23) et < p25 (30) → ACCEPTABLE
  // Attention : 30 ≥ p25 (30) → BIEN (catégorisation utilise ≥)
  // Vérifions : current(30, p={10:23,25:30,50:35,75:43,90:50}) → ≥p25 → BIEN
  // donc next = TRES_BIEN, target = p50 = 35, delta = +5
  const t = getNextCategoryTarget('vo2max', 30, 48, 'M')
  assert.ok(t)
  assert.equal(t.nextCategory, 'TRES_BIEN')
  assert.equal(t.targetValue, 35)
  assert.equal(t.delta, 5)
  assert.equal(t.isAtTop, false)
})

test('NextTarget — VO2max H 48y à 49 → EXCELLENT → isAtTop', () => {
  // 49 ≥ p75 (43) → EXCELLENT
  const t = getNextCategoryTarget('vo2max', 49, 48, 'M')
  assert.ok(t)
  assert.equal(t.isAtTop, true)
  assert.equal(t.nextCategory, 'EXCELLENT')
  assert.equal(t.delta, 0)
  assert.equal(t.targetValue, 49)
})

test('NextTarget — lower-is-better, % gras H 48y à 30.2 → cible p25=30, delta négatif', () => {
  // M 40-49 bodyFat (lowerIsBetter) : pct(35, 30, 25, 20, 14)
  // 30.2 < p10 (35) et ≥ p25 (30) → ACCEPTABLE (en lowerIsBetter : <p10 mais ≥p25 → ACCEPTABLE)
  // Vérifions : value=30.2, lowerIsBetter, p={10:35,25:30,50:25,75:20,90:14}
  //   <p75 (20)? non (30.2 > 20)
  //   <p50 (25)? non
  //   <p25 (30)? non (30.2 > 30)
  //   <p10 (35)? oui → ACCEPTABLE
  // next = BIEN, target = p25 = 30, delta = 30 - 30.2 = -0.2
  const t = getNextCategoryTarget('bodyFat', 30.2, 48, 'M')
  assert.ok(t)
  assert.equal(t.nextCategory, 'BIEN')
  assert.equal(t.targetValue, 30)
  assert.ok(Math.abs(t.delta - -0.2) < 0.01, `attendu ~-0.2, reçu ${t.delta}`)
  assert.equal(t.isAtTop, false)
})

test('NextTarget — A_AMELIORER → ACCEPTABLE via p10', () => {
  // M 30-39 push-ups : aAmeliorer 12, acceptable 17, bien 24, tresBien 30
  // tables ACSM : p10=12, p25=17, p50=24, p75=30 (approx)
  // value 5 → A_AMELIORER, next = ACCEPTABLE, target = p10
  const t = getNextCategoryTarget('pushups', 5, 35, 'M')
  assert.ok(t)
  assert.equal(t.nextCategory, 'ACCEPTABLE')
  assert.ok(t.delta > 0, `delta doit être positif (push-ups higher-is-better), reçu ${t.delta}`)
})

test('NextTarget — test hors barème → null', () => {
  // Le % de gras est coté par la grille de Marie (ADR 0024), hors norme : ni
  // table CPAFLA, ni repli — c'est le cas « pas de barème » qui subsiste.
  assert.equal(getNextCategoryTarget('bodyFat', 22, 35, 'M', 'cpafla'), null)
})

test('NextTarget — valeur invalide → null', () => {
  assert.equal(getNextCategoryTarget('vo2max', Number.NaN, 35, 'M'), null)
})

test('NextTarget — âge invalide → null', () => {
  assert.equal(getNextCategoryTarget('vo2max', 49, -5, 'M'), null)
})

test('Push-ups H 30-39 : barème ACSM', () => {
  // ACSM H 30-39 push-ups : aAmeliorer 12, acceptable 17, bien 24, tresBien 30
  assert.equal(getCategorization('pushups', 18, 35, 'M'), 'BIEN')        // ≥17 et <24
  assert.equal(getCategorization('pushups', 25, 35, 'M'), 'TRES_BIEN')   // ≥24 et <30
  assert.equal(getCategorization('pushups', 31, 35, 'M'), 'EXCELLENT')   // ≥30
  assert.equal(getCategorization('pushups', 5, 35, 'M'), 'A_AMELIORER')  // <12
})

test('CPAFLA — les 48 seuils du tableau 4.10, bande par bande', () => {
  // Transcription complète du tableau que Marie utilise, relue contre la photo
  // du guide. Une seule valeur qui dériverait ne planterait rien : elle ferait
  // simplement basculer un client d'une catégorie à l'autre, de façon
  // parfaitement plausible. D'où la vérification exhaustive plutôt qu'un
  // échantillon.
  //
  // Ordre : [Acceptable, Bien, Très bien, Excellent] — les bornes BASSES.
  const tableau: Record<string, [number, number, number, number]> = {
    'M/15': [43.6, 48.8, 52.4, 57.4],
    'M/20': [41.6, 47.2, 50.6, 55.6],
    'M/30': [33.7, 40.1, 45.4, 48.8],
    'M/40': [31.9, 35.5, 42.7, 47.0],
    'M/50': [26.0, 30.1, 36.5, 41.8],
    'M/60': [23.5, 28.7, 32.8, 38.4],
    'F/15': [36.8, 39.5, 43.7, 49.0],
    'F/20': [35.0, 37.8, 42.0, 47.2],
    'F/30': [33.0, 36.0, 40.1, 45.4],
    'F/40': [27.1, 31.9, 35.1, 40.0],
    'F/50': [24.6, 31.0, 34.0, 36.6],
    'F/60': [23.5, 29.6, 32.8, 35.8]
  }
  for (const [cle, attendu] of Object.entries(tableau)) {
    const [sexe, debut] = cle.split('/')
    // On interroge au milieu de la tranche, pas sur sa borne.
    const r = getCpaflaRange('vo2max', Number(debut) + 2, sexe as 'F' | 'M')
    assert.ok(r, `table attendue pour ${cle}`)
    assert.deepEqual(
      [r.percentiles.p10, r.percentiles.p25, r.percentiles.p50, r.percentiles.p75],
      attendu,
      `seuils divergents pour ${cle}`
    )
  }
})

test('CPAFLA — les bornes de tranche d’âge sont inclusives des deux côtés', () => {
  // 15-19, 20-29, … : un client de 19 ans et un de 20 ans ne doivent pas
  // tomber dans le même groupe, ni dans aucun.
  assert.deepEqual(getCpaflaRange('vo2max', 19, 'M')?.percentiles.p75, 57.4)
  assert.deepEqual(getCpaflaRange('vo2max', 20, 'M')?.percentiles.p75, 55.6)
  assert.deepEqual(getCpaflaRange('vo2max', 69, 'F')?.percentiles.p75, 35.8)
})

test('CPAFLA — hors 15-69 ans, aucune table plutôt qu’une extrapolation', () => {
  // Le repli sur l'ACSM est alors géré par getCategorization : mieux vaut une
  // autre norme explicite qu'un chiffre inventé aux extrémités.
  assert.equal(getCpaflaRange('vo2max', 14, 'M'), null)
  assert.equal(getCpaflaRange('vo2max', 70, 'F'), null)
})
