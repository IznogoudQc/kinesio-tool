import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { BILAN_FIELD_GROUPS, type BilanFieldDef, type BilanFieldGroup } from './bilanFields'
import { CategoryBadge } from '../../components/CategoryBadge'
import { BilanSynthesisCards } from '../../components/BilanSynthesisCards'
import { PercentileIndicator } from '../../components/PercentileIndicator'
import type { Category, NormsType } from '../../lib/norms'
import { computeAge } from '../../lib/norms'
import { computeBilan, mergeComputedIntoBilan, type BilanProfile } from '../../lib/bilan-computed'
import { BILAN_TO_TEST_KEY } from '../../lib/norms/bilan-keys'
import { validateBilanField } from '../../lib/bilan-bounds'
import { AerobicSection } from './AerobicSection'

interface BilanFormProps {
  date: string
  data: BilanData
  readOnly?: boolean
  onDateChange?: (date: string) => void
  onDataChange?: (data: BilanData) => void
  /** Variante compacte sur fond clair (modal d'import). Sinon : cartes marine. */
  variant?: 'light' | 'marine'
  /** Si fournie, affiche la catégorie sous la valeur (mode lecture seule uniquement). */
  categorize?: (key: keyof BilanData, value: number) => Category | null
  /** Profil client pour les auto-calculs et les scores de synthèse. */
  client?: Pick<Client, 'birthdate' | 'sex'>
  /** Norme à utiliser pour la synthèse. */
  norms?: NormsType
  /** Affiche les cards de synthèse au-dessus du formulaire (saisie manuelle). */
  showSynthesis?: boolean
  /** Si fourni avec showSynthesis, affiche les flèches ▲▼ de comparaison. */
  previousData?: BilanData
  /** Force le mode collapsible (par défaut : oui en édition, non en lecture). */
  collapsible?: boolean
  /** Si fourni, ne rend QUE ces sections (par id). Absent = toutes les sections
   *  (comportement par défaut). Utilisé par le mode guidé (stepper) de la saisie. */
  visibleSectionIds?: string[]
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

/** Calcule et injecte les valeurs dérivées (IMC, VO2max protocolaire, MET, FC
 *  max, % gras Durnin, puissance Sayers) à partir des saisies. Délègue à
 *  `computeBilan` (source de vérité unique). Utilisé pour les modaux au moment
 *  de la sauvegarde. */
export function deriveBilanFields(data: BilanData, age: number | null, sex: 'F' | 'M' | null): BilanData {
  const computed = computeBilan(data, { age, sex, norms: 'acsm' })
  return mergeComputedIntoBilan(data, computed)
}

export function BilanForm({
  date,
  data,
  readOnly = false,
  onDateChange,
  onDataChange,
  variant = 'marine',
  categorize,
  client,
  norms = 'acsm',
  showSynthesis = false,
  previousData,
  collapsible,
  visibleSectionIds
}: BilanFormProps) {
  const isLight = variant === 'light'
  const labelClass = isLight ? 'text-marine/60' : 'text-cream/55'
  const valueClass = isLight ? 'text-marine' : 'text-cream'
  const sectionTitleClass = isLight ? 'text-marine' : 'text-cream'
  const inputClass = isLight
    ? 'w-full px-2.5 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors'
    : 'w-full px-2.5 py-1.5 border border-marine-light/50 rounded-md bg-marine/40 text-cream text-base focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors'
  const computedClass = isLight
    ? 'w-full px-2.5 py-1.5 border border-cream-dark/60 rounded-md bg-cream/40 text-marine/80 text-base'
    : 'w-full px-2.5 py-1.5 border border-marine-light/30 rounded-md bg-marine/20 text-cream/70 text-base'

  const age = useMemo(() => computeAge(client?.birthdate ?? null), [client?.birthdate])
  const sex = client?.sex ?? null

  const profile: BilanProfile = useMemo(() => ({ age, sex, norms }), [age, sex, norms])

  // En édition, on dérive les champs auto à partir des saisies pour les afficher
  // en read-only. En lecture seule, on respecte ce qui est dans `data`.
  // On ne réinjecte PAS dans le state parent — le caller appelle `deriveBilanFields`
  // au moment de sauvegarder (évite les boucles setState/re-render).
  const computed = useMemo(() => computeBilan(data, profile), [data, profile])
  const derivedData = useMemo<BilanData>(
    () => (readOnly ? data : mergeComputedIntoBilan(data, computed)),
    [data, computed, readOnly]
  )

  const previousComputed = useMemo(
    () => (previousData ? computeBilan(previousData, profile) : undefined),
    [previousData, profile]
  )

  // Sections collapsibles : par défaut, toutes ouvertes en lecture seule, ouvertes aussi
  // en édition (Marie-Eve peut replier ce qu'elle ne remplit pas).
  const useCollapsible = collapsible ?? !readOnly
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(BILAN_FIELD_GROUPS.map(g => g.id))
  )
  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderField(def: BilanFieldDef) {
    const raw = derivedData[def.key]
    const isText = def.type === 'text'
    const isSelect = def.type === 'select'
    const isTextarea = def.type === 'textarea'
    const isComputed = def.type === 'computed'
    const numericValue = typeof raw === 'number' && !Number.isNaN(raw) ? raw : null
    const category = readOnly && categorize && numericValue !== null ? categorize(def.key, numericValue) : null
    const showBadge = readOnly && categorize && numericValue !== null
    const testKey = BILAN_TO_TEST_KEY[def.key]
    const showPercentile = testKey !== undefined && numericValue !== null && age !== null && sex !== null
    // Plausibilité : uniquement sur les champs numériques saisis par l'utilisateur.
    const isNumberInput = !isText && !isSelect && !isTextarea && !isComputed
    const bound = !readOnly && isNumberInput ? validateBilanField(def.key, numericValue) : null
    const boundBorder =
      bound?.level === 'error' ? ' !border-red-500' : bound?.level === 'warn' ? ' !border-amber-400' : ''

    const fullWidth = isTextarea ? 'col-span-2 md:col-span-3' : ''

    return (
      <div key={def.key} className={`min-w-0 ${fullWidth}`}>
        <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
          {def.label}
          {def.unit && <span className="lowercase tracking-normal"> ({def.unit})</span>}
        </label>
        {readOnly ? (
          <>
            {isTextarea ? (
              <p className={`text-base ${valueClass} whitespace-pre-wrap`}>
                {raw === undefined || raw === '' ? <span className="opacity-40">—</span> : String(raw)}
              </p>
            ) : (
              <p className={`text-base font-medium ${valueClass}`}>
                {raw === undefined || raw === '' ? <span className="opacity-40">—</span> : String(raw)}
              </p>
            )}
            {showBadge && (
              <div className="mt-0.5">
                <CategoryBadge
                  category={category}
                  variant="compact"
                  emptyClassName={isLight ? 'text-marine/30 text-xs' : 'text-cream/30 text-xs'}
                />
              </div>
            )}
          </>
        ) : isComputed ? (
          <>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={raw === undefined ? '—' : String(raw)}
              className={computedClass}
            />
            {def.hint && <p className={`text-xs mt-1 ${isLight ? 'text-marine/45' : 'text-cream/45'}`}>{def.hint}</p>}
          </>
        ) : isSelect ? (
          <select
            value={(raw as string | undefined) ?? ''}
            onChange={e => onDataChange?.(setField(data, def.key, e.target.value || undefined))}
            className={inputClass}
          >
            <option value="">— Choisir —</option>
            {def.options?.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : isTextarea ? (
          <>
            <textarea
              value={(raw as string | undefined) ?? ''}
              onChange={e => onDataChange?.(setField(data, def.key, e.target.value))}
              rows={4}
              className={inputClass}
            />
            {def.hint && <p className={`text-xs mt-1 ${isLight ? 'text-marine/45' : 'text-cream/45'}`}>{def.hint}</p>}
          </>
        ) : isText ? (
          <input
            type="text"
            value={(raw as string | undefined) ?? ''}
            onChange={e => onDataChange?.(setField(data, def.key, e.target.value))}
            className={inputClass}
          />
        ) : (
          <>
            <input
              type="number"
              step="any"
              value={raw === undefined ? '' : (raw as number)}
              onChange={e =>
                onDataChange?.(
                  setField(data, def.key, Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)
                )
              }
              className={`${inputClass}${boundBorder}`}
            />
            {bound?.message && (
              <p className={`text-xs mt-1 ${bound.level === 'error' ? 'text-red-500' : 'text-amber-600'}`}>
                {bound.message}
              </p>
            )}
          </>
        )}
        {showPercentile && testKey && (
          <PercentileIndicator
            test={testKey}
            value={numericValue}
            age={age}
            sex={sex}
            norms={norms}
            variant={variant}
          />
        )}
      </div>
    )
  }

  function renderSection(group: BilanFieldGroup) {
    const isOpen = openSections.has(group.id)
    // Compteur de complétion : nombre de champs non vides sur le total (hors champs
    // calculés, qui sont auto-remplis et ne traduisent pas l'effort de saisie).
    const userFields = group.fields.filter(f => f.type !== 'computed')
    const filled = userFields.filter(f => {
      const v = derivedData[f.key]
      return v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))
    }).length
    const total = userFields.length
    const isComplete = total > 0 && filled === total
    const completionLabel = total > 0 ? ` (${filled} / ${total} champs)` : ''

    const headingClass = `flex items-center gap-2 w-full text-left text-sm font-semibold uppercase tracking-wide mb-2.5 ${sectionTitleClass}`
    const titleNode = (
      <>
        <span>
          {group.title}
          {total > 0 && (
            <span className={isLight ? 'ml-2 text-marine/45 font-normal' : 'ml-2 text-cream/45 font-normal'}>
              {completionLabel}
            </span>
          )}
        </span>
        {isComplete && <Check size={14} className="text-green-600 shrink-0" aria-label="Section complète" />}
      </>
    )
    const heading = useCollapsible ? (
      <button
        type="button"
        onClick={() => toggleSection(group.id)}
        className={`${headingClass} hover:opacity-80 transition-opacity`}
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {titleNode}
      </button>
    ) : (
      <h3 className={headingClass}>{titleNode}</h3>
    )

    const isNotes = group.id === 'notes'
    const isAerobic = group.id === 'aerobie'
    return (
      <section key={group.id}>
        {heading}
        {(!useCollapsible || isOpen) && (
          isAerobic ? (
            <AerobicSection
              data={derivedData}
              onDataChange={onDataChange}
              readOnly={readOnly}
              variant={variant}
              age={age}
              sex={sex}
              categorize={categorize}
              norms={norms}
            />
          ) : (
            <div className={isNotes ? 'grid grid-cols-1 gap-x-5 gap-y-3' : 'grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3'}>
              {group.fields.map(renderField)}
            </div>
          )
        )}
      </section>
    )
  }

  return (
    <div className="space-y-5">
      {showSynthesis && (
        <section
          className={
            isLight
              ? 'sticky top-0 z-10 bg-cream/95 backdrop-blur-sm py-3 -mx-6 px-6 border-b border-marine/10 mb-2'
              : ''
          }
        >
          <h3 className={`text-sm font-semibold uppercase tracking-wide mb-2.5 ${sectionTitleClass}`}>
            Synthèse — mise à jour en temps réel
          </h3>
          <BilanSynthesisCards
            computed={computed}
            previous={previousComputed}
            variant={variant}
            emptyHint="Saisissez taille + poids + VO2max pour voir la synthèse se calculer."
          />
        </section>
      )}

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

      {(visibleSectionIds
        ? BILAN_FIELD_GROUPS.filter(g => visibleSectionIds.includes(g.id))
        : BILAN_FIELD_GROUPS
      ).map(renderSection)}
    </div>
  )
}
