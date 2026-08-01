/**
 * Tests des jeux de données fictifs.
 *
 * Lancer : `node --test src/lib/dummy-scenarios.test.ts`
 *
 * L'enjeu : chaque scénario doit produire CE QU'IL ANNONCE une fois passé dans
 * les vrais calculs de l'app. Un scénario « neutre » qui déclencherait un record
 * personnel ne montrerait pas le cas « aucune victoire », et on ne s'en
 * apercevrait qu'en cliquant — ou jamais.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  circForMonth,
  DUMMY_BIRTHDATE,
  DUMMY_HEIGHT_CM,
  plisForMonth,
  SCENARIOS,
  recuperationFor,
  weightLbForMonth,
  type DummyScenario
} from './dummy-scenarios.ts'
import { computeBilan, type BilanProfile } from './bilan-computed.ts'
import { isLowerBetter } from './norms/bilan-keys.ts'
import { detectWins } from './dashboard-wins.ts'
import { calculateAge, calculateBodyFat } from './body-fat-calculator.ts'

const HEIGHT_M = DUMMY_HEIGHT_CM / 100
const round1 = (n: number) => Math.round(n * 10) / 10
const AGE = calculateAge(DUMMY_BIRTHDATE)
const profile: BilanProfile = { age: AGE, sex: 'M', norms: 'cpafla' }

/** Reconstruit les bilans d'un scénario comme le fait le bouton de seed. */
function bilansOf(sc: DummyScenario): Bilan[] {
  return SCENARIOS[sc].bilans.map((b, i) => {
    const circ = circForMonth(b.monthOffset, sc)
    const plis = plisForMonth(b.monthOffset, sc)
    const bf = calculateBodyFat(
      { triceps: plis.triceps, biceps: plis.biceps, sousscapulaire: plis.sousscapulaire, iliaque: plis.iliaque },
      AGE,
      'M'
    )
    const data = {
      taille_cm: DUMMY_HEIGHT_CM,
      poids_kg: circ.poidsKg,
      imc: round1(circ.poidsKg / (HEIGHT_M * HEIGHT_M)),
      tour_taille_cm: circ.taille,
      tour_hanche_cm: circ.hanche,
      pli_triceps: plis.triceps,
      pli_biceps: plis.biceps,
      pli_sous_scap: plis.sousscapulaire,
      pli_iliaque: plis.iliaque,
      pourcentage_gras: round1(bf.bodyFatSiri),
      vo2max: b.vo2max,
      fc_repos: b.fcRepos,
      pa_systolique: b.paSys,
      pa_diastolique: b.paDia,
      pushups: b.pushups,
      situps: b.situps,
      saut_vertical_cm: b.sautCm,
      flexion_tronc_cm: b.flexionCm,
      endurance_dos_sec: b.enduranceDosSec
    }
    return { id: `b${i}`, clientId: 'dummy', date: b.date, data, source: 'manuel', createdAt: b.date } as Bilan
  })
}

/** Les bilans du plus récent au plus ancien, comme les sert l'app. */
function winsOf(sc: DummyScenario) {
  const chrono = bilansOf(sc)
  const desc = [...chrono].reverse()
  return detectWins({
    computed: computeBilan(desc[0].data, profile),
    previous: computeBilan(desc[1].data, profile),
    bilans: desc,
    currentData: desc[0].data
  })
}

test('les trois scénarios existent et ont des emails distincts', () => {
  const emails = Object.values(SCENARIOS).map(s => s.email)
  assert.equal(emails.length, 3)
  assert.equal(new Set(emails).size, 3, 'des emails identiques empêcheraient la coexistence')
})

test('progression : le client s’améliore → au moins une victoire', () => {
  const wins = winsOf('progression')
  assert.ok(wins.length > 0, 'un client qui progresse doit voir des victoires')
})

test('régression : aucune victoire, jamais un message négatif', () => {
  assert.deepEqual(winsOf('regression'), [], 'un client qui recule ne doit rien voir à cet endroit')
})

test('NEUTRE : aucune victoire — c’est toute la raison d’être du scénario', () => {
  // Le piège : les records personnels portent aussi sur l'IMC, le tour de
  // taille et le % de gras, tous dérivés du poids. Un plateau dont le dernier
  // point serait le plus léger déclencherait un record.
  assert.deepEqual(winsOf('neutre'), [], 'le scénario neutre ne doit produire aucune victoire')
})

test('neutre : le dernier bilan n’est le meilleur sur AUCUNE mesure à record', () => {
  const chrono = bilansOf('neutre')
  const dernier = chrono[chrono.length - 1].data
  const plusHautMieux = ['vo2max', 'pushups', 'situps', 'saut_vertical_cm'] as const
  const plusBasMieux = ['pourcentage_gras', 'imc', 'tour_taille_cm'] as const

  for (const k of plusHautMieux) {
    const vals = chrono.map(b => b.data[k] as number)
    assert.ok(
      (dernier[k] as number) < Math.max(...vals),
      `${k} : le dernier bilan est le meilleur → un record se déclencherait`
    )
  }
  for (const k of plusBasMieux) {
    const vals = chrono.map(b => b.data[k] as number)
    assert.ok(
      (dernier[k] as number) > Math.min(...vals),
      `${k} : le dernier bilan est le plus bas → un record se déclencherait`
    )
  }
})

