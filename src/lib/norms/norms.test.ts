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

function getCategorization(
  test: TestKey,
  value: number,
  age: number,
  sex: 'F' | 'M',
  norms: NormsType = 'acsm'
): Category | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const range = norms === 'cpafla' ? getCpaflaRange(test, age, sex) : getAcsmRange(test, age, sex)
  if (!range) return null
  const { percentiles: p, lowerIsBetter } = range
  if (lowerIsBetter) {
    if (value < p.p75) return 'EXCELLENT'
    if (value < p.p50) return 'TRES_BIEN'
    if (value < p.p25) return 'BIEN'
    if (value < p.p10) return 'ACCEPTABLE'
    return 'A_AMELIORER'
  }
  if (value >= p.p75) return 'EXCELLENT'
  if (value >= p.p50) return 'TRES_BIEN'
  if (value >= p.p25) return 'BIEN'
  if (value >= p.p10) return 'ACCEPTABLE'
  return 'A_AMELIORER'
}

// Copies de l'API publique (mêmes raisons que ci-dessus — Node `--test` ne peut
// pas suivre la chaîne d'imports sans extensions). Si vous modifiez ces
// fonctions, mettre à jour aussi `src/lib/norms/index.ts`.

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

test('Tour de taille — seuils Santé Canada', () => {
  // H : ≤80 = EXCELLENT, ≤102 = ACCEPTABLE, >102 = A_AMELIORER
  assert.equal(getCategorization('waistCircumference', 78, 40, 'M'), 'EXCELLENT')
  assert.equal(getCategorization('waistCircumference', 105, 40, 'M'), 'A_AMELIORER')
  // F : ≤80 = BIEN, ≤88 = ACCEPTABLE
  assert.equal(getCategorization('waistCircumference', 85, 40, 'F'), 'ACCEPTABLE')
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

test('CPAFLA — ossature prête, tables non encore encodées → null partout', () => {
  // Tant que les barèmes officiels CSEP-PATH ne sont pas encodés (cf. ADR 0013),
  // getCpaflaRange retourne null et la catégorisation retombe sur « — ».
  assert.equal(getCpaflaRange('pushups', 35, 'M'), null)
  assert.equal(getCpaflaRange('situps', 35, 'F'), null)
  assert.equal(getCpaflaRange('trunkFlexion', 35, 'M'), null)
  assert.equal(getCpaflaRange('legPower', 35, 'M'), null)
  assert.equal(getCategorization('vo2max', 49, 35, 'M', 'cpafla'), null)
  assert.equal(getCategorization('bodyFat', 12, 35, 'F', 'cpafla'), null)
  assert.equal(cpaflaHasTables(), false)
})

test('Valeur invalide → null', () => {
  assert.equal(getCategorization('vo2max', Number.NaN, 35, 'M'), null)
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
  // legPower hors ACSM dans cpafla
  assert.equal(getNextCategoryTarget('vo2max', 49, 35, 'M', 'cpafla'), null)
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
