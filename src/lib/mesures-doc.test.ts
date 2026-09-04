import { test } from 'node:test'
import assert from 'node:assert/strict'
import { datesDesPrises, evolution, groupesDeMesures } from './mesures-doc.ts'

const CIRC = [
  // Volontairement dans le désordre : l'ordre d'arrivée des lignes ne l'est pas.
  { date: '2026-06-25', poidsKg: 91.8, taille: 93, hanche: 107, bicepsG: 40 },
  { date: '2026-02-26', poidsKg: 93.9, taille: 97, hanche: 106 }
]
const PLIS = [
  { date: '2026-06-25', triceps: 6, biceps: 5.5, sousscapulaire: 18.5, iliaque: 15, somme4Plis: 45, pourcentageGrasSiri: 23.1 },
  { date: '2026-02-26', triceps: 5, biceps: 6, sousscapulaire: 17, iliaque: 22, mollet: 9, somme4Plis: 50, pourcentageGrasSiri: 24.6 }
]

test('les points d’une série vont du plus ancien au plus récent', () => {
  const [composition] = groupesDeMesures(CIRC, PLIS)
  const poids = composition.series.find(s => s.cle === 'poids')!
  assert.deepEqual(
    poids.points.map(p => p.date),
    ['2026-02-26', '2026-06-25']
  )
})

test('une mesure jamais prise ne produit aucune série', () => {
  const groupes = groupesDeMesures(CIRC, PLIS)
  const circ = groupes.find(g => g.titre === 'Circonférences')!
  // Ni abdomen ni cou dans les prises : ils ne doivent pas apparaître.
  assert.deepEqual(circ.series.map(s => s.cle), ['taille', 'hanche', 'bicepsG'])
})

test('une mesure prise une seule fois compte quand même', () => {
  const groupes = groupesDeMesures(CIRC, PLIS)
  const plis = groupes.find(g => g.titre === 'Plis cutanés')!
  const mollet = plis.series.find(s => s.cle === 'mollet')!
  assert.equal(mollet.points.length, 1)
  // Une seule prise : pas d'écart à annoncer.
  assert.equal(evolution(mollet), null)
})

test('le poids suit l’unité du client', () => {
  const enKg = groupesDeMesures(CIRC, PLIS, 'kg')[0].series.find(s => s.cle === 'poids')!
  assert.equal(enKg.unite, 'kg')
  assert.equal(enKg.points[1].valeur, 91.8)

  const enLb = groupesDeMesures(CIRC, PLIS, 'lb')[0].series.find(s => s.cle === 'poids')!
  assert.equal(enLb.unite, 'lb')
  assert.equal(enLb.points[1].valeur, 202.4)
})

test('l’écart va de la première à la dernière prise', () => {
  const groupes = groupesDeMesures(CIRC, PLIS, 'kg')
  const taille = groupes.find(g => g.titre === 'Circonférences')!.series.find(s => s.cle === 'taille')!
  const ev = evolution(taille)!
  assert.equal(ev.depuis.date, '2026-02-26')
  assert.equal(ev.vers.date, '2026-06-25')
  assert.equal(ev.ecart, -4)
})

test('un groupe sans aucune mesure disparaît', () => {
  const groupes = groupesDeMesures([{ date: '2026-01-01', poidsKg: 80 }], [])
  assert.deepEqual(groupes.map(g => g.titre), ['Poids et composition'])
})

test('aucune prise : aucun groupe', () => {
  assert.deepEqual(groupesDeMesures([], []), [])
})

test('les dates de prise sont dédoublonnées et triées', () => {
  assert.deepEqual(datesDesPrises(CIRC, PLIS), ['2026-02-26', '2026-06-25'])
})

test('les notes d’une prise ne ressortent jamais', () => {
  const avecNotes = [{ date: '2026-06-25', poidsKg: 90, notes: 'Client crispé, à revoir' }]
  const json = JSON.stringify(groupesDeMesures(avecNotes, []))
  assert.equal(json.includes('crispé'), false)
})

test('la somme des 5 plis n’apparaît qu’aux prises où le mollet a été pris', () => {
  const [composition] = groupesDeMesures(CIRC, PLIS)
  const somme5 = composition.series.find(s => s.cle === 'somme5')!
  // Février porte le mollet, juin non : une seule date, et c'est février.
  assert.deepEqual(somme5.points, [{ date: '2026-02-26', valeur: 59 }])
})

test('sans aucun mollet, la somme des 5 plis ne crée aucune série', () => {
  const sansMollet = [{ date: '2026-06-25', triceps: 6, biceps: 5.5, sousscapulaire: 18.5, iliaque: 15, somme4Plis: 45 }]
  const [composition] = groupesDeMesures([], sansMollet)
  assert.equal(composition.series.some(s => s.cle === 'somme5'), false)
})
