/**
 * Jeux de données fictifs pour l'outil de développement « Dummy Jean ».
 *
 * Trois trajectoires sur trois ans, pour voir chaque écran dans les trois cas
 * que rencontre Marie-Eve :
 *
 *  · `progression` — le client s'améliore à chaque bilan (jeu historique).
 *  · `regression`  — un client en forme qui décroche.
 *  · `neutre`      — ni progrès ni recul, le cas le plus délicat à fabriquer.
 *
 * ── Pourquoi ces données vivent ICI et non dans le composant ────────────────
 * Elles étaient dans `DummyJeanSeedButton.tsx`, donc impossibles à vérifier
 * autrement qu'en cliquant. Or le scénario neutre a une exigence PRÉCISE : il
 * doit produire **zéro victoire**, sinon il ne montre pas ce pour quoi il
 * existe. Un module pur se teste (`dummy-scenarios.test.ts`).
 */

/** Repères communs aux trois scénarios. */
export const DUMMY_BIRTHDATE = '1978-06-15'
export const DUMMY_HEIGHT_CM = 178

export type DummyScenario = 'progression' | 'regression' | 'neutre'

/**
 * Poids (lb) au mois `month` (0-35).
 *
 * La régression n'est pas la progression jouée à l'envers : la reprise
 * s'accélère au lieu de ralentir, ce qui est le schéma réel d'un abandon.
 */
export function weightLbForMonth(month: number, sc: DummyScenario): number {
  if (sc === 'regression') {
    if (month <= 12) return 205 + month * 1.5 // an 1 : +18 lb (reprise lente)
    if (month <= 24) return 223 + (month - 12) * 2.1 // an 2 : +25 lb (ça s'emballe)
    return 248 + (month - 24) * 1.67 // an 3 : +20 lb
  }
  if (sc === 'neutre') return neutreLb(month)
  if (month <= 12) return 300 - month * 3.75 // an 1 : −45 lb
  if (month <= 24) return 255 - (month - 12) * 2.92 // an 2 : −35 lb
  return 220 - (month - 24) * 1.67 // an 3 : −20 lb (plateau)
}

/**
 * Neutre : le poids fluctue de ±2,5 lb autour de 230 sans tendance.
 *
 * Les points d'ancrage sont choisis pour que le **dernier bilan (mois 30) ne
 * soit pas le plus bas** de la série. Sinon « record personnel — IMC » et
 * « — tour de taille » se déclencheraient (ils sont dérivés du poids), et le
 * scénario cesserait d'être neutre. Le minimum tombe volontairement au mois 18.
 */
const NEUTRE_ANCHORS = [232, 228, 231, 227, 230, 230]

function neutreLb(month: number): number {
  const i = Math.min(NEUTRE_ANCHORS.length - 1, Math.floor(month / 6))
  const j = Math.min(NEUTRE_ANCHORS.length - 1, i + 1)
  const t = (month % 6) / 6
  return NEUTRE_ANCHORS[i] + (NEUTRE_ANCHORS[j] - NEUTRE_ANCHORS[i]) * t
}

export interface BilanSpec {
  date: string
  /** Mois correspondant, pour récupérer circonférences et plis cohérents. */
  monthOffset: number
  vo2max: number
  bruceDurationSec: number
  fcRepos: number
  paSys: number
  paDia: number
  pushups: number
  situps: number
  sautCm: number
  flexionCm: number
  enduranceDosSec: number
}

/** Progression : chaque semestre s'améliore. */
const BILANS_PROGRESSION: BilanSpec[] = [
  { date: '2023-01-15', monthOffset: 0, vo2max: 18, bruceDurationSec: 5 * 60 + 18, fcRepos: 92, paSys: 148, paDia: 96, pushups: 3, situps: 6, sautCm: 18, flexionCm: 20, enduranceDosSec: 32 },
  { date: '2023-07-15', monthOffset: 6, vo2max: 22, bruceDurationSec: 6 * 60 + 36, fcRepos: 86, paSys: 142, paDia: 92, pushups: 7, situps: 11, sautCm: 23, flexionCm: 26, enduranceDosSec: 53 },
  { date: '2024-01-15', monthOffset: 12, vo2max: 26, bruceDurationSec: 7 * 60 + 54, fcRepos: 80, paSys: 136, paDia: 88, pushups: 11, situps: 15, sautCm: 28, flexionCm: 29, enduranceDosSec: 75 },
  { date: '2024-07-15', monthOffset: 18, vo2max: 30, bruceDurationSec: 9 * 60, fcRepos: 75, paSys: 130, paDia: 84, pushups: 15, situps: 19, sautCm: 33, flexionCm: 31, enduranceDosSec: 95 },
  { date: '2025-01-15', monthOffset: 24, vo2max: 33, bruceDurationSec: 9 * 60 + 45, fcRepos: 70, paSys: 126, paDia: 80, pushups: 18, situps: 22, sautCm: 37, flexionCm: 33, enduranceDosSec: 110 },
  { date: '2025-07-15', monthOffset: 30, vo2max: 37, bruceDurationSec: 10 * 60 + 51, fcRepos: 66, paSys: 122, paDia: 78, pushups: 22, situps: 25, sautCm: 41, flexionCm: 35, enduranceDosSec: 120 }
]

