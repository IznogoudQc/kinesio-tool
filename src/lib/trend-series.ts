/**
 * Séries datées pour les courbes de tendance.
 *
 * Écrites une fois parce qu'elles alimentent TROIS surfaces — le tableau de
 * bord, le document HTML remis au client et le PDF. Recopiées, elles auraient
 * fini par diverger : un tri inversé ici, un bilan sans valeur gardé là, et les
 * trois documents auraient raconté trois histoires du même client.
 *
 * Les bilans arrivent du plus RÉCENT au plus ancien (ordre de la base) ; les
 * courbes se lisent dans l'autre sens. C'est le seul piège de ce module, et la
 * raison pour laquelle il existe.
 */
import type { BilanComputed } from './bilan-computed.ts'

/** Ce que ces fonctions attendent d'un bilan — volontairement minimal. */
export interface BilanDate {
  date: string
  data: { pourcentage_gras?: number | null }
}

/** Un point de la courbe du % de gras. */
export interface PointGras {
  date: string
  pct: number
}

/** Un point de la courbe d'un score 0-4. */
export interface PointScore {
  date: string
  score: number
}

function estNombre(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v)
}

/**
 * % de gras dans le temps, du plus ANCIEN au plus récent.
 *
 * Les bilans sans mesure sont retirés plutôt que tracés à zéro : une valeur
 * manquante n'est pas une valeur basse, et la courbe plongerait à chaque bilan
 * où Marie n'a pas pris les plis.
 */
export function serieGras(bilans: readonly BilanDate[] | null | undefined): PointGras[] {
  return [...(bilans ?? [])]
    .reverse()
    .map(b => ({ date: b.date, pct: b.data.pourcentage_gras }))
    .filter((p): p is PointGras => estNombre(p.pct))
}

/**
 * Score de composition corporelle (0-4) dans le temps, du plus ANCIEN au plus
 * récent.
 *
 * `calculer` reçoit les données d'un bilan et rend son score — l'appelant
 * fournit la fonction pour que ce module n'ait pas à connaître le profil de
 * calcul ni les normes.
 */
export function serieScore<T extends { date: string }>(
  bilans: readonly T[] | null | undefined,
  calculer: (b: T) => number | null | undefined
): PointScore[] {
  return [...(bilans ?? [])]
    .reverse()
    .map(b => ({ date: b.date, score: calculer(b) }))
    .filter((p): p is PointScore => estNombre(p.score))
}

/** Raccourci pour la composition corporelle, la courbe la plus demandée. */
export function serieComposition<T extends { date: string }>(
  bilans: readonly T[] | null | undefined,
  calculer: (b: T) => BilanComputed
): PointScore[] {
  return serieScore(bilans, b => calculer(b).composition.score)
}
