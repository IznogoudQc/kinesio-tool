import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getTableColumns } from 'drizzle-orm'
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  clientHasNutrition,
  clientRowSchema,
  matchExistingClient,
  mergeClientForImport,
  planImport,
  summarizeBundle,
  type ClientBundle,
  type ExportedClient
} from './client-bundle.ts'
import { clients } from '../../db/schema.ts'

function exported(id: string, name: string, email: string, extra: Partial<ExportedClient> = {}): ExportedClient {
  return {
    client: { id, name, email },
    bilans: [],
    circonferences: [],
    plis: [],
    notes: [],
    avatars: {},
    ...extra
  }
}

function bundle(clients: ExportedClient[]): ClientBundle {
  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: '2026-07-09T12:00:00.000Z',
    appVersion: '0.1.93',
    clients
  }
}

test('summarizeBundle additionne tout ce qui appartient aux clients', () => {
  const s = summarizeBundle(
    bundle([
      exported('a', 'Denise', 'd@x.ca', { bilans: [{}, {}], circonferences: [{}], avatars: { 'x.webp': 'AA' } }),
      exported('b', 'Sabrina', 's@x.ca', { bilans: [{}], plis: [{}, {}], notes: [{}] })
    ])
  )
  assert.equal(s.clientCount, 2)
  assert.equal(s.bilanCount, 3)
  assert.equal(s.mesureCount, 1)
  assert.equal(s.plisCount, 2)
  assert.equal(s.noteCount, 1)
  assert.equal(s.avatarCount, 1)
  assert.equal(s.nutritionCount, 0)
  assert.deepEqual(s.clientNames, ['Denise', 'Sabrina'])
})

test('clientHasNutrition : détecte une donnée nutrition renseignée', () => {
  assert.equal(clientHasNutrition({ id: 'a', name: 'X', email: 'x@x.ca' }), false)
  assert.equal(clientHasNutrition({ supplementsNotes: '' }), false)
  assert.equal(clientHasNutrition({ nutritionEnabled: false }), false)
  assert.equal(clientHasNutrition({ supplementsNotes: '{"v":2}' }), true)
  assert.equal(clientHasNutrition({ hydratationMlParJour: 3200 }), true)
  assert.equal(clientHasNutrition({ jeunePlanning: [{ freq: 'daily' }] }), true)
})

test('summarizeBundle compte les clients avec nutrition', () => {
  const s = summarizeBundle(
    bundle([
      exported('a', 'Avec', 'a@x.ca', { client: { id: 'a', name: 'Avec', email: 'a@x.ca', nutritionMenu: '{"v":2}' } }),
      exported('b', 'Sans', 'b@x.ca')
    ])
  )
  assert.equal(s.nutritionCount, 1)
})

test('matchExistingClient : l’identifiant prime sur le courriel', () => {
  const existing = [
    { id: 'a', email: 'autre@x.ca' },
    { id: 'z', email: 'denise@x.ca' }
  ]
  assert.equal(matchExistingClient({ id: 'a', email: 'denise@x.ca' }, existing)?.id, 'a')
})

test('matchExistingClient : repli sur le courriel (ancien fichier sans id)', () => {
  const existing = [{ id: 'z', email: 'Denise@X.ca' }]
  assert.equal(matchExistingClient({ name: 'Denise', email: 'denise@x.ca' }, existing)?.id, 'z')
})

test('matchExistingClient : aucun rapprochement possible', () => {
  assert.equal(matchExistingClient({ id: 'a', email: 'neuf@x.ca' }, [{ id: 'b', email: 'vieux@x.ca' }]), null)
  assert.equal(matchExistingClient({ name: 'Sans courriel' }, [{ id: 'b', email: 'v@x.ca' }]), null)
})

test('planImport sépare les nouveaux clients de ceux déjà présents', () => {
  const p = planImport(bundle([exported('a', 'Denise', 'd@x.ca'), exported('b', 'Sabrina', 's@x.ca')]), [
    { id: 'b', email: 's@x.ca' }
  ])
  assert.deepEqual(p.toAdd, ['Denise'])
  assert.deepEqual(p.toUpdate, ['Sabrina'])
})

test('un client de la base absent du fichier n’est jamais listé (aucun import ne le supprime)', () => {
  const p = planImport(bundle([exported('a', 'Denise', 'd@x.ca')]), [
    { id: 'a', email: 'd@x.ca' },
    { id: 'autre', email: 'autre@x.ca' }
  ])
  assert.deepEqual(p.toAdd, [])
  assert.deepEqual(p.toUpdate, ['Denise'])
})

test('fichier vide → plan vide', () => {
  assert.deepEqual(planImport(bundle([]), [{ id: 'a', email: 'a@x.ca' }]), { toAdd: [], toUpdate: [] })
})

/**
 * NON-RÉGRESSION export/import : le fichier `.kinesio` doit transporter TOUTES les
 * colonnes de la table `clients` — y compris tous les champs nutrition/jeûne
 * ajoutés récemment. Le test est piloté par le VRAI schéma Drizzle : ajouter une
 * colonne au schéma la couvre automatiquement. Si quelqu'un restreint la
 * validation du bundle ou la fusion d'import à une liste de champs, ça casse ici.
 */
test('export/import : toutes les colonnes de clients survivent (validation + fusion)', () => {
  const cols = Object.keys(getTableColumns(clients))

  // Garde-fou explicite : les champs récents doivent bien exister dans le schéma.
  for (const k of [
    'jeunePlanning',
    'nutritionMenu',
    'alimentsAimes',
    'alimentsPasAimes',
    'nutritionMacroManual',
    'nutritionManualProteinG',
    'nutritionManualFatG',
    'nutritionManualCarbG',
    'hydratationMlParJour',
    'supplementsNotes',
    'alimentsPrivilegier',
    'alimentsEviter',
    'nutritionMot',
    'principePersoTitre',
    'principePersoTexte'
  ]) {
    assert.ok(cols.includes(k), `colonne « ${k} » absente du schéma clients`)
  }

  // Ligne client "pleine" : une valeur factice pour chaque colonne du schéma.
  const fullRow: Record<string, unknown> = {}
  for (const k of cols) {
    fullRow[k] = k === 'id' ? 'c1' : k === 'name' ? 'Denise' : k === 'email' ? 'd@x.ca' : `val-${k}`
  }

  // 1) Aller-retour fichier (JSON) + validation du bundle : aucune colonne perdue.
  const parsed = JSON.parse(JSON.stringify(fullRow))
  const validated = clientRowSchema.parse(parsed) as Record<string, unknown>
  for (const k of cols) {
    assert.ok(k in validated, `colonne « ${k} » perdue à la validation du bundle`)
  }

  // 2) Fusion d'import : garde tout le contenu, force seulement l'id cible.
  const merged = mergeClientForImport(validated, 'target-id')
  for (const k of cols) {
    assert.ok(k in merged, `colonne « ${k} » perdue à la fusion d'import`)
  }
  assert.equal(merged.id, 'target-id')
})
