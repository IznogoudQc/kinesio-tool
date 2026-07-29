/**
 * Tests du résumé du score global — partagé par le PDF et le document HTML.
 *
 * Lancer : `node --test src/lib/global-score-summary.test.ts`
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeBilan, type BilanProfile } from './bilan-computed.ts'
import { componentLabelInline, globalScoreSummary, GLOBAL_BLURB } from './global-score-summary.ts'

const P: BilanProfile = { age: 49, sex: 'M', norms: 'cpafla' }

/** Bilan complet de Nicholas, 25 juin 2026 — toutes les composantes cotées 4. */
const COMPLET = {
  taille_cm: 176, poids_kg: 91.8, tour_taille_cm: 93, pushups: 55, situps: 49,
  flexion_tronc_cm: 27, endurance_dos_sec: 180, saut_vertical_cm: 48, vo2max: 57.6,
  pa_systolique: 112, pli_triceps: 7, pli_biceps: 5.5, pli_sous_scap: 18.5,
  pli_iliaque: 17, pli_mollet: 7.5
}

test('le résumé reprend le score de computeBilan, jamais un second calcul', () => {
  const c = computeBilan(COMPLET, P)
  const s = globalScoreSummary(c)
  assert.ok(s)
  assert.equal(s.score, c.overall.score)
  assert.equal(s.category, c.overall.category)
})

test('la formule affichée redonne bien le score', () => {
  const c = computeBilan(COMPLET, P)
  const s = globalScoreSummary(c)!
  const somme = s.components.reduce((a, x) => a + x.cote, 0)
  assert.equal(s.formula, `(${s.components.map(x => x.cote).join(' + ')}) ÷ ${s.components.length}`)
  assert.equal(Math.round((somme / s.components.length) * 10) / 10, Math.round(s.score * 10) / 10)
})

test('composantes à égalité → aucun « point faible » désigné', () => {
  // Tout à 4 : annoncer un point fort et un point faible n'aurait aucun sens.
  const s = globalScoreSummary(computeBilan(COMPLET, P))!
  assert.ok(s.components.every(c => c.cote === s.components[0].cote), 'toutes les cotes égales attendues')
  assert.equal(s.strongest, null)
  assert.equal(s.weakest, null)
})

test('cotes inégales → point fort et point faible identifiés', () => {
  // Bilan de sept. 2025 : composition 0, aérobie 4, PA 0, dos 3, musculo 4.
  const s = globalScoreSummary(
    computeBilan(
      { taille_cm: 176, poids_kg: 99.8, tour_taille_cm: 103, pushups: 28, situps: 25,
        flexion_tronc_cm: 22, endurance_dos_sec: 180, saut_vertical_cm: 48, vo2max: 49,
        pa_systolique: 129 },
      { ...P, age: 48 }
    )
  )!
  assert.ok(s.strongest && s.weakest)
  assert.ok(s.strongest.cote > s.weakest.cote)
  assert.equal(s.weakest.cote, 0)
  assert.equal(s.strongest.cote, 4)
})

test('composante non mesurée : listée comme absente, jamais comptée zéro', () => {
  const s = globalScoreSummary(computeBilan({ taille_cm: 176, poids_kg: 96.1, tour_taille_cm: 100 }, P))!
  assert.deepEqual(s.components.map(c => c.key), ['composition', 'backHealth'])
  assert.deepEqual(
    s.missing.map(m => m.key).sort(),
    ['aerobic', 'musculoGlobal', 'pa_systolique']
  )
  // Une absente comptée 0 aurait tiré la moyenne vers le bas.
  assert.equal(s.score, 2)
  assert.equal(s.formula, '(2 + 2) ÷ 2')
})

test('bilan vide → pas de résumé (section masquée)', () => {
  assert.equal(globalScoreSummary(computeBilan({}, P)), null)
})

test('libellé en milieu de phrase : « METS » garde ses majuscules', () => {
  // Un toLowerCase() complet donnait « aptitude aérobie (mets max) ».
  assert.equal(componentLabelInline('aerobic'), 'aptitude aérobie (METS max)')
  assert.equal(componentLabelInline('composition'), 'composition corporelle')
})

test('chaque catégorie a une phrase, aucune vide', () => {
  for (const [cat, texte] of Object.entries(GLOBAL_BLURB)) {
    assert.ok(texte.length > 40, `${cat} : phrase trop courte`)
    assert.ok(texte.endsWith('.'), `${cat} : phrase non terminée`)
  }
})
