/**
 * Tests de l'ÉAS (Figure 4-6 du Guide du conseiller, 3ᵉ éd.).
 *
 * Lancer : `node --test src/lib/eas.test.ts`
 *
 * Ce qui se joue ici : la grille cote **différemment selon le sexe**, et rien à
 * l'écran ne trahirait une colonne recopiée de travers — le score serait
 * simplement faux, de façon plausible, pour la moitié des clients. Les tests
 * verrouillent chaque case de la grille et le garde-fou du sexe manquant.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EAS_QUESTIONS,
  EAS_KEYS,
  EAS_MAX,
  EAS_CATEGORIES,
  easCategory,
  easScore,
  easIsBlank,
  emptyEas,
  asEasAnswers,
  type EasAnswers
} from './eas.ts'

/** Construit des réponses à partir des index des trois questions. */
function rep(frequence: number | null, intensite: number | null, perception: number | null): EasAnswers {
  return { frequence, intensite, perception }
}

test('trois questions, dans l’ordre imprimé', () => {
  assert.deepEqual(
    EAS_QUESTIONS.map(q => q.key),
    ['frequence', 'intensite', 'perception']
  )
  assert.deepEqual(
    EAS_QUESTIONS.map(q => q.numero),
    [1, 2, 3]
  )
  assert.deepEqual(EAS_KEYS, ['frequence', 'intensite', 'perception'])
})

test('le nombre de réponses par question correspond à la feuille', () => {
  assert.deepEqual(
    EAS_QUESTIONS.map(q => q.choices.length),
    [3, 3, 5]
  )
})

test('la grille de points, case par case', () => {
  // Recopiée de la Figure 4-6. Si une seule case dérive, le score devient faux
  // sans que rien ne plante.
  const attendu: Record<string, { M: number; F: number }[]> = {
    frequence: [
      { M: 3, F: 5 }, // au moins trois fois
      { M: 2, F: 3 }, // normalement une ou deux fois
      { M: 0, F: 0 } // rarement ou jamais
    ],
    intensite: [
      { M: 3, F: 3 }, // effort intense
      { M: 1, F: 2 }, // effort moyen
      { M: 0, F: 0 } // effort léger
    ],
    perception: [
      { M: 5, F: 3 }, // très bonne
      { M: 5, F: 3 }, // bonne
      { M: 3, F: 1 }, // moyenne
      { M: 0, F: 0 }, // faible
      { M: 0, F: 0 } // très faible
    ]
  }
  for (const q of EAS_QUESTIONS) {
    assert.deepEqual(
      q.choices.map(c => c.points),
      attendu[q.key],
      `grille de « ${q.titre} »`
    )
  }
})

test('les deux sexes plafonnent au même total — le contrôle qui valide la lecture', () => {
  // Homme 3+3+5 = 11, femme 5+3+3 = 11. C'est ce qui concorde avec la catégorie
  // « Excellent : 9 – 11 » : si les colonnes ne tombaient pas sur le même
  // maximum, c'est que la grille aurait été mal recopiée.
  for (const sexe of ['M', 'F'] as const) {
    const total = EAS_QUESTIONS.reduce((s, q) => s + Math.max(...q.choices.map(c => c.points[sexe])), 0)
    assert.equal(total, EAS_MAX, `le maximum ${sexe} devrait être ${EAS_MAX}`)
  }
})

test('le meilleur profil donne 11 et « Excellent », pour les deux sexes', () => {
  for (const sexe of ['M', 'F'] as const) {
    const s = easScore(rep(0, 0, 0), sexe)
    assert.equal(s.points, 11)
    assert.equal(s.category, 'Excellent')
    assert.equal(s.complete, true)
  }
})

test('le pire profil donne 0 et « À améliorer »', () => {
  for (const sexe of ['M', 'F'] as const) {
    const s = easScore(rep(2, 2, 4), sexe)
    assert.equal(s.points, 0)
    assert.equal(s.category, 'À améliorer')
    assert.equal(s.complete, true)
  }
})

test('un même profil ne donne PAS le même score selon le sexe', () => {
  // Une ou deux fois (H2/F3) + effort moyen (H1/F2) + moyenne (H3/F1).
  // Homme : 2+1+3 = 6. Femme : 3+2+1 = 6. Égalité fortuite — on en cherche donc
  // un autre qui diverge vraiment, sinon le test ne prouverait rien.
  const homme = easScore(rep(0, 1, 2), 'M') // 3 + 1 + 3 = 7
  const femme = easScore(rep(0, 1, 2), 'F') // 5 + 2 + 1 = 8
  assert.equal(homme.points, 7)
  assert.equal(femme.points, 8)
  assert.notEqual(homme.points, femme.points)
})

