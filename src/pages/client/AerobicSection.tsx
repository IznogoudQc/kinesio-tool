import { useMemo } from 'react'
import {
  BRUCE_STAGES,
  bruceStageFor,
  bruceTreadmillVo2max,
  cooperVo2max,
  formatMmSs,
  legerVo2max,
  parseMmSs,
  type AerobicTestType
} from '../../lib/vo2max-calculator'
import { computeMet } from '../../lib/norms/calc'
import { validateBilanField, type BoundResult } from '../../lib/bilan-bounds'
import { CategoryBadge } from '../../components/CategoryBadge'
import { PercentileIndicator } from '../../components/PercentileIndicator'
import type { Category, NormsType } from '../../lib/norms'

interface AerobicSectionProps {
  data: BilanData
  onDataChange?: (data: BilanData) => void
  readOnly: boolean
  variant: 'light' | 'marine'
  age: number | null
  sex: 'F' | 'M' | null
  /** Pour afficher la catégorie VO2max en read-only. */
  categorize?: (key: keyof BilanData, value: number) => Category | null
  /** Norme active — utilisée par PercentileIndicator. */
  norms?: NormsType
}

const TEST_TYPE_OPTIONS: { value: AerobicTestType; label: string }[] = [
  { value: 'bruce', label: 'Tapis Roulant de Bruce' },
  { value: 'cooper', label: 'Test de Cooper (12 min)' },
  { value: 'leger', label: 'Test de Léger (navette 20 m)' },
  { value: 'manual', label: 'Autre / VO2max connu directement' }
]

function setFields(data: BilanData, patch: Partial<BilanData>): BilanData {
  const next = { ...data } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) {
      delete next[k]
    } else {
      next[k] = v
    }
  }
  return next as BilanData
}

/** Calcule le VO2max selon le protocole et les valeurs disponibles. Retourne `null` si non calculable. */
function computeVo2maxForProtocol(data: BilanData, age: number | null, sex: 'F' | 'M' | null): number | null {
  const t: AerobicTestType = data.aerobie_test_type ?? 'manual'
  if (t === 'bruce' && data.bruce_duration_sec !== undefined && sex !== null) {
    const v = bruceTreadmillVo2max({ durationSeconds: data.bruce_duration_sec, sex })
    return Number.isFinite(v) ? Math.round(v * 10) / 10 : null
  }
  if (t === 'cooper' && data.cooper_distance_m !== undefined) {
    const v = cooperVo2max(data.cooper_distance_m)
    return Number.isFinite(v) ? Math.round(v * 10) / 10 : null
  }
  if (t === 'leger' && data.leger_palier !== undefined && age !== null) {
    const v = legerVo2max(data.leger_palier, age)
    return Number.isFinite(v) ? Math.round(v * 10) / 10 : null
  }
  return null
}

