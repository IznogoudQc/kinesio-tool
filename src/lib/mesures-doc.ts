/**
 * Les prises de mesures, mises en séries pour le document « Suivi des mesures ».
 *
 * Module PUR : il ne connaît ni React ni la base. Il prend les lignes des deux
 * tables (circonférences et plis) et rend, par mesure, la suite de ses valeurs
 * dans le temps. Le document HTML et le PDF s'impriment du même rendu, donc
 * cette mise en forme n'existe qu'ici — il n'y a pas deux versions à accorder.
 *
 * Ce qui n'a JAMAIS été mesuré ne produit pas de série : un client à qui on n'a
 * jamais pris le mollet ne doit pas voir une ligne vide portant son nom.
 *
 * Les notes des prises ne sortent pas d'ici. Elles sont écrites pendant la
 * mesure, pour la kinésiologue, et n'ont pas à se retrouver dans un document
 * remis au client.
 */
import { s5pcForScoring } from './norms/cpafla-composition.ts'

/** Une ligne de `mesures_circonferences`, telle qu'elle sort de la base. */
export interface PriseCirconferences {
  date: string
  [colonne: string]: number | string | null | undefined
}

/** Une ligne de `mesures_plis_cutanes`. */
export interface PrisePlis {
  date: string
  triceps?: number | null
  biceps?: number | null
  sousscapulaire?: number | null
  iliaque?: number | null
  mollet?: number | null
  somme4Plis?: number | null
  pourcentageGrasSiri?: number | null
}

/** Une valeur datée. */
export interface PointMesure {
  date: string
  valeur: number
}

/** Tout ce qu'on sait d'une mesure suivie dans le temps. */
export interface SerieMesure {
  cle: string
  label: string
  unite: string
  /** De la plus ANCIENNE à la plus récente — c'est le sens de lecture d'une courbe. */
  points: PointMesure[]
}

/** Les trois familles du document, dans l'ordre où elles se lisent. */
export interface GroupeMesures {
  titre: string
  series: SerieMesure[]
}

/**
 * Libellés des colonnes de circonférences.
 *
 * Les cinq que Marie-Eve saisit portent les mêmes libellés qu'au formulaire
 * (`MESURE_FIELDS`) — recopiés ici plutôt qu'importés parce que ce module doit
 * rester autonome, comme les autres modules partagés avec le processus
 * principal. Les autres colonnes existent encore en base : une prise ancienne
 * peut les contenir, et un document qui les tairait perdrait des mesures que le
 * client a bel et bien passées.
 */
const LIBELLES_CIRC: { cle: string; label: string }[] = [
  { cle: 'taille', label: 'Tour de taille' },
  { cle: 'hanche', label: 'Tour de hanche' },
  { cle: 'bicepsG', label: 'Biceps fléchi' },
  { cle: 'cuisseG', label: 'Cuisse' },
  { cle: 'epaule', label: 'Épaules et pec' },
  { cle: 'poitrine', label: 'Poitrine' },
  { cle: 'abdomen', label: 'Abdomen' },
  { cle: 'cou', label: 'Cou' },
  { cle: 'bicepsD', label: 'Biceps fléchi (droit)' },
  { cle: 'cuisseD', label: 'Cuisse (droite)' },
  { cle: 'molletG', label: 'Mollet' },
  { cle: 'molletD', label: 'Mollet (droit)' }
]

const LIBELLES_PLIS: { cle: keyof PrisePlis; label: string }[] = [
  { cle: 'triceps', label: 'Triceps' },
  { cle: 'biceps', label: 'Biceps' },
  { cle: 'sousscapulaire', label: 'Sous-scapulaire' },
  { cle: 'iliaque', label: 'Crête iliaque' },
  { cle: 'mollet', label: 'Mollet' }
]

const KG_PAR_LB = 0.45359237

