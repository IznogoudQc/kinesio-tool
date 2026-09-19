/**
 * Tests des champs mesures retirés de l'affichage.
 * Lancer : `node --test src/lib/mesures-legacy-fields.test.ts`
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { groupesDeMesures } from './mesures-doc.ts'
import { LEGACY_CIRC_FIELDS, LEGACY_PLIS_FIELDS } from './mesures-legacy-fields.ts'

/** Le bloc `mesuresCirconferences` du schéma Drizzle, lu comme du texte. */
function schemaCirconferences(): string {
  const schema = readFileSync(new URL('../../db/schema.ts', import.meta.url), 'utf-8')
  const debut = schema.indexOf("sqliteTable('mesures_circonferences'")
  assert.ok(debut > 0, 'table mesures_circonferences introuvable dans le schéma')
  // Jusqu'au `})` en début de ligne, et non au premier rencontré : le
  // `references(..., { onDelete: 'cascade' })` de clientId en contient un, qui
  // coupait le bloc avant même la première circonférence.
  return schema.slice(debut, schema.indexOf('\n})', debut))
}

test('chaque clé écartée est une VRAIE colonne du schéma', () => {
  // Un `keyof` ne protégerait pas : le module doit rester sans import de type
  // pour servir les deux tsconfig. Donc on vérifie contre le schéma lui-même —
  // une faute de frappe rendrait le filtre silencieusement inopérant.
  const bloc = schemaCirconferences()
  for (const cle of LEGACY_CIRC_FIELDS) {
    assert.ok(new RegExp(`\\b${cle}:`).test(bloc), `${cle} n'est pas une colonne de mesures_circonferences`)
  }
})

test('les colonnes écartées ne sont PAS supprimées du schéma', () => {
  // La compat descendante des vieux .kinesio en dépend : masquer n'est pas
  // effacer. Si une migration retirait la colonne, ce test le dirait.
  const bloc = schemaCirconferences()
  for (const cle of ['bicepsD', 'cuisseD', 'poitrine']) {
    assert.ok(new RegExp(`\\b${cle}:`).test(bloc), `${cle} a disparu du schéma`)
  }
})

test('les mesures écartées ne produisent aucune série, même avec des valeurs', () => {
  const prises = [
    { date: '2026-06-25', taille: 93, hanche: 107, bicepsG: 40, bicepsD: 38.5, cuisseG: 52, cuisseD: 50.5, poitrine: 132 },
    { date: '2026-07-18', taille: 94, hanche: 104, bicepsG: 38.5, bicepsD: 38.5, cuisseG: 50.5, cuisseD: 50.5, poitrine: 132 }
  ]
  const groupes = groupesDeMesures(prises, [])
  const cles = groupes.flatMap(g => g.series.map(s => s.cle))

  for (const ecartee of LEGACY_CIRC_FIELDS) {
    assert.ok(!cles.includes(ecartee), `${ecartee} ne devrait pas produire de série`)
  }
  // Les jumelles actives, elles, restent.
  for (const active of ['taille', 'hanche', 'bicepsG', 'cuisseG']) {
    assert.ok(cles.includes(active), `${active} devrait rester`)
  }
})

test('aucun libellé de mesure écartée n’atteint le document', () => {
  const prises = [{ date: '2026-07-18', poitrine: 132, bicepsD: 38.5, cuisseD: 50.5, taille: 94 }]
  const json = JSON.stringify(groupesDeMesures(prises, []))
  for (const libelle of ['Poitrine', 'Biceps fléchi (droit)', 'Cuisse (droite)']) {
    assert.equal(json.includes(libelle), false, `« ${libelle} » ne devrait pas apparaître`)
  }
  assert.ok(json.includes('Tour de taille'))
})

test('une prise qui ne contient QUE des mesures écartées ne crée aucun groupe', () => {
  const groupes = groupesDeMesures([{ date: '2026-07-18', poitrine: 132, bicepsD: 38.5 }], [])
  assert.deepEqual(groupes, [])
})

test('aucun pli n’est écarté pour l’instant', () => {
  assert.equal(LEGACY_PLIS_FIELDS.size, 0)
  const plis = [
    { date: '2026-06-25', triceps: 6, biceps: 5.5, sousscapulaire: 18.5, iliaque: 15, mollet: 9, somme4Plis: 45, pourcentageGrasSiri: 23.1 },
    { date: '2026-07-18', triceps: 7, biceps: 5.5, sousscapulaire: 18.5, iliaque: 17, mollet: 9, somme4Plis: 48, pourcentageGrasSiri: 24 }
  ]
  const groupe = groupesDeMesures([], plis).find(g => g.titre === 'Plis cutanés')!
  assert.deepEqual(groupe.series.map(s => s.cle), ['triceps', 'biceps', 'sousscapulaire', 'iliaque', 'mollet'])
})