test('sans sexe au dossier, pas de score inventé', () => {
  // Coter au hasard serait faux une fois sur deux. On le dit plutôt.
  for (const sexe of [null, undefined] as const) {
    const s = easScore(rep(0, 0, 0), sexe)
    assert.equal(s.points, null)
    assert.equal(s.category, null)
    assert.equal(s.sexeManquant, true)
    assert.equal(s.answered, 3)
  }
})

test('un questionnaire vierge sans sexe ne réclame pas le sexe', () => {
  // Rien n'est répondu : inutile d'afficher « sexe manquant », il n'y a encore
  // rien à coter.
  const s = easScore(emptyEas(), null)
  assert.equal(s.sexeManquant, false)
  assert.equal(s.points, null)
})

test('un questionnaire vierge ne vaut pas zéro', () => {
  const s = easScore(emptyEas(), 'M')
  assert.equal(s.points, null)
  assert.equal(s.category, null)
  assert.equal(s.answered, 0)
  assert.equal(s.complete, false)
})

test('un questionnaire partiel est coté sur le total absolu, pas au prorata', () => {
  // Le barème du guide (9-11, 6-8…) porte sur un total sur 11 : le ramener au
  // prorata des questions répondues changerait la catégorie annoncée.
  const s = easScore(rep(0, null, null), 'M') // 3 points seulement
  assert.equal(s.points, 3)
  assert.equal(s.category, 'Acceptable')
  assert.equal(s.answered, 1)
  assert.equal(s.complete, false)
})

test('les bornes de chaque catégorie', () => {
  assert.equal(easCategory(11), 'Excellent')
  assert.equal(easCategory(9), 'Excellent')
  assert.equal(easCategory(8), 'Très bien')
  assert.equal(easCategory(6), 'Très bien')
  assert.equal(easCategory(5), 'Bien')
  assert.equal(easCategory(4), 'Bien')
  assert.equal(easCategory(3), 'Acceptable')
  assert.equal(easCategory(1), 'Acceptable')
  assert.equal(easCategory(0), 'À améliorer')
  assert.equal(easCategory(null), null)
})

test('les catégories couvrent 0 à 11 sans trou', () => {
  for (let n = 0; n <= EAS_MAX; n++) {
    assert.ok(easCategory(n) !== null, `aucune catégorie pour ${n}`)
  }
})

test('les catégories sont ordonnées de la meilleure à la moins bonne', () => {
  for (let i = 1; i < EAS_CATEGORIES.length; i++) {
    assert.ok(EAS_CATEGORIES[i].min < EAS_CATEGORIES[i - 1].min)
  }
})

test('« Très bonne » et « Bonne » valent pareil — la grille ne les distingue pas', () => {
  const q = EAS_QUESTIONS.find(x => x.key === 'perception')!
  assert.deepEqual(q.choices[0].points, q.choices[1].points)
  // Idem pour « Faible » et « Très faible ».
  assert.deepEqual(q.choices[3].points, q.choices[4].points)
})

test('les index hors barème sont ignorés, pas comptés', () => {
  const s = easScore(rep(9, -1, 2.5 as unknown as number), 'M')
  assert.equal(s.answered, 0)
  assert.equal(s.points, null)
})

test('asEasAnswers nettoie ce qui vient de la base', () => {
  assert.deepEqual(asEasAnswers({ frequence: 1, intensite: 99, perception: 4 }), {
    frequence: 1,
    intensite: null,
    perception: 4
  })
  assert.deepEqual(asEasAnswers(null), emptyEas())
  assert.deepEqual(asEasAnswers('bonjour'), emptyEas())
  assert.deepEqual(asEasAnswers({}), emptyEas())
})

test('easIsBlank distingue le vierge du répondu', () => {
  assert.equal(easIsBlank(emptyEas()), true)
  assert.equal(easIsBlank(rep(null, null, 2)), false)
})

test('aucun libellé de réponse n’est vide', () => {
  for (const q of EAS_QUESTIONS) {
    assert.ok(q.question.trim().length > 0)
    for (const c of q.choices) assert.ok(c.label.trim().length > 0)
  }
})
