/**
 * Tests du risque santé IMC (tableau 4.4 du Guide du conseiller, 3e éd.).
 *
 * Lancer : `node --test src/lib/norms/health-risk.test.ts`
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BMI_BANDS,
  bmiRisk,
  healthRisk,
  healthRiskExplanation,
  HEALTH_RISK_ORDER,
  HEALTH_RISK_SOURCE,
  muscularCaveat,
  muscularCaveatApplies,
  healthRiskScale,
  healthRiskFacts,
  HEALTH_RISK_HEX,
  bmiRiskBar,
  waistRiskBar,
  healthRiskBareme
} from './health-risk.ts'

test('les six bandes de la feuille, à leurs bornes exactes', () => {
  assert.equal(bmiRisk(18.4)?.risk, 'ACCRU')
  assert.equal(bmiRisk(18.5)?.risk, 'MOINDRE')
  assert.equal(bmiRisk(24.9)?.risk, 'MOINDRE')
  assert.equal(bmiRisk(25)?.risk, 'ACCRU')
  assert.equal(bmiRisk(29.9)?.risk, 'ACCRU')
  assert.equal(bmiRisk(30)?.risk, 'ELEVE')
  assert.equal(bmiRisk(34.9)?.risk, 'ELEVE')
  assert.equal(bmiRisk(35)?.risk, 'TRES_ELEVE')
  assert.equal(bmiRisk(39.9)?.risk, 'TRES_ELEVE')
  assert.equal(bmiRisk(40)?.risk, 'EXTREMEMENT_ELEVE')
  assert.equal(bmiRisk(55)?.risk, 'EXTREMEMENT_ELEVE')
})

test('le risque remonte des deux côtés : maigreur et excès sont tous deux « Accru »', () => {
  // Ce n'est pas une échelle monotone — c'est bien ce qu'imprime la feuille.
  assert.equal(bmiRisk(17)?.risk, 'ACCRU')
  assert.equal(bmiRisk(27)?.risk, 'ACCRU')
  assert.equal(bmiRisk(22)?.risk, 'MOINDRE')
})

test('le libellé de bande situe la valeur', () => {
  assert.equal(bmiRisk(32.2)?.band, '30,0–34,9')
  assert.equal(bmiRisk(22)?.band, '18,5–24,9')
  assert.equal(bmiRisk(41)?.band, '40 et plus')
})

test('valeur absente ou aberrante → null (jamais de risque inventé)', () => {
  for (const v of [null, undefined, Number.NaN, 0, -3]) {
    assert.equal(bmiRisk(v as number | null | undefined), null)
  }
})

test('les bandes couvrent la droite réelle sans trou ni chevauchement', () => {
  // Chaque borne supérieure est strictement croissante, et la dernière est
  // ouverte : aucun IMC positif ne peut retomber en dehors.
  for (let i = 1; i < BMI_BANDS.length; i++) {
    assert.ok(BMI_BANDS[i].ltImc > BMI_BANDS[i - 1].ltImc, `bande ${i} mal ordonnée`)
  }
  assert.equal(BMI_BANDS[BMI_BANDS.length - 1].ltImc, Infinity)
  for (let imc = 0.1; imc < 80; imc += 0.1) {
    assert.ok(bmiRisk(imc) !== null, `IMC ${imc.toFixed(1)} non classé`)
  }
})

test('l’ordre de gravité est complet et sans doublon', () => {
  assert.equal(new Set(HEALTH_RISK_ORDER).size, HEALTH_RISK_ORDER.length)
  for (const b of BMI_BANDS) assert.ok(HEALTH_RISK_ORDER.includes(b.risk))
})

// ── Risque combiné IMC + tour de taille ──────────────────────────────────────

test('les 6 lignes de la feuille, colonne « Risque IMC + TT »', () => {
  // Seuil atteint → le risque combiné imprimé sur la ligne.
  const cases: [number, number, 'F' | 'M', string][] = [
    [22, 90, 'M', 'ELEVE'],
    [22, 80, 'F', 'ELEVE'],
    [27, 100, 'M', 'TRES_ELEVE'],
    [27, 90, 'F', 'TRES_ELEVE'],
    [32, 110, 'M', 'EXTREMEMENT_ELEVE'],
    [32, 105, 'F', 'EXTREMEMENT_ELEVE'],
    [37, 125, 'M', 'EXTREMEMENT_ELEVE'],
    [37, 115, 'F', 'EXTREMEMENT_ELEVE'],
    [42, 125, 'M', 'EXTREMEMENT_ELEVE'],
    [42, 125, 'F', 'EXTREMEMENT_ELEVE']
  ]
  for (const [imc, waist, sex, expected] of cases) {
    const r = healthRisk({ imc, waist, sex })
    assert.equal(r?.risk, expected, `IMC ${imc} / TT ${waist} ${sex}`)
    assert.equal(r?.waistRaised, true, `IMC ${imc} / TT ${waist} ${sex} : le TT devrait relever`)
  }
})

test('sous le seuil, le tour de taille ne relève pas le risque', () => {
  // 89 cm chez un homme d'IMC normal : on reste à « Moindre ».
  const r = healthRisk({ imc: 22, waist: 89, sex: 'M' })
  assert.equal(r?.risk, 'MOINDRE')
  assert.equal(r?.waistRaised, false)
  assert.equal(r?.waistThreshold, 90)
})

test('le tour de taille pèse plus que l’IMC — le cas que la feuille sert à attraper', () => {
  // Homme d'IMC normal, 92 cm → « Élevé ».
  const mince = healthRisk({ imc: 23, waist: 92, sex: 'M' })
  // Homme en embonpoint, 95 cm (sous son seuil de 100) → « Accru » seulement.
  const rond = healthRisk({ imc: 27, waist: 95, sex: 'M' })
  assert.equal(mince?.risk, 'ELEVE')
  assert.equal(rond?.risk, 'ACCRU')
  // Conséquence assumée : l'IMC le plus bas porte ici le risque le plus haut.
})

test('sous 18,5 la feuille n’évalue pas le tour de taille', () => {
  const r = healthRisk({ imc: 17, waist: 130, sex: 'M' })
  assert.equal(r?.risk, 'ACCRU')
  assert.equal(r?.waistRaised, false)
  assert.equal(r?.waistThreshold, null)
})

test('tour de taille ou sexe manquant → risque de l’IMC seul, sans invention', () => {
  for (const input of [
    { imc: 27, sex: 'M' as const },
    { imc: 27, waist: 120, sex: null },
    { imc: 27, waist: null, sex: 'F' as const },
    { imc: 27, waist: Number.NaN, sex: 'M' as const }
  ]) {
    const r = healthRisk(input)
    assert.equal(r?.risk, 'ACCRU', JSON.stringify(input))
    assert.equal(r?.waistRaised, false)
  }
})

test('healthRisk et bmiRisk s’accordent quand le tour de taille est absent', () => {
  for (let imc = 15; imc < 50; imc += 0.5) {
    assert.equal(healthRisk({ imc })?.risk, bmiRisk(imc)?.risk, `IMC ${imc}`)
  }
})

test('IMC absent ou aberrant → null', () => {
  for (const imc of [null, undefined, Number.NaN, 0, -3]) {
    assert.equal(healthRisk({ imc, waist: 100, sex: 'M' }), null)
  }
})

test('tour de taille non mesuré : ne jamais affirmer qu’il est sous le seuil', () => {
  const absent = healthRisk({ imc: 27, sex: 'M' })!
  assert.equal(absent.waistKnown, false)
  assert.match(healthRiskExplanation(absent), /non mesuré/)
  assert.doesNotMatch(healthRiskExplanation(absent), /sous 100 cm, qui ne relève/)

  const mesure = healthRisk({ imc: 27, waist: 95, sex: 'M' })!
  assert.equal(mesure.waistKnown, true)
  assert.match(healthRiskExplanation(mesure), /sous 100 cm/)
})

test('la phrase d’explication couvre les quatre situations, sans trou', () => {
  const cas = [
    healthRisk({ imc: 17, waist: 130, sex: 'M' })!, // pas de seuil sous 18,5
    healthRisk({ imc: 23, waist: 92, sex: 'M' })!, // relevé par le TT
    healthRisk({ imc: 23, waist: 85, sex: 'M' })!, // mesuré, sous le seuil
    healthRisk({ imc: 23, sex: 'M' })! // non mesuré
  ]
  const phrases = cas.map(healthRiskExplanation)
  for (const p of phrases) assert.ok(p.length > 0 && p.endsWith('.'))
  assert.equal(new Set(phrases).size, 4, 'les quatre situations doivent se distinguer')
})

/* ── Nuance « entraînement musculaire » (note de bas du tableau 4.4) ─────── */

