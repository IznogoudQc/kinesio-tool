import { useEffect, useMemo, useState } from 'react'
import { Apple, Ban, BookMarked, CalendarClock, Check, ClipboardList, Droplet, ExternalLink, Heart, Mail, MessageSquareQuote, Pill, Save, Sparkles, Target, ThumbsDown, Trash2, Utensils } from 'lucide-react'
import { useClientContext } from '../ClientDetailLayout'
import { clientsService } from '../../../services/clients'
import { reportsService } from '../../../services/reports'
import { bilansService } from '../../../services/bilans'
import { aiAdviceService, AIAdviceError } from '../../../services/aiAdvice'
import { nutritionTemplatesService } from '../../../services/nutritionTemplates'
import { SendBilanModal } from '../SendBilanModal'
import {
  ACTIVITY_LABELS,
  ACTIVITY_ORDER,
  RATE_PRESETS,
  DEFAULT_RATE_KG_PER_WEEK,
  DEFAULT_PROTEIN_PER_LB_LEAN,
  DEFAULT_FAT_MAX_G,
  DEFAULT_MEALS_PER_DAY,
  bodyFatGoal,
  dailyDeficitForRate,
  estimateMacros,
  macrosPerMeal,
  type ActivityLevel,
  type MacroEstimate
} from '../../../lib/nutrition'
import { manualMacros } from '../../../lib/objectif'
import { buildSynthesisBilan } from '../../../lib/synthesisBilan'
import { computeBilan } from '../../../lib/bilan-computed'
import { computeAge } from '../../../lib/norms'
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
const macroInput =
  'w-24 px-2 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold'

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

// Propositions par défaut — Marie clique pour insérer, puis garde, modifie ou retire.
const FOODS_GOOD = [
  'Légumes verts', 'Protéines maigres (poulet, poisson, œufs)', 'Légumineuses', 'Fruits entiers',
  'Grains entiers', 'Noix et graines', 'Yogourt grec', 'Eau'
]
const FOODS_BAD = [
  'Sucres ajoutés', 'Boissons sucrées', 'Aliments ultra-transformés', 'Alcool', 'Fritures',
  'Charcuteries', 'Grignotage le soir'
]
// Suppléments courants avec le moment généralement recommandé pour la prise.
const SUPPLEMENTS: { label: string; timing: string }[] = [
  { label: 'Vitamine D3 + K2', timing: 'avec un repas contenant du gras' },
  { label: 'Oméga-3 (EPA/DHA)', timing: 'au repas' },
  { label: 'Magnésium', timing: 'le soir (souper ou coucher)' },
  { label: 'Zinc', timing: 'au coucher, à distance du calcium/fer' },
  { label: 'Créatine 5 g', timing: 'tous les jours, n’importe quand' },
  { label: 'Multivitamine', timing: 'au déjeuner' },
  { label: 'Vitamine C', timing: 'le matin' },
  { label: 'Probiotiques', timing: 'à jeun, le matin' },
  { label: 'Fer', timing: 'à jeun avec vitamine C, loin du café/thé' },
  { label: 'Protéine (whey)', timing: 'après l’entraînement ou en collation' }
]
const HYDRATION_PRESETS = [2000, 2500, 3000]
const MOT_PRESETS = [
  'On vise le progrès, pas la perfection. Un repas à la fois.',
  'La régularité bat la perfection : chaque petit choix compte.',
  'Mange vrai, bouge souvent, dors bien — le reste suit.'
]

/** Message lisible pour une erreur de génération IA (clé absente → renvoi Paramètres). */
function aiErrorMessage(err: unknown): string {
  if (err instanceof AIAdviceError && err.code === 'NO_API_KEY') {
    return 'Aucune clé API Anthropic configurée — ajoutez-la dans Paramètres pour utiliser l’IA.'
  }
  return err instanceof Error ? err.message : 'Erreur lors de la génération IA.'
}

/** Ajoute `item` en nouvelle ligne (sans doublon, insensible à la casse). */
function appendLine(current: string, item: string): string {
  const lines = current.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.some(l => l.toLowerCase() === item.toLowerCase())) return current
  return current.trim() ? `${current.replace(/\s+$/, '')}\n${item}` : item
}

