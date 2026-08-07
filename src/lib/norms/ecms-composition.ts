/**
 * Composition corporelle — transcription **littérale** de Statistique Canada.
 *
 * Enquête canadienne sur les mesures de la santé, variables dérivées :
 *   • `HWMDWSTA` (tableau 14) — points du tour de taille
 *   • `SFMDBCA`  (tableau 16) — arbre de décision du résultat
 *   • `SFMDS5`   (tableau 20) — somme des 5 plis, et ses exclusions
 *   • `SFMDS5A`  (tableau 21) — points de la somme des plis
 *
 * ⚠️ Ce module est **volontairement redondant** avec `cpafla-composition.ts`.
 * Il n'est pas une refactorisation : c'est une seconde implémentation, écrite
 * depuis la spécification publique, qui sert à **mesurer l'écart** avec notre
 * lecture du Guide du conseiller. Deux implémentations qui concordent valent
 * une preuve ; une seule ne vaut qu'une affirmation.
 *
 * Ce qu'il fait et que l'autre ne fait pas :
 *
 *  1. **Limite d'âge 15-69 ans.** Hors de cette plage, l'ECMS ne publie aucune
 *     norme — le résultat est `null`, pas une note approchée.
 *  2. **Exclusion des plis au-dessus d'un IMC de 30.** Le tableau 20 retire la
 *     somme des 5 plis de la population dès `HWMDBMI > 29,99`. Le résultat
 *     retombe alors sur le tour de taille seul, même si les cinq plis sont
 *     mesurés. Notre lecture du guide, elle, les utilise à tout IMC.
 *  3. **Aucune valeur inférée.** Là où la spécification ne dit rien, on rend
 *     `null` au lieu de combler par élimination.
 *
 * Module autonome (aucun import) : il traverse la frontière Electron/renderer.
 */

export interface EcmsCompositionInput {
  imc: number | null | undefined
  /** Tour de taille (cm). */
  ct: number | null | undefined
  /** Somme des CINQ plis cutanés (mm) — `null` si le mollet manque. */
  s5pc: number | null | undefined
  sex: 'F' | 'M' | null
  age: number | null | undefined
}

/** Pourquoi aucun résultat n'a pu être produit — utile pour l'expliquer à l'écran. */
export type EcmsExclusion =
  | 'age'
  | 'sexe'
  | 'mesures'
  /** IMC > 29,99 : les plis sortent de la population (tableau 20), pas le calcul. */
  | 'plis-exclus'
  | null