test('la nuance s’applique au profil visé : surpoids, tour de taille sous la limite', () => {
  // Le cas concret : homme musclé, IMC 27, tour de taille 88 cm (< 100).
  // L'app l'affichait « risque accru » sans réserve, alors que le guide dit
  // précisément l'inverse pour lui.
  const r = healthRisk({ imc: 27, waist: 88, sex: 'M' })!
  assert.equal(r.risk, 'ACCRU')
  assert.equal(muscularCaveatApplies(r), true)
  assert.match(muscularCaveat(r)!, /entraînement musculaire/)
})

test('la nuance ne s’applique pas si le tour de taille dépasse la limite', () => {
  // 100 cm chez l'homme : le risque est relevé, la remarque du guide ne vaut
  // plus — elle porte explicitement sur un tour de taille INFÉRIEUR aux limites.
  const r = healthRisk({ imc: 27, waist: 100, sex: 'M' })!
  assert.equal(r.waistRaised, true)
  assert.equal(muscularCaveatApplies(r), false)
  assert.equal(muscularCaveat(r), null)
})

test('la nuance ne s’applique pas si le tour de taille n’est pas mesuré', () => {
  // Sans mesure, on ne peut pas affirmer qu'il est sous la limite. Afficher la
  // nuance reviendrait à rassurer sur la foi d'une donnée absente.
  const r = healthRisk({ imc: 27, waist: null, sex: 'M' })!
  assert.equal(r.waistKnown, false)
  assert.equal(muscularCaveatApplies(r), false)
})

