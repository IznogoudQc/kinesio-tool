/**
 * Planning de jeûne flexible. Marie compose une liste de « programmes » : soit une
 * fenêtre d'alimentation quotidienne (16:8, 18:6…), soit un jeûne prolongé (24 h,
 * 48 h, 96 h…) qui se répète selon une récurrence souple (hebdo, aux 2 semaines,
 * mensuel, saisonnier, ou date ponctuelle). Ce module ne fait QUE des calculs purs
 * (aucune dépendance UI/DB) : projeter les programmes sur un calendrier.
 *
 * Toutes les dates sont des chaînes ISO `AAAA-MM-JJ` manipulées en UTC pour éviter
 * les décalages de fuseau.
 */

export type FastingFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'seasonal' | 'once'

export interface FastingProgram {
  id: string
  /** Nom affiché, ex. « 16:8 » ou « Jeûne 48 h ». */
  label: string
  /** `window` = fenêtre d'alimentation quotidienne ; `extended` = jeûne prolongé de N heures. */
  kind: 'window' | 'extended'
  /** Fenêtre d'alimentation (HH:MM) — pour `kind: 'window'`. */
  windowStart?: string
  windowEnd?: string
  /** Durée du jeûne prolongé en heures — pour `kind: 'extended'` (24, 36, 48, 96…). */
  durationHours?: number
  /** Récurrence. `daily` ne s'applique qu'aux fenêtres quotidiennes. */
  freq: FastingFreq
  /** Jour de la semaine (0 = dimanche … 6 = samedi) pour `weekly`/`biweekly`. `undefined` = jour de `anchorDate`. */
  weekday?: number
  /** Date d'ancrage ISO (première occurrence / référence de la récurrence). */
  anchorDate: string
  notes?: string
}

/** Un jour couvert par un programme de jeûne prolongé (ou une occurrence ponctuelle). */
export interface CoveredDay {
  programId: string
  label: string
  kind: 'window' | 'extended'
  /** Vrai si c'est le 1er jour de l'occurrence (utile pour l'étiquette). */
  isStart: boolean
  /** Numéro du jour dans l'occurrence (1 = premier jour). */
  dayNo: number
  /** Nombre total de jours couverts par l'occurrence. */
  spanDays: number
}

// ── Utilitaires de date (UTC) ────────────────────────────────────────────────

function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

export function toISO(dt: Date): string {
  return dt.toISOString().slice(0, 10)
}

export function addDaysISO(d: string, n: number): string {
  const dt = parseISO(d)
  dt.setUTCDate(dt.getUTCDate() + n)
  return toISO(dt)
}

function addMonthsISO(d: string, n: number): string {
  const dt = parseISO(d)
  const targetDay = dt.getUTCDate()
  dt.setUTCDate(1)
  dt.setUTCMonth(dt.getUTCMonth() + n)
  // Clamp au dernier jour du mois cible (ex. 31 janv + 1 mois → 28/29 fév).
  const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate()
  dt.setUTCDate(Math.min(targetDay, lastDay))
  return toISO(dt)
}

export function weekdayOfISO(d: string): number {
  return parseISO(d).getUTCDay()
}

/** Nombre de jours couverts par un jeûne prolongé (48 h → 2 jours, 96 h → 4). */
export function spanDaysOf(program: FastingProgram): number {
  if (program.kind !== 'extended' || !program.durationHours || program.durationHours <= 0) return 1
  return Math.max(1, Math.ceil(program.durationHours / 24))
}

const STEP_MONTHS: Partial<Record<FastingFreq, number>> = { monthly: 1, seasonal: 3 }

/**
 * Dates de DÉBUT des occurrences d'un programme non quotidien dont le déroulé
 * (span) chevauche `[fromISO, toISO]`. Les programmes `daily` renvoient `[]`
 * (traités séparément — ils s'appliquent tous les jours).
 */