/**
 * Régression : un client en forme qui décroche.
 *
 * Le premier semestre baisse à peine — volontaire : il faut pouvoir vérifier
 * qu'un recul léger ne déclenche pas de fausse victoire. La chute s'accentue
 * ensuite jusqu'à faire redescendre les catégories.
 */
const BILANS_REGRESSION: BilanSpec[] = [
  { date: '2023-01-15', monthOffset: 0, vo2max: 39, bruceDurationSec: 11 * 60 + 20, fcRepos: 62, paSys: 118, paDia: 74, pushups: 26, situps: 28, sautCm: 44, flexionCm: 36, enduranceDosSec: 128 },
  { date: '2023-07-15', monthOffset: 6, vo2max: 37, bruceDurationSec: 10 * 60 + 45, fcRepos: 65, paSys: 121, paDia: 76, pushups: 24, situps: 26, sautCm: 42, flexionCm: 35, enduranceDosSec: 121 },
  { date: '2024-01-15', monthOffset: 12, vo2max: 33, bruceDurationSec: 9 * 60 + 40, fcRepos: 70, paSys: 127, paDia: 80, pushups: 19, situps: 21, sautCm: 37, flexionCm: 32, enduranceDosSec: 104 },
  { date: '2024-07-15', monthOffset: 18, vo2max: 28, bruceDurationSec: 8 * 60 + 24, fcRepos: 77, paSys: 133, paDia: 85, pushups: 13, situps: 16, sautCm: 31, flexionCm: 28, enduranceDosSec: 82 },
  { date: '2025-01-15', monthOffset: 24, vo2max: 23, bruceDurationSec: 6 * 60 + 54, fcRepos: 84, paSys: 140, paDia: 90, pushups: 8, situps: 11, sautCm: 25, flexionCm: 24, enduranceDosSec: 58 },
  { date: '2025-07-15', monthOffset: 30, vo2max: 19, bruceDurationSec: 5 * 60 + 36, fcRepos: 90, paSys: 146, paDia: 94, pushups: 4, situps: 7, sautCm: 20, flexionCm: 21, enduranceDosSec: 38 }
]

/**
 * Neutre : le client se maintient. Le plus délicat des trois.
 *
 * Chaque valeur oscille légèrement — un plateau parfaitement plat serait
 * irréaliste — MAIS le dernier bilan n'est jamais le meilleur de la série, sur
 * aucune des mesures suivies par `detectWins` (VO2max, pompes, redressements,
 * saut). Sans cette contrainte, la moindre oscillation favorable au dernier
 * point déclencherait un « record personnel » et le scénario ne montrerait plus
 * le cas « aucune victoire ».
 *
 * Les catégories ne bougent pas non plus d'un bilan à l'autre, donc pas de
 * progression de cote ni de gain sur le score global.
 */