test('la nuance est limitée à la plage de surpoids, comme l’écrit le guide', () => {
  // L'étendre à l'obésité serait notre interprétation, pas celle du guide.
  for (const imc of [24.9, 30, 35, 41]) {
    const r = healthRisk({ imc, waist: 80, sex: 'M' })!
    assert.equal(muscularCaveatApplies(r), false, `IMC ${imc} ne devrait pas déclencher la nuance`)
  }
  // Les bornes exactes de la plage, elles, la déclenchent.
  for (const imc of [25, 29.9]) {
    assert.equal(muscularCaveatApplies(healthRisk({ imc, waist: 80, sex: 'M' })!), true, `IMC ${imc}`)
  }
})

test('la nuance vaut aussi pour les femmes, à leur propre seuil', () => {
  assert.equal(muscularCaveatApplies(healthRisk({ imc: 27, waist: 85, sex: 'F' })!), true)
  assert.equal(muscularCaveatApplies(healthRisk({ imc: 27, waist: 90, sex: 'F' })!), false)
})

test('la nuance est formulée comme une question, jamais comme une conclusion', () => {
  // L'app ne sait pas si le client s'entraîne — c'est Marie qui sait. Le texte
  // doit donc rester conditionnel.
  const texte = muscularCaveat(healthRisk({ imc: 27, waist: 88, sex: 'M' })!)!
  assert.match(texte, /^Si le client/)
  assert.equal(/n’est pas à risque|aucun risque/.test(texte), false)
})

test('la source cite le tableau 4.4 du guide, plus l’aide-mémoire', () => {
  assert.match(HEALTH_RISK_SOURCE, /Guide du conseiller/)
  assert.match(HEALTH_RISK_SOURCE, /4\.4/)
  assert.equal(HEALTH_RISK_SOURCE.includes('SPAP'), false)
  // La restriction d'âge figure bien en note du tableau — elle reste.
  assert.match(HEALTH_RISK_SOURCE, /20 à 65 ans/)
})

/* ── Barème affichable ───────────────────────────────────────────────────── */

test('le barème montre les cinq paliers, un seul actif', () => {
  const r = healthRisk({ imc: 27, waist: 88, sex: 'M' })!
  const cells = healthRiskScale(r)
  assert.equal(cells.length, 5)
  assert.equal(cells.filter(c => c.active).length, 1)
  assert.equal(cells.find(c => c.active)!.risk, 'ACCRU')
})

test('le barème est toujours dans l’ordre de gravité croissante', () => {
  // L'échelle ne veut rien dire si l'ordre change d'un écran à l'autre.
  const cells = healthRiskScale(healthRisk({ imc: 22, waist: 80, sex: 'M' })!)
  assert.deepEqual(
    cells.map(c => c.risk),
    ['MOINDRE', 'ACCRU', 'ELEVE', 'TRES_ELEVE', 'EXTREMEMENT_ELEVE']
  )
  assert.deepEqual(cells.map(c => c.label), ['Moindre', 'Accru', 'Élevé', 'Très élevé', 'Extrêmement élevé'])
})

