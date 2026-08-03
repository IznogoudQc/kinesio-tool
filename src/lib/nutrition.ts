/**
 * Calculs d'objectif chiffré & nutrition — logique pure (sans JSX, sans DB),
 * testable avec `node --test`.
 *
 * Deux volets :
 *  1. `bodyFatGoal` — poids-cible pour atteindre un % de gras visé, en préservant
 *     la masse maigre (méthode standard : on ne perd que du gras). Défendable, ce
 *     n'est que de l'arithmétique.
 *  2. `estimateMacros` — estimation calorique + macros pour une perte de gras.
 *     ⚠️ À TITRE INDICATIF seulement — la planification nutritionnelle relève des
 *     nutritionnistes/diététistes (OPDQ). Toujours accompagner d'un avertissement.
 *
 * Toutes les masses sont en kg en interne (la conversion lb se fait à l'affichage,
 * cf. src/lib/units.ts). Renvoie `null` dès qu'une donnée requise manque.
 */

export type ActivityLevel = 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif'

/** Facteur kg → lb (identique à src/lib/units.ts, inliné pour garder ce module
 *  autonome — pas d'import de valeur, exécutable tel quel par `node --test`). */

/** Multiplicateurs de dépense énergétique (BMR → TDEE) — valeurs Harris/Mifflin usuelles. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
  tres_actif: 1.9
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentaire: 'Sédentaire (peu ou pas d’exercice)',
  leger: 'Léger (1-3 j/sem)',
  modere: 'Modéré (3-5 j/sem)',
  actif: 'Actif (6-7 j/sem)',
  tres_actif: 'Très actif (travail physique + entraînement)'
}

export const ACTIVITY_ORDER: ActivityLevel[] = ['sedentaire', 'leger', 'modere', 'actif', 'tres_actif']

/** Déficit calorique par défaut (20 % sous le TDEE) — utilisé quand aucun rythme
 *  de perte n'est fourni. On ne descend jamais sous le BMR (garde-fou sécurité). */
const FAT_LOSS_DEFICIT = 0.2

/** Énergie d'un kg de masse grasse (kcal) — base du calcul déficit ↔ rythme. */
const KCAL_PER_KG_FAT = 7700

/** Rythmes de perte proposés (kg/semaine), du plus lent au plus rapide. */
export interface RatePreset {
  kgPerWeek: number
  intensity: string
}
export const RATE_PRESETS: RatePreset[] = [
  { kgPerWeek: 0.25, intensity: 'Lent' },
  { kgPerWeek: 0.5, intensity: 'Modéré' },
  { kgPerWeek: 0.75, intensity: 'Soutenu' },
  { kgPerWeek: 1.0, intensity: 'Rapide' }
]
/** Rythme par défaut appliqué à l'activation du module (modéré, soutenable). */
export const DEFAULT_RATE_KG_PER_WEEK = 0.5

/** Déficit calorique quotidien correspondant à un rythme hebdomadaire donné. */
export function dailyDeficitForRate(rateKgPerWeek: number | null | undefined): number | null {
  if (!Number.isFinite(rateKgPerWeek ?? NaN) || (rateKgPerWeek as number) <= 0) return null
  return Math.round(((rateKgPerWeek as number) * KCAL_PER_KG_FAT) / 7)
}

/** Inverse : rythme hebdomadaire (kg/sem) impliqué par un déficit quotidien —
 *  sert à déduire le rythme quand les calories sont fixées manuellement.
 *  `null` si le déficit est nul ou négatif (aucune perte projetée). */
export function weeklyLossFromDeficit(dailyDeficitKcal: number | null | undefined): number | null {
  if (!Number.isFinite(dailyDeficitKcal ?? NaN) || (dailyDeficitKcal as number) <= 0) return null
  return ((dailyDeficitKcal as number) * 7) / KCAL_PER_KG_FAT
}

/** Nombre de semaines estimé pour perdre `toLoseKg` au rythme donné (kg/sem).
 *  `null` si les données sont absentes ou s'il n'y a rien à perdre. */
export function weeksToGoal(
  toLoseKg: number | null | undefined,
  rateKgPerWeek: number | null | undefined
): number | null {
  if (!Number.isFinite(toLoseKg ?? NaN) || !Number.isFinite(rateKgPerWeek ?? NaN)) return null
  if ((toLoseKg as number) <= 0 || (rateKgPerWeek as number) <= 0) return null
  return (toLoseKg as number) / (rateKgPerWeek as number)
}

/** Formule des macros — paramètres par défaut, modifiables par client :
 *  - protéines : 1 g par livre de masse maigre (préserve le muscle en déficit) ;
 *  - lipides : plafond de 60 g ;
 *  - glucides : le reste des calories cibles. */