export interface EcmsCompositionResult {
  /** Résultat publié, arrondi à une décimale. `null` si non calculable. */
  valeur: number | null
  /** Cote entière 0-4 dérivée de la classification. */
  cote: number | null
  /** Points du tour de taille (HWMDWSTA). */
  waistPoints: number | null
  /** Points de la somme des plis (SFMDS5A), ou `null` si exclue/absente. */
  skinfoldPoints: number | null
  /** Ce qui a limité le calcul, le cas échéant. */
  exclusion: EcmsExclusion
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Tableau 14 — HWMDWSTA. Règles évaluées **de haut en bas**, première atteinte.
 *
 *  ⚠️ Les règles 3 et 4 se chevauchent sous un IMC de 18,5 : une personne maigre
 *  au tour de taille fin déclenche les deux. L'ordre décide donc du résultat, et
 *  la spécification ne l'énonce pas. On lit de haut en bas — la règle 4 n'ayant
 *  aucune condition d'IMC, c'est la forme d'un cas par défaut.
 *
 *  ⚠️ Coquille de la page : la ligne « 1 » répète chez la femme l'intervalle
 *  79,9-87,1, identique à la ligne « 3 ». Lue ainsi, elle laisse des milliers de
 *  combinaisons sans règle. On lit « > 87 », par symétrie avec les hommes.
 */
export function ecmsWaistPoints(bmi: number, waist: number, sex: 'F' | 'M'): number {
  const M = sex === 'M'
  if (bmi > 29.99 && ((M && waist > 101.0) || (!M && waist > 87.0))) return 0
  if (bmi > 18.49 && bmi < 30.0 && ((M && waist > 101.0) || (!M && waist > 87.0))) return 1
  if (bmi > 29.99 && ((M && waist > 93.9 && waist < 101.1) || (!M && waist > 79.9 && waist < 87.1))) return 2
  if (
    M
      ? bmi < 18.5 || (bmi > 18.49 && bmi < 30.0 && waist > 93.9 && waist < 101.1)
      : bmi < 18.5 || (bmi > 18.49 && bmi < 30.0 && waist > 79.9 && waist < 87.1)
  ) {
    return 3
  }
  return 4
}

/** Tableau 21 — SFMDS5A. `null` si aucune règle ne couvre la combinaison. */
export function ecmsSkinfoldPoints(bmi: number, s5: number, sex: 'F' | 'M'): number | null {
  if (sex === 'M') {
    if (bmi > 34.99 && s5 > 77.0) return 0
    if (bmi > 32.49 && bmi < 35.0 && s5 > 77.0) return 1
    if ((bmi < 32.5 && s5 > 77.0) || (bmi > 32.49 && bmi < 35.0 && s5 > 53.9 && s5 < 77.1)) return 2
    if (
      (bmi < 18.5 && (s5 < 25.0 || (s5 > 55.0 && s5 < 77.1))) ||
      (bmi > 18.49 && bmi < 32.5 && s5 > 53.9 && s5 < 77.1)
    ) {
      return 3
    }
    if ((bmi < 18.5 && s5 > 24.9 && s5 < 55.1) || (bmi > 18.49 && s5 > 0 && s5 < 54.0)) return 4
    return null
  }
  if (bmi > 34.99 && s5 > 113.0) return 0
  if (bmi > 32.49 && bmi < 35.0 && s5 > 113.0) return 1
  if ((bmi < 32.5 && s5 > 113.0) || (bmi > 32.49 && bmi < 35.0 && s5 > 82.9 && s5 < 113.1)) return 2
  if (
    (bmi < 18.5 && (s5 < 46.0 || (s5 > 84.0 && s5 < 113.1))) ||
    (bmi > 18.49 && bmi < 32.5 && s5 > 82.9 && s5 < 113.1)
  ) {
    return 3
  }
  if ((bmi < 18.5 && s5 > 45.9 && s5 < 84.1) || (bmi > 18.49 && s5 > 0 && s5 < 83.0)) return 4
  return null
}

/** Tableau 16 — SFMDBCA. Le résultat, tel que l'ECMS le publierait. */
export function ecmsComposition(input: EcmsCompositionInput): EcmsCompositionResult {
  const vide: EcmsCompositionResult = {
    valeur: null,
    cote: null,
    waistPoints: null,
    skinfoldPoints: null,
    exclusion: null
  }
  const { imc, ct, s5pc, sex, age } = input
  if (sex !== 'M' && sex !== 'F') return { ...vide, exclusion: 'sexe' }
  // Tableaux 14, 16 et 21 : « Exclusions de la population » hors 15-69 ans.
  if (!isNum(age) || age < 15 || age > 69) return { ...vide, exclusion: 'age' }
  if (!isNum(imc)) return { ...vide, exclusion: 'mesures' }

  const waistPoints = isNum(ct) ? ecmsWaistPoints(imc, ct, sex) : null

  // Tableau 20 : la somme des 5 plis sort de la population dès un IMC > 29,99.
  const plisExclus = imc > 29.99
  const skinfoldPoints = !plisExclus && isNum(s5pc) ? ecmsSkinfoldPoints(imc, s5pc, sex) : null
  const exclusion: EcmsExclusion = plisExclus && isNum(s5pc) ? 'plis-exclus' : null

  const fini = (valeur: number): EcmsCompositionResult => ({
    valeur: Math.round(valeur * 10) / 10,
    cote: classer(valeur),
    waistPoints,
    skinfoldPoints,
    exclusion
  })

  if (waistPoints !== null && skinfoldPoints !== null) {
    return fini((waistPoints * 1.5 + skinfoldPoints) / 2.5)
  }
  if (skinfoldPoints !== null) return fini(skinfoldPoints)
  if (waistPoints !== null) return fini(waistPoints)

  // IMC seul (tableau 16). Rien n'y est écrit pour un IMC de 35 et plus : on ne
  // comble pas, contrairement à notre lecture du guide qui y met 0.
  if (imc > 32.49 && imc < 35.0) return fini(1)
  if (imc > 29.99 && imc < 32.5) return fini(2)
  if ((imc > 0 && imc < 18.5) || (imc > 24.99 && imc < 30.0)) return fini(3)
  if (imc > 18.49 && imc < 25.0) return fini(4)
  return { ...vide, exclusion: 'mesures' }
}

/** Classification du résultat (fenêtre Propriétés) : < 0,5 · < 1,5 · < 2,5 · < 3,5. */
function classer(valeur: number): number {
  if (valeur < 0.5) return 0
  if (valeur < 1.5) return 1
  if (valeur < 2.5) return 2
  if (valeur < 3.5) return 3
  return 4
}

/** Phrase expliquant ce que le mode strict a fait — ou pourquoi il n'a rien produit. */
export function ecmsExplanation(r: EcmsCompositionResult): string {
  switch (r.exclusion) {
    case 'age':
      return 'Hors norme : l’ECMS ne publie de barème que de 15 à 69 ans.'
    case 'sexe':
      return 'Sexe requis pour appliquer le barème.'
    case 'plis-exclus':
      return 'Somme des 5 plis écartée : l’ECMS l’exclut de la population dès un IMC supérieur à 30. La note repose sur le tour de taille.'
    case 'mesures':
      return 'Aucune règle de l’ECMS ne couvre ces mesures.'
    default:
      if (r.waistPoints !== null && r.skinfoldPoints !== null) {
        return `(tour de taille ${r.waistPoints} × 1,5 + plis ${r.skinfoldPoints}) ÷ 2,5`
      }
      if (r.waistPoints !== null) return 'Tour de taille seul (pas de somme des 5 plis).'
      return 'IMC seul.'
  }
}
