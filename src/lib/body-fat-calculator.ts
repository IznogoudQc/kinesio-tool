/**
 * Calcul du pourcentage de gras corporel à partir de la somme de 4 plis cutanés
 * (triceps + biceps + sous-scapulaire + crête iliaque) :
 *  - densité corporelle via les équations de Durnin & Womersley (1974) ;
 *  - conversion densité → % gras via Siri (1961) et Brožek (1963).
 *
 * Utilisé à la fois côté main process (stockage des valeurs calculées) et côté
 * renderer (aperçu en temps réel pendant la saisie).
 */

export type Sex = 'F' | 'M'

interface DwCoefficient {
  ageMin: number
  ageMax: number
  c: number
  m: number
}

const DW_COEFFICIENTS: Record<Sex, DwCoefficient[]> = {
  M: [
    { ageMin: 17, ageMax: 19, c: 1.1620, m: 0.0630 },
    { ageMin: 20, ageMax: 29, c: 1.1631, m: 0.0632 },
    { ageMin: 30, ageMax: 39, c: 1.1422, m: 0.0544 },
    { ageMin: 40, ageMax: 49, c: 1.1620, m: 0.0700 },
    { ageMin: 50, ageMax: 99, c: 1.1715, m: 0.0779 }
  ],
  F: [
    { ageMin: 16, ageMax: 19, c: 1.1549, m: 0.0678 },
    { ageMin: 20, ageMax: 29, c: 1.1599, m: 0.0717 },
    { ageMin: 30, ageMax: 39, c: 1.1423, m: 0.0632 },
    { ageMin: 40, ageMax: 49, c: 1.1333, m: 0.0612 },
    { ageMin: 50, ageMax: 99, c: 1.1339, m: 0.0645 }
  ]
}

export function calculateBodyDensity(sumPlis: number, age: number, sex: Sex): number {
  if (!Number.isFinite(sumPlis) || sumPlis <= 0) {
    throw new Error('La somme des plis doit être un nombre positif.')
  }
  // Sous la borne basse de la première tranche, on utilise quand même les coefficients
  // de cette tranche (les enfants/ados sortent du champ d'application clinique de la
  // formule, mais on évite une erreur dure côté UI).
  const ranges = DW_COEFFICIENTS[sex]
  const range =
    ranges.find(r => age >= r.ageMin && age <= r.ageMax) ??
    (age < ranges[0].ageMin ? ranges[0] : undefined)
  if (!range) throw new Error(`Âge ${age} hors plage Durnin-Womersley`)
  return range.c - range.m * Math.log10(sumPlis)
}

export function densityToBodyFatSiri(density: number): number {
  return (4.95 / density - 4.50) * 100
}

export function densityToBodyFatBrozek(density: number): number {
  return (4.57 / density - 4.142) * 100
}

export interface FourSitePlis {
  triceps: number
  biceps: number
  sousscapulaire: number
  iliaque: number
}

export interface BodyFatResult {
  sumPlis: number
  density: number
  bodyFatSiri: number
  bodyFatBrozek: number
}

export function calculateBodyFat(plis: FourSitePlis, age: number, sex: Sex): BodyFatResult {
  const sumPlis = plis.triceps + plis.biceps + plis.sousscapulaire + plis.iliaque
  const density = calculateBodyDensity(sumPlis, age, sex)
  return {
    sumPlis,
    density,
    bodyFatSiri: densityToBodyFatSiri(density),
    bodyFatBrozek: densityToBodyFatBrozek(density)
  }
}

/** Âge en années révolues à partir d'une date de naissance ISO `AAAA-MM-JJ`. */
export function calculateAge(birthdate: string): number {
  const birth = new Date(birthdate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}
