/**
 * Découpage des journées de menu.
 *
 * Testé parce que le texte manipulé est celui que Marie a écrit à la main : un
 * remplacement trop gourmand efface son travail, un remplacement trop timide
 * ajoute un doublon. Ni l'un ni l'autre ne se voit avant le document du client.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estLigneDe, ligneDuRepas, remplacerRepas, structureJournee } from './menu-lines.ts'

const JOURNEE = [
  'Déjeuner : yogourt grec, petits fruits, amandes',
  '',
  'Dîner : salade de pois chiches, feta, huile d’olive',
  '',
  'Souper : saumon au citron, riz brun, brocoli',
  '',
  'Collation : pomme et fromage'
].join('\n')

test('la structure suit le nombre de repas et de collations', () => {
  assert.deepEqual(structureJournee(3, 1), ['Déjeuner', 'Dîner', 'Souper', 'Collation'])
  // Deux repas = pas de déjeuner. C'est le matin qui saute, pas le souper.
  assert.deepEqual(structureJournee(2, 0), ['Dîner', 'Souper'])
  assert.deepEqual(structureJournee(1, 0), ['Souper'])
  // Zéro collation ne doit produire AUCUNE ligne de collation.
  assert.ok(!structureJournee(3, 0).some(r => r.startsWith('Collation')))
  // Plusieurs collations sont numérotées, pour pouvoir en refaire une seule.
  assert.deepEqual(structureJournee(2, 2), ['Dîner', 'Souper', 'Collation 1', 'Collation 2'])
})

test('la structure reste valide sur des nombres aberrants', () => {
  // Les bornes viennent d'un `<select>`, mais une donnée en base peut être hors
  // plage : mieux vaut une journée plausible qu'une liste vide.
  assert.deepEqual(structureJournee(0, 0), ['Souper'])
  assert.deepEqual(structureJournee(9, 9), ['Déjeuner', 'Dîner', 'Souper', 'Collation 1', 'Collation 2', 'Collation 3'])
})

test('reconnaît un repas malgré accents, casse et puces', () => {
  assert.ok(estLigneDe('Déjeuner : œufs', 'Déjeuner'))
  assert.ok(estLigneDe('dejeuner: œufs', 'Déjeuner'))
  assert.ok(estLigneDe('- Dîner : soupe', 'Dîner'))
  assert.ok(estLigneDe('  SOUPER   :  poisson', 'Souper'))
})

test('n’attrape pas une note libre qui commence par le mot', () => {
  // Sans l'exigence du deux-points, cette note serait écrasée par une reprise.
  assert.ok(!estLigneDe('Souper léger les soirs d’entraînement', 'Souper'))
  assert.ok(!estLigneDe('Collation à éviter après 20 h', 'Collation'))
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
  const out = remplacerRepas(sansDiner, 'Dîner', 'Dîner : salade de lentilles', structureJournee(3, 1))
  const ordre = out.split('\n').filter(l => l.trim())
  assert.match(ordre[0], /^Déjeuner/)
  assert.match(ordre[1], /^Dîner/)
  assert.match(ordre[2], /^Souper/)
})

test('une collation numérotée s’insère après l’autre, pas avant', () => {
  const ordre = structureJournee(3, 2)
  const j = 'Déjeuner : gruau\n\nDîner : salade\n\nSouper : poisson\n\nCollation 1 : pomme'
  const out = remplacerRepas(j, 'Collation 2', 'Collation 2 : yogourt', ordre)
  const lignes = out.split('\n').filter(l => l.trim())
  assert.match(lignes[3], /^Collation 1/)
  assert.match(lignes[4], /^Collation 2/)
})

test('un repas absent et dernier de l’ordre va à la fin', () => {
  const out = remplacerRepas('Déjeuner : œufs', 'Collation', 'Collation : noix', structureJournee(3, 1))
  assert.match(out, /^Déjeuner : œufs\n\nCollation : noix$/)
})

test('journée vide, ou remplacement vide — rien ne casse', () => {
  assert.equal(remplacerRepas('', 'Déjeuner', 'Déjeuner : œufs', structureJournee(3, 1)), 'Déjeuner : œufs')
  assert.equal(remplacerRepas(JOURNEE, 'Déjeuner', '   '), JOURNEE, 'un vide ne doit rien effacer')
})

test('remplacer deux fois de suite ne duplique pas', () => {
  // Le piège classique : la 2e passe n'a pas reconnu la ligne écrite par la 1re.
  let out = remplacerRepas(JOURNEE, 'Déjeuner', 'Déjeuner : gruau et noix')
  out = remplacerRepas(out, 'Déjeuner', 'Déjeuner : rôties et beurre d’arachide')
  assert.equal(out.split(/^Déjeuner/gm).length - 1, 1, 'deux lignes de déjeuner')
  assert.match(out, /rôties/)
})
