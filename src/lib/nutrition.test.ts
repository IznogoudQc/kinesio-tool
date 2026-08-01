/**
 * Tests du moteur objectif chiffré & nutrition — cas Nicholas Jean (H 48 ans).
 *
 * Lancer : `node --test src/lib/nutrition.test.ts`
 *
 * Référence (calculs vérifiés à la main) :
 *   poids 99.8 kg, %gras 30.2, cible 15 %, taille 176, âge 48, H, activité modérée
 *   - masse maigre = 99.8 × 0.698 = 69.66 kg
 *   - poids-cible  = 69.66 / 0.85 = 81.95 → 82.0 kg
 *   - à perdre     = 99.8 − 81.95 = 17.85 → 17.8 kg (≈ 39 lb)
 *   - BMR Mifflin  = 10×99.8 + 6.25×176 − 5×48 + 5 = 1863
 *   - TDEE modéré  = 1863 × 1.55 = 2888
 *   - cible kcal   = 2888 × 0.8 = 2310
 *   - protéines    = 82.0 × 2.0 = 164 g ; lipides = 2310×0.25/9 = 64 g
 *   - glucides     = (2310 − 656 − 576)/4 = 270 g
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bodyFatGoal,
  mifflinBmr,
  estimateMacros,
  DEFAULT_PROTEIN_PER_KG,
  PROTEIN_PER_KG_RANGE,
  fiberTargetG,
  dailyDeficitForRate,
  weeklyLossFromDeficit,
  weeksToGoal,
  DEFAULT_FAT_MAX_G,
  FAT_PCT_OF_KCAL_RANGE,
  fatPctOfKcal,
  fatGramsRangeForKcal,
  DEFAULT_FAT_PCT
} from './nutrition.ts'

const close = (a: number, b: number, eps = 0.15) => Math.abs(a - b) <= eps

test('bodyFatGoal — Nicholas 99.8 kg / 30.2 % → cible 15 %', () => {
  const g = bodyFatGoal(99.8, 30.2, 15)
  assert.ok(g !== null)
  assert.ok(close(g!.leanKg, 69.7), `leanKg ${g!.leanKg}`)
  assert.ok(close(g!.goalKg, 82.0), `goalKg ${g!.goalKg}`)
  assert.ok(close(g!.toLoseKg, 17.8), `toLoseKg ${g!.toLoseKg}`)
})

test('bodyFatGoal — déjà à la cible → rien à perdre', () => {
  const g = bodyFatGoal(80, 15, 15)
  assert.ok(g !== null)
  assert.ok(Math.abs(g!.toLoseKg) < 0.2, `toLoseKg ${g!.toLoseKg}`)
})

test('bodyFatGoal — sous la cible (plus lean) → toLose négatif', () => {
  const g = bodyFatGoal(80, 12, 15)
  assert.ok(g !== null && g!.toLoseKg < 0)
})

test('bodyFatGoal — données manquantes / invalides → null', () => {
  assert.equal(bodyFatGoal(null, 30, 15), null)
  assert.equal(bodyFatGoal(99.8, undefined, 15), null)
  assert.equal(bodyFatGoal(99.8, 30, null), null)
  assert.equal(bodyFatGoal(99.8, 30, 0), null)
  assert.equal(bodyFatGoal(99.8, 100, 15), null)
  assert.equal(bodyFatGoal(0, 30, 15), null)
})

test('mifflinBmr — Nicholas → 1863', () => {
  assert.equal(mifflinBmr({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M' }), 1863)
})

test('mifflinBmr — femme (−161)', () => {
  // 10×60 + 6.25×165 − 5×30 − 161 = 600 + 1031.25 − 150 − 161 = 1320.25 → 1320
  assert.equal(mifflinBmr({ weightKg: 60, heightCm: 165, age: 30, sex: 'F' }), 1320)
})

test('mifflinBmr — sexe/données manquantes → null', () => {
  assert.equal(mifflinBmr({ weightKg: 99.8, heightCm: 176, age: 48, sex: null }), null)
  assert.equal(mifflinBmr({ weightKg: null, heightCm: 176, age: 48, sex: 'M' }), null)
})

test('estimateMacros — protéines = POIDS CORPOREL × 1,4 (base v0.9.106)', () => {
  // Base changée à la demande de Marie : g par kg de poids corporel, plus par
  // livre de masse maigre. 99,8 kg × 1,4 = 140 g ; lipides plafond 60 ;
  // TDEE 2888, défaut −20 % → 2310 kcal ; glucides = (2310 − 560 − 540)/4 = 303.
  const m = estimateMacros({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M', activity: 'modere', leanKg: 69.66 })
  assert.ok(m !== null)
  assert.equal(m!.bmr, 1863)
  assert.equal(m!.tdee, 2888)
  assert.equal(m!.targetKcal, 2310)
  assert.equal(m!.proteinG, 140)
  assert.equal(m!.fatG, 60)
  assert.equal(m!.carbsG, 303)
  // Fibres = 14 g / 1000 kcal → round(2310/1000·14) = 32.
  assert.equal(m!.fiberG, 32)
})

test('fiberTargetG — 14 g par 1000 kcal (référence Santé Canada / DRI)', () => {
  assert.equal(fiberTargetG(2000), 28)
  assert.equal(fiberTargetG(2500), 35)
  assert.equal(fiberTargetG(1800), 25) // ≈ cible femme adulte
  assert.equal(fiberTargetG(2700), 38) // ≈ cible homme adulte
})

test('estimateMacros — formule personnalisée (1,6 g/kg, gras max 50)', () => {
  const m = estimateMacros({
    weightKg: 99.8,
    heightCm: 176,
    age: 48,
    sex: 'M',
    activity: 'modere',
    leanKg: 69.66,
    proteinPerKg: 1.6,
    fatMaxG: 50
  })
  assert.ok(m !== null)
  assert.equal(m!.proteinG, Math.round(99.8 * 1.6)) // 160
  assert.equal(m!.fatG, 50)
})

test('estimateMacros — cible kcal jamais sous le BMR', () => {
  // Sédentaire : TDEE 1863×1.2 = 2236 ; 0.8× = 1789 < BMR 1863 → clampé au BMR.
  const m = estimateMacros({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M', activity: 'sedentaire', leanKg: 69.66 })
  assert.ok(m !== null && m!.targetKcal >= m!.bmr)
})

test('estimateMacros — activité/masse maigre/données manquantes → null', () => {
  assert.equal(estimateMacros({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M', activity: null, leanKg: 69.66 }), null)
  assert.equal(estimateMacros({ weightKg: null, heightCm: 176, age: 48, sex: 'M', activity: 'modere', leanKg: 69.66 }), null)
  assert.equal(estimateMacros({ weightKg: 99.8, heightCm: 176, age: 48, sex: 'M', activity: 'modere', leanKg: null }), null)
})

test('dailyDeficitForRate — 0.5 kg/sem → 550 kcal/j', () => {
  // 0.5 × 7700 / 7 = 550
  assert.equal(dailyDeficitForRate(0.5), 550)
  assert.equal(dailyDeficitForRate(1.0), 1100)
})

test('dailyDeficitForRate — rythme absent/invalide → null', () => {
  assert.equal(dailyDeficitForRate(null), null)
  assert.equal(dailyDeficitForRate(0), null)
  assert.equal(dailyDeficitForRate(-0.5), null)
})

test('weeklyLossFromDeficit — inverse de dailyDeficitForRate (550 → ~0.5 kg/sem)', () => {
  const close = (a: number, b: number) => Math.abs(a - b) <= 0.01
  assert.ok(close(weeklyLossFromDeficit(550)!, 0.5))
  assert.ok(close(weeklyLossFromDeficit(1100)!, 1.0))
})

test('weeklyLossFromDeficit — déficit nul ou négatif → null (aucune perte)', () => {
  assert.equal(weeklyLossFromDeficit(0), null)
  assert.equal(weeklyLossFromDeficit(-200), null)
  assert.equal(weeklyLossFromDeficit(null), null)
})

test('weeksToGoal — 17.8 kg à 0.5 kg/sem → 35.6 semaines', () => {
  assert.ok(close(weeksToGoal(17.8, 0.5)!, 35.6, 0.05))
})

test('weeksToGoal — rien à perdre / rythme nul → null', () => {
  assert.equal(weeksToGoal(0, 0.5), null)
  assert.equal(weeksToGoal(17.8, 0), null)
  assert.equal(weeksToGoal(null, 0.5), null)
})

test('estimateMacros — déficit selon le rythme (0.5 kg/sem = −550)', () => {
  const m = estimateMacros({
    weightKg: 99.8,
    heightCm: 176,
    age: 48,
    sex: 'M',
    activity: 'modere',
    leanKg: 69.66,
    dailyDeficitKcal: 550
  })
  assert.ok(m !== null)
  // TDEE 2888 − 550 = 2338 ; glucides = (2338 − 560 − 540)/4 = 310.
  assert.equal(m!.targetKcal, 2338)
  assert.equal(m!.proteinG, 140)
  assert.equal(m!.fatG, 60)
  assert.equal(m!.carbsG, 310)
})

test('estimateMacros — calories manuelles (override) priment sur le calcul auto', () => {
  const m = estimateMacros({
    weightKg: 99.8,
    heightCm: 176,
    age: 48,
    sex: 'M',
    activity: 'modere',
    leanKg: 69.66,
    dailyDeficitKcal: 550,
    targetKcalOverride: 2000
  })
  assert.ok(m !== null)
  assert.equal(m!.targetKcal, 2000) // ignore le déficit auto
  assert.equal(m!.proteinG, 140) // protéines inchangées : elles suivent le POIDS
  assert.equal(m!.fatG, 60)
  assert.equal(m!.carbsG, Math.max(0, Math.round((2000 - 140 * 4 - 60 * 9) / 4))) // 225
})

test('estimateMacros — déficit rapide clampé au BMR', () => {
  // Déficit énorme → targetKcal ne descend jamais sous le BMR.
  const m = estimateMacros({
    weightKg: 99.8,
    heightCm: 176,
    age: 48,
    sex: 'M',
    activity: 'modere',
    leanKg: 69.66,
    dailyDeficitKcal: 5000
  })
  assert.ok(m !== null && m!.targetKcal === m!.bmr)
})

test('la masse maigre n’entre PLUS dans les protéines', () => {
  // Le garde-fou du changement de base : deux clients de même poids mais de
  // composition très différente doivent recevoir la même cible protéique.
  const base = { weightKg: 91.8, heightCm: 176, age: 49, sex: 'M' as const, activity: 'modere' as const }
  const muscle = estimateMacros({ ...base, leanKg: 75, proteinPerKg: 1.4 })
  const moinsMuscle = estimateMacros({ ...base, leanKg: 55, proteinPerKg: 1.4 })
  assert.equal(muscle!.proteinG, moinsMuscle!.proteinG)
  assert.equal(muscle!.proteinG, Math.round(91.8 * 1.4)) // 129
})

test('la fourchette annoncée à Marie encadre bien le défaut', () => {
  assert.ok(PROTEIN_PER_KG_RANGE.min <= DEFAULT_PROTEIN_PER_KG)
  assert.ok(DEFAULT_PROTEIN_PER_KG <= PROTEIN_PER_KG_RANGE.max)
  assert.equal(DEFAULT_PROTEIN_PER_KG, PROTEIN_PER_KG_RANGE.usual)
})

test('fatPctOfKcal : part des calories venant des lipides', () => {
  // 60 g × 9 = 540 kcal sur 1662 → 32,5 %
  assert.equal(Math.round((fatPctOfKcal(60, 1662) as number) * 10) / 10, 32.5)
  assert.equal(fatPctOfKcal(60, 0), null)
  assert.equal(fatPctOfKcal(null, 1800), null)
})

test('fatPctOfKcal : le défaut de 60 g sort de la fourchette au-delà de 1800 kcal', () => {
  // C'est le piège du plafond fixe : la part chute quand les calories montent.
  assert.ok((fatPctOfKcal(DEFAULT_FAT_MAX_G, 1800) as number) >= FAT_PCT_OF_KCAL_RANGE.min)
  assert.ok((fatPctOfKcal(DEFAULT_FAT_MAX_G, 2200) as number) < FAT_PCT_OF_KCAL_RANGE.min)
})

test('fatGramsRangeForKcal : bornes en grammes de la fourchette 30-40 %', () => {
  const r = fatGramsRangeForKcal(2000)
  assert.ok(r)
  assert.equal(r.min, 67) // 2000 × 0,30 / 9
  assert.equal(r.max, 89) // 2000 × 0,40 / 9
  assert.equal(fatGramsRangeForKcal(0), null)
})

test('estimateMacros : mode % — les lipides suivent les calories', () => {
  const base = {
    weightKg: 99.8, heightCm: 176, age: 48, sex: 'M' as const,
    activity: 'modere' as const, leanKg: 69.66, dailyDeficitKcal: 550
  }
  const enG = estimateMacros({ ...base, fatMaxG: 60, fatMode: 'g' as const })
  const enPct = estimateMacros({ ...base, fatMaxG: 60, fatMode: 'pct' as const, fatPct: 35 })
  assert.ok(enG && enPct)
  // Mêmes calories, mêmes protéines : seuls les lipides (et donc les glucides) bougent.
  assert.equal(enG.targetKcal, enPct.targetKcal)
  assert.equal(enG.proteinG, enPct.proteinG)
  assert.equal(enG.fatG, 60)
  assert.equal(enPct.fatG, Math.round((enPct.targetKcal * 35) / 100 / 9))
  // Et la part obtenue retombe bien sur 35 % (à l'arrondi près).
  assert.ok(Math.abs((fatPctOfKcal(enPct.fatG, enPct.targetKcal) as number) - 35) < 0.5)
})

test('estimateMacros : sans fatMode, comportement historique inchangé', () => {
  const base = {
    weightKg: 99.8, heightCm: 176, age: 48, sex: 'M' as const,
    activity: 'modere' as const, leanKg: 69.66, dailyDeficitKcal: 550, fatMaxG: 80
  }
  // Aucun client existant ne doit voir ses chiffres changer : absent, null et 'g'
  // doivent donner exactement le même résultat.
  const sansMode = estimateMacros(base)
  assert.equal(sansMode?.fatG, 80)
  assert.equal(estimateMacros({ ...base, fatMode: null })?.fatG, 80)
  assert.equal(estimateMacros({ ...base, fatMode: 'g' as const })?.fatG, 80)
})

test('estimateMacros : mode % sans valeur → milieu de la fourchette (35 %)', () => {
  const m = estimateMacros({
    weightKg: 99.8, heightCm: 176, age: 48, sex: 'M', activity: 'modere',
    leanKg: 69.66, dailyDeficitKcal: 550, fatMode: 'pct', fatPct: null
  })
  assert.ok(m)
  assert.equal(m.fatG, Math.round((m.targetKcal * DEFAULT_FAT_PCT) / 100 / 9))
  assert.ok(DEFAULT_FAT_PCT >= FAT_PCT_OF_KCAL_RANGE.min && DEFAULT_FAT_PCT <= FAT_PCT_OF_KCAL_RANGE.max)
})
