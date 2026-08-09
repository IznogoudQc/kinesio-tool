/**
 * Préférences de menu par repas et par moment.
 *
 * Testé sur deux points qui cassent en silence : la relecture du JSON stocké
 * (une valeur inattendue en base ferait planter l'onglet Nutrition) et le
 * partage des sept journées entre semaine et fin de semaine.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  consignesPourMoment,
  momentDeJournee,
  parsePrefsRepas,
  prefDe,
  serializePrefsRepas,
  type PrefsRepas
} from './menu-prefs.ts'

test('journées 1 à 5 en semaine, 6 et 7 en fin de semaine', () => {
  const moments = Array.from({ length: 7 }, (_, i) => momentDeJournee(i))
  assert.deepEqual(moments, [
    'semaine', 'semaine', 'semaine', 'semaine', 'semaine',
    'weekend', 'weekend'
  ])
})

test('relit ce qui a été écrit', () => {
  const prefs: PrefsRepas = {
    'Déjeuner': { semaine: 'rapide, sans cuisson', weekend: 'omelette' },
    'Dîner': { semaine: 'souvent des salades', weekend: '' }
  }
  const relu = parsePrefsRepas(serializePrefsRepas(prefs))
  assert.equal(relu['Déjeuner'].semaine, 'rapide, sans cuisson')
  assert.equal(relu['Dîner'].weekend, '')
})

test('rien de renseigné → null en base, pas un objet vide', () => {
  assert.equal(serializePrefsRepas({}), null)
  assert.equal(serializePrefsRepas({ 'Souper': { semaine: '  ', weekend: '' } }), null)
})

test('une donnée abîmée ne fait pas planter l’écran', () => {
  // Chacun de ces cas est arrivé au moins une fois dans un projet : colonne
  // vide, JSON tronqué, forme d'une version antérieure.
  for (const brut of [null, undefined, '', '   ', '{oops', '[]', '"texte"', '{"Déjeuner":null}']) {
    assert.deepEqual(parsePrefsRepas(brut), {}, `cassé sur ${JSON.stringify(brut)}`)
  }
  // Un champ du mauvais type est ramené à une chaîne vide, pas propagé.
  const p = parsePrefsRepas('{"Souper":{"semaine":42,"weekend":"poisson"}}')
  assert.equal(p['Souper'].semaine, '')
  assert.equal(p['Souper'].weekend, 'poisson')
})

test('prefDe ne renvoie jamais undefined', () => {
  const p = prefDe({}, 'Déjeuner')
  assert.equal(p.semaine, '')
  assert.equal(p.weekend, '')
})

test('les consignes suivent la structure, pas les clés stockées', () => {
  const prefs: PrefsRepas = {
    'Déjeuner': { semaine: 'rapide', weekend: 'omelette' },
    'Dîner': { semaine: 'salades', weekend: '' },
    // Repas que le client ne prend plus : ne doit pas revenir dans le menu.
    'Collation 3': { semaine: 'noix', weekend: 'noix' }
  }
  const structure = ['Déjeuner', 'Dîner', 'Souper']
  assert.deepEqual(consignesPourMoment(prefs, structure, 'semaine'), [
    'Déjeuner : rapide',
    'Dîner : salades'
  ])
  // Le week-end, seul le déjeuner est renseigné.
  assert.deepEqual(consignesPourMoment(prefs, structure, 'weekend'), ['Déjeuner : omelette'])
})

test('rien de renseigné → aucune consigne, pas une ligne vide', () => {
  assert.deepEqual(consignesPourMoment({}, ['Déjeuner', 'Souper'], 'semaine'), [])
})

test('un texte multiligne devient une seule consigne lisible', () => {
  const prefs: PrefsRepas = { 'Souper': { semaine: 'poisson\n  légumes verts\n', weekend: '' } }
  assert.deepEqual(consignesPourMoment(prefs, ['Souper'], 'semaine'), ['Souper : poisson · légumes verts'])
})
