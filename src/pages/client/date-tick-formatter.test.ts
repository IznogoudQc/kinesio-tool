/**
 * Tests des étiquettes d'axe : deux prises d'un même mois doivent se distinguer.
 * Lancer : `node --test src/pages/client/date-tick-formatter.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatBilanDate, formatBilanMonth, formatDayMonth, makeDateTickFormatter } from './bilanFields.ts'

test('un mois unique garde son étiquette de mois', () => {
  const dates = ['2026-02-26', '2026-06-25', '2026-07-18']
  const tick = makeDateTickFormatter(dates)
  assert.deepEqual(dates.map(tick), ['févr 2026', 'juin 2026', 'juill 2026'])
})

test('deux prises du même mois passent au jour, les voisines non', () => {
  // Le cas qui rendait le graphique illisible : deux « sept 2026 » côte à côte.
  const dates = ['2026-08-15', '2026-09-03', '2026-09-17', '2026-10-02']
  const tick = makeDateTickFormatter(dates)
  assert.deepEqual(dates.map(tick), ['août 2026', '3 sept', '17 sept', 'oct 2026'])
})

test('le dédoublement se juge sur le mois ET l’année', () => {
  // Septembre 2025 et septembre 2026 ne sont pas le même mois : rien à lever.
  const dates = ['2025-09-04', '2026-09-04']
  const tick = makeDateTickFormatter(dates)
  assert.deepEqual(dates.map(tick), ['sept 2025', 'sept 2026'])
})

test('formatDayMonth donne le jour et le mois court, sans année', () => {
  assert.equal(formatDayMonth('2026-09-03'), '3 sept')
  assert.equal(formatDayMonth('2026-01-31'), '31 janv')
  assert.equal(formatDayMonth('2026-07-18'), '18 juill')
  // Entrée illisible rendue telle quelle, comme les autres formateurs.
  assert.equal(formatDayMonth('pas une date'), 'pas une date')
})

test('l’infobulle, elle, garde la date complète avec le jour', () => {
  // La spec demandait de le vérifier : c'est ce que le tooltip du graphique
  // affiche déjà, et c'est ce qui lève l'ambiguïté au survol.
  assert.equal(formatBilanDate('2026-09-03'), '3 septembre 2026')
  assert.equal(formatBilanMonth('2026-09-03'), 'sept 2026')
})