/** Rangée de propositions cliquables ; un clic ajoute la ligne (coché si déjà présent). */
function SuggestChips({ items, current, onPick }: { items: string[]; current: string; onPick: (item: string) => void }) {
  const present = new Set(current.split('\n').map(l => l.trim().toLowerCase()))
  return (
    <div className="mb-2.5">
      <p className="text-marine/40 text-xs mb-1.5">Propositions — cliquez pour ajouter :</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(it => {
          const used = present.has(it.toLowerCase())
          return (
            <button
              key={it}
              type="button"
              onClick={() => onPick(it)}
              disabled={used}
              className={`px-2.5 py-1 rounded-full border text-sm transition-colors ${used ? 'border-cream-dark text-marine/30 cursor-default' : 'border-gold/40 text-marine/70 hover:border-gold hover:bg-gold/10'}`}
            >
              {used ? '✓ ' : '+ '}
              {it}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Comme SuggestChips, mais insère « nom — moment recommandé » (pour les suppléments). */
function SupplementChips({
  items,
  current,
  onPick
}: {
  items: { label: string; timing: string }[]
  current: string
  onPick: (line: string) => void
}) {
  const present = current.toLowerCase()
  return (
    <div className="mb-2.5">
      <p className="text-marine/40 text-xs mb-1.5">Propositions (avec le moment recommandé) — cliquez pour ajouter :</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(it => {
          const used = present.includes(it.label.toLowerCase())
          return (
            <button
              key={it.label}
              type="button"
              onClick={() => onPick(`${it.label} — ${it.timing}`)}
              disabled={used}
              title={`${it.label} — ${it.timing}`}
              className={`px-2.5 py-1 rounded-full border text-sm transition-colors ${used ? 'border-cream-dark text-marine/30 cursor-default' : 'border-gold/40 text-marine/70 hover:border-gold hover:bg-gold/10'}`}
            >
              {used ? '✓ ' : '+ '}
              {it.label}
            </button>
          )
        })}
      </div>
    </div>
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
  // Mode des macros : `false` = calculées par la formule (auto) ; `true` = Marie tape
  // les grammes (protéines/lipides/glucides) et les calories se déduisent.
  const [macroManual, setMacroManual] = useState(client.nutritionMacroManual ?? false)
  const [manualProteinG, setManualProteinG] = useState<string>(
    client.nutritionManualProteinG != null ? String(client.nutritionManualProteinG) : ''
  )
  const [manualFatG, setManualFatG] = useState<string>(
    client.nutritionManualFatG != null ? String(client.nutritionManualFatG) : ''
  )
  const [manualCarbG, setManualCarbG] = useState<string>(
    client.nutritionManualCarbG != null ? String(client.nutritionManualCarbG) : ''
  )
  const [repasParJour, setRepasParJour] = useState<number>(client.nutritionRepasParJour ?? DEFAULT_MEALS_PER_DAY)

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
  const [alimentsAimes, setAlimentsAimes] = useState(client.alimentsAimes ?? '')
  const [alimentsPasAimes, setAlimentsPasAimes] = useState(client.alimentsPasAimes ?? '')
  const [nutritionMot, setNutritionMot] = useState(client.nutritionMot ?? '')
  const [nutritionMenu, setNutritionMenu] = useState(client.nutritionMenu ?? '')

  // Génération IA (plan de suppléments / idées de menu).
  const [aiBusy, setAiBusy] = useState<'supp' | 'menu' | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  // Modèles de protocole réutilisables.
  const [templates, setTemplates] = useState<NutritionTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [templateBusy, setTemplateBusy] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [opening, setOpening] = useState(false)
  const [openingFoodlog, setOpeningFoodlog] = useState(false)
  const [showSendEmail, setShowSendEmail] = useState(false)
  const [sentMsg, setSentMsg] = useState<string | null>(null)

  const mlNum = hydratationMl.trim() !== '' ? Number(hydratationMl) : null
  const verres = mlNum != null && Number.isFinite(mlNum) ? Math.round(mlNum / 250) : null

  // Dernières valeurs du client (synthèse des bilans) — sert au calcul auto des macros.
  const [latestData, setLatestData] = useState<BilanData | null>(null)
  useEffect(() => {
    let cancelled = false
    bilansService
      .list(client.id)
      .then(list => {
        if (cancelled) return
        const synth = list.length > 0 ? buildSynthesisBilan(list) : null
        setLatestData(synth?.data ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [client.id])

  // Résultat des macros en direct (grammes réels), calculé au fil des changements.
  const age = computeAge(client.birthdate)
  const liveMacros: MacroEstimate | null = useMemo(() => {
    if (!nutritionEnabled) return null
    if (macroManual) {
      return manualMacros({
        nutritionManualProteinG: manualProteinG.trim() !== '' ? Number(manualProteinG) : null,
        nutritionManualFatG: manualFatG.trim() !== '' ? Number(manualFatG) : null,
        nutritionManualCarbG: manualCarbG.trim() !== '' ? Number(manualCarbG) : null
      })
    }
    const data = latestData
    const weightKg = data && typeof data.poids_kg === 'number' ? data.poids_kg : null
    const target = targetBodyFat.trim() !== '' ? Number(targetBodyFat) : null
    if (!data || weightKg == null || target == null || activityLevel === '') return null
    const computed = computeBilan(data, { age, sex: client.sex, norms: 'acsm' })
    const bodyFatPct =
      computed.pourcentageGrasDurnin ?? (typeof data.pourcentage_gras === 'number' ? data.pourcentage_gras : null)
    const goal = bodyFatGoal(weightKg, bodyFatPct, target)
    if (!goal) return null
    return estimateMacros({
      weightKg,
      heightCm: typeof data.taille_cm === 'number' ? data.taille_cm : null,
      age,
      sex: client.sex,
      activity: activityLevel,
      leanKg: goal.leanKg,
      dailyDeficitKcal: dailyDeficitForRate(rateKgPerWeek),
      proteinPerLbLean: proteinPerLb.trim() !== '' ? Number(proteinPerLb) : null,
      fatMaxG: fatMaxG.trim() !== '' ? Number(fatMaxG) : null,
      targetKcalOverride: null
    })
  }, [nutritionEnabled, macroManual, manualProteinG, manualFatG, manualCarbG, latestData, targetBodyFat, activityLevel, age, client.sex, rateKgPerWeek, proteinPerLb, fatMaxG])

  // Hydratation recommandée ≈ 35 ml/kg (milieu de la fourchette 30–40), arrondie à 100 ml.
  const hydraWeightKg = latestData && typeof latestData.poids_kg === 'number' ? latestData.poids_kg : null
  const hydraSuggestion = hydraWeightKg != null ? Math.round((hydraWeightKg * 35) / 100) * 100 : null

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
    // Mode manuel des macros : Marie tape protéines + lipides + glucides (g) ;
    // les calories se déduisent (P×4 + G×4 + L×9).
    const macroOn = nutritionEnabled && macroManual
    const protGVal = macroOn && manualProteinG.trim() !== '' ? Number(manualProteinG) : null
    const fatGVal = macroOn && manualFatG.trim() !== '' ? Number(manualFatG) : null
    const carbGVal = macroOn && manualCarbG.trim() !== '' ? Number(manualCarbG) : null
    if (protGVal !== null && (!Number.isFinite(protGVal) || protGVal < 0 || protGVal > 500)) {
      setError('Les protéines (g) doivent être comprises entre 0 et 500.')
      return false
    }
    if (fatGVal !== null && (!Number.isFinite(fatGVal) || fatGVal < 0 || fatGVal > 400)) {
      setError('Les lipides (g) doivent être compris entre 0 et 400.')
      return false
    }
    if (carbGVal !== null && (!Number.isFinite(carbGVal) || carbGVal < 0 || carbGVal > 800)) {
      setError('Les glucides (g) doivent être compris entre 0 et 800.')
      return false
    }
    if (macroOn && (protGVal === null || fatGVal === null || carbGVal === null)) {
      setError('En mode manuel, indiquez les protéines, les lipides et les glucides.')
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
        nutritionMacroManual: macroOn,
        // Calories déduites des grammes en mode manuel ; `null` en auto.
        nutritionTargetKcal: macroOn && liveMacros ? liveMacros.targetKcal : null,
        nutritionManualProteinG: protGVal,
        nutritionManualFatG: fatGVal,
        nutritionManualCarbG: carbGVal,
        nutritionRepasParJour: nutritionEnabled ? repasParJour : null,
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
        nutritionMot: nutritionMot.trim() || null,
        nutritionMenu: nutritionMenu.trim() || null,
        alimentsAimes: alimentsAimes.trim() || null,
        alimentsPasAimes: alimentsPasAimes.trim() || null
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

  /** Enregistre d'abord (le courriel joint le document en base), puis ouvre le compositeur. */
  async function openSendEmail() {
    if (await persist()) setShowSendEmail(true)
  }

  /** Enregistre puis ouvre le journal alimentaire vierge imprimable. */
  async function handleOpenFoodlog() {
    setOpeningFoodlog(true)
    try {
      if (!(await persist())) return
      const path = await reportsService.generateFoodlogHtml(client.id)
      await reportsService.openPdf(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de générer le journal alimentaire.')
    } finally {
      setOpeningFoodlog(false)
    }
  }

  /** IA : organise les suppléments saisis en horaire (remplace le champ, éditable). */
  async function generateSupplementsPlan() {
    setAiError(null)
    setAiBusy('supp')
    try {
      const text = await aiAdviceService.generateNutrition({ type: 'supplements', supplements: supplementsNotes })
      setSupplementsNotes(text)
    } catch (err) {
      setAiError(aiErrorMessage(err))
    } finally {
      setAiBusy(null)
    }
  }

  /** IA : idées de menu (journées types) selon les macros + aliments. */
  async function generateMenuIdeas() {
    setAiError(null)
    setAiBusy('menu')
    try {
      const text = await aiAdviceService.generateNutrition({
        type: 'menu',
        kcal: liveMacros?.targetKcal ?? null,
        proteinG: liveMacros?.proteinG ?? null,
        fatG: liveMacros?.fatG ?? null,
        carbsG: liveMacros?.carbsG ?? null,
        foodsGood: alimentsPrivilegier,
        foodsBad: alimentsEviter,
        foodsLiked: alimentsAimes,
        foodsDisliked: alimentsPasAimes
      })
      setNutritionMenu(text)
    } catch (err) {
      setAiError(aiErrorMessage(err))
    } finally {
      setAiBusy(null)
    }
  }

  useEffect(() => {
    nutritionTemplatesService.list().then(setTemplates).catch(() => {})
  }, [])

  /** Sous-ensemble des réglages nutrition capturé dans un modèle. */
  function currentTemplateData(): Record<string, unknown> {
    return {
      nutritionEnabled,
      nutritionTargetBodyFat: targetBodyFat.trim() !== '' ? Number(targetBodyFat) : null,
      nutritionActivityLevel: activityLevel || null,
      nutritionRateKgPerWeek: rateKgPerWeek,
      nutritionProteinPerLbLean: proteinPerLb.trim() !== '' ? Number(proteinPerLb) : null,
      nutritionFatMaxG: fatMaxG.trim() !== '' ? Number(fatMaxG) : null,
      nutritionMacroManual: macroManual,
      nutritionManualProteinG: manualProteinG.trim() !== '' ? Number(manualProteinG) : null,
      nutritionManualFatG: manualFatG.trim() !== '' ? Number(manualFatG) : null,
      nutritionManualCarbG: manualCarbG.trim() !== '' ? Number(manualCarbG) : null,
      nutritionRepasParJour: repasParJour,
      jeunePlanning: programs,
      hydratationMlParJour: hydratationMl.trim() !== '' ? Number(hydratationMl) : null,
      supplementsNotes: supplementsNotes.trim() || null,
      alimentsPrivilegier: alimentsPrivilegier.trim() || null,
      alimentsEviter: alimentsEviter.trim() || null
    }
  }

  /** Applique un modèle (JSON) aux champs du formulaire. Champs client (goûts,
   *  mot, menu, objectif libre) NON touchés — le modèle est un protocole. */
  function applyTemplateJson(json: string) {
    let d: Record<string, unknown>
    try {
      d = JSON.parse(json)
    } catch {
      return
    }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? (v as number) : null)
    const str = (v: unknown) => (typeof v === 'string' ? v : '')
    if ('nutritionEnabled' in d) setNutritionEnabled(!!d.nutritionEnabled)
    if ('nutritionTargetBodyFat' in d) setTargetBodyFat(num(d.nutritionTargetBodyFat) != null ? String(d.nutritionTargetBodyFat) : '')
    if ('nutritionActivityLevel' in d) setActivityLevel((d.nutritionActivityLevel as ActivityLevel) ?? '')
    if (num(d.nutritionRateKgPerWeek) != null) setRateKgPerWeek(Number(d.nutritionRateKgPerWeek))
    if ('nutritionProteinPerLbLean' in d) setProteinPerLb(num(d.nutritionProteinPerLbLean) != null ? String(d.nutritionProteinPerLbLean) : String(DEFAULT_PROTEIN_PER_LB_LEAN))
    if ('nutritionFatMaxG' in d) setFatMaxG(num(d.nutritionFatMaxG) != null ? String(d.nutritionFatMaxG) : String(DEFAULT_FAT_MAX_G))
    if ('nutritionMacroManual' in d) setMacroManual(!!d.nutritionMacroManual)
    if ('nutritionManualProteinG' in d) setManualProteinG(num(d.nutritionManualProteinG) != null ? String(d.nutritionManualProteinG) : '')
    if ('nutritionManualFatG' in d) setManualFatG(num(d.nutritionManualFatG) != null ? String(d.nutritionManualFatG) : '')
    if ('nutritionManualCarbG' in d) setManualCarbG(num(d.nutritionManualCarbG) != null ? String(d.nutritionManualCarbG) : '')
    if (num(d.nutritionRepasParJour) != null) setRepasParJour(Number(d.nutritionRepasParJour))
    if (Array.isArray(d.jeunePlanning)) setPrograms(d.jeunePlanning as FastingProgram[])
    if ('hydratationMlParJour' in d) setHydratationMl(num(d.hydratationMlParJour) != null ? String(d.hydratationMlParJour) : '')
    if ('supplementsNotes' in d) setSupplementsNotes(str(d.supplementsNotes))
    if ('alimentsPrivilegier' in d) setAlimentsPrivilegier(str(d.alimentsPrivilegier))
    if ('alimentsEviter' in d) setAlimentsEviter(str(d.alimentsEviter))
    setShowTemplates(false)
  }

  async function saveTemplate() {
    const name = newTemplateName.trim()
    if (!name) return
    setTemplateBusy(true)
    try {
      await nutritionTemplatesService.save(name, JSON.stringify(currentTemplateData()))
      setNewTemplateName('')
      setTemplates(await nutritionTemplatesService.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le modèle.')
    } finally {
      setTemplateBusy(false)
    }
  }

  async function deleteTemplate(id: string) {
    setTemplateBusy(true)
    try {
      await nutritionTemplatesService.delete(id)
      setTemplates(await nutritionTemplatesService.list())
    } catch {
      /* silencieux */
    } finally {
      setTemplateBusy(false)
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
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates(v => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-md text-base transition-colors ${showTemplates ? 'border-gold/60 bg-gold/10 text-marine' : 'text-marine/70 hover:text-marine border-cream-dark hover:border-gold/60'}`}
          >
            <BookMarked size={15} />
            Modèles
          </button>
          <button
            type="button"
            onClick={handleOpenFoodlog}
            disabled={openingFoodlog}
            title="Journal alimentaire vierge à imprimer (le client note ce qu'il mange)"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-marine/70 hover:text-marine border border-cream-dark hover:border-gold/60 rounded-md text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardList size={15} />
            {openingFoodlog ? 'Génération…' : 'Journal à imprimer'}
          </button>
          <button
            type="button"
            onClick={handleOpenDoc}
            disabled={opening}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-marine/70 hover:text-marine border border-cream-dark hover:border-gold/60 rounded-md text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink size={15} />
            {opening ? 'Ouverture…' : 'Voir le document'}
          </button>
          <button
            type="button"
            onClick={openSendEmail}
            disabled={saving}
            title="Envoyer le document nutrition au client par courriel"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-marine/70 hover:text-marine border border-cream-dark hover:border-gold/60 rounded-md text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail size={15} />
            Courriel
          </button>
        </div>
      </div>

      {showSendEmail && (
        <SendBilanModal
          client={client}
          kind="nutrition"
          onCancel={() => setShowSendEmail(false)}
          onSent={to => {
            setShowSendEmail(false)
            setSentMsg(`Document nutrition envoyé à ${to}.`)
            setTimeout(() => setSentMsg(null), 4000)
          }}
        />
      )}

      {sentMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-marine text-cream text-base font-medium px-5 py-3 rounded-lg shadow-2xl border border-marine-light/40">
          {sentMsg}
        </div>
      )}

      {showTemplates && (
        <div className="rounded-lg border border-gold/40 bg-cream/40 p-5 space-y-4">
          <p className="text-marine font-medium">Modèles de protocole</p>
          <p className="text-marine/50 text-sm -mt-2">
            Enregistre les réglages nutrition actuels comme modèle réutilisable, ou applique-en un à ce client. Les
            goûts, le mot et les idées de menu (propres au client) ne sont pas touchés.
          </p>

          {templates.length > 0 ? (
            <ul className="space-y-2">
              {templates.map(t => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-cream-dark bg-white px-3 py-2">
                  <span className="text-marine font-medium truncate">{t.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => applyTemplateJson(t.data)}
                      disabled={templateBusy}
                      className="px-3 py-1.5 rounded-md bg-gold text-marine text-sm font-semibold hover:bg-gold-dark transition-colors disabled:opacity-50"
                    >
                      Appliquer
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(t.id)}
                      disabled={templateBusy}
                      className="p-1.5 rounded-md text-red-600/70 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                      aria-label="Supprimer le modèle"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-marine/45 text-sm">Aucun modèle enregistré pour l’instant.</p>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-cream-dark">
            <input
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="Nom du modèle (ex. Perte de gras standard)"
              maxLength={80}
              className={`flex-1 ${fieldClass}`}
            />
            <button
              type="button"
              onClick={saveTemplate}
              disabled={templateBusy || newTemplateName.trim() === ''}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-gold/50 text-marine/80 text-base hover:border-gold hover:bg-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={15} />
              Enregistrer le protocole actuel
            </button>
          </div>
        </div>
      )}

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
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-marine">Macros</p>
                <div className="flex rounded-md border border-cream-dark overflow-hidden text-sm">
                  {([
                    { v: false, label: 'Automatique' },
                    { v: true, label: 'Manuel' }
                  ] as const).map(o => (
                    <button
                      key={String(o.v)}
                      type="button"
                      onClick={() => {
                        // Passer en Manuel : partir du résultat auto (s'il est calculable et que rien n'est saisi).
                        if (o.v && !manualProteinG && !manualFatG && !manualCarbG && liveMacros) {
                          setManualProteinG(String(liveMacros.proteinG))
                          setManualFatG(String(liveMacros.fatG))
                          setManualCarbG(String(liveMacros.carbsG))
                        }
                        setMacroManual(o.v)
                      }}
                      className={`px-3 py-1.5 transition-colors ${macroManual === o.v ? 'bg-gold text-marine font-semibold' : 'bg-white text-marine/60 hover:text-marine'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {macroManual ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Protéines</span>
                    <input type="number" min={0} max={500} step={5} value={manualProteinG} onChange={e => setManualProteinG(e.target.value)} placeholder="150" className={macroInput} />
                    <span className="text-marine/60">g</span>
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Lipides</span>
                    <input type="number" min={0} max={400} step={5} value={manualFatG} onChange={e => setManualFatG(e.target.value)} placeholder="60" className={macroInput} />
                    <span className="text-marine/60">g</span>
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Glucides</span>
                    <input type="number" min={0} max={800} step={5} value={manualCarbG} onChange={e => setManualCarbG(e.target.value)} placeholder="200" className={macroInput} />
                    <span className="text-marine/60">g</span>
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Calories</span>
                    <span className="text-marine/60">
                      calculées{liveMacros ? ` — ${liveMacros.targetKcal.toLocaleString('fr-CA')} kcal / jour` : ' (P×4 + G×4 + L×9)'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Calories</span>
                    <span className="text-marine/60">calculées (métabolisme + rythme)</span>
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Protéines</span>
                    <input type="number" min={0.3} max={2.5} step={0.1} value={proteinPerLb} onChange={e => setProteinPerLb(e.target.value)} className={macroInput} />
                    <span className="text-marine/60">g par lb de masse maigre</span>
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Lipides</span>
                    <span className="text-marine/60">max</span>
                    <input type="number" min={20} max={200} step={5} value={fatMaxG} onChange={e => setFatMaxG(e.target.value)} className={macroInput} />
                    <span className="text-marine/60">g</span>
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Glucides</span>
                    <span className="text-marine/60">le reste des calories cibles</span>
                  </div>
                </div>
              )}

              {/* Résultat en direct */}
              <div className="mt-4 border-t border-cream-dark pt-3">
                <p className="text-[11px] uppercase tracking-wide text-gold-dark font-semibold mb-2">Résultat</p>
                {liveMacros ? (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { l: 'Calories', v: liveMacros.targetKcal, u: 'kcal' },
                      { l: 'Protéines', v: liveMacros.proteinG, u: 'g' },
                      { l: 'Lipides', v: liveMacros.fatG, u: 'g' },
                      { l: 'Glucides', v: liveMacros.carbsG, u: 'g' }
                    ].map(m => (
                      <div key={m.l} className="rounded-md bg-white border border-cream-dark py-2">
                        <p className="text-[10px] uppercase tracking-wide text-marine/40">{m.l}</p>
                        <p className="text-lg font-semibold tabular-nums text-marine leading-tight">{m.v.toLocaleString('fr-CA')}</p>
                        <p className="text-[10px] text-marine/40">{m.u}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-marine/45 text-xs">
                    {macroManual
                      ? 'Indiquez calories, protéines et lipides pour voir le résultat.'
                      : 'Renseignez le % de gras visé, le niveau d’activité et un poids récent (bilan) pour calculer les macros.'}
                  </p>
                )}
              </div>

              {liveMacros && (
                <div className="mt-4 border-t border-cream-dark pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-wide text-gold-dark font-semibold">Par repas</p>
                    <label className="flex items-center gap-2 text-sm text-marine/70">
                      Repas / jour
                      <select
                        value={repasParJour}
                        onChange={e => setRepasParJour(Number(e.target.value))}
                        className="px-2 py-1 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {(() => {
                      const pm = macrosPerMeal(liveMacros, repasParJour)
                      return [
                        { l: 'Calories', v: pm.targetKcal, u: 'kcal' },
                        { l: 'Protéines', v: pm.proteinG, u: 'g' },
                        { l: 'Lipides', v: pm.fatG, u: 'g' },
                        { l: 'Glucides', v: pm.carbsG, u: 'g' }
                      ]
                    })().map(m => (
                      <div key={m.l} className="rounded-md bg-white/70 border border-cream-dark py-2">
                        <p className="text-[10px] uppercase tracking-wide text-marine/40">{m.l}</p>
                        <p className="text-base font-semibold tabular-nums text-marine leading-tight">{m.v.toLocaleString('fr-CA')}</p>
                        <p className="text-[10px] text-marine/40">{m.u}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-marine/40 text-xs mr-1">Propositions :</span>
          {HYDRATION_PRESETS.map(ml => (
            <button
              key={ml}
              type="button"
              onClick={() => setHydratationMl(String(ml))}
              className={`px-2.5 py-1 rounded-full border text-sm transition-colors ${Number(hydratationMl) === ml ? 'border-gold bg-gold/15 text-marine font-semibold' : 'border-gold/40 text-marine/70 hover:border-gold hover:bg-gold/10'}`}
            >
              {(ml / 1000).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} L
            </button>
          ))}
          <button
            type="button"
            onClick={() => hydraSuggestion != null && setHydratationMl(String(hydraSuggestion))}
            disabled={hydraSuggestion == null}
            title={hydraSuggestion == null ? 'Ajoutez un poids dans un bilan pour activer le calcul.' : `≈ 35 ml × ${hydraWeightKg} kg`}
            className="px-2.5 py-1 rounded-full border border-gold/40 text-sm text-marine/70 transition-colors hover:border-gold hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gold/40 disabled:hover:bg-transparent"
          >
            🧮 Calculer d'après le poids
            {hydraSuggestion != null && ` (≈ ${(hydraSuggestion / 1000).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} L)`}
          </button>
        </div>
        <p className="text-marine/40 text-xs mt-1.5">
          Repère courant : environ 30 à 40 ml par kg de poids corporel (≈ 35 ml/kg utilisé pour le calcul).
        </p>
      </Section>

      <Section icon={Pill} title="Suppléments" desc="Recommandations libres, avec le moment de prise.">
        <SupplementChips items={SUPPLEMENTS} current={supplementsNotes} onPick={line => setSupplementsNotes(c => appendLine(c, line))} />
        <textarea
          value={supplementsNotes}
          onChange={e => setSupplementsNotes(e.target.value)}
          rows={5}
          placeholder="Ex. Vitamine D3 + K2 — avec un repas contenant du gras&#10;Créatine 5 g — tous les jours"
          className={`${fieldClass} resize-y`}
        />
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={generateSupplementsPlan}
            disabled={aiBusy !== null || supplementsNotes.trim() === ''}
            title={supplementsNotes.trim() === '' ? 'Ajoutez d’abord des suppléments.' : 'Organiser en horaire avec l’IA'}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-gold/50 text-marine/80 text-sm hover:border-gold hover:bg-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles size={15} className="text-gold-dark" />
            {aiBusy === 'supp' ? 'Génération…' : 'Organiser en horaire (IA)'}
          </button>
          <span className="text-marine/40 text-xs">L’IA classe par moment de prise. Vous pouvez ensuite modifier le texte.</span>
        </div>
      </Section>

      {/* ── Aliments ────────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section icon={Apple} title="À privilégier" desc="Aliments à mettre de l'avant.">
          <SuggestChips items={FOODS_GOOD} current={alimentsPrivilegier} onPick={it => setAlimentsPrivilegier(c => appendLine(c, it))} />
          <textarea
            value={alimentsPrivilegier}
            onChange={e => setAlimentsPrivilegier(e.target.value)}
            rows={5}
            placeholder="Ex. Légumes verts, protéines maigres, légumineuses, fruits entiers, eau."
            className={`${fieldClass} resize-y`}
          />
        </Section>
        <Section icon={Ban} title="À éviter" desc="Aliments à limiter.">
          <SuggestChips items={FOODS_BAD} current={alimentsEviter} onPick={it => setAlimentsEviter(c => appendLine(c, it))} />
          <textarea
            value={alimentsEviter}
            onChange={e => setAlimentsEviter(e.target.value)}
            rows={5}
            placeholder="Ex. Sucres ajoutés, boissons sucrées, aliments ultra-transformés, alcool."
            className={`${fieldClass} resize-y`}
          />
        </Section>
      </div>

      {/* ── Goûts du client (préférences) ───────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section icon={Heart} title="Ce que la personne aime" desc="Préférences personnelles — pris en compte par l'IA du menu.">
          <textarea
            value={alimentsAimes}
            onChange={e => setAlimentsAimes(e.target.value)}
            rows={4}
            placeholder="Ex. Poulet, patate douce, avocat, fromage, café, chocolat noir."
            className={`${fieldClass} resize-y`}
          />
        </Section>
        <Section icon={ThumbsDown} title="Ce que la personne n'aime pas" desc="À exclure des idées de menu (goûts, intolérances).">
          <textarea
            value={alimentsPasAimes}
            onChange={e => setAlimentsPasAimes(e.target.value)}
            rows={4}
            placeholder="Ex. Poisson, brocoli, champignons, lait, tofu."
            className={`${fieldClass} resize-y`}
          />
        </Section>
      </div>

      {/* ── Idées de menu (IA) ──────────────────────────────────────────────── */}
      <Section
        icon={Utensils}
        title="Idées de menu"
        desc="Exemples de journées types selon les macros et les aliments — modifiables."
      >
        <div className="mb-2 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={generateMenuIdeas}
            disabled={aiBusy !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-gold/50 text-marine/80 text-sm hover:border-gold hover:bg-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles size={15} className="text-gold-dark" />
            {aiBusy === 'menu' ? 'Génération…' : 'Générer des idées (IA)'}
          </button>
          {liveMacros && (
            <span className="text-marine/40 text-xs">
              Basé sur ≈ {liveMacros.targetKcal.toLocaleString('fr-CA')} kcal · {liveMacros.proteinG} P / {liveMacros.fatG} L / {liveMacros.carbsG} G
            </span>
          )}
        </div>
        <textarea
          value={nutritionMenu}
          onChange={e => setNutritionMenu(e.target.value)}
          rows={8}
          placeholder="Cliquez « Générer des idées » ou écrivez vos propres exemples de journées (déjeuner, dîner, souper, collations)."
          className={`${fieldClass} resize-y`}
        />
        <p className="text-marine/40 text-xs mt-1.5">
          Idées génériques à titre d’exemple — un plan nutritionnel personnalisé relève d’une nutritionniste.
        </p>
      </Section>

      {aiError && (
        <div className="text-red-700 text-base bg-red-50 border border-red-200 rounded-md px-4 py-3">{aiError}</div>
      )}

      {/* ── Mot de Marie ────────────────────────────────────────────────────── */}
      <Section
        icon={MessageSquareQuote}
        title="Mot de Marie sur la nutrition"
        desc="Court message affiché dans la section nutrition du rapport."
      >
        {nutritionMot.trim() === '' && (
          <div className="mb-2.5">
            <p className="text-marine/40 text-xs mb-1.5">Exemples — cliquez pour partir de là :</p>
            <div className="flex flex-col gap-1.5">
              {MOT_PRESETS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNutritionMot(m)}
                  className="text-left px-3 py-2 rounded-md border border-gold/40 text-marine/70 text-sm hover:border-gold hover:bg-gold/10 transition-colors"
                >
                  « {m} »
                </button>
              ))}
            </div>
          </div>
        )}
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