test('neutre : le poids reste dans une bande étroite, sans tendance', () => {
  const poids = Array.from({ length: 36 }, (_, m) => weightLbForMonth(m, 'neutre'))
  const min = Math.min(...poids)
  const max = Math.max(...poids)
  assert.ok(max - min <= 6, `amplitude ${round1(max - min)} lb — trop large pour un plateau`)
  // Ni gain ni perte nette sur trois ans.
  assert.ok(Math.abs(poids[35] - poids[0]) <= 3, 'le neutre ne doit pas dériver')
})

test('les trajectoires de poids vont bien dans le sens annoncé', () => {
  const bout = (sc: DummyScenario) => [weightLbForMonth(0, sc), weightLbForMonth(35, sc)]
  const [pDeb, pFin] = bout('progression')
  const [rDeb, rFin] = bout('regression')
  assert.ok(pFin < pDeb - 80, `progression : ${round1(pDeb)} → ${round1(pFin)} lb`)
  assert.ok(rFin > rDeb + 50, `régression : ${round1(rDeb)} → ${round1(rFin)} lb`)
})

test('les circonférences suivent le poids dans les deux sens', () => {
  const tailleDebut = circForMonth(0, 'regression').taille
  const tailleFin = circForMonth(35, 'regression').taille
  assert.ok(tailleFin > tailleDebut, 'le tour de taille doit grossir en régression')

  const pDebut = circForMonth(0, 'progression').taille
  const pFin = circForMonth(35, 'progression').taille
  assert.ok(pFin < pDebut, 'le tour de taille doit diminuer en progression')
})

test('aucune valeur aberrante : plis et circonférences restent plausibles', () => {
  for (const sc of Object.keys(SCENARIOS) as DummyScenario[]) {
    for (let m = 0; m < 36; m++) {
      const c = circForMonth(m, sc)
      const p = plisForMonth(m, sc)
      assert.ok(c.poidsKg > 40 && c.poidsKg < 200, `${sc} m${m} : poids ${c.poidsKg} kg`)
      assert.ok(c.taille > 50 && c.taille < 200, `${sc} m${m} : tour de taille ${c.taille} cm`)
      for (const [k, v] of Object.entries(p)) {
        assert.ok(v >= 3 && v < 80, `${sc} m${m} : pli ${k} = ${v} mm`)
      }
    }
  }
})

/* ── Relevés après l'effort ──────────────────────────────────────────────── */

test('la récupération suit le scénario : elle s’améliore en progression', () => {
  // C'est tout l'intérêt de dériver ces valeurs plutôt que de les écrire : la
  // FC de récupération doit raconter la même histoire que le reste du bilan.
  const b = SCENARIOS.progression.bilans
  const premier = recuperationFor(b[0]).fcRecup
  const dernier = recuperationFor(b[b.length - 1]).fcRecup
  assert.ok(dernier < premier, `la FC de récup devrait baisser (${premier} → ${dernier})`)
})

test('…et se dégrade en régression', () => {
  const b = SCENARIOS.regression.bilans
  const premier = recuperationFor(b[0]).fcRecup
  const dernier = recuperationFor(b[b.length - 1]).fcRecup
  assert.ok(dernier > premier, `la FC de récup devrait monter (${premier} → ${dernier})`)
})

test('en neutre, le dernier relevé n’est jamais le meilleur', () => {
  // Même contrainte que pour les autres mesures du scénario neutre : un
  // dernier point record déclencherait une fausse « victoire ».
  const valeurs = SCENARIOS.neutre.bilans.map(b => recuperationFor(b).fcRecup)
  assert.ok(valeurs[valeurs.length - 1] > Math.min(...valeurs), 'le dernier ne doit pas être le minimum')
})

test('la récupération reste physiologiquement plausible', () => {
  for (const nom of ['progression', 'regression', 'neutre'] as const) {
    for (const b of SCENARIOS[nom].bilans) {
      const r = recuperationFor(b)
      // Après l'effort, la FC est PLUS HAUTE qu'au repos — jamais l'inverse.
      assert.ok(r.fcRecup > b.fcRepos, `${nom} ${b.date} : FC récup ≤ FC repos`)
      assert.ok(r.fcRecup <= 200, `${nom} ${b.date} : FC récup ${r.fcRecup} invraisemblable`)
      // La systolique monte, la diastolique redescend un peu.
      assert.ok(r.paRecupSys > b.paSys, `${nom} ${b.date} : systolique de récup trop basse`)
      assert.ok(r.paRecupDia < b.paDia, `${nom} ${b.date} : diastolique de récup trop haute`)
      assert.ok(r.paRecupSys <= 220 && r.paRecupDia >= 50, `${nom} ${b.date} : PA de récup hors bornes`)
    }
  }
})

test('une baisse de FC de récupération compte comme un progrès', () => {
  // Le sens doit être déclaré : sans ça, une clé inconnue est traitée comme
  // « plus haut = mieux » et un progrès s'afficherait en rouge.
  assert.equal(isLowerBetter('fc_recup'), true)
  assert.equal(isLowerBetter('pa_recup_sys'), true)
  assert.equal(isLowerBetter('pa_recup_dia'), true)
})
