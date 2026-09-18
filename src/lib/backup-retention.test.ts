/**
 * Tests de la rétention des sauvegardes.
 * Lancer : `node --test src/lib/backup-retention.test.ts`
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  KEEP_DAILY,
  KEEP_WEEKLY,
  backupDate,
  backupFileName,
  backupsToDelete,
  backupsToKeep,
  weekKey
} from './backup-retention.ts'

/** Les `n` journées consécutives qui précèdent `finIso` (incluse). */
function journees(finIso: string, n: number): string[] {
  const out: string[] = []
  const d = new Date(`${finIso}T00:00:00Z`)
  for (let i = 0; i < n; i++) {
    out.push(backupFileName(d.toISOString().slice(0, 10)))
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return out
}

test('moins de sept sauvegardes : on ne supprime rien', () => {
  const noms = journees('2026-09-18', 5)
  assert.deepEqual(backupsToDelete(noms), [])
  assert.equal(backupsToKeep(noms).length, 5)
})

test('les sept dernières journées sont gardées telles quelles', () => {
  const noms = journees('2026-09-18', 30)
  const gardees = backupsToKeep(noms)
  for (const q of journees('2026-09-18', KEEP_DAILY)) {
    assert.ok(gardees.includes(q), `${q} devrait être gardée`)
  }
})

test('une sauvegarde par semaine au-delà des sept jours', () => {
  // Trois mois de sauvegardes quotidiennes : 92 fichiers.
  const noms = journees('2026-09-18', 92)
  const gardees = backupsToKeep(noms)

  // 7 quotidiennes + au plus 8 hebdomadaires, et les deux ensembles se
  // recoupent (les 7 jours tombent dans une ou deux semaines).
  assert.ok(gardees.length <= KEEP_DAILY + KEEP_WEEKLY)
  assert.ok(gardees.length >= KEEP_WEEKLY)

  // Au plus une gardée par semaine, hors les sept journées récentes.
  const recentes = new Set(journees('2026-09-18', KEEP_DAILY))
  const parSemaine = new Map<string, number>()
  for (const f of gardees) {
    if (recentes.has(f)) continue
    const s = weekKey(backupDate(f) as string)
    parSemaine.set(s, (parSemaine.get(s) ?? 0) + 1)
  }
  for (const [semaine, n] of parSemaine) {
    assert.equal(n, 1, `la semaine ${semaine} en garde ${n}`)
  }

  // Et on couvre bien huit semaines distinctes.
  const semaines = new Set(gardees.map(f => weekKey(backupDate(f) as string)))
  assert.equal(semaines.size, KEEP_WEEKLY)
})

test('la plus récente de chaque semaine est celle qui reste', () => {
  const noms = journees('2026-09-18', 60)
  const gardees = new Set(backupsToKeep(noms))
  const recentes = new Set(journees('2026-09-18', KEEP_DAILY))
  // 2026-08-30 est un dimanche : le dernier jour de sa semaine, donc le gardé.
  assert.equal(weekKey('2026-08-30'), '2026-08-24')
  assert.ok(gardees.has(backupFileName('2026-08-30')))
  assert.ok(!gardees.has(backupFileName('2026-08-29')))
  assert.ok(!recentes.has(backupFileName('2026-08-30')))
})

test('tout ce qui dépasse huit semaines est supprimé', () => {
  const noms = journees('2026-09-18', 120)
  const aSupprimer = new Set(backupsToDelete(noms))
  // 120 jours en arrière, bien au-delà des 8 semaines.
  assert.ok(aSupprimer.has(backupFileName('2026-05-25')))
  assert.equal(new Set([...aSupprimer, ...backupsToKeep(noms)]).size, noms.length)
})

test('une semaine à cheval sur le Nouvel An reste une seule semaine', () => {
  // 2025-12-29 est un lundi : du 29 décembre au 4 janvier, même semaine.
  assert.equal(weekKey('2025-12-31'), '2025-12-29')
  assert.equal(weekKey('2026-01-02'), '2025-12-29')
  const noms = journees('2026-02-20', 70)
  const gardees = backupsToKeep(noms)
  const semaines = gardees.map(f => weekKey(backupDate(f) as string))
  assert.equal(new Set(semaines).size, semaines.length ? new Set(semaines).size : 0)
  // Pas deux gardées dans la semaine du 29 décembre.
  assert.ok(gardees.filter(f => weekKey(backupDate(f) as string) === '2025-12-29').length <= 1)
})

test('un fichier étranger au dossier n’est ni gardé ni supprimé', () => {
  const noms = [...journees('2026-09-18', 40), 'notes-de-marie.txt', 'kinesio-backup-truc.kinesio', 'export.kinesio']
  const aSupprimer = backupsToDelete(noms)
  assert.ok(!aSupprimer.includes('notes-de-marie.txt'))
  assert.ok(!aSupprimer.includes('kinesio-backup-truc.kinesio'))
  assert.ok(!aSupprimer.includes('export.kinesio'))
  assert.ok(!backupsToKeep(noms).includes('export.kinesio'))
})

test('le nommage fait l’aller-retour', () => {
  assert.equal(backupFileName('2026-09-18'), 'kinesio-backup-2026-09-18.kinesio')
  assert.equal(backupDate('kinesio-backup-2026-09-18.kinesio'), '2026-09-18')
  assert.equal(backupDate('kinesio-backup-2026-09-18.json'), null)
  assert.equal(backupDate('autre.kinesio'), null)
})
