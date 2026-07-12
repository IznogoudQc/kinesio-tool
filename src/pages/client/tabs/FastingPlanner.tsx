import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { FastingCalendar } from '../../../components/FastingCalendar'
import {
  describeProgram,
  extendedWindow,
  FREQ_LABELS,
  toISO,
  type FastingFreq,
  type FastingProgram
} from '../../../lib/fasting-planning'

const WINDOW_PRESETS: { label: string; start: string; end: string }[] = [
  { label: '16:8', start: '12:00', end: '20:00' },
  { label: '18:6', start: '13:00', end: '19:00' },
  { label: '20:4', start: '16:00', end: '20:00' }
]
const DURATION_PRESETS = [24, 36, 48, 72, 96]
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

const field =
  'w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold'

function todayISO(): string {
  return toISO(new Date())
}

function blankProgram(): FastingProgram {
  return { id: crypto.randomUUID(), label: '', kind: 'extended', durationHours: 48, startTime: '08:00', freq: 'weekly', weekday: 1, anchorDate: todayISO() }
}

/** Étiquette par défaut si Marie laisse le champ vide. */
function autoLabel(p: FastingProgram): string {
  if (p.kind === 'window') {
    const preset = WINDOW_PRESETS.find(w => w.start === p.windowStart && w.end === p.windowEnd)
    return preset ? preset.label : p.windowStart && p.windowEnd ? `${p.windowStart}–${p.windowEnd}` : 'Fenêtre'
  }
  return p.durationHours ? `Jeûne ${p.durationHours} h` : 'Jeûne'
}

