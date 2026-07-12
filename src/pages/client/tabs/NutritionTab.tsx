import { useState } from 'react'
import { Apple, Ban, CalendarClock, Check, Droplet, ExternalLink, MessageSquareQuote, Pill, Target } from 'lucide-react'
import { useClientContext } from '../ClientDetailLayout'
import { clientsService } from '../../../services/clients'
import { reportsService } from '../../../services/reports'
import {
  ACTIVITY_LABELS,
  ACTIVITY_ORDER,
  RATE_PRESETS,
  DEFAULT_RATE_KG_PER_WEEK,
  DEFAULT_PROTEIN_PER_LB_LEAN,
  DEFAULT_FAT_MAX_G,
  type ActivityLevel
} from '../../../lib/nutrition'
import { kgToLb } from '../../../lib/units'
import { FastingPlanner } from './FastingPlanner'
import type { FastingProgram } from '../../../lib/fasting-planning'

/** Parse le planning JSON stocké en base en tableau de programmes (vide si invalide). */
function parseInitialPrograms(raw: string | null | undefined): FastingProgram[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FastingProgram[]) : []
  } catch {
    return []
  }
}

const fieldClass =
  'w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors'

function Section({
  icon: Icon,
  title,
  desc,
  children
}: {
  icon: typeof Target
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-cream-dark rounded-lg p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gold/15 text-gold-dark shrink-0">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-marine font-semibold text-lg leading-tight">{title}</h2>
          {desc && <p className="text-marine/50 text-sm mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function NutritionTab() {
  const { client, onClientUpdated } = useClientContext()

  // ── Objectif chiffré & nutrition (déplacé depuis « Modifier ») ──────────────
  const [nutritionEnabled, setNutritionEnabled] = useState(client.nutritionEnabled ?? false)
  const [targetBodyFat, setTargetBodyFat] = useState(
    client.nutritionTargetBodyFat != null ? String(client.nutritionTargetBodyFat) : ''
  )
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>(client.nutritionActivityLevel ?? '')
  const [rateKgPerWeek, setRateKgPerWeek] = useState<number>(client.nutritionRateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK)
  const [proteinPerLb, setProteinPerLb] = useState<string>(
    String(client.nutritionProteinPerLbLean ?? DEFAULT_PROTEIN_PER_LB_LEAN)
  )
  const [fatMaxG, setFatMaxG] = useState<string>(String(client.nutritionFatMaxG ?? DEFAULT_FAT_MAX_G))
  const [caloriesMode, setCaloriesMode] = useState<'auto' | 'manual'>(
    client.nutritionTargetKcal != null ? 'manual' : 'auto'
  )
  const [manualKcal, setManualKcal] = useState<string>(
    client.nutritionTargetKcal != null ? String(client.nutritionTargetKcal) : ''
  )

  // ── Planning de jeûne flexible ────────────────────────────────────────────────
  const [programs, setPrograms] = useState<FastingProgram[]>(() => parseInitialPrograms(client.jeunePlanning))

  // ── Hydratation & suppléments ────────────────────────────────────────────────
  const [hydratationMl, setHydratationMl] = useState(
    client.hydratationMlParJour != null ? String(client.hydratationMlParJour) : ''
  )
  const [supplementsNotes, setSupplementsNotes] = useState(client.supplementsNotes ?? '')

  // ── Aliments & mot de Marie ──────────────────────────────────────────────────
  const [alimentsPrivilegier, setAlimentsPrivilegier] = useState(client.alimentsPrivilegier ?? '')
  const [alimentsEviter, setAlimentsEviter] = useState(client.alimentsEviter ?? '')
  const [nutritionMot, setNutritionMot] = useState(client.nutritionMot ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [opening, setOpening] = useState(false)

  const mlNum = hydratationMl.trim() !== '' ? Number(hydratationMl) : null
  const verres = mlNum != null && Number.isFinite(mlNum) ? Math.round(mlNum / 250) : null

  /** Valide + enregistre. Retourne `true` si la sauvegarde a réussi. */
  async function persist(): Promise<boolean> {
    setError(null)

    const targetPct = targetBodyFat.trim() !== '' ? Number(targetBodyFat) : null
    if (nutritionEnabled && targetPct !== null && (!Number.isFinite(targetPct) || targetPct < 3 || targetPct > 60)) {
      setError('Le % de gras visé doit être compris entre 3 et 60.')
      return false
    }
    const proteinVal = proteinPerLb.trim() !== '' ? Number(proteinPerLb) : null
    const fatVal = fatMaxG.trim() !== '' ? Number(fatMaxG) : null
    if (nutritionEnabled && proteinVal !== null && (!Number.isFinite(proteinVal) || proteinVal < 0.3 || proteinVal > 2.5)) {
      setError('Les protéines (g/lb de masse maigre) doivent être comprises entre 0,3 et 2,5.')
      return false
    }
    if (nutritionEnabled && fatVal !== null && (!Number.isFinite(fatVal) || fatVal < 20 || fatVal > 200)) {
      setError('Le plafond de lipides doit être compris entre 20 et 200 g.')
      return false
    }
    const kcalVal = nutritionEnabled && caloriesMode === 'manual' && manualKcal.trim() !== '' ? Number(manualKcal) : null
    if (kcalVal !== null && (!Number.isFinite(kcalVal) || kcalVal < 800 || kcalVal > 6000)) {
      setError('Les calories manuelles doivent être comprises entre 800 et 6000.')
      return false
    }
    if (nutritionEnabled && caloriesMode === 'manual' && manualKcal.trim() === '') {
      setError('Indiquez les calories cibles, ou choisissez « Automatique ».')
      return false
    }
    const mlVal = hydratationMl.trim() !== '' ? Number(hydratationMl) : null
    if (mlVal !== null && (!Number.isFinite(mlVal) || mlVal < 0 || mlVal > 10000)) {
      setError("La cible d'hydratation doit être comprise entre 0 et 10 000 ml.")
      return false
    }

    try {
      setSaving(true)
      const updated = await clientsService.update(client.id, {
        nutritionEnabled,
        nutritionTargetBodyFat: nutritionEnabled ? targetPct : null,
        nutritionActivityLevel: nutritionEnabled && activityLevel !== '' ? activityLevel : null,
        nutritionRateKgPerWeek: nutritionEnabled ? rateKgPerWeek : null,
        nutritionProteinPerLbLean: nutritionEnabled ? proteinVal : null,
        nutritionFatMaxG: nutritionEnabled ? fatVal : null,
        nutritionTargetKcal: kcalVal,
        // Ancien modèle de jeûne (type unique + fenêtre) remplacé par le planning.
        jeuneType: null,
        jeuneFenetreDebut: null,
        jeuneFenetreFin: null,
        jeuneNotes: null,
        jeunePlanning: programs.length > 0 ? JSON.stringify(programs) : null,
        hydratationMlParJour: mlVal,
        supplementsNotes: supplementsNotes.trim() || null,
        alimentsPrivilegier: alimentsPrivilegier.trim() || null,
        alimentsEviter: alimentsEviter.trim() || null,
        nutritionMot: nutritionMot.trim() || null
      })
      onClientUpdated?.(updated)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    setSaved(false)
    if (await persist()) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  /** Enregistre d'abord (le document lit la base), puis ouvre le HTML nutrition. */
  async function handleOpenDoc() {
    setOpening(true)
    try {
      if (!(await persist())) return
      const path = await reportsService.generateNutritionHtml(client.id)
      await reportsService.openPdf(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de générer le document nutrition.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8 pb-28 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-marine font-semibold text-2xl">Nutrition &amp; jeûne</h1>
          <p className="text-marine/50 text-base mt-1">
            Ces réglages composent le document nutrition remis à {client.name.split(' ')[0]}.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenDoc}
          disabled={opening}
          className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 text-marine/70 hover:text-marine border border-cream-dark hover:border-gold/60 rounded-md text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ExternalLink size={15} />
          {opening ? 'Ouverture…' : 'Voir le document'}
        </button>
      </div>

      {/* ── Objectif chiffré & nutrition ────────────────────────────────────── */}
      <Section
        icon={Target}
        title="Objectif chiffré & macros"
        desc="Ajoute au rapport les livres à perdre pour atteindre le % de gras visé et des macros indicatives."
      >
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={nutritionEnabled}
            onChange={e => setNutritionEnabled(e.target.checked)}
            className="accent-gold w-4 h-4"
          />
          <span className="text-base font-medium text-marine">Activer l'objectif chiffré pour ce client</span>
        </label>

        {nutritionEnabled && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-marine mb-1">% de gras corporel visé</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={3}
                  max={60}
                  step={0.5}
                  value={targetBodyFat}
                  onChange={e => setTargetBodyFat(e.target.value)}
                  placeholder="15"
                  className={`w-28 ${fieldClass}`}
                />
                <span className="text-marine/50 text-base">%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-marine mb-1">Niveau d'activité</label>
              <select
                value={activityLevel}
                onChange={e => setActivityLevel(e.target.value as ActivityLevel | '')}
                className={fieldClass}
              >
                <option value="">— Choisir —</option>
                {ACTIVITY_ORDER.map(a => (
                  <option key={a} value={a}>
                    {ACTIVITY_LABELS[a]}
                  </option>
                ))}
              </select>
              <p className="text-marine/40 text-xs mt-1">Sert à l'estimation calorique pour les macros.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-marine mb-1">Rythme de perte visé</label>
              <select
                value={String(rateKgPerWeek)}
                onChange={e => setRateKgPerWeek(Number(e.target.value))}
                className={fieldClass}
              >
                {RATE_PRESETS.map(r => (
                  <option key={r.kgPerWeek} value={String(r.kgPerWeek)}>
                    {r.kgPerWeek.toLocaleString('fr-CA')} kg/sem (≈{' '}
                    {kgToLb(r.kgPerWeek).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} lb) — {r.intensity}
                    {r.kgPerWeek === DEFAULT_RATE_KG_PER_WEEK ? ' · recommandé' : ''}
                  </option>
                ))}
              </select>
              <p className="text-marine/40 text-xs mt-1">Détermine l'échéance estimée et l'ampleur du déficit calorique.</p>
            </div>

            <div className="rounded-md border border-cream-dark bg-cream/50 p-4">
              <p className="text-sm font-medium text-marine mb-2">Formule des macros</p>
              <div className="flex items-start gap-2 mb-2 text-marine text-sm">
                <span className="w-20 pt-1.5">Calories</span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-4">
                    {([
                      { value: 'auto', label: 'Automatique' },
                      { value: 'manual', label: 'Manuel' }
                    ] as const).map(opt => (
                      <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="calories-mode"
                          checked={caloriesMode === opt.value}
                          onChange={() => setCaloriesMode(opt.value)}
                          className="accent-gold"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {caloriesMode === 'manual' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={800}
                        max={6000}
                        step={50}
                        value={manualKcal}
                        onChange={e => setManualKcal(e.target.value)}
                        placeholder="2000"
                        className="w-24 px-2 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
                      />
                      <span className="text-marine/60">kcal / jour</span>
                    </div>
                  ) : (
                    <span className="text-marine/50 text-xs">Calculées à partir du métabolisme et du rythme.</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2 text-marine text-sm">
                <span className="w-20">Protéines</span>
                <input
                  type="number"
                  min={0.3}
                  max={2.5}
                  step={0.1}
                  value={proteinPerLb}
                  onChange={e => setProteinPerLb(e.target.value)}
                  className="w-20 px-2 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
                />
                <span className="text-marine/60">g par lb de masse maigre</span>
              </div>
              <div className="flex items-center gap-2 mb-2 text-marine text-sm">
                <span className="w-20">Lipides</span>
                <span className="text-marine/60">max</span>
                <input
                  type="number"
                  min={20}
                  max={200}
                  step={5}
                  value={fatMaxG}
                  onChange={e => setFatMaxG(e.target.value)}
                  className="w-20 px-2 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
                />
                <span className="text-marine/60">g</span>
              </div>
              <div className="flex items-center gap-2 text-marine text-sm">
                <span className="w-20">Glucides</span>
                <span className="text-marine/60">le reste des calories cibles</span>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── Planning de jeûne flexible ──────────────────────────────────────── */}
      <Section
        icon={CalendarClock}
        title="Planning de jeûne"
        desc="Ajoute des programmes (fenêtre quotidienne 16:8, jeûne 48 h le lundi, 96 h une fois par saison…). Le calendrier montre les journées de jeûne."
      >
        <FastingPlanner programs={programs} onChange={setPrograms} />
      </Section>

      {/* ── Hydratation & suppléments ───────────────────────────────────────── */}
      <Section icon={Droplet} title="Hydratation" desc="Cible quotidienne d'eau.">
        <label className="block text-sm font-medium text-marine mb-1">Cible d'eau par jour</label>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min={0}
            max={10000}
            step={100}
            value={hydratationMl}
            onChange={e => setHydratationMl(e.target.value)}
            placeholder="2500"
            className={`w-32 ${fieldClass}`}
          />
          <span className="text-marine/60 text-base">ml / jour</span>
          {mlNum != null && Number.isFinite(mlNum) && mlNum > 0 && (
            <span className="text-marine/45 text-sm">
              ≈ {(mlNum / 1000).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} L · {verres} verres de 250 ml
            </span>
          )}
        </div>
        <p className="text-marine/40 text-xs mt-1.5">Repère courant : environ 30 à 40 ml par kg de poids corporel.</p>
      </Section>

      <Section icon={Pill} title="Suppléments" desc="Recommandations libres.">
        <textarea
          value={supplementsNotes}
          onChange={e => setSupplementsNotes(e.target.value)}
          rows={3}
          placeholder="Ex. Vitamine D 1000 UI le matin. Créatine 5 g/jour. Oméga-3."
          className={`${fieldClass} resize-y`}
        />
      </Section>

      {/* ── Aliments ────────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section icon={Apple} title="À privilégier" desc="Aliments à mettre de l'avant.">
          <textarea
            value={alimentsPrivilegier}
            onChange={e => setAlimentsPrivilegier(e.target.value)}
            rows={5}
            placeholder="Ex. Légumes verts, protéines maigres, légumineuses, fruits entiers, eau."
            className={`${fieldClass} resize-y`}
          />
        </Section>
        <Section icon={Ban} title="À éviter" desc="Aliments à limiter.">
          <textarea
            value={alimentsEviter}
            onChange={e => setAlimentsEviter(e.target.value)}
            rows={5}
            placeholder="Ex. Sucres ajoutés, boissons sucrées, aliments ultra-transformés, alcool."
            className={`${fieldClass} resize-y`}
          />
        </Section>
      </div>

      {/* ── Mot de Marie ────────────────────────────────────────────────────── */}
      <Section
        icon={MessageSquareQuote}
        title="Mot de Marie sur la nutrition"
        desc="Court message affiché dans la section nutrition du rapport."
      >
        <textarea
          value={nutritionMot}
          onChange={e => setNutritionMot(e.target.value)}
          rows={3}
          placeholder="Ex. On vise le progrès, pas la perfection. Un repas à la fois."
          className={`${fieldClass} resize-y`}
        />
      </Section>

      {error && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</div>
      )}

      {/* Barre d'enregistrement collante */}
      <div className="fixed bottom-0 left-0 right-0 md:left-auto md:right-8 md:bottom-6 md:w-auto z-30 flex justify-end px-8 py-4 md:p-0 bg-cream/90 md:bg-transparent backdrop-blur md:backdrop-blur-none border-t border-cream-dark md:border-0">
        <div className="flex items-center gap-4">
          {saved && (
            <span className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
              <Check size={16} /> Enregistré
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-gold text-marine font-semibold rounded-md text-base hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