export const DEFAULT_PROTEIN_PER_LB_LEAN = 1.0
/**
 * Base actuelle : g de protéines par kg de **poids corporel**.
 *
 * Méthode de Marie-Eve : 1 à 1,4 g/kg, jusqu'à 1,6 chez les plus actifs. On
 * prend 1,4 par défaut — le haut de la fourchette courante, pas l'extrême.
 */
export const DEFAULT_PROTEIN_PER_KG = 1.4
/** Fourchette annoncée à Marie dans l'interface. */
export const PROTEIN_PER_KG_RANGE = { min: 1.0, usual: 1.4, max: 1.6 }
export const DEFAULT_FAT_MAX_G = 60

/**
 * Fourchette de lipides visée, en % de l'apport calorique total.
 *
 * Source : CPAFLA / ÉCPHV — Guide du conseiller, 3ᵉ éd. « La quantité totale de
 * gras d'origine alimentaire devrait correspondre à 30 à 40 % de l'apport
 * calorique total, selon la quantité de glucides consommée (la quantité de
 * protéines doit demeurer relativement constante). »
 *
 * D'où les deux bases de calcul possibles (`FatMode`) : un plafond fixe en
 * grammes ne tient la fourchette que sur une plage étroite de calories — 60 g
 * couvrent 30-40 % entre 1350 et 1800 kcal seulement, et passent sous les 30 %
 * au-delà. Le mode `'pct'` s'y adosse directement.
 */
export const FAT_PCT_OF_KCAL_RANGE = { min: 30, max: 40 }

/** Base de calcul des lipides. `'g'` = plafond fixe (historique, défaut). */
export type FatMode = 'g' | 'pct'
/** Milieu de la fourchette — défaut quand Marie bascule en % sans préciser. */
export const DEFAULT_FAT_PCT = 35

/** Part des calories venant des lipides (%). `null` si l'un des deux manque. */
export function fatPctOfKcal(fatG: number | null | undefined, targetKcal: number | null | undefined): number | null {
  if (!Number.isFinite(fatG ?? NaN) || !Number.isFinite(targetKcal ?? NaN)) return null
  if ((targetKcal as number) <= 0) return null
  return ((fatG as number) * 9 * 100) / (targetKcal as number)
}

/** Bornes en grammes correspondant à la fourchette, pour des calories données. */
export function fatGramsRangeForKcal(targetKcal: number | null | undefined): { min: number; max: number } | null {
  if (!Number.isFinite(targetKcal ?? NaN) || (targetKcal as number) <= 0) return null
  const kcal = targetKcal as number
  return {
    min: Math.round((kcal * FAT_PCT_OF_KCAL_RANGE.min) / 100 / 9),
    max: Math.round((kcal * FAT_PCT_OF_KCAL_RANGE.max) / 100 / 9)
  }
}

/** Fibres alimentaires visées : 14 g par 1000 kcal — référence Santé Canada / DRI
 *  (Institute of Medicine, 2005). Équivaut à ≈ 25 g/j (femme) et ≈ 38 g/j (homme).
 *  Comme la cible s'adosse aux calories, elle s'adapte à chaque client. */
export const FIBER_G_PER_1000_KCAL = 14
export function fiberTargetG(targetKcal: number): number {
  return Math.round((targetKcal / 1000) * FIBER_G_PER_1000_KCAL)
}

export interface BodyFatGoal {
  /** Poids à atteindre (kg) pour le % de gras visé, masse maigre constante. */
  goalKg: number
  /** Masse à perdre (kg). ≤ 0 si l'objectif est déjà atteint ou dépassé. */
  toLoseKg: number
  /** Masse maigre estimée (kg) — préservée dans le calcul. */
  leanKg: number
}

/**
 * Poids-cible pour atteindre `targetPct` % de gras, en gardant la masse maigre.
 *   masse maigre = poids × (1 − %gras/100)
 *   poids-cible  = masse maigre / (1 − %cible/100)
 */
export function bodyFatGoal(
  currentKg: number | null | undefined,
  currentBodyFatPct: number | null | undefined,
  targetPct: number | null | undefined
): BodyFatGoal | null {
  if (
    !Number.isFinite(currentKg ?? NaN) ||
    !Number.isFinite(currentBodyFatPct ?? NaN) ||
    !Number.isFinite(targetPct ?? NaN)
  ) {
    return null
  }
  const w = currentKg as number
  const bf = currentBodyFatPct as number
  const target = targetPct as number
  if (w <= 0 || bf < 0 || bf >= 100 || target <= 0 || target >= 100) return null

  const leanKg = w * (1 - bf / 100)
  const goalKg = leanKg / (1 - target / 100)
  return {
    goalKg: Math.round(goalKg * 10) / 10,
    toLoseKg: Math.round((w - goalKg) * 10) / 10,
    leanKg: Math.round(leanKg * 10) / 10
  }
}