function estNombre(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Trie par date croissante — l'ordre d'arrivée des lignes n'est pas garanti. */
function chronologique<T extends { date: string }>(lignes: readonly T[]): T[] {
  return [...lignes].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function serie(
  cle: string,
  label: string,
  unite: string,
  lignes: readonly { date: string }[],
  lire: (l: never) => unknown,
  transforme: (v: number) => number = v => v
): SerieMesure | null {
  const points: PointMesure[] = []
  for (const l of chronologique(lignes)) {
    const v = lire(l as never)
    if (estNombre(v)) points.push({ date: l.date, valeur: transforme(v) })
  }
  return points.length > 0 ? { cle, label, unite, points } : null
}

/**
 * Les groupes du document, prêts à afficher.
 *
 * `unitePoids` suit le réglage du client : Marie-Eve saisit en livres pour la
 * plupart, et un document qui annoncerait des kilos ne lui parlerait pas.
 */
export function groupesDeMesures(
  circonferences: readonly PriseCirconferences[],
  plis: readonly PrisePlis[],
  unitePoids: 'kg' | 'lb' = 'kg'
): GroupeMesures[] {
  const facteurPoids = unitePoids === 'lb' ? 1 / KG_PAR_LB : 1
  const arrondi1 = (v: number): number => Math.round(v * 10) / 10

  const composition: (SerieMesure | null)[] = [
    serie('poids', 'Poids', unitePoids, circonferences, (l: PriseCirconferences) => l.poidsKg, v =>
      arrondi1(v * facteurPoids)
    ),
    serie('gras', 'Pourcentage de gras', '%', plis, (l: PrisePlis) => l.pourcentageGrasSiri, arrondi1),
    serie('somme4', 'Somme des 4 plis', 'mm', plis, (l: PrisePlis) => l.somme4Plis, arrondi1),
    // La somme des CINQ plis n'existe pas en base : elle vient du point d'entrée
    // unique de la cotation CPAFLA, qui rend `null` tant que le mollet manque.
    // Les prises antérieures au mollet ne produisent donc simplement pas de
    // point, et la série apparaît le jour où Marie-Eve a commencé à le prendre.
    serie(
      'somme5',
      'Somme des 5 plis',
      'mm',
      plis,
      (l: PrisePlis) =>
        s5pcForScoring({
          triceps: l.triceps ?? undefined,
          biceps: l.biceps ?? undefined,
          sousScap: l.sousscapulaire ?? undefined,
          iliaque: l.iliaque ?? undefined,
          mollet: l.mollet ?? undefined
        }),
      arrondi1
    )
  ]

  const circ = LIBELLES_CIRC.map(({ cle, label }) =>
    serie(cle, label, 'cm', circonferences, (l: PriseCirconferences) => l[cle])
  )

  const plisSeries = LIBELLES_PLIS.map(({ cle, label }) =>
    serie(String(cle), label, 'mm', plis, (l: PrisePlis) => l[cle])
  )

  const groupes: GroupeMesures[] = [
    { titre: 'Poids et composition', series: composition.filter((s): s is SerieMesure => s !== null) },
    { titre: 'Circonférences', series: circ.filter((s): s is SerieMesure => s !== null) },
    { titre: 'Plis cutanés', series: plisSeries.filter((s): s is SerieMesure => s !== null) }
  ]
  return groupes.filter(g => g.series.length > 0)
}

/** Toutes les dates de prise, de la plus ancienne à la plus récente, sans doublon. */
export function datesDesPrises(
  circonferences: readonly { date: string }[],
  plis: readonly { date: string }[]
): string[] {
  return [...new Set([...circonferences, ...plis].map(l => l.date))].sort()
}

/**
 * Écart entre la première et la dernière valeur d'une série.
 *
 * `null` quand une seule prise existe : un écart demande deux mesures, et
 * afficher « 0 » laisserait croire que rien n'a bougé.
 */
export function evolution(s: SerieMesure): { depuis: PointMesure; vers: PointMesure; ecart: number } | null {
  if (s.points.length < 2) return null
  const depuis = s.points[0]
  const vers = s.points[s.points.length - 1]
  return { depuis, vers, ecart: Math.round((vers.valeur - depuis.valeur) * 10) / 10 }
}