export function AerobicSection({ data, onDataChange, readOnly, variant, age, sex, categorize, norms = 'acsm' }: AerobicSectionProps) {
  const isLight = variant === 'light'
  const labelClass = isLight ? 'text-marine/60' : 'text-cream/55'
  const valueClass = isLight ? 'text-marine' : 'text-cream'
  const mutedClass = isLight ? 'text-marine/45' : 'text-cream/45'
  const inputClass = isLight
    ? 'w-full px-2.5 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-base focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors'
    : 'w-full px-2.5 py-1.5 border border-marine-light/50 rounded-md bg-marine/40 text-cream text-base focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors'
  const computedClass = isLight
    ? 'w-full px-2.5 py-1.5 border border-cream-dark/60 rounded-md bg-cream/40 text-marine/80 text-base'
    : 'w-full px-2.5 py-1.5 border border-marine-light/30 rounded-md bg-marine/20 text-cream/70 text-base'

  const testType: AerobicTestType = data.aerobie_test_type ?? 'manual'

  // VO2max protocolaire — calculé live pendant la saisie ; en read-only, on respecte data.vo2max.
  const protocolVo2max = readOnly ? null : computeVo2maxForProtocol(data, age, sex)
  const displayedVo2max = readOnly ? data.vo2max : (protocolVo2max ?? data.vo2max)
  const displayedMet = useMemo(() => {
    const v = computeMet(displayedVo2max)
    return v === null ? null : Math.round(v * 10) / 10
  }, [displayedVo2max])

  const bruceStage = useMemo(
    () => (testType === 'bruce' && data.bruce_duration_sec ? bruceStageFor(data.bruce_duration_sec) : null),
    [testType, data.bruce_duration_sec]
  )

  function changeTestType(next: AerobicTestType) {
    if (!onDataChange) return
    // Map le label aussi pour rester compatible avec la table « Source » du parser .docx.
    const label = TEST_TYPE_OPTIONS.find(o => o.value === next)?.label
    const cleared: Partial<BilanData> = {
      aerobie_test_type: next,
      test_aerobie: label
    }
    // En passant à manual, on garde le vo2max actuel. Sinon, on le recalcule.
    if (next !== 'manual') {
      const v = computeVo2maxForProtocol({ ...data, aerobie_test_type: next }, age, sex)
      cleared.vo2max = v ?? undefined
    }
    onDataChange(setFields(data, cleared))
  }

  function setBruceDuration(input: string) {
    if (!onDataChange) return
    const seconds = parseMmSs(input)
    const patch: Partial<BilanData> = { bruce_duration_sec: seconds ?? undefined }
    if (seconds !== null && sex !== null) {
      const v = bruceTreadmillVo2max({ durationSeconds: seconds, sex })
      patch.vo2max = Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined
    }
    onDataChange(setFields(data, patch))
  }

  function setCooperDistance(value: number | undefined) {
    if (!onDataChange) return
    const patch: Partial<BilanData> = { cooper_distance_m: value }
    if (value !== undefined) {
      const v = cooperVo2max(value)
      patch.vo2max = Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined
    } else {
      patch.vo2max = undefined
    }
    onDataChange(setFields(data, patch))
  }

  function setLegerPalier(value: number | undefined) {
    if (!onDataChange) return
    const patch: Partial<BilanData> = { leger_palier: value }
    if (value !== undefined && age !== null) {
      const v = legerVo2max(value, age)
      patch.vo2max = Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined
    } else {
      patch.vo2max = undefined
    }
    onDataChange(setFields(data, patch))
  }

  function setNumberField(key: keyof BilanData, value: number | undefined) {
    if (!onDataChange) return
    onDataChange(setFields(data, { [key]: value }))
  }

  function setManualVo2max(value: number | undefined) {
    if (!onDataChange) return
    onDataChange(setFields(data, { vo2max: value }))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const vo2maxCategory =
    readOnly && categorize && typeof displayedVo2max === 'number' ? categorize('vo2max', displayedVo2max) : null

  // Plausibilité des saisies numériques de la section (mêmes bornes que BilanForm).
  const boundOf = (key: string, value: number | undefined): BoundResult | null =>
    readOnly ? null : validateBilanField(key, value)
  const boundBorder = (b: BoundResult | null): string =>
    b?.level === 'error' ? ' !border-red-500' : b?.level === 'warn' ? ' !border-amber-400' : ''
  const boundMsg = (b: BoundResult | null) =>
    b?.message ? (
      <p className={`text-xs mt-1 ${b.level === 'error' ? 'text-red-500' : 'text-amber-600'}`}>{b.message}</p>
    ) : null
  const cooperBound = boundOf('cooper_distance_m', data.cooper_distance_m)
  const legerBound = boundOf('leger_palier', data.leger_palier)
  const fcReposBound = boundOf('fc_repos', data.fc_repos)
  const paSysBound = boundOf('pa_systolique', data.pa_systolique)
  const paDiaBound = boundOf('pa_diastolique', data.pa_diastolique)

  return (
    <div className="space-y-4">
      {/* Sélecteur de protocole */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
        <div className="min-w-0 col-span-2 md:col-span-2">
          <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>Test aérobie utilisé</label>
          {readOnly ? (
            <p className={`text-base font-medium ${valueClass}`}>
              {data.test_aerobie ?? <span className="opacity-40">—</span>}
            </p>
          ) : (
            <select value={testType} onChange={e => changeTestType(e.target.value as AerobicTestType)} className={inputClass}>
              {TEST_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Inputs spécifiques au protocole */}
        {testType === 'bruce' && (
          <div className="min-w-0">
            <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
              Durée totale (mm:ss)
            </label>
            {readOnly ? (
              <p className={`text-base font-medium ${valueClass}`}>
                {data.bruce_duration_sec ? formatMmSs(data.bruce_duration_sec) : <span className="opacity-40">—</span>}
              </p>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                placeholder="12:30"
                defaultValue={formatMmSs(data.bruce_duration_sec)}
                onBlur={e => setBruceDuration(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setBruceDuration((e.target as HTMLInputElement).value)
                  }
                }}
                className={inputClass}
              />
            )}
            {sex === null && !readOnly && (
              <p className="text-xs text-red-500 mt-1">Sexe du client requis pour le calcul Bruce.</p>
            )}
          </div>
        )}

        {testType === 'cooper' && (
          <div className="min-w-0">
            <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>Distance (m)</label>
            {readOnly ? (
              <p className={`text-base font-medium ${valueClass}`}>
                {data.cooper_distance_m ?? <span className="opacity-40">—</span>}
              </p>
            ) : (
              <>
                <input
                  type="number"
                  step="any"
                  value={data.cooper_distance_m ?? ''}
                  onChange={e =>
                    setCooperDistance(Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)
                  }
                  className={`${inputClass}${boundBorder(cooperBound)}`}
                />
                {boundMsg(cooperBound)}
              </>
            )}
          </div>
        )}

        {testType === 'leger' && (
          <div className="min-w-0">
            <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>Palier atteint</label>
            {readOnly ? (
              <p className={`text-base font-medium ${valueClass}`}>
                {data.leger_palier ?? <span className="opacity-40">—</span>}
              </p>
            ) : (
              <>
                <input
                  type="number"
                  step="1"
                  min={1}
                  max={21}
                  value={data.leger_palier ?? ''}
                  onChange={e => setLegerPalier(Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)}
                  className={`${inputClass}${boundBorder(legerBound)}`}
                />
                {boundMsg(legerBound)}
              </>
            )}
            {age === null && !readOnly && (
              <p className="text-xs text-red-500 mt-1">Date de naissance requise pour le calcul Léger.</p>
            )}
          </div>
        )}
      </div>

      {/* VO2max + MET — toujours affichés */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
        <div className="min-w-0">
          <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
            VO2max <span className="lowercase tracking-normal">(ml/kg/min)</span>
          </label>
          {readOnly ? (
            <>
              <p className={`text-base font-medium ${valueClass}`}>
                {displayedVo2max === undefined ? <span className="opacity-40">—</span> : displayedVo2max.toFixed(1)}
              </p>
              {vo2maxCategory && (
                <div className="mt-0.5">
                  <CategoryBadge category={vo2maxCategory} variant="compact" />
                </div>
              )}
            </>
          ) : testType === 'manual' ? (
            <input
              type="number"
              step="any"
              value={data.vo2max ?? ''}
              onChange={e =>
                setManualVo2max(Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)
              }
              className={inputClass}
            />
          ) : (
            <>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={displayedVo2max === undefined ? '—' : displayedVo2max.toFixed(1)}
                className={computedClass}
              />
              <p className={`text-xs mt-1 ${mutedClass}`}>
                Calculé via {testType === 'bruce' ? 'Foster/Pollock' : testType === 'cooper' ? 'Cooper' : 'Léger 1988'}
              </p>
            </>
          )}
          {typeof displayedVo2max === 'number' && (
            <PercentileIndicator
              test="vo2max"
              value={displayedVo2max}
              age={age}
              sex={sex}
              norms={norms}
              variant={variant}
            />
          )}
        </div>

        <div className="min-w-0">
          <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
            MET équivalent <span className="lowercase tracking-normal">(MET)</span>
          </label>
          {readOnly ? (
            <p className={`text-base font-medium ${valueClass}`}>
              {data.met_equivalent === undefined ? <span className="opacity-40">—</span> : data.met_equivalent.toFixed(1)}
            </p>
          ) : (
            <>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={displayedMet === null ? '—' : displayedMet.toFixed(1)}
                className={computedClass}
              />
              <p className={`text-xs mt-1 ${mutedClass}`}>VO2max ÷ 3.5</p>
            </>
          )}
        </div>

        {/* Bruce : stage atteint */}
        {testType === 'bruce' && (
          <div className="min-w-0">
            <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>Stage atteint</label>
            {bruceStage ? (
              <p className={`text-base font-medium ${valueClass}`}>
                Stage {bruceStage.stage} —{' '}
                <span className={mutedClass}>
                  {bruceStage.speedKmh} km/h à {bruceStage.gradePct}% (~{bruceStage.mets} MET)
                </span>
              </p>
            ) : (
              <p className={`text-base ${mutedClass}`}>—</p>
            )}
          </div>
        )}
      </div>

      {/* Encart info : table des stages Bruce (édition uniquement) */}
      {testType === 'bruce' && !readOnly && (
        <details className={isLight ? 'bg-cream/60 border border-cream-dark rounded-md p-3' : 'bg-marine/30 border border-marine-light/40 rounded-md p-3'}>
          <summary className={`cursor-pointer text-sm font-medium ${labelClass}`}>
            Table des paliers Bruce (vitesse · pente · MET)
          </summary>
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className={mutedClass}>
                <th className="text-left font-medium pr-3">Stage</th>
                <th className="text-left font-medium pr-3">Fin (min)</th>
                <th className="text-left font-medium pr-3">Vitesse</th>
                <th className="text-left font-medium pr-3">Pente</th>
                <th className="text-left font-medium">MET</th>
              </tr>
            </thead>
            <tbody className={valueClass}>
              {BRUCE_STAGES.map(s => (
                <tr key={s.stage}>
                  <td className="pr-3 py-0.5">{s.stage}</td>
                  <td className="pr-3 py-0.5">{s.endMinutes}</td>
                  <td className="pr-3 py-0.5">{s.speedKmh} km/h</td>
                  <td className="pr-3 py-0.5">{s.gradePct} %</td>
                  <td className="py-0.5">{s.mets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/* FC repos / FC max prédite / PA repos */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
        <div className="min-w-0">
          <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
            FC au repos <span className="lowercase tracking-normal">(bpm)</span>
          </label>
          {readOnly ? (
            <p className={`text-base font-medium ${valueClass}`}>
              {data.fc_repos === undefined ? <span className="opacity-40">—</span> : data.fc_repos}
            </p>
          ) : (
            <>
              <input
                type="number"
                step="any"
                value={data.fc_repos ?? ''}
                onChange={e =>
                  setNumberField('fc_repos', Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)
                }
                className={`${inputClass}${boundBorder(fcReposBound)}`}
              />
              {boundMsg(fcReposBound)}
            </>
          )}
        </div>

        <div className="min-w-0">
          <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
            FC max prédite <span className="lowercase tracking-normal">(bpm)</span>
          </label>
          {readOnly ? (
            <p className={`text-base font-medium ${valueClass}`}>
              {data.fc_max_predite === undefined ? <span className="opacity-40">—</span> : data.fc_max_predite}
            </p>
          ) : (
            <>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={data.fc_max_predite === undefined ? '—' : String(data.fc_max_predite)}
                className={computedClass}
              />
              <p className={`text-xs mt-1 ${mutedClass}`}>Tanaka : 208 − 0.7 × âge</p>
            </>
          )}
        </div>

        <div className="min-w-0">
          <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
            PA systolique <span className="lowercase tracking-normal">(mmHg)</span>
          </label>
          {readOnly ? (
            <p className={`text-base font-medium ${valueClass}`}>
              {data.pa_systolique === undefined ? <span className="opacity-40">—</span> : data.pa_systolique}
            </p>
          ) : (
            <>
              <input
                type="number"
                step="any"
                value={data.pa_systolique ?? ''}
                onChange={e =>
                  setNumberField(
                    'pa_systolique',
                    Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber
                  )
                }
                className={`${inputClass}${boundBorder(paSysBound)}`}
              />
              {boundMsg(paSysBound)}
            </>
          )}
        </div>

        <div className="min-w-0">
          <label className={`block text-xs uppercase tracking-wide mb-1 ${labelClass}`}>
            PA diastolique <span className="lowercase tracking-normal">(mmHg)</span>
          </label>
          {readOnly ? (
            <p className={`text-base font-medium ${valueClass}`}>
              {data.pa_diastolique === undefined ? <span className="opacity-40">—</span> : data.pa_diastolique}
            </p>
          ) : (
            <>
              <input
                type="number"
                step="any"
                value={data.pa_diastolique ?? ''}
                onChange={e =>
                  setNumberField(
                    'pa_diastolique',
                    Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber
                  )
                }
                className={`${inputClass}${boundBorder(paDiaBound)}`}
              />
              {boundMsg(paDiaBound)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