const BILANS_NEUTRE: BilanSpec[] = [
  { date: '2023-01-15', monthOffset: 0, vo2max: 31, bruceDurationSec: 9 * 60 + 10, fcRepos: 72, paSys: 128, paDia: 82, pushups: 15, situps: 18, sautCm: 33, flexionCm: 29, enduranceDosSec: 90 },
  { date: '2023-07-15', monthOffset: 6, vo2max: 32, bruceDurationSec: 9 * 60 + 25, fcRepos: 71, paSys: 127, paDia: 81, pushups: 16, situps: 19, sautCm: 34, flexionCm: 30, enduranceDosSec: 94 },
  { date: '2024-01-15', monthOffset: 12, vo2max: 30, bruceDurationSec: 8 * 60 + 55, fcRepos: 73, paSys: 129, paDia: 83, pushups: 14, situps: 17, sautCm: 32, flexionCm: 28, enduranceDosSec: 88 },
  { date: '2024-07-15', monthOffset: 18, vo2max: 32, bruceDurationSec: 9 * 60 + 25, fcRepos: 71, paSys: 127, paDia: 81, pushups: 16, situps: 19, sautCm: 34, flexionCm: 30, enduranceDosSec: 94 },
  { date: '2025-01-15', monthOffset: 24, vo2max: 31, bruceDurationSec: 9 * 60 + 10, fcRepos: 72, paSys: 128, paDia: 82, pushups: 15, situps: 18, sautCm: 33, flexionCm: 29, enduranceDosSec: 91 },
  { date: '2025-07-15', monthOffset: 30, vo2max: 31, bruceDurationSec: 9 * 60 + 10, fcRepos: 72, paSys: 128, paDia: 82, pushups: 15, situps: 18, sautCm: 33, flexionCm: 29, enduranceDosSec: 90 }
]

export interface ScenarioConfig {
  name: string
  email: string
  bilans: BilanSpec[]
  /** Libellé du bouton dans les réglages. */
  bouton: string
  /** Résumé affiché sous les boutons. */
  resume: string
}

/** Emails distincts → les trois clients fictifs coexistent dans la base. */
export const SCENARIOS: Record<DummyScenario, ScenarioConfig> = {
  progression: {
    name: 'Dummy Jean (progression)',
    email: 'dummy@kinesio-outils.test',
    bilans: BILANS_PROGRESSION,
    bouton: 'Progression',
    resume: '300 lb → 200 lb, VO2max 18 → 37, gain musculaire progressif.'
  },
  regression: {
    name: 'Dummy Jean (régression)',
    email: 'dummy-regression@kinesio-outils.test',
    bilans: BILANS_REGRESSION,
    bouton: 'Régression',
    resume: '205 lb → 268 lb, VO2max 39 → 19, pression artérielle qui monte.'
  },
  neutre: {
    name: 'Dummy Jean (neutre)',
    email: 'dummy-neutre@kinesio-outils.test',
    bilans: BILANS_NEUTRE,
    bouton: 'Neutre',
    resume: '230 lb stable, valeurs qui oscillent sans tendance — aucune victoire déclenchée.'
  }
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/** lb → kg (l'IPC reçoit des kg). */
export function lbToKg(lb: number): number {
  return lb / 2.20462
}

/**
 * Circonférences cohérentes avec le mois donné.
 *
 * `lostLb` garde 300 comme référence dans LES TROIS scénarios : c'est ce qui
 * permet de réutiliser les mêmes formules anthropométriques. Un poids qui monte
 * fait simplement diminuer `lostLb`, donc grossir les circonférences.
 *
 * `noise` permet au composant d'ajouter du bruit ; les tests passent 0 pour
 * rester déterministes.
 */
export function circForMonth(month: number, sc: DummyScenario, noise = 0) {
  const poidsLb = weightLbForMonth(month, sc) + noise
  const lostLb = 300 - poidsLb
  // Gain musculaire lié au temps : seulement quand le client s'entraîne.
  const gainMusculaire = sc === 'progression' ? month * 0.04 : 0
  return {
    poidsKg: round1(lbToKg(poidsLb)),
    cou: round1(46 - lostLb * 0.06),
    epaule: round1(128 - lostLb * 0.05 + gainMusculaire),
    bicepsG: round1(38 + gainMusculaire),
    bicepsD: round1(38.3 + gainMusculaire),
    poitrine: round1(120 - lostLb * 0.1),
    taille: round1(132 - lostLb * 0.37),
    abdomen: round1(135 - lostLb * 0.38),
    hanche: round1(128 - lostLb * 0.3),
    cuisseG: round1(72 - lostLb * 0.08),
    cuisseD: round1(72.5 - lostLb * 0.08),
    molletG: round1(45 - lostLb * 0.04),
    molletD: round1(45.3 - lostLb * 0.04)
  }
}

/** Plis cutanés cohérents avec le mois donné (décroissent avec la masse grasse). */
export function plisForMonth(month: number, sc: DummyScenario) {
  const lostLb = 300 - weightLbForMonth(month, sc)
  return {
    triceps: Math.max(4, round1(28 - lostLb * 0.18)),
    biceps: Math.max(3, round1(20 - lostLb * 0.13)),
    sousscapulaire: Math.max(5, round1(38 - lostLb * 0.2)),
    iliaque: Math.max(5, round1(45 - lostLb * 0.25))
  }
}