/** Éditeur d'un programme (formulaire). */
function ProgramEditor({
  initial,
  onSave,
  onCancel
}: {
  initial: FastingProgram
  onSave: (p: FastingProgram) => void
  onCancel: () => void
}) {
  const [p, setP] = useState<FastingProgram>(initial)
  const set = (patch: Partial<FastingProgram>) => setP(prev => ({ ...prev, ...patch }))
  // Le jeûne prolongé ne peut pas être « quotidien » ; la fenêtre l'accepte.
  const freqOptions: FastingFreq[] =
    p.kind === 'window'
      ? ['daily', 'weekly', 'biweekly', 'monthly', 'seasonal', 'once']
      : ['weekly', 'biweekly', 'monthly', 'seasonal', 'once']

  function save() {
    const clean: FastingProgram = { ...p, label: p.label.trim() || autoLabel(p) }
    if (clean.freq === 'daily') clean.weekday = undefined
    onSave(clean)
  }

  return (
    <div className="rounded-lg border border-gold/40 bg-cream/40 p-5 space-y-4">
      <div className="flex gap-4">
        {([
          { v: 'extended', label: 'Jeûne prolongé' },
          { v: 'window', label: 'Fenêtre quotidienne' }
        ] as const).map(o => (
          <label key={o.v} className="flex items-center gap-2 text-marine text-base cursor-pointer">
            <input
              type="radio"
              name="prog-kind"
              checked={p.kind === o.v}
              onChange={() =>
                set(
                  o.v === 'window'
                    ? { kind: 'window', windowStart: p.windowStart ?? '12:00', windowEnd: p.windowEnd ?? '20:00' }
                    : { kind: 'extended', durationHours: p.durationHours ?? 48, freq: p.freq === 'daily' ? 'weekly' : p.freq }
                )
              }
              className="accent-gold"
            />
            {o.label}
          </label>
        ))}
      </div>

      {p.kind === 'window' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {WINDOW_PRESETS.map(w => (
              <button
                key={w.label}
                type="button"
                onClick={() => set({ windowStart: w.start, windowEnd: w.end, label: p.label || w.label })}
                className="px-2.5 py-1 rounded-md border border-cream-dark text-sm text-marine/70 hover:border-gold/60"
              >
                {w.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-marine/70">
              Fenêtre — début
              <input type="time" value={p.windowStart ?? ''} onChange={e => set({ windowStart: e.target.value })} className={`${field} mt-1`} />
            </label>
            <label className="text-sm text-marine/70">
              Fenêtre — fin
              <input type="time" value={p.windowEnd ?? ''} onChange={e => set({ windowEnd: e.target.value })} className={`${field} mt-1`} />
            </label>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-marine mb-1">Durée du jeûne</p>
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => set({ durationHours: h })}
                className={`px-2.5 py-1 rounded-md border text-sm ${p.durationHours === h ? 'border-gold bg-gold/15 text-marine font-semibold' : 'border-cream-dark text-marine/70 hover:border-gold/60'}`}
              >
                {h} h
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={336}
              value={p.durationHours ?? ''}
              onChange={e => set({ durationHours: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="w-20 px-2 py-1 border border-cream-dark rounded-md bg-white text-marine text-sm"
            />
            <span className="text-marine/50 text-sm">heures</span>
          </div>

          <div className="mt-3">
            <label className="text-sm font-medium text-marine">
              Heure de début
              <input
                type="time"
                value={p.startTime ?? ''}
                onChange={e => set({ startTime: e.target.value || undefined })}
                className={`${field} mt-1 max-w-[10rem]`}
              />
            </label>
            {(() => {
              const win = extendedWindow(p)
              return win ? (
                <p className="text-marine/50 text-xs mt-1.5">
                  Se termine <strong className="text-marine/70">{WEEKDAYS[win.endDay]} à {win.endTime}</strong> (
                  {p.durationHours} h plus tard).
                </p>
              ) : (
                <p className="text-marine/40 text-xs mt-1.5">Laissez vide pour un jeûne à partir de minuit.</p>
              )
            })()}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm font-medium text-marine">
          Récurrence
          <select value={p.freq} onChange={e => set({ freq: e.target.value as FastingFreq })} className={`${field} mt-1`}>
            {freqOptions.map(f => (
              <option key={f} value={f}>
                {FREQ_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        {(p.freq === 'weekly' || p.freq === 'biweekly') && (
          <label className="text-sm font-medium text-marine">
            Jour de la semaine
            <select
              value={p.weekday ?? 1}
              onChange={e => set({ weekday: Number(e.target.value) })}
              className={`${field} mt-1`}
            >
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-medium text-marine">
          {p.freq === 'once' ? 'Date' : 'À partir du'}
          <input type="date" value={p.anchorDate} onChange={e => set({ anchorDate: e.target.value })} className={`${field} mt-1`} />
        </label>
        <label className="text-sm font-medium text-marine">
          Nom (optionnel)
          <input
            type="text"
            value={p.label}
            onChange={e => set({ label: e.target.value })}
            placeholder={autoLabel(p)}
            maxLength={40}
            className={`${field} mt-1`}
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-marine">
        Consignes (optionnel)
        <input
          type="text"
          value={p.notes ?? ''}
          onChange={e => set({ notes: e.target.value })}
          placeholder="Ex. Rompre le jeûne avec des protéines."
          maxLength={200}
          className={`${field} mt-1`}
        />
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-marine/60 hover:text-marine text-base">
          Annuler
        </button>
        <button
          type="button"
          onClick={save}
          className="px-5 py-2 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark"
        >
          Enregistrer le programme
        </button>
      </div>
    </div>
  )
}

/** Gère la liste de programmes + le calendrier de prévisualisation. */
export function FastingPlanner({ programs, onChange }: { programs: FastingProgram[]; onChange: (next: FastingProgram[]) => void }) {
  const now = new Date()
  const [viewY, setViewY] = useState(now.getUTCFullYear())
  const [viewM, setViewM] = useState(now.getUTCMonth())
  const [editing, setEditing] = useState<FastingProgram | null>(null)

  function shiftMonth(delta: number) {
    const m = viewM + delta
    setViewY(y => y + Math.floor(m / 12))
    setViewM(((m % 12) + 12) % 12)
  }

  function upsert(p: FastingProgram) {
    const exists = programs.some(x => x.id === p.id)
    onChange(exists ? programs.map(x => (x.id === p.id ? p : x)) : [...programs, p])
    setEditing(null)
  }

  function remove(id: string) {
    onChange(programs.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Calendrier de prévisualisation */}
      <div className="rounded-lg border border-cream-dark bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="flex items-center gap-2 text-marine font-medium">
            <CalendarDays size={17} className="text-gold-dark" /> Aperçu du calendrier
          </p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1.5 rounded-md hover:bg-cream text-marine/60" aria-label="Mois précédent">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} className="p-1.5 rounded-md hover:bg-cream text-marine/60" aria-label="Mois suivant">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <FastingCalendar programs={programs} year={viewY} month0={viewM} todayISO={toISO(now)} />
        {programs.length === 0 && (
          <p className="text-marine/45 text-sm mt-4">Ajoutez un programme pour voir les journées de jeûne apparaître ici.</p>
        )}
      </div>

      {/* Liste des programmes */}
      <div className="space-y-3">
        {programs.map(p => (
          <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-cream-dark bg-white p-4">
            <div className="min-w-0">
              <p className="font-semibold text-marine">{p.label || autoLabel(p)}</p>
              <p className="text-marine/55 text-sm mt-0.5">{describeProgram(p)}</p>
              {p.notes && <p className="text-marine/45 text-sm mt-1 italic">{p.notes}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setEditing(p)}
                className="p-1.5 rounded-md text-marine/50 hover:text-marine hover:bg-cream"
                aria-label="Modifier"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="p-1.5 rounded-md text-red-600/70 hover:text-red-700 hover:bg-red-50"
                aria-label="Supprimer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <ProgramEditor key={editing.id} initial={editing} onSave={upsert} onCancel={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(blankProgram())}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-gold/50 text-marine/80 hover:border-gold hover:bg-gold/5 text-base"
        >
          <Plus size={16} /> Ajouter un programme de jeûne
        </button>
      )}
    </div>
  )
}
