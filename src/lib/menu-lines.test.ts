/**
 * Découpage des journées de menu.
 *
 * Testé parce que le texte manipulé est celui que Marie a écrit à la main : un
 * remplacement trop gourmand efface son travail, un remplacement trop timide
 * ajoute un doublon. Ni l'un ni l'autre ne se voit avant le document du client.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estLigneDe, ligneDuRepas, remplacerRepas } from './menu-lines.ts'

const JOURNEE = [
  'Déjeuner : yogourt grec, petits fruits, amandes',
  '',
  'Dîner : salade de pois chiches, feta, huile d’olive',
  '',
  'Souper : saumon au citron, riz brun, brocoli',
  '',
  'Collations : pomme et fromage'
].join('\n')

test('reconnaît un repas malgré accents, casse et puces', () => {
  assert.ok(estLigneDe('Déjeuner : œufs', 'Déjeuner'))
  assert.ok(estLigneDe('dejeuner: œufs', 'Déjeuner'))
  assert.ok(estLigneDe('- Dîner : soupe', 'Dîner'))
  assert.ok(estLigneDe('  SOUPER   :  poisson', 'Souper'))
})

test('n’attrape pas une note libre qui commence par le mot', () => {
  // Sans l'exigence du deux-points, cette note serait écrasée par une reprise.
  assert.ok(!estLigneDe('Souper léger les soirs d’entraînement', 'Souper'))
  assert.ok(!estLigneDe('Collations à éviter après 20 h', 'Collations'))
})

test('lit la ligne d’un repas, ou null s’il est absent', () => {
  assert.equal(ligneDuRepas(JOURNEE, 'Dîner'), 'Dîner : salade de pois chiches, feta, huile d’olive')
  assert.equal(ligneDuRepas('Déjeuner : œufs', 'Souper'), null)
})

test('remplace un repas sans toucher aux autres', () => {
  const out = remplacerRepas(JOURNEE, 'Souper', 'Souper : poulet grillé, couscous, courgettes')
  assert.match(out, /Souper : poulet grillé/)
  assert.ok(!out.includes('saumon au citron'), 'l’ancien souper subsiste')
  // Les trois autres repas sont intacts, une seule fois chacun.
  for (const garde of ['yogourt grec', 'pois chiches', 'pomme et fromage']) {
    assert.equal(out.split(garde).length - 1, 1, `${garde} altéré ou dupliqué`)
  }
  assert.equal(out.split('\n').length, JOURNEE.split('\n').length, 'nombre de lignes changé')
})

test('un repas absent s’insère à sa place, pas à la fin', () => {
  const sansDiner = 'Déjeuner : œufs et pain\n\nSouper : poisson et légumes'
  const out = remplacerRepas(sansDiner, 'Dîner', 'Dîner : salade de lentilles')
  const ordre = out.split('\n').filter(l => l.trim())
  assert.match(ordre[0], /^Déjeuner/)
  assert.match(ordre[1], /^Dîner/)
  assert.match(ordre[2], /^Souper/)
})

test('un repas absent et dernier de l’ordre va à la fin', () => {
  const out = remplacerRepas('Déjeuner : œufs', 'Collations', 'Collations : noix')
  assert.match(out, /^Déjeuner : œufs\n\nCollations : noix$/)
})

test('journée vide, ou remplacement vide — rien ne casse', () => {
  assert.equal(remplacerRepas('', 'Déjeuner', 'Déjeuner : œufs'), 'Déjeuner : œufs')
  assert.equal(remplacerRepas(JOURNEE, 'Déjeuner', '   '), JOURNEE, 'un vide ne doit rien effacer')
})

test('remplacer deux fois de suite ne duplique pas', () => {
  // Le piège classique : la 2e passe n'a pas reconnu la ligne écrite par la 1re.
  let out = remplacerRepas(JOURNEE, 'Déjeuner', 'Déjeuner : gruau et noix')
  out = remplacerRepas(out, 'Déjeuner', 'Déjeuner : rôties et beurre d’arachide')
  assert.equal(out.split(/^Déjeuner/gm).length - 1, 1, 'deux lignes de déjeuner')
  assert.match(out, /rôties/)
})
