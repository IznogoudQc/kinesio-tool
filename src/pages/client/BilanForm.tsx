import { BILAN_FIELD_GROUPS, type BilanFieldDef } from './bilanFields'

interface BilanFormProps {
  date: string
  data: BilanData
  readOnly?: boolean
  onDateChange?: (date: string) => void
  onDataChange?: (data: BilanData) => void
  /** Variante compacte sur fond clair (modal d'import). Sinon : cartes marine. */
  variant?: 'light' | 'marine'
}

function setField(data: BilanData, key: keyof BilanData, value: number | string | undefined): BilanData {
  const next = { ...data } as Record<string, number | string>
  if (value === undefined || value === '') {
    delete next[key]
  } else {
    next[key] = value
  }
  return next as BilanData
}

export function BilanForm({
  date,
  data,
  readOnly = false,
  onDateChange,
  onDataChange,
  variant = 'marine'
}: BilanFormProps) {
  const isLight = variant === 'light'
  const labelClass = isLight ? 'text-marine/60' : 'text-cream/55'
  const valueClass = isLight ? 'text-marine' : 'text-cream'
  const sectionTitleClass = isLight ? 'text-marine' : 'text-cream'
  const inputClass = isLight
    ? 'w-full px-2.5 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors'
    : 'w-full px-2.5 py-1.5 border border-marine-light/50 rounded-md bg-marine/40 text-cream text-base focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors'

  function renderField(def: BilanFieldDef) {
    const raw = data[def.key]
    const isText = def.type === 'text'

    return (
      <div key={def.key} className="min-w-0">
        <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
          {def.label}
          {def.unit && <span className="lowercase tracking-normal"> ({def.unit})</span>}
        </label>
        {readOnly ? (
          <p className={`text-base font-medium ${valueClass}`}>
            {raw === undefined || raw === '' ? <span className="opacity-40">—</span> : String(raw)}
          </p>
        ) : isText ? (
          <input
            type="text"
            value={(raw as string | undefined) ?? ''}
            onChange={e => onDataChange?.(setField(data, def.key, e.target.value))}
            className={inputClass}
          />
        ) : (
          <input
            type="number"
            step="any"
            value={raw === undefined ? '' : (raw as number)}
            onChange={e =>
              onDataChange?.(
                setField(data, def.key, Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)
              )
            }
            className={inputClass}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>Date du bilan</label>
        {readOnly ? (
          <p className={`text-base font-medium ${valueClass}`}>{date}</p>
        ) : (
          <input
            type="date"
            value={date}
            onChange={e => onDateChange?.(e.target.value)}
            className={`${inputClass} max-w-[12rem]`}
          />
        )}
      </div>

      {BILAN_FIELD_GROUPS.map(group => (
        <section key={group.title}>
          <h3 className={`text-sm font-semibold uppercase tracking-wide mb-2.5 ${sectionTitleClass}`}>
            {group.title}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
            {group.fields.map(renderField)}
          </div>
        </section>
      ))}
    </div>
  )
}
