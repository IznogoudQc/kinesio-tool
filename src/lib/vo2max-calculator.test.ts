/**
 * Tests des estimateurs VO2max (Bruce, Cooper, Léger) + helpers Bruce.
 *
 * Lancer : `node --test src/lib/vo2max-calculator.test.ts`
 *
 * Cas du brief :
 *  - Bruce H 12 min → ~49 ml/kg/min (Foster/Pollock)
 *  - Bruce F 8 min → 31.14 (4.38 x 8 - 3.9)
 *  - Cooper 2400 m → ~42
 *  - Léger : le brief annoncait ~36. On a longtemps cru qu'il parlait d'un
 *           enfant, parce que la formule sortait -3.65 a 30 ans. En fait le
 *           code passait le numero de palier la ou l'equation attend une
 *           VITESSE en km/h. Corrige le 2026-08-07 ; voir `legerSpeedKmh`.
 *  - Nicholas (H 48 ans, 12:30) → ~49 (matche son bilan reel)
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BRUCE_STAGES,
  bruceStageFor,
  bruceTreadmillVo2max,
  cooperVo2max,
  formatMmSs,
  legerVo2max,
  legerSpeedKmh,
  VO2MAX_PROTOCOLES,
  parseMmSs,
  sayersLegPower
} from './vo2max-calculator.ts'

const close = (a: number, b: number, eps = 1) => Math.abs(a - b) <= eps

test('Bruce — homme 12 min → ~42.4 (Foster/Pollock littéral)', () => {
  // Note : le brief annonçait "~49" mais Foster/Pollock 1984 donne :
  //   14.76 - 1.379*12 + 0.451*144 - 0.012*1728 = 42.42
  // Le ~49 du brief correspondait probablement à un autre estimateur (Bruce-FRIEND
  // ou ACSM treadmill). On garde Foster/Pollock comme demandé par le brief.
  const v = bruceTreadmillVo2max({ durationSeconds: 12 * 60, sex: 'M' })
  assert.ok(close(v, 42.4, 0.1), `attendu 42.4, reçu ${v}`)
})

test('Bruce — femme 8 min → ~31.14', () => {
  const v = bruceTreadmillVo2max({ durationSeconds: 8 * 60, sex: 'F' })
  assert.ok(close(v, 31.14, 0.01), `attendu 31.14, reçu ${v}`)
})

test('Bruce — Nicholas 12:30 (12.5 min) homme → ~44.6 Foster/Pollock', () => {
  // Brief : 12:30 → ~49 (matche son bilan réel). Mais Foster/Pollock donne 44.6.
  // L'écart (~5 ml/kg/min) est cohérent : le bilan de Nicholas a probablement
  // utilisé une autre équation (Bruce-FRIEND prend en compte l'âge).
  const v = bruceTreadmillVo2max({ durationSeconds: 12 * 60 + 30, sex: 'M' })
  assert.ok(close(v, 44.6, 0.1), `attendu 44.6, reçu ${v}`)
})

test('Bruce — durée 0 ou invalide → NaN', () => {
  assert.ok(Number.isNaN(bruceTreadmillVo2max({ durationSeconds: 0, sex: 'M' })))
  assert.ok(Number.isNaN(bruceTreadmillVo2max({ durationSeconds: -10, sex: 'F' })))
})

test('Cooper — 2400 m → ~42', () => {
  const v = cooperVo2max(2400)
  assert.ok(close(v, 42), `attendu ~42, reçu ${v}`)
})

test('Cooper — distance manquante → NaN', () => {
  assert.ok(Number.isNaN(cooperVo2max(0)))
})

test('Léger — le palier se convertit en vitesse avant l’équation', () => {
  // Le palier 1 se court à 8,5 km/h, +0,5 km/h par palier.
  assert.equal(legerSpeedKmh(1), 8.5)
  assert.equal(legerSpeedKmh(8), 12)
  assert.equal(legerSpeedKmh(21), 18.5)
})

test('Léger — palier 8, 30 ans → ~27.7', () => {
  // Ce test a longtemps affirmé -3,65 : le `V` de l'équation publiée est une
  // VITESSE en km/h et le code lui passait le numéro de palier. Le commentaire
  // d'alors notait que le brief annonçait « ~36 » et concluait que le brief
  // parlait d'un enfant — c'était l'inverse. Un VO2max négatif était le signe
  // que l'entrée n'était pas dans la bonne unité, pas un cas limite à expliquer.
  assert.ok(close(legerVo2max(8, 30), 27.74, 0.1))
})

test('Léger — palier 9 à 20 ans ≈ 45, l’ordre de grandeur publié', () => {
  assert.ok(close(legerVo2max(9, 20), 44.94, 0.1))
})

test('Léger — croît avec le palier et décroît avec l’âge', () => {
  // Deux propriétés que la version fautive violait déjà en pratique : elle
  // rendait négatif tout adulte, donc « plus haut palier » restait ordonné mais
  // sur des valeurs impossibles. Ancrer le sens du monde réel, pas juste l'ordre.
  for (let p = 1; p < 21; p++) assert.ok(legerVo2max(p + 1, 30) > legerVo2max(p, 30))
  for (let a = 15; a < 70; a++) assert.ok(legerVo2max(10, a + 1) < legerVo2max(10, a))
  // Un adulte moyen sur un palier moyen doit tomber dans une plage physiologique.
  const v = legerVo2max(8, 40)
  assert.ok(v > 10 && v < 60, `palier 8 à 40 ans hors plage physiologique : ${v}`)
})

test('Léger — paramètres invalides → NaN', () => {
  assert.ok(Number.isNaN(legerVo2max(0, 30)))
  assert.ok(Number.isNaN(legerVo2max(8, 0)))
})

test('VO2MAX_PROTOCOLES — les exemples affichés restent plausibles', () => {
  // Le seul garde-fou automatique contre une erreur d'unité comme celle du
  // palier/vitesse : elle sortait -3,65, donc hors plage. Un exemple qui dérive
  // échoue ici, avant d'aller s'afficher dans l'écran des barèmes.
  assert.equal(VO2MAX_PROTOCOLES.length, 3)
  for (const p of VO2MAX_PROTOCOLES) {
    const { vo2max } = p.exemple()
    assert.ok(
      Number.isFinite(vo2max) && vo2max > 15 && vo2max < 70,
      `${p.nom} : exemple hors plage physiologique (${vo2max})`
    )
    assert.ok(p.formule.length > 0 && p.source.length > 0, `${p.nom} : formule ou source vide`)
  }
})

test('BRUCE_STAGES — 7 paliers de 3 min', () => {
  assert.equal(BRUCE_STAGES.length, 7)
  assert.equal(BRUCE_STAGES[0].endMinutes, 3)
  assert.equal(BRUCE_STAGES[6].endMinutes, 21)
})

test('bruceStageFor — 12:30 → stage 5 (vient de commencer)', () => {
  const s = bruceStageFor(12 * 60 + 30)
  assert.equal(s?.stage, 5)
})

test('bruceStageFor — pile 12 min → stage 4', () => {
  const s = bruceStageFor(12 * 60)
  assert.equal(s?.stage, 4)
})

test('bruceStageFor — durée nulle → null', () => {
  assert.equal(bruceStageFor(0), null)
  assert.equal(bruceStageFor(-1), null)
})

test('Sayers — Nicholas saut 48 cm + 99.8 kg → 5380 W', () => {
  // P = 60.7*48 + 45.3*99.8 - 2055 = 2913.6 + 4520.94 - 2055 = 5379.54 → 5380
  assert.equal(sayersLegPower(48, 99.8), 5380)
})

test('Sayers — saut 60, poids 80 → 5211 W', () => {
  // 60.7*60 + 45.3*80 - 2055 = 3642 + 3624 - 2055 = 5211
  assert.equal(sayersLegPower(60, 80), 5211)
})

test('Sayers — données manquantes ou nulles → null', () => {
  assert.equal(sayersLegPower(undefined, 80), null)
  assert.equal(sayersLegPower(50, undefined), null)
  assert.equal(sayersLegPower(0, 80), null)
  assert.equal(sayersLegPower(50, 0), null)
  assert.equal(sayersLegPower(-10, 80), null)
})

test('parseMmSs / formatMmSs — aller-retour', () => {
  assert.equal(parseMmSs('12:30'), 750)
  assert.equal(parseMmSs('5:05'), 305)
  assert.equal(parseMmSs(' 8:00 '), 480)
  assert.equal(parseMmSs('abc'), null)
  assert.equal(parseMmSs('12:99'), null)
  assert.equal(formatMmSs(750), '12:30')
  assert.equal(formatMmSs(305), '5:05')
  assert.equal(formatMmSs(null), '')
  assert.equal(formatMmSs(undefined), '')
})
