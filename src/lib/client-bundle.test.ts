import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  matchExistingClient,
  planImport,
  summarizeBundle,
  type ClientBundle,
  type ExportedClient
} from './client-bundle.ts'

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
  assert.deepEqual(s.clientNames, ['Denise', 'Sabrina'])
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
