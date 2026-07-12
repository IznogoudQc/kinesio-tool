import { fastingDaysInRange, monthGrid, toISO, MONTH_LABELS, type FastingProgram } from '../lib/fasting-planning'

const WEEK_HEADER = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

/**
 * Calendrier mensuel d'un mois : les jours couverts par un jeûne prolongé (ou une
 * occurrence ponctuelle) sont surlignés en or. Composant présentationnel pur —
 * réutilisé dans l'app (onglet Nutrition) et dans le document HTML client.
 * Les fenêtres quotidiennes (16:8…) ne remplissent PAS le calendrier.
 */
export function FastingCalendar({
  programs,
  year,
  month0,
  todayISO
}: {
  programs: FastingProgram[]
  year: number
  month0: number
  /** Date du jour (ISO) à entourer, optionnel. */
  todayISO?: string
}) {
  const weeks = monthGrid(year, month0)
  const fromISO = toISO(new Date(Date.UTC(year, month0, 1)))
  const toISO_ = toISO(new Date(Date.UTC(year, month0 + 1, 0)))
  const covered = fastingDaysInRange(programs, fromISO, toISO_)

  return (
    <div>
      <p className="ed-display text-lg text-marine capitalize mb-3">
        {MONTH_LABELS[month0]} {year}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {WEEK_HEADER.map(w => (
          <div key={w} className="text-center text-[11px] font-semibold uppercase tracking-wide text-marine/35 pb-1">
            {w}
          </div>
        ))}
        {weeks.flat().map((cell, i) => {
          if (!cell) return <div key={i} className="aspect-square" />
          const day = Number(cell.slice(8, 10))
          const marks = covered[cell]
          const isToday = todayISO === cell
          const ext = marks?.find(m => m.kind === 'extended')
          const startMark = marks?.find(m => m.isStart)
          return (
            <div
              key={i}
              className={[
                'aspect-square rounded-md border p-1 flex flex-col',
                marks ? 'border-gold/45 bg-gold/15' : 'border-cream-dark/60 bg-white',
                isToday ? 'ring-2 ring-marine/40' : ''
              ].join(' ')}
              title={marks ? marks.map(m => m.label).join(', ') : undefined}
            >
              <span className={`text-xs tabular-nums ${marks ? 'font-semibold text-marine' : 'text-marine/45'}`}>{day}</span>
              {startMark && (
                <span className="mt-auto truncate text-[9px] font-semibold leading-tight text-gold-dark">
                  {startMark.label}
                  {startMark.startTime ? ` · ${startMark.startTime}` : ''}
                </span>
              )}
              {marks && !startMark && ext && (
                <span className="mt-auto text-[9px] leading-tight text-gold-dark/70">↳ jeûne</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