/** BMR (métabolisme de repos, kcal/j) via Mifflin-St Jeor. */
export function mifflinBmr(params: {
  weightKg: number | null | undefined
  heightCm: number | null | undefined
  age: number | null | undefined
  sex: 'M' | 'F' | null | undefined
}): number | null {
  const { weightKg, heightCm, age, sex } = params
  if (
    !Number.isFinite(weightKg ?? NaN) ||
    !Number.isFinite(heightCm ?? NaN) ||
    !Number.isFinite(age ?? NaN) ||
    (sex !== 'M' && sex !== 'F')
  ) {
    return null
  }
  const base = 10 * (weightKg as number) + 6.25 * (heightCm as number) - 5 * (age as number)
  const bmr = sex === 'M' ? base + 5 : base - 161
  return bmr > 0 ? Math.round(bmr) : null
}

export interface MacroEstimate {
  bmr: number
  tdee: number
  targetKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  /** Fibres visées (g/jour), 14 g par 1000 kcal (référence Santé Canada / DRI). */
  fiberG: number
}

/** Nombre de repas par défaut si non précisé. */
export const DEFAULT_MEALS_PER_DAY = 3

/** Énergie d'un gramme de macronutriment (kcal). Facteurs d'Atwater. */
export const KCAL_PER_G = { protein: 4, fat: 9, carbs: 4 } as const

/**
 * Part de chaque macro dans les calories cibles (%).
 *
 * Rapportée à `targetKcal`, pas à la somme des trois : c'est la cible qui fait
 * référence. En mode automatique les glucides sont un reste arrondi, donc le
 * total peut tomber à 99 ou 101 % — un écart réel, qu'il vaut mieux montrer que
 * masquer en normalisant.
 *
 * Les fibres n'y figurent pas : elles sont comptées dans les glucides et
 * n'apportent pas d'énergie assimilable. Leur ajouter un % double-compterait.
 */
export function macroEnergyShares(
  macros: Pick<MacroEstimate, 'targetKcal' | 'proteinG' | 'fatG' | 'carbsG'>
): { protein: number; fat: number; carbs: number } | null {
  const { targetKcal, proteinG, fatG, carbsG } = macros
  if (!Number.isFinite(targetKcal) || targetKcal <= 0) return null
  const part = (g: number, parG: number) => (g * parG * 100) / targetKcal
  return {
    protein: part(proteinG, KCAL_PER_G.protein),
    fat: part(fatG, KCAL_PER_G.fat),
    carbs: part(carbsG, KCAL_PER_G.carbs)
  }
}

/**
 * Explication des glucides nets, montrée à Marie et au client.
 *
 * Texte court volontairement : c'est une définition, pas un conseil. Aucune
 * recommandation de quantité — ce serait sortir du champ de pratique.
 */
export const NET_CARBS_EXPLANATION =
  'Le calcul se fait par aliment : glucides nets = les glucides de l’aliment ' +
  'moins ses fibres. Les fibres traversent l’intestin sans être absorbées comme ' +
  'les autres glucides : elles apportent peu d’énergie et font peu monter la ' +
  'glycémie. Ce sont donc les glucides nets qui reflètent le mieux l’effet réel ' +
  'de ce qu’on mange.'

/**
 * ⚠️ Pas de fonction « glucides totaux ».
 *
 * On pourrait croire que `totaux = nets + fibres`, mais c'est faux ici : la
 * cible de fibres est **dérivée des calories** (14 g / 1000 kcal), pas la somme
 * des fibres réellement présentes dans les aliments qui fournissent les
 * glucides nets. Additionner les deux mélangerait une cible et une observation,
 * et donnerait un total qui ne correspond à aucun repas réel.
 *
 * Les deux valeurs sont des cibles **indépendantes** : tant de glucides nets,
 * tant de fibres. Le net se calcule aliment par aliment, sur son étiquette.
 *
 * Convention de l'app : le chiffre saisi et affiché est le glucide **net**, et
 * les fibres comptent 0 kcal. Les calories restent `P×4 + net×4 + L×9`,
 * identiques aux versions antérieures — seul le sens du nombre a changé.
 */

/** Densité en fibres (g par 1000 kcal) — à comparer à `FIBER_G_PER_1000_KCAL`. */
export function fiberDensityPer1000Kcal(fiberG: number, targetKcal: number): number | null {
  if (!Number.isFinite(targetKcal) || targetKcal <= 0) return null
  return (fiberG * 1000) / targetKcal
}

