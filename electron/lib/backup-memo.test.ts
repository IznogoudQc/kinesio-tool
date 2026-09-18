/**
 * Tests du mode d'emploi de restauration.
 * Lancer : `node --test electron/lib/backup-memo.test.ts`
 *
 * Ce que ces tests protègent vraiment : le mémo cite des libellés de boutons et
 * un chemin. Le jour où il sert, personne ne pourra le corriger — il doit donc
 * rester exact, et son exactitude se vérifie ici.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { MEMO_FILENAME, memoRestauration } from './backup-memo.ts'

const DOSSIER = 'C:\\Users\\marie\\OneDrive\\Kinesio-Outils\\backups'
const LE_18 = new Date('2026-09-18T14:30:00Z')

test('le chemin réel du dossier y figure, pas un gabarit à compléter', () => {
  const memo = memoRestauration(DOSSIER, LE_18)
  assert.ok(memo.includes(DOSSIER))
  // Un « <ton nom> » à deviner est inutilisable : sur un PC neuf, le nom
  // d'utilisateur Windows n'est pas forcément le même.
  assert.ok(!memo.includes('<ton nom>'))
  assert.ok(!memo.includes('<'))
})

test('les libellés cités sont ceux des vrais boutons de ClientsPage', () => {
  const memo = memoRestauration(DOSSIER, LE_18)
  const page = readFileSync(new URL('../../src/pages/ClientsPage.tsx', import.meta.url), 'utf-8')

  for (const libelle of ['Importer', 'Fusionner']) {
    assert.ok(memo.includes(`« ${libelle} »`), `le mémo devrait citer « ${libelle} »`)
    assert.ok(page.includes(`\n            ${libelle}\n`) || page.includes(`>${libelle}<`) || page.includes(libelle), `« ${libelle} » devrait exister dans ClientsPage`)
  }

  // « Fusion » n'est le nom d'aucun bouton — c'est « Fusionner ».
  assert.ok(!/«\s*Fusion\s*»/.test(memo))
})

test('la date de mise à jour est celle de la sauvegarde', () => {
  const memo = memoRestauration(DOSSIER, LE_18)
  assert.ok(memo.includes('18 septembre 2026'), memo.slice(-200))
})

test('le cadre du titre est d’aplomb', () => {
  const lignes = memoRestauration(DOSSIER, LE_18).split('\r\n')
  const cadre = lignes.slice(0, 4)
  const largeurs = new Set(cadre.map(l => [...l].length))
  assert.equal(largeurs.size, 1, `largeurs différentes : ${[...largeurs].join(', ')}`)
  assert.ok(cadre[0].startsWith('╔') && cadre[0].endsWith('╗'))
  assert.ok(cadre[3].startsWith('╚') && cadre[3].endsWith('╝'))
  for (const l of cadre.slice(1, 3)) assert.ok(l.startsWith('║') && l.endsWith('║'))
})

test('aucune ligne ne dépasse la largeur des filets', () => {
  // Un filet plus court que le paragraphe qu'il souligne fait croire à un
  // fichier abîmé — et c'est le premier fichier que Marie ouvrira ce jour-là.
  const lignes = memoRestauration(DOSSIER, LE_18).split('\r\n')
  const largeurFilet = [...(lignes.find(l => /^─+$/.test(l)) as string)].length
  const trop = lignes.filter(l => [...l].length > largeurFilet)
  assert.deepEqual(trop, [], `lignes trop longues (filet = ${largeurFilet})`)
})

test('les fins de ligne sont en CRLF, pour le Bloc-notes', () => {
  const memo = memoRestauration(DOSSIER, LE_18)
  assert.ok(memo.includes('\r\n'))
  // Aucun LF orphelin : le Bloc-notes ancien afficherait tout sur une ligne.
  assert.equal(memo.replace(/\r\n/g, '').includes('\n'), false)
})

test('les quatre étapes sont là, dans l’ordre', () => {
  const memo = memoRestauration(DOSSIER, LE_18)
  const positions = ['ÉTAPE 1', 'ÉTAPE 2', 'ÉTAPE 3', 'ÉTAPE 4'].map(e => memo.indexOf(e))
  assert.ok(positions.every(p => p >= 0), 'une étape manque')
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

test('l’adresse de secours et le lien des versions y sont', () => {
  const memo = memoRestauration(DOSSIER, LE_18)
  assert.ok(memo.includes('njean9@gmail.com'))
  assert.ok(memo.includes('https://github.com/IznogoudQc/kinesio-tool/releases'))
})

test('le nom du fichier se remarque parmi les sauvegardes', () => {
  assert.equal(MEMO_FILENAME, 'COMMENT-RESTAURER.txt')
  // Et il ne ressemble pas à une sauvegarde : la rétention ne doit pas le voir.
  assert.equal(/^kinesio-backup-\d{4}-\d{2}-\d{2}\.kinesio$/.test(MEMO_FILENAME), false)
})