test('chaque palier porte sa couleur partagée', () => {
  const cells = healthRiskScale(healthRisk({ imc: 22, waist: 80, sex: 'M' })!)
  for (const c of cells) {
    assert.equal(c.hex, HEALTH_RISK_HEX[c.risk])
    assert.match(c.hex, /^#[0-9a-f]{6}$/i)
  }
})

test('le palier actif suit bien le risque COMBINÉ, pas celui de l’IMC seul', () => {
  // Homme IMC 27 (Accru) mais tour de taille 102 → Très élevé. C'est ce
  // relèvement que le tableau existe pour attraper ; le barème doit le montrer.
  const r = healthRisk({ imc: 27, waist: 102, sex: 'M' })!
  assert.equal(healthRiskScale(r).find(c => c.active)!.risk, 'TRES_ELEVE')
})

test('les chiffres affichés sont ceux qui ont produit le verdict', () => {
  const input = { imc: 27.34, waist: 88, sex: 'M' as const }
  const f = healthRiskFacts(input, healthRisk(input)!)
  assert.equal(f.imc, '27,3') // virgule décimale, arrondi au dixième
  assert.equal(f.imcBand, '25,0–29,9')
  assert.equal(f.waist, '88 cm') // pas de « 88,0 »
  assert.equal(f.waistThreshold, '100 cm')
})

test('un tour de taille non mesuré n’est pas inventé', () => {
  const input = { imc: 27, waist: null, sex: 'M' as const }
  const f = healthRiskFacts(input, healthRisk(input)!)
  assert.equal(f.waist, null)
  // Le seuil, lui, reste affichable : il dit ce qu'il faudrait mesurer.
  assert.equal(f.waistThreshold, '100 cm')
})

test('sans sexe, aucun seuil de tour de taille n’est annoncé', () => {
  // Les seuils diffèrent entre hommes et femmes : en afficher un au hasard
  // serait faux une fois sur deux.
  const input = { imc: 27, waist: 88, sex: null }
  const f = healthRiskFacts(input, healthRisk(input)!)
  assert.equal(f.waistThreshold, null)
})

test('la plage d’IMC affichée est celle du tableau, pas une reformulation', () => {
  for (const [imc, plage] of [[17, 'moins de 18,5'], [22, '18,5–24,9'], [27, '25,0–29,9'], [32, '30,0–34,9'], [37, '35,0–39,9'], [42, '40 et plus']] as const) {
    const input = { imc, waist: null, sex: 'M' as const }
    assert.equal(healthRiskFacts(input, healthRisk(input)!).imcBand, plage, `IMC ${imc}`)
  }
})

test('la graduation du barème tient sur cinq colonnes', () => {
  // « Extrêmement élevé » se coupait en « Extrêmement… », qui ne veut plus rien
  // dire. Le libellé complet reste le verdict ; la graduation est abrégée.
  const cells = healthRiskScale(healthRisk({ imc: 22, waist: 80, sex: 'M' })!)
  assert.deepEqual(cells.map(c => c.shortLabel), ['Moindre', 'Accru', 'Élevé', 'Très élevé', 'Extrême'])
  for (const c of cells) {
    assert.ok(c.shortLabel.length <= 10, `« ${c.shortLabel} » est trop long pour la graduation`)
    assert.ok(c.label.length > 0)
  }
})

test('un tour de taille décimal garde sa décimale', () => {
  const input = { imc: 27, waist: 88.5, sex: 'M' as const }
  assert.equal(healthRiskFacts(input, healthRisk(input)!).waist, '88,5 cm')
})

/* ── Barres à axe numérique ──────────────────────────────────────────────── */

test('la barre d’IMC couvre l’axe sans trou ni chevauchement', () => {
  const bar = bmiRiskBar(27)
  assert.equal(bar.zones[0].min, bar.scaleMin)
  assert.equal(bar.zones[bar.zones.length - 1].max, bar.scaleMax)
  for (let i = 1; i < bar.zones.length; i++) {
    assert.equal(bar.zones[i].min, bar.zones[i - 1].max, `trou entre les zones ${i - 1} et ${i}`)
  }
})

test('les zones de la barre d’IMC suivent la colonne « risque associé à l’IMC »', () => {
  // Y compris le fait qu'un IMC bas soit « Accru » comme la zone 25–29,9 : le
  // risque remonte des deux côtés, et la barre doit le montrer.
  const bar = bmiRiskBar(27)
  assert.deepEqual(
    bar.zones.map(z => z.risk),
    ['ACCRU', 'MOINDRE', 'ACCRU', 'ELEVE', 'TRES_ELEVE', 'EXTREMEMENT_ELEVE']
  )
  assert.deepEqual(bar.bounds, [18.5, 25, 30, 35, 40])
})

test('le repère d’IMC tombe au bon endroit, et reste dans l’axe', () => {
  assert.equal(bmiRiskBar(15)!.markerRatio, 0)
  assert.equal(bmiRiskBar(45)!.markerRatio, 1)
  assert.equal(bmiRiskBar(30)!.markerRatio, 0.5) // (30-15)/30
  // Hors axe : plaqué au bord plutôt que débordant.
  assert.equal(bmiRiskBar(12)!.markerRatio, 0)
  assert.equal(bmiRiskBar(60)!.markerRatio, 1)
  assert.equal(bmiRiskBar(null).markerRatio, null)
})

test('la barre du tour de taille dit ce que fait le tour de taille', () => {
  // Sous le seuil → le risque reste celui de l'IMC ; au-dessus → il devient le
  // risque combiné. C'est toute la lecture du tableau, en deux couleurs.
  const r = healthRisk({ imc: 27, waist: 88, sex: 'M' })!
  const bar = waistRiskBar(88, r)!
  assert.equal(bar.zones.length, 2)
  assert.equal(bar.zones[0].risk, 'ACCRU') // IMC seul
  assert.equal(bar.zones[1].risk, 'TRES_ELEVE') // combiné
  assert.equal(bar.zones[0].max, 100)
  assert.deepEqual(bar.bounds, [100])
})

test('la barre du tour de taille s’adapte au seuil, sans écraser le repère', () => {
  // Seuil bas (femme, IMC normal : 80) comme seuil haut (125) doivent rester
  // lisibles.
  const bas = waistRiskBar(74, healthRisk({ imc: 22, waist: 74, sex: 'F' })!)!
  assert.ok(bas.scaleMin <= 60 && bas.scaleMax >= 140)
  assert.ok(bas.markerRatio! > 0 && bas.markerRatio! < 1)

  const haut = waistRiskBar(130, healthRisk({ imc: 42, waist: 130, sex: 'M' })!)!
  assert.ok(haut.scaleMax >= 150)
  assert.ok(haut.markerRatio! > 0 && haut.markerRatio! < 1)
})

test('pas de barre de tour de taille quand le tableau n’en prévoit pas', () => {
  // IMC sous 18,5 : la ligne du guide ne donne aucun seuil.
  assert.equal(waistRiskBar(70, healthRisk({ imc: 17, waist: 70, sex: 'M' })!), null)
  // Sexe inconnu : les seuils diffèrent, en choisir un serait faux une fois sur deux.
  assert.equal(waistRiskBar(88, healthRisk({ imc: 27, waist: 88, sex: null })!), null)
})

/* ── Barème dépliable ────────────────────────────────────────────────────── */

test('le barème rend les six lignes du tableau 4.4', () => {
  const rows = healthRiskBareme('M', healthRisk({ imc: 27, waist: 88, sex: 'M' })!)
  assert.equal(rows.length, 6)
  assert.deepEqual(
    rows.map(r => r.imcLabel),
    ['moins de 18,5', '18,5–24,9', '25,0–29,9', '30,0–34,9', '35,0–39,9', '40 et plus']
  )
  assert.deepEqual(rows.map(r => r.waist), [null, 90, 100, 110, 125, 125])
})

test('le barème marque la ligne du client, une seule', () => {
  const rows = healthRiskBareme('F', healthRisk({ imc: 32, waist: 90, sex: 'F' })!)
  assert.equal(rows.filter(r => r.active).length, 1)
  assert.equal(rows.find(r => r.active)!.imcLabel, '30,0–34,9')
})

test('le barème donne les seuils du BON sexe', () => {
  assert.deepEqual(healthRiskBareme('F', null).map(r => r.waist), [null, 80, 90, 105, 115, 125])
  assert.deepEqual(healthRiskBareme('M', null).map(r => r.waist), [null, 90, 100, 110, 125, 125])
  // Sans sexe, aucun seuil inventé — mais la colonne IMC reste consultable.
  assert.deepEqual(healthRiskBareme(null, null).map(r => r.waist), [null, null, null, null, null, null])
  assert.equal(healthRiskBareme(null, null).filter(r => r.active).length, 0)
})

test('la première ligne du barème n’a pas de risque combiné', () => {
  // Le tableau imprime « – » : sous 18,5 le tour de taille n'est pas évalué.
  const rows = healthRiskBareme('M', null)
  assert.equal(rows[0].combined, null)
  assert.equal(rows[0].combinedLabel, null)
  for (const r of rows.slice(1)) assert.ok(r.combinedLabel)
})
