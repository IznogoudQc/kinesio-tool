import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CIRC_MAP, PLIS_MAP, numOrNull } from './measure-sync-map.ts'
import { BILAN_FIELD_GROUPS } from '../pages/client/bilanFields.ts'

test('CIRC_MAP — mappe poids, grandeur et les 5 circonférences', () => {
  const byBilan = Object.fromEntries(CIRC_MAP.map(m => [m.bilan, m.circ]))
  assert.equal(byBilan['poids_kg'], 'poidsKg')
  assert.equal(byBilan['taille_cm'], 'grandeurCm') // grandeur/hauteur
  assert.equal(byBilan['tour_taille_cm'], 'taille') // tour de taille
  assert.equal(byBilan['tour_hanche_cm'], 'hanche')
  assert.equal(byBilan['circ_biceps_flechi_cm'], 'bicepsG')
  assert.equal(byBilan['circ_cuisse_cm'], 'cuisseG')
  assert.equal(byBilan['circ_epaules_pec_cm'], 'epaule')
  // clés uniques des deux côtés
  assert.equal(new Set(CIRC_MAP.map(m => m.bilan)).size, CIRC_MAP.length)
  assert.equal(new Set(CIRC_MAP.map(m => m.circ)).size, CIRC_MAP.length)
})

test('PLIS_MAP — les 4 plis requis + le mollet facultatif', () => {
  const byBilan = Object.fromEntries(PLIS_MAP.map(m => [m.bilan, m.plis]))
  assert.deepEqual(byBilan, {
    pli_triceps: 'triceps',
    pli_biceps: 'biceps',
    pli_sous_scap: 'sousscapulaire',
    pli_iliaque: 'iliaque',
    pli_mollet: 'mollet'
  })
})

test('le formulaire de bilan expose bien les cinq plis', () => {
  // La somme des 5 plis entre dans la note de composition (`USE_CALF_SKINFOLD`),
  // mais pendant plusieurs versions le formulaire n'offrait que quatre champs :
  // la branche « imc+ct+s5pc » était donc inatteignable. Ce test relie les deux —
  // ce que le calcul attend doit être saisissable.
  const plis = BILAN_FIELD_GROUPS.find(g => g.id === 'plis')
  assert.ok(plis, 'section « plis » introuvable')
  const cles = plis.fields.map(f => f.key)
  for (const m of PLIS_MAP) assert.ok(cles.includes(m.bilan), `${m.bilan} absent du formulaire`)
  // …et le mollet ne doit pas rendre la section « incomplète » quand il est vide.
  assert.equal(plis.fields.find(f => f.key === 'pli_mollet')?.optional, true)
})

test('numOrNull — nombres finis seulement', () => {
  assert.equal(numOrNull(42), 42)
  assert.equal(numOrNull(0), 0)
  assert.equal(numOrNull('42'), null)
  assert.equal(numOrNull(undefined), null)
  assert.equal(numOrNull(NaN), null)
  assert.equal(numOrNull(Infinity), null)
})