/** Répartit (à parts égales) les macros du jour sur `meals` repas. Chaque valeur
 *  est arrondie ; c'est indicatif, pas une somme exacte au gramme près. */
export function macrosPerMeal(macros: MacroEstimate, meals: number): MacroEstimate {
  const n = Math.max(1, Math.round(meals))
  const per = (v: number) => Math.round(v / n)
  return {
    bmr: 0,
    tdee: 0,
    targetKcal: per(macros.targetKcal),
    proteinG: per(macros.proteinG),
    carbsG: per(macros.carbsG),
    fatG: per(macros.fatG),
    fiberG: per(macros.fiberG)
  }
}

/**
 * Estimation calorique + macros pour une perte de gras. Formule (paramétrable) :
 *  - protéines = `proteinPerKg` g × **poids corporel** (kg) ;
 *  - lipides = plafond `fatMaxG` g ;
 *  - glucides = le reste des calories cibles.
 * `leanKg` reste requis : c'est lui qui atteste qu'un % de gras est connu, et
 * la masse maigre sert encore ailleurs. Mais il n'entre plus dans les
 * protéines — voir ADR : base changée en v0.9.106 à la demande de Marie.
 * ⚠️ Indicatif — accompagner d'un avertissement (champ de pratique).
 */
export function estimateMacros(params: {
  weightKg: number | null | undefined
  heightCm: number | null | undefined
  age: number | null | undefined
  sex: 'M' | 'F' | null | undefined
  activity: ActivityLevel | null | undefined
  /** Masse maigre (kg) — base du calcul des protéines. */
  leanKg: number | null | undefined
  /** Déficit calorique quotidien visé (kcal). Si absent, on applique −20 % du TDEE. */
  dailyDeficitKcal?: number | null
  /** g de protéines par kg de poids corporel (défaut 1,4). */
  proteinPerKg?: number | null
  /** Plafond de lipides en g (défaut 60). Ignoré si `fatMode = 'pct'`. */
  fatMaxG?: number | null
  /** Base de calcul des lipides : plafond en g (défaut) ou % des calories. */
  fatMode?: FatMode | null
  /** % des calories en lipides quand `fatMode = 'pct'` (défaut 35). */
  fatPct?: number | null
  /** Calories cibles fixées manuellement (kcal). Si absent, calcul automatique
   *  (TDEE − déficit). Permet à Marie de fixer les calories elle-même. */
  targetKcalOverride?: number | null
}): MacroEstimate | null {
  const { weightKg, heightCm, age, sex, activity, leanKg, dailyDeficitKcal, proteinPerKg, fatMaxG, fatMode, fatPct, targetKcalOverride } = params
  const bmr = mifflinBmr({ weightKg, heightCm, age, sex })
  if (bmr === null || !activity || !(activity in ACTIVITY_FACTORS)) return null
  if (!Number.isFinite(leanKg ?? NaN) || (leanKg as number) <= 0) return null

  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activity])
  // Déficit selon le rythme choisi, sinon défaut −20 %. Jamais sous le BMR.
  const deficitTarget =
    Number.isFinite(dailyDeficitKcal ?? NaN) && (dailyDeficitKcal as number) > 0
      ? Math.round(tdee - (dailyDeficitKcal as number))
      : Math.round(tdee * (1 - FAT_LOSS_DEFICIT))
  // Calories cibles : valeur manuelle si fournie, sinon calcul auto (jamais sous le BMR).
  const targetKcal =
    Number.isFinite(targetKcalOverride ?? NaN) && (targetKcalOverride as number) > 0
      ? Math.round(targetKcalOverride as number)
      : Math.max(bmr, deficitTarget)

  const parKg =
    Number.isFinite(proteinPerKg ?? NaN) && (proteinPerKg as number) > 0
      ? (proteinPerKg as number)
      : DEFAULT_PROTEIN_PER_KG
  const fatCap =
    Number.isFinite(fatMaxG ?? NaN) && (fatMaxG as number) > 0 ? (fatMaxG as number) : DEFAULT_FAT_MAX_G

  // Poids CORPOREL, pas masse maigre : c'est tout le changement de base.
  const proteinG = Math.round((weightKg as number) * parKg)
  // Lipides : plafond fixe en grammes (défaut), ou part des calories cibles.
  // En mode %, les grammes suivent les calories — c'est tout l'intérêt.
  const pct = Number.isFinite(fatPct ?? NaN) && (fatPct as number) > 0 ? (fatPct as number) : DEFAULT_FAT_PCT
  const fatG = fatMode === 'pct' ? Math.round((targetKcal * pct) / 100 / 9) : Math.round(fatCap)
  const carbsG = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4))

  return { bmr, tdee, targetKcal, proteinG, carbsG, fatG, fiberG: fiberTargetG(targetKcal) }
}
