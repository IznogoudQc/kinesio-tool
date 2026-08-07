import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ecmsComposition, ecmsWaistPoints, ecmsSkinfoldPoints } from './ecms-composition.ts'
import { cpaflaCompositionDetail } from './cpafla-composition.ts'

const ADULTE = 45

test('hors 15-69 ans, l’ECMS ne publie aucune norme', () => {
  const base = { imc: 25, ct: 90, s5pc: null, sex: 'M' as const }
  assert.equal(ecmsComposition({ ...base, age: 14 }).exclusion, 'age')
  assert.equal(ecmsComposition({ ...base, age: 70 }).exclusion, 'age')
  assert.equal(ecmsComposition({ ...base, age: 14 }).valeur, null)
  // Aux bornes, la norme s'applique.
  assert.notEqual(ecmsComposition({ ...base, age: 15 }).valeur, null)
  assert.notEqual(ecmsComposition({ ...base, age: 69 }).valeur, null)
})

test('au-dessus d’un IMC de 30, la somme des plis est écartée', () => {
  // Tableau 20 : « Exclusions de la population » dès HWMDBMI > 29,99. C'est la
  // différence la plus visible avec notre lecture du guide, qui l'utilise
  // quel que soit l'IMC.
  const avecPlis = { imc: 32, ct: 99, s5pc: 60, sex: 'M' as const, age: ADULTE }
  const e = ecmsComposition(avecPlis)
  assert.equal(e.exclusion, 'plis-exclus')
  assert.equal(e.skinfoldPoints, null)
  assert.equal(e.valeur, e.waistPoints, 'la note doit retomber sur le tour de taille')

  // Sous 30, les plis comptent bel et bien.
  const sous30 = ecmsComposition({ imc: 27, ct: 99, s5pc: 60, sex: 'M', age: ADULTE })
  assert.equal(sous30.exclusion, null)
  assert.notEqual(sous30.skinfoldPoints, null)
})

test('les deux implémentations concordent là où l’ECMS se prononce', () => {
  // Le but du mode : mesurer l'écart. S'il n'y en a pas dans le domaine
  // couvert, il faut pouvoir le démontrer — pas l'affirmer.
  const ecarts: string[] = []
  let compares = 0
  for (const sex of ['M', 'F'] as const) {
    for (let imc = 16; imc <= 40; imc += 0.5) {
      for (let ct = 65; ct <= 140; ct += 1) {
        const e = ecmsComposition({ imc, ct, s5pc: null, sex, age: ADULTE })
        const n = cpaflaCompositionDetail({ imc, ct, s5pc: null, sex })
        if (e.valeur === null) continue
        compares++
        if (e.valeur !== n.valeur) ecarts.push(`${sex} IMC ${imc} TT ${ct} : ${n.valeur} ≠ ${e.valeur}`)
      }
    }
  }
  assert.ok(compares > 7000, `couverture trop faible : ${compares}`)
  assert.deepEqual(ecarts.slice(0, 5), [], `${ecarts.length} écarts`)
})

test('avec les plis, les deux divergent seulement au-dessus d’un IMC de 30', () => {
  // Sous 30 : même formule, mêmes points → même résultat.
  for (const [imc, ct, s5] of [[22, 90, 45], [27, 97, 60], [29, 95, 70]] as const) {
    const e = ecmsComposition({ imc, ct, s5pc: s5, sex: 'M', age: ADULTE })
    const n = cpaflaCompositionDetail({ imc, ct, s5pc: s5, sex: 'M' })
    assert.equal(e.valeur, n.valeur, `IMC ${imc}`)
  }
  // Au-dessus de 30 : l'ECMS ignore les plis, nous non. L'écart est attendu.
  const e = ecmsComposition({ imc: 33, ct: 95, s5pc: 40, sex: 'M', age: ADULTE })
  const n = cpaflaCompositionDetail({ imc: 33, ct: 95, s5pc: 40, sex: 'M' })
  assert.equal(e.skinfoldPoints, null)
  assert.equal(e.valeur, 2) // tour de taille seul
  assert.equal(n.valeur, 2.8) // (2×1,5 + 4)/2,5
  assert.notEqual(e.valeur, n.valeur)
})

test('tableau 14 — points du tour de taille aux bornes', () => {
  assert.equal(ecmsWaistPoints(25, 93, 'M'), 4)
  assert.equal(ecmsWaistPoints(25, 95, 'M'), 3)
  assert.equal(ecmsWaistPoints(25, 105, 'M'), 1)
  assert.equal(ecmsWaistPoints(33, 95, 'M'), 2)
  assert.equal(ecmsWaistPoints(33, 105, 'M'), 0)
  // Sous 18,5 : la règle 3 passe avant la 4, donc jamais 4 malgré un tour fin.
  assert.equal(ecmsWaistPoints(17, 70, 'M'), 3)
})

test('tableau 21 — la spécification ne couvre pas tout, et on ne comble pas', () => {
  // Un IMC de 36 avec une somme moyenne : aucune ligne ne s'applique.
  assert.equal(ecmsSkinfoldPoints(36, 60, 'M'), null)
  // Ce que notre lecture du guide, elle, chiffre à 2.
  assert.equal(cpaflaCompositionDetail({ imc: 36, ct: 95, s5pc: 60, sex: 'M' }).c, 2)
})

test('sexe manquant ou mesures absentes → aucun résultat inventé', () => {
  assert.equal(ecmsComposition({ imc: 25, ct: 90, s5pc: null, sex: null, age: ADULTE }).exclusion, 'sexe')
  assert.equal(ecmsComposition({ imc: null, ct: null, s5pc: null, sex: 'M', age: ADULTE }).exclusion, 'mesures')
})
