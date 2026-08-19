/**
 * Notes prises pendant un bilan.
 *
 * Deux choses à verrouiller : la CORRESPONDANCE entre sections du formulaire et
 * du tableau de bord — une note sur les plis doit ressortir sous « composition
 * corporelle », pas ailleurs — et le fait qu'aucune note ne s'invente à partir
 * d'une valeur vide.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cleNoteSection,
  notesDeBilansPour,
  SECTION_BILAN_VERS_DASHBOARD
} from './bilan-section-notes.ts'

const titre = (g: string) => ({ plis: 'Plis cutanés', anthropo: 'Anthropométrie', vitaux: 'Signes vitaux (repos)', aerobie: 'Aptitude aérobie', musculo: 'Force et mobilité', circonferences: 'Circonférences', indices: 'Indices' })[g] ?? g

test('la clé de stockage est stable', () => {
  // Elle est écrite dans `bilan.data` : la changer rendrait muettes toutes les
  // notes déjà prises.
  assert.equal(cleNoteSection('plis'), 'note_plis')
  assert.equal(cleNoteSection('aerobie'), 'note_aerobie')
})

test('les trois sections de mesures corporelles mènent à la composition', () => {
  for (const g of ['anthropo', 'circonferences', 'plis']) {
    assert.equal(SECTION_BILAN_VERS_DASHBOARD[g], 'composition', g)
  }
})

test('les signes vitaux se lisent avec le cardio', () => {
  assert.equal(SECTION_BILAN_VERS_DASHBOARD.vitaux, 'aerobie')
})

test('le groupe « notes » n’est PAS repris', () => {
  // Il porte l'objectif du client et le mot qui lui est adressé — déjà
  // affichés ailleurs et destinés au document.
  assert.equal(SECTION_BILAN_VERS_DASHBOARD.notes, undefined)
})

test('une section du tableau de bord ramasse toutes ses sections de formulaire', () => {
  const bilans = [
    { date: '2026-06-01', data: { note_plis: 'Plis difficiles au triceps.', note_anthropo: 'Pesée à jeun.' } }
  ]
  const notes = notesDeBilansPour(bilans, 'composition', titre)
  assert.deepEqual(notes.map(n => n.section).sort(), ['Anthropométrie', 'Plis cutanés'])
})

test('la plus RÉCENTE d’abord', () => {
  const bilans = [
    { date: '2025-01-01', data: { note_plis: 'ancienne' } },
    { date: '2026-06-01', data: { note_plis: 'récente' } }
  ]
  assert.deepEqual(
    notesDeBilansPour(bilans, 'composition', titre).map(n => n.texte),
    ['récente', 'ancienne']
  )
})

test('rien ne s’invente à partir du vide', () => {
  const bilans = [
    { date: '2026-06-01', data: { note_plis: '   ', note_anthropo: '', pli_triceps: 12 } }
  ]
  assert.deepEqual(notesDeBilansPour(bilans, 'composition', titre), [])
  assert.deepEqual(notesDeBilansPour(null, 'composition', titre), [])
})

test('une note ne déborde pas sur une autre section', () => {
  const bilans = [{ date: '2026-06-01', data: { note_plis: 'sur les plis' } }]
  assert.deepEqual(notesDeBilansPour(bilans, 'aerobie', titre), [])
  assert.equal(notesDeBilansPour(bilans, 'composition', titre).length, 1)
})