export function occurrenceStarts(program: FastingProgram, fromISO: string, toISO_: string): string[] {
  if (program.freq === 'daily') return []
  const span = spanDaysOf(program)
  // On élargit la borne basse pour capter une occurrence qui commence avant la
  // fenêtre mais dont le jeûne prolongé déborde à l'intérieur.
  const searchFrom = addDaysISO(fromISO, -(span - 1))
  const anchor = program.anchorDate
  if (!anchor) return []

  if (program.freq === 'once') {
    return anchor >= searchFrom && anchor <= toISO_ ? [anchor] : []
  }

  const out: string[] = []
  if (program.freq === 'weekly' || program.freq === 'biweekly') {
    const step = program.freq === 'weekly' ? 7 : 14
    // Aligne l'ancre sur le jour de semaine voulu (si précisé).
    let start = anchor
    if (program.weekday !== undefined) {
      const delta = (program.weekday - weekdayOfISO(anchor) + 7) % 7
      start = addDaysISO(anchor, delta)
    }
    // Avance jusqu'à `searchFrom` par pas entiers pour éviter d'itérer depuis loin.
    if (start < searchFrom) {
      const daysDiff = Math.round((parseISO(searchFrom).getTime() - parseISO(start).getTime()) / 86400000)
      const k = Math.floor(daysDiff / step)
      start = addDaysISO(start, k * step)
      while (start < searchFrom) start = addDaysISO(start, step)
    }
    for (let d = start, guard = 0; d <= toISO_ && guard < 1000; d = addDaysISO(d, step), guard++) out.push(d)
    return out
  }

  // monthly / seasonal — pas en mois.
  const stepM = STEP_MONTHS[program.freq] ?? 1
  for (let d = anchor, guard = 0; d <= toISO_ && guard < 1200; d = addMonthsISO(d, stepM), guard++) {
    if (d >= searchFrom) out.push(d)
  }
  return out
}

/**
 * Projette tous les programmes sur `[fromISO, toISO]` et renvoie, pour chaque
 * date ISO couverte, la liste des occurrences (jeûnes prolongés / ponctuels).
 * Les fenêtres quotidiennes ne remplissent PAS le calendrier (voir `dailyWindows`).
 */
export function fastingDaysInRange(
  programs: FastingProgram[],
  fromISO: string,
  toISO_: string
): Record<string, CoveredDay[]> {
  const map: Record<string, CoveredDay[]> = {}
  for (const p of programs) {
    if (p.freq === 'daily') continue
    const span = spanDaysOf(p)
    for (const start of occurrenceStarts(p, fromISO, toISO_)) {
      for (let i = 0; i < span; i++) {
        const date = addDaysISO(start, i)
        if (date < fromISO || date > toISO_) continue
        ;(map[date] ??= []).push({
          programId: p.id,
          label: p.label,
          kind: p.kind,
          isStart: i === 0,
          dayNo: i + 1,
          spanDays: span
        })
      }
    }
  }
  return map
}

/** Les programmes à fenêtre quotidienne (16:8…) — affichés à part du calendrier. */
export function dailyWindows(programs: FastingProgram[]): FastingProgram[] {
  return programs.filter(p => p.freq === 'daily')
}

/** Grille d'un mois (semaines de 7 jours, lundi→dimanche) pour l'affichage calendrier.
 *  Renvoie des dates ISO ; les jours hors du mois sont `null`. */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month0, 1))
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  // Colonne 0 = lundi. getUTCDay: 0=dim → on décale pour lundi=0.
  const firstCol = (first.getUTCDay() + 6) % 7
  const cells: (string | null)[] = []
  for (let i = 0; i < firstCol; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(Date.UTC(year, month0, d))))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export const WEEKDAY_LABELS_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
export const MONTH_LABELS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

export const FREQ_LABELS: Record<FastingFreq, string> = {
  daily: 'Tous les jours',
  weekly: 'Chaque semaine',
  biweekly: 'Aux 2 semaines',
  monthly: 'Une fois par mois',
  seasonal: 'Une fois par saison',
  once: 'Une seule fois'
}

/** Résumé lisible d'un programme (ex. « Jeûne 48 h · Aux 2 semaines · lundi »). */
export function describeProgram(p: FastingProgram): string {
  const parts: string[] = []
  if (p.kind === 'window' && p.windowStart && p.windowEnd) parts.push(`Fenêtre ${p.windowStart}–${p.windowEnd}`)
  else if (p.kind === 'extended' && p.durationHours) parts.push(`Jeûne ${p.durationHours} h`)
  parts.push(FREQ_LABELS[p.freq])
  if ((p.freq === 'weekly' || p.freq === 'biweekly')) {
    const wd = p.weekday ?? weekdayOfISO(p.anchorDate)
    parts.push(['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][wd])
  }
  return parts.join(' · ')
}
