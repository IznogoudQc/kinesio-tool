import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Apple, Ban, BookMarked, CalendarClock, Check, ClipboardCopy, ClipboardList, Droplet, ExternalLink, FileInput, Heart, Mail, MessageSquareQuote, Pill, RefreshCw, Save, Sparkles, Target, ThumbsDown, Trash2, Utensils } from 'lucide-react'
import { useClientContext } from '../ClientDetailLayout'
import { clientsService } from '../../../services/clients'
import { reportsService } from '../../../services/reports'
import { bilansService } from '../../../services/bilans'
import {
  consignesPourMoment,
  libelleMoment,
  momentDeJournee,
  parsePrefsRepas,
  prefDe,
  serializePrefsRepas,
  type PrefsRepas
} from '../../../lib/menu-prefs'
import {
  structureJournee,
  remplacerRepas,
  REPAS_POSSIBLES,
  COLLATIONS_POSSIBLES
} from '../../../lib/menu-lines'
import { etiquetteMacro, type MacroMisEnAvant } from '../../../lib/food-macros'
import { cleListe, elementsListe } from '../../../lib/nutrition-lists'
import { importerMenu } from '../../../lib/menu-import'
import { proteinesDeLigne } from '../../../lib/menu-macros'
import { MACROS_PAR_100G, type TableMacros } from '../../../lib/food-macros'
import {
  SUGGESTIONS_PROTEINES,
  SUGGESTIONS_GLUCIDES,
  SUGGESTIONS_LIPIDES,
  SUGGESTIONS_PREF_SEMAINE,
  SUGGESTIONS_PREF_WEEKEND
} from '../../../lib/food-suggestions'
import { aiAdviceService, AIAdviceError, type EstimationRepas } from '../../../services/aiAdvice'
import { nutritionTemplatesService } from '../../../services/nutritionTemplates'
import { SendBilanModal } from '../SendBilanModal'
import {
  ACTIVITY_LABELS,
  ACTIVITY_ORDER,
  RATE_PRESETS,
  DEFAULT_RATE_KG_PER_WEEK,
  DEFAULT_PROTEIN_PER_KG,
  PROTEIN_PER_KG_RANGE,
  DEFAULT_FAT_MAX_G,
  DEFAULT_MEALS_PER_DAY,
  FAT_PCT_OF_KCAL_RANGE,
  DEFAULT_FAT_PCT,
  type FatMode,
  bodyFatGoal,
  dailyDeficitForRate,
  estimateMacros,
  fatGramsRangeForKcal,
  fatPctOfKcal,
  fiberDensityPer1000Kcal,
  macroEnergyShares,
  NET_CARBS_EXPLANATION,
  macrosParPrise,
  DEFAULT_RATIO_COLLATION,
  type ActivityLevel,
  type MacroEstimate
} from '../../../lib/nutrition'
import { manualMacros } from '../../../lib/objectif'
import {
  parseSuppPlan,
  serializeSuppPlan,
  supplementsProteines,
  parseMenuPlan,
  serializeMenuPlan,
  SUPP_MOMENTS,
  type SuppPlan
} from '../../../lib/nutrition-plan'
import { DEFAULT_SUPPLEMENTS, type SupplementItem } from '../../../lib/supplements'
import { DEFAULT_FOODS_GOOD, DEFAULT_FOODS_BAD } from '../../../lib/food-suggestions'
import { settingsService } from '../../../services/settings'
import { buildSynthesisBilan } from '../../../lib/synthesisBilan'
import { computeBilan } from '../../../lib/bilan-computed'
import { computeAge, DEFAULT_NORMS } from '../../../lib/norms'
import { kgToLb, kgToWeightInput, weightInputToKg, weightUnitLabel } from '../../../lib/units'
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

/**
 * Nombre de journées du menu — une semaine complète (demande de Marie).
 *
 * Passé de 2 à 7 : `MenuPlan.jours` acceptait déjà N entrées et le rendu des
 * documents filtre les journées vides, donc seule la saisie était bornée.
 */
const MENU_NB_JOURS = 7

const fieldClass =
  'w-full px-3 py-2 border border-cream-dark rounded-md bg-white text-marine placeholder-marine/30 text-base focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold transition-colors'
const macroInput =
  'w-24 px-2 py-1.5 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold'

/** Part d'une macro dans les calories, à côté de son champ. Rien si incalculable. */
function PartKcal({ pct, alerte = false }: { pct?: number; alerte?: boolean }) {
  if (pct === undefined || !Number.isFinite(pct)) return null
  return (
    <span
      className={`text-xs tabular-nums ${alerte ? 'text-amber-700 font-medium' : 'text-marine/50'}`}
      title={alerte ? `Hors du ${FAT_PCT_OF_KCAL_RANGE.min}-${FAT_PCT_OF_KCAL_RANGE.max} % visé` : undefined}
    >
      {Math.round(pct)} % des kcal
    </span>
  )
}

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

/** Zone de texte qui s'ajuste automatiquement à la hauteur de son contenu :
 *  plus de barre de défilement, quelle que soit la longueur (utile pour les
 *  champs remplis par l'IA). `minRows` fixe la hauteur minimale. */
function AutoTextarea({
  value,
  onChange,
  minRows = 3,
  className,
  placeholder
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  minRows?: number
  className?: string
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={minRows}
      placeholder={placeholder}
      className={className}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  )
}

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

/** Les lignes de repas d'une journée — une par ligne non vide. */
function lignesDeJournee(texte: string): string[] {
  return texte
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

/** « Déjeuner : yogourt… » → « Déjeuner ». Sans deux-points, la ligne entière. */
function nomDuRepas(ligne: string): string {
  const i = ligne.indexOf(':')
  return i === -1 ? ligne.slice(0, 20) : ligne.slice(0, i).trim()
}

/**
 * Contrôle d'une journée : protéines CALCULÉES, le reste ESTIMÉ.
 *
 * Les deux natures de chiffre ne sont pas présentées pareil, et c'est le point
 * de tout le tableau : la colonne P vient d'une multiplication qu'on peut
 * refaire à la main, les trois autres d'un modèle qui devine des portions. Les
 * afficher du même trait laisserait croire qu'ils se valent.
 *
 * ⚠️ Écran de contrôle pour Marie. Rien n'est enregistré, rien ne part dans le
 * document du client : calculer l'apport d'une personne relève de la
 * nutritionniste.
 */
export function ControleJournee({
  jour,
  estimation,
  cibleProteinesJour,
  table
}: {
  jour: string
  estimation?: { repas: EstimationRepas[] }
  cibleProteinesJour?: number
  /** Composition à utiliser — celle ajustée dans les Paramètres. */
  table?: TableMacros
}) {
  const lignes = lignesDeJournee(jour)
  if (lignes.length === 0) return null

  // `l => proteinesDeLigne(l, table)` et non `map(proteinesDeLigne)` : `map`
  // passe l'index en second argument, qui atterrirait dans `table`.
  const calculs = lignes.map(l => proteinesDeLigne(l, table))
  const totalP = calculs.reduce((t, c) => t + c.totalG, 0)
  const est = estimation?.repas ?? []
  const totalKcal = est.reduce((t, e) => t + e.kcal, 0)
  const totalG = est.reduce((t, e) => t + e.glucidesG, 0)
  const totalL = est.reduce((t, e) => t + e.lipidesG, 0)

  const inconnus = calculs.flatMap(c => c.inconnus)
  const hypothese = calculs.some(c => c.hypothese)
  const ecart =
    cibleProteinesJour != null && Math.abs(totalP - cibleProteinesJour) > cibleProteinesJour * 0.15

  return (
    <div className="mt-1.5 rounded-md border border-cream-dark bg-white/40 px-2 py-1.5">
      {/* `pl-2.5` sur chaque colonne chiffrée : sans écart, « Déjeuner » et
          « 54 g » se collaient en « Déjeuner54 g », et le total de la journée
          devenait « 113 g1950 » — illisible. */}
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="text-marine/40">
            <th className="text-left font-normal pb-0.5">Repas</th>
            <th className="text-right font-medium pb-0.5 pl-2.5 text-marine/60">P</th>
            <th className="text-right font-normal pb-0.5 pl-2.5">≈ kcal</th>
            <th className="text-right font-normal pb-0.5 pl-2.5">≈ G</th>
            <th className="text-right font-normal pb-0.5 pl-2.5">≈ L</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, r) => (
            <tr key={r} className="text-marine/55">
              <td className="text-left truncate max-w-[7rem]">{nomDuRepas(ligne)}</td>
              {/* Un repas dont un aliment pesé est inconnu affiche « ? » : sans
                  ça, « 0 g » se lit comme un fait alors que c'est un trou. */}
              <td className="text-right font-medium pl-2.5 text-marine/80">
                {calculs[r].totalG} g
                {calculs[r].inconnus.length > 0 && (
                  <span className="text-amber-700" title="Un aliment pesé est absent de la table">
                    {' '}?
                  </span>
                )}
              </td>
              <td className="text-right pl-2.5">{est[r] ? est[r].kcal : '—'}</td>
              <td className="text-right pl-2.5">{est[r] ? `${est[r].glucidesG} g` : '—'}</td>
              <td className="text-right pl-2.5">{est[r] ? `${est[r].lipidesG} g` : '—'}</td>
            </tr>
          ))}
          <tr className="border-t border-cream-dark text-marine/70">
            <td className="text-left pt-0.5">Journée</td>
            <td className={`text-right font-semibold pt-0.5 pl-2.5 ${ecart ? 'text-amber-700' : ''}`}>
              {totalP} g
            </td>
            <td className="text-right pt-0.5 pl-2.5">{est.length ? totalKcal : '—'}</td>
            <td className="text-right pt-0.5 pl-2.5">{est.length ? `${totalG} g` : '—'}</td>
            <td className="text-right pt-0.5 pl-2.5">{est.length ? `${totalL} g` : '—'}</td>
          </tr>
        </tbody>
      </table>

      {cibleProteinesJour != null && (
        <p className="mt-1 text-marine/40 text-[11px]">
          Cible de protéines : {cibleProteinesJour} g
          {ecart && <span className="text-amber-700"> — écart important</span>}
        </p>
      )}
      {inconnus.length > 0 && (
        <p className="mt-1 text-marine/45 text-[11px]">
          Non compté, aliment absent de la table : {inconnus.join(' · ')}
        </p>
      )}
      {hypothese && (
        <p className="mt-1 text-marine/45 text-[11px]">
          La mesure de supplément est comptée à sa valeur usuelle — vérifiez la dose réelle.
        </p>
      )}
    </div>
  )
}

/** Ajoute `item` en nouvelle ligne (sans doublon, insensible à la casse). */
function appendLine(current: string, item: string): string {
  // `cleListe` et non un simple `toLowerCase` : une virgule de fin laissée par
  // Marie ferait passer « Poulet, » pour un aliment différent de « Poulet », et
  // la proposition s'ajouterait une deuxième fois.
  if (elementsListe(current).some(l => cleListe(l) === cleListe(item))) return current
  return current.trim() ? `${current.replace(/\s+$/, '')}\n${item}` : item
}

/** Rangée de propositions cliquables ; un clic ajoute la ligne (coché si déjà présent). */
/**
 * Propositions cliquables. `macro` affiche en plus la composition indicative de
 * chaque aliment pour 100 g — les protéines dans la colonne des protéines, etc.
 *
 * Omis pour les listes qui ne sont pas des aliments (contraintes de semaine) et
 * pour tout aliment absent de la table : Marie ajoute les siens, et une valeur
 * inventée serait pire que pas de valeur.
 */
export function SuggestChips({
  items,
  current,
  onPick,
  macro,
  table
}: {
  items: string[]
  current: string
  onPick: (item: string) => void
  macro?: MacroMisEnAvant
  /** Composition à afficher — celle ajustée dans les Paramètres. */
  table?: TableMacros
}) {
  const present = new Set(elementsListe(current).map(cleListe))
  return (
    <div className="mb-2.5">
      {/* La base de référence doit être à l'écran : « ≈ 10 g P » ne veut rien
          dire sans elle, et on ne peut pas deviner qu'il s'agit de 100 g.
          Écrite une fois en tête de rangée plutôt que sur chaque pastille. */}
      <p className="text-marine/40 text-xs mb-1.5">
        Propositions{macro && <span> (valeurs pour 100 g d’aliment)</span>} — cliquez pour ajouter :
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(it => {
          const used = present.has(cleListe(it))
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
              {macro && etiquetteMacro(it, macro, table) && (
                <span className="ml-1.5 text-marine/35 tabular-nums">{etiquetteMacro(it, macro, table)}</span>
              )}
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
  // Un supplément est « déjà présent » seulement si une LIGNE commence par son nom
  // (le clic insère « Nom — moment »). Éviter un `includes` global qui marquait à
  // tort « Fer » présent parce que « …calcium/fer » contient « fer ».
  const lines = current.split('\n').map(l => l.trim().toLowerCase())
  const isUsed = (label: string): boolean => {
    const lab = label.toLowerCase()
    return lines.some(l => l === lab || l.startsWith(`${lab} —`) || l.startsWith(`${lab} -`))
  }
  return (
    <div className="mb-2.5">
      <p className="text-marine/40 text-xs mb-1.5">Propositions (avec le moment recommandé) — cliquez pour ajouter :</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(it => {
          const used = isUsed(it.label)
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
  const wUnit = client.unitWeight ?? 'kg'
  // Poids cible saisi dans l'unité du client (kg/lb) ; stocké en kg.
  const [targetWeight, setTargetWeight] = useState(
    client.nutritionTargetWeightKg != null ? String(kgToWeightInput(client.nutritionTargetWeightKg, wUnit)) : ''
  )
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>(client.nutritionActivityLevel ?? '')
  const [rateKgPerWeek, setRateKgPerWeek] = useState<number>(client.nutritionRateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK)
  const [proteinPerKgInput, setProteinPerKgInput] = useState<string>(
    String(client.nutritionProteinPerKg ?? DEFAULT_PROTEIN_PER_KG)
  )
  const [fatMaxG, setFatMaxG] = useState<string>(String(client.nutritionFatMaxG ?? DEFAULT_FAT_MAX_G))
  // Base des lipides : plafond en g (historique, défaut) ou % des calories.
  const [fatMode, setFatMode] = useState<FatMode>(client.nutritionFatMode === 'pct' ? 'pct' : 'g')
  const [fatPctInput, setFatPctInput] = useState<string>(
    client.nutritionFatPct != null ? String(client.nutritionFatPct) : String(DEFAULT_FAT_PCT)
  )
  // Mode des macros : `false` = calculées par la formule (auto) ; `true` = Marie tape
  // les grammes (protéines/lipides/glucides) et les calories se déduisent.
  const [macroManual, setMacroManual] = useState(client.nutritionMacroManual ?? false)
  const [manualProteinG, setManualProteinG] = useState<string>(
    client.nutritionManualProteinG != null ? String(client.nutritionManualProteinG) : ''
  )
  const [manualFatG, setManualFatG] = useState<string>(
    client.nutritionManualFatG != null ? String(client.nutritionManualFatG) : ''
  )
  const [manualFiberG, setManualFiberG] = useState<string>(
    client.nutritionManualFiberG != null ? String(client.nutritionManualFiberG) : ''
  )
  const [manualCarbG, setManualCarbG] = useState<string>(
    client.nutritionManualCarbG != null ? String(client.nutritionManualCarbG) : ''
  )
  const [repasParJour, setRepasParJour] = useState<number>(client.nutritionRepasParJour ?? DEFAULT_MEALS_PER_DAY)
  const [collationsParJour, setCollationsParJour] = useState<number>(client.nutritionCollationsParJour ?? 1)
  const [ratioCollation, setRatioCollation] = useState<number>(
    client.nutritionRatioCollation ?? DEFAULT_RATIO_COLLATION
  )
  /** Les lignes d'une journée — une seule source pour l'IA, les boutons et le
   *  remplacement de ligne. */
  const structure = structureJournee(repasParJour, collationsParJour)
  const [prefsRepas, setPrefsRepas] = useState<PrefsRepas>(() => parsePrefsRepas(client.nutritionPrefsRepas))
  /** Onglet ouvert dans « Préférences par repas ». Suit la structure : si Marie
   *  retire une collation, l'onglet actif ne doit pas rester sur un repas absent. */
  const [ongletPref, setOngletPref] = useState(0)
  const repasActif = structure[Math.min(ongletPref, structure.length - 1)] ?? structure[0]

  function setPref(repas: string, moment: 'semaine' | 'weekend', v: string) {
    setPrefsRepas(p => ({ ...p, [repas]: { ...prefDe(p, repas), [moment]: v } }))
  }

  // ── Planning de jeûne flexible ────────────────────────────────────────────────
  const [programs, setPrograms] = useState<FastingProgram[]>(() => parseInitialPrograms(client.jeunePlanning))

  // ── Hydratation & suppléments ────────────────────────────────────────────────
  const [hydratationMl, setHydratationMl] = useState(
    client.hydratationMlParJour != null ? String(client.hydratationMlParJour) : ''
  )
  // Suppléments : plan structuré (liste brute `input` + un champ par moment de prise).
  const [supp, setSupp] = useState<SuppPlan>(() => parseSuppPlan(client.supplementsNotes))
  const setSuppField = (k: keyof SuppPlan, v: string) => setSupp(s => ({ ...s, [k]: v }))

  // ── Aliments & mot de Marie ──────────────────────────────────────────────────
  const [alimentsPrivilegier, setAlimentsPrivilegier] = useState(client.alimentsPrivilegier ?? '')
  const [alimentsEviter, setAlimentsEviter] = useState(client.alimentsEviter ?? '')
  const [alimentsAimes, setAlimentsAimes] = useState(client.alimentsAimes ?? '')
  const [alimentsProteines, setAlimentsProteines] = useState(client.alimentsProteines ?? '')
  const [alimentsGlucides, setAlimentsGlucides] = useState(client.alimentsGlucides ?? '')
  const [alimentsLipides, setAlimentsLipides] = useState(client.alimentsLipides ?? '')
  const [alimentsPasAimes, setAlimentsPasAimes] = useState(client.alimentsPasAimes ?? '')
  const [nutritionMot, setNutritionMot] = useState(client.nutritionMot ?? '')
  // Menu : une semaine complète, chaque journée un champ texte (repas + total).
  // Passé de 2 à 7 journées à la demande de Marie. `MenuPlan.jours` acceptait
  // déjà N entrées et le rendu des documents filtre les vides : seule la
  // saisie était bornée.
  const [menuJours, setMenuJours] = useState<string[]>(() => {
    const m = parseMenuPlan(client.nutritionMenu)
    if (m) return Array.from({ length: MENU_NB_JOURS }, (_, i) => m.jours[i] ?? '')
    // Rétro-compat : ancien texte libre → placé dans la journée 1 (régénérable).
    return Array.from({ length: MENU_NB_JOURS }, (_, i) => (i === 0 ? client.nutritionMenu ?? '' : ''))
  })
  const setMenuJour = (i: number, v: string) => {
    // Toute modification périme l'ESTIMATION : un chiffre à côté d'un texte
    // qu'il ne décrit plus est pire que pas de chiffre. Les colonnes estimées
    // repassent donc à « — » jusqu'à une nouvelle vérification.
    //
    // Le tableau, lui, reste affiché : les protéines sont recalculées à chaque
    // frappe et suivent le texte sans jamais se périmer.
    setEstimations(null)
    setMenuJours(js => js.map((j, k) => (k === i ? v : j)))
  }

  // Bibliothèques proposées (suppléments, aliments) — GLOBALES, chargées depuis
  // les réglages en lecture seule ici ; leur ÉDITION vit dans Paramètres → Nutrition.
  const [suppLibrary, setSuppLibrary] = useState<SupplementItem[]>(DEFAULT_SUPPLEMENTS)
  const [foodsGoodLib, setFoodsGoodLib] = useState<string[]>(DEFAULT_FOODS_GOOD)
  const [foodsBadLib, setFoodsBadLib] = useState<string[]>(DEFAULT_FOODS_BAD)
  const [libProteines, setLibProteines] = useState<string[]>(SUGGESTIONS_PROTEINES)
  const [libGlucides, setLibGlucides] = useState<string[]>(SUGGESTIONS_GLUCIDES)
  const [libLipides, setLibLipides] = useState<string[]>(SUGGESTIONS_LIPIDES)
  const [libPrefSemaine, setLibPrefSemaine] = useState<string[]>(SUGGESTIONS_PREF_SEMAINE)
  const [libPrefWeekend, setLibPrefWeekend] = useState<string[]>(SUGGESTIONS_PREF_WEEKEND)
  /**
   * Composition des aliments, ajustable dans les Paramètres.
   *
   * `MACROS_PAR_100G` sert de valeur initiale : les pastilles affichent tout de
   * suite une teneur plausible plutôt que de rester muettes le temps du
   * chargement, et le calcul des protéines ne repart pas de zéro.
   */
  const [tableMacros, setTableMacros] = useState<TableMacros>(MACROS_PAR_100G)
  useEffect(() => {
    settingsService.getFoodMacros().then(setTableMacros).catch(() => {})
    settingsService.getSupplements().then(setSuppLibrary).catch(() => {})
    settingsService.getFoodList('good').then(setFoodsGoodLib).catch(() => {})
    settingsService.getFoodList('bad').then(setFoodsBadLib).catch(() => {})
    // Les trois palettes par macronutriment sont éditables dans les Paramètres :
    // les constantes ne servent plus que de valeur initiale avant chargement.
    settingsService.getFoodList('proteines').then(setLibProteines).catch(() => {})
    settingsService.getFoodList('glucides').then(setLibGlucides).catch(() => {})
    settingsService.getFoodList('lipides').then(setLibLipides).catch(() => {})
    settingsService.getFoodList('pref_semaine').then(setLibPrefSemaine).catch(() => {})
    settingsService.getFoodList('pref_weekend').then(setLibPrefWeekend).catch(() => {})
  }, [])

  // Génération IA (plan de suppléments / idées de menu).
  const [aiBusy, setAiBusy] = useState<'supp' | 'menu' | null>(null)
  /** Reprise partielle en cours : « 2 » pour la journée 2, « 2:Souper » pour un
   *  repas. Un seul identifiant plutôt que deux états — il ne peut y en avoir
   *  qu'une à la fois, et le bouton concerné doit être le seul à réagir. */
  const [reprise, setReprise] = useState<string | null>(null)
  /** Deuxième clic pour effacer les sept journées. Une confirmation en place du
   *  bouton plutôt qu'une fenêtre système : sept journées, dont les retouches de
   *  Marie, ne se perdent pas sur un clic mal placé. */
  const [confirmeEffacer, setConfirmeEffacer] = useState(false)
  /** Nom du fichier demandé dans le prompt copié — rappelé à l'écran un moment. */
  const [promptCopie, setPromptCopie] = useState<string | null>(null)
  const [importOuvert, setImportOuvert] = useState(false)
  const [importTexte, setImportTexte] = useState('')
  const [importSource, setImportSource] = useState<string | null>(null)
  const [importErreur, setImportErreur] = useState<string | null>(null)
  const [importAvis, setImportAvis] = useState<string[]>([])
  /**
   * Protéines estimées par journée — outil de contrôle pour Marie.
   *
   * Volontairement dans l'état React, jamais en base et jamais dans le document
   * du client : ce sont des estimations d'un modèle, et le calcul nutritionnel
   * relève de la nutritionniste. Effacées dès qu'une journée change, pour ne
   * jamais afficher un chiffre à côté d'un texte qu'il ne décrit plus.
   */
  /**
   * Estimations de l'IA, par journée puis par repas — calories, glucides,
   * lipides. Les protéines ne sont PAS ici : elles se calculent à la volée
   * depuis le texte du menu, et n'ont donc rien à mémoriser.
   */
  const [estimations, setEstimations] = useState<{ repas: EstimationRepas[] }[] | null>(null)
  /**
   * Le tableau de contrôle est-il visible.
   *
   * Séparé de `estimations` pour que les protéines — calculées, donc immédiates
   * — s'affichent dès le clic, sans attendre l'aller-retour avec l'IA.
   */
  const [controleAffiche, setControleAffiche] = useState(false)
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
        nutritionManualCarbG: manualCarbG.trim() !== '' ? Number(manualCarbG) : null,
        nutritionManualFiberG: manualFiberG.trim() !== '' ? Number(manualFiberG) : null
      })
    }
    const data = latestData
    const weightKg = data && typeof data.poids_kg === 'number' ? data.poids_kg : null
    const target = targetBodyFat.trim() !== '' ? Number(targetBodyFat) : null
    if (!data || weightKg == null || target == null || activityLevel === '') return null
    const computed = computeBilan(data, { age, sex: client.sex, norms: DEFAULT_NORMS })
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
      proteinPerKg: proteinPerKgInput.trim() !== '' ? Number(proteinPerKgInput) : null,
      fatMaxG: fatMaxG.trim() !== '' ? Number(fatMaxG) : null,
      fatMode,
      fatPct: fatPctInput.trim() !== '' ? Number(fatPctInput) : null,
      targetKcalOverride: null
    })
  }, [nutritionEnabled, macroManual, manualProteinG, manualFatG, manualCarbG, manualFiberG, latestData, targetBodyFat, activityLevel, age, client.sex, rateKgPerWeek, proteinPerKgInput, fatMaxG, fatMode, fatPctInput])
  /** Cibles par prise — un repas vaut 1 part, une collation `ratioCollation` %.
   *  Une seule source : la carte « Par repas » et le prompt de l'IA la lisent. */
  const cibles = liveMacros ? macrosParPrise(liveMacros, repasParJour, collationsParJour, ratioCollation) : null

  // Hydratation recommandée ≈ 35 ml/kg (milieu de la fourchette 30–40), arrondie à 100 ml.
  /** Poids du dernier bilan : ce que le facteur protéique multiplie, et la base
   *  de la suggestion d'hydratation. */
  const poidsActuelKg = latestData && typeof latestData.poids_kg === 'number' ? latestData.poids_kg : null

  // Part de chaque macro dans les calories, affichée à côté des champs saisis.
  const manualParts = liveMacros ? macroEnergyShares(liveMacros) : null

  // Part des calories venant des lipides, contrôlée contre le repère 30-40 %.
  const fatPct = liveMacros ? fatPctOfKcal(liveMacros.fatG, liveMacros.targetKcal) : null
  const fatGRange = liveMacros ? fatGramsRangeForKcal(liveMacros.targetKcal) : null
  const fatPctHorsFourchette =
    fatPct !== null && (fatPct < FAT_PCT_OF_KCAL_RANGE.min || fatPct > FAT_PCT_OF_KCAL_RANGE.max)
  const hydraSuggestion = poidsActuelKg != null ? Math.round((poidsActuelKg * 35) / 100) * 100 : null

  /** Valide + enregistre. Retourne `true` si la sauvegarde a réussi. */
  async function persist(): Promise<boolean> {
    setError(null)

    const targetPct = targetBodyFat.trim() !== '' ? Number(targetBodyFat) : null
    if (nutritionEnabled && targetPct !== null && (!Number.isFinite(targetPct) || targetPct < 3 || targetPct > 60)) {
      setError('Le % de gras visé doit être compris entre 3 et 60.')
      return false
    }
    // Poids cible (saisi en unité client) → kg. Bornes larges (kg).
    const targetWeightInput = targetWeight.trim() !== '' ? Number(targetWeight) : null
    if (nutritionEnabled && targetWeightInput !== null && !Number.isFinite(targetWeightInput)) {
      setError('Le poids cible doit être un nombre.')
      return false
    }
    const targetWeightKg =
      nutritionEnabled && targetWeightInput !== null ? weightInputToKg(targetWeightInput, wUnit) : null
    const proteinVal = proteinPerKgInput.trim() !== '' ? Number(proteinPerKgInput) : null
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
    // Fibres : facultatives même en manuel — vides, elles retombent sur 14 g / 1000 kcal.
    const fiberGVal = macroOn && manualFiberG.trim() !== '' ? Number(manualFiberG) : null
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
    if (fiberGVal !== null && (!Number.isFinite(fiberGVal) || fiberGVal < 0 || fiberGVal > 200)) {
      setError('Les fibres (g) doivent être comprises entre 0 et 200.')
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
        nutritionTargetWeightKg: targetWeightKg,
        nutritionActivityLevel: nutritionEnabled && activityLevel !== '' ? activityLevel : null,
        nutritionRateKgPerWeek: nutritionEnabled ? rateKgPerWeek : null,
        nutritionProteinPerKg: nutritionEnabled ? proteinVal : null,
        nutritionFatMaxG: nutritionEnabled ? fatVal : null,
        nutritionFatMode: nutritionEnabled ? fatMode : null,
        nutritionFatPct: nutritionEnabled && fatPctInput.trim() !== '' ? Number(fatPctInput) : null,
        nutritionMacroManual: macroOn,
        // Calories déduites des grammes en mode manuel ; `null` en auto.
        nutritionTargetKcal: macroOn && liveMacros ? liveMacros.targetKcal : null,
        nutritionManualProteinG: protGVal,
        nutritionManualFatG: fatGVal,
        nutritionManualCarbG: carbGVal,
        nutritionManualFiberG: fiberGVal,
        nutritionRepasParJour: nutritionEnabled ? repasParJour : null,
        nutritionCollationsParJour: nutritionEnabled ? collationsParJour : null,
        nutritionRatioCollation: nutritionEnabled ? ratioCollation : null,
        nutritionPrefsRepas: serializePrefsRepas(prefsRepas),
        // Ancien modèle de jeûne (type unique + fenêtre) remplacé par le planning.
        jeuneType: null,
        jeuneFenetreDebut: null,
        jeuneFenetreFin: null,
        jeuneNotes: null,
        jeunePlanning: programs.length > 0 ? JSON.stringify(programs) : null,
        hydratationMlParJour: mlVal,
        supplementsNotes: serializeSuppPlan(supp),
        alimentsPrivilegier: alimentsPrivilegier.trim() || null,
        alimentsEviter: alimentsEviter.trim() || null,
        nutritionMot: nutritionMot.trim() || null,
        nutritionMenu: serializeMenuPlan(menuJours),
        alimentsAimes: alimentsAimes.trim() || null,
        alimentsProteines: alimentsProteines.trim() || null,
        alimentsGlucides: alimentsGlucides.trim() || null,
        alimentsLipides: alimentsLipides.trim() || null,
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

  /** IA : répartit les suppléments saisis dans les 5 moments + interactions (éditable). */
  async function generateSupplementsPlan() {
    setAiError(null)
    setAiBusy('supp')
    try {
      const plan = await aiAdviceService.generateSupplementsPlan(supp.input)
      const join = (a: string[]) => a.join('\n')
      setSupp(s => ({
        ...s,
        reveil: join(plan.reveil),
        dejeuner: join(plan.dejeuner),
        apresEntrainement: join(plan.apresEntrainement),
        souper: join(plan.souper),
        coucher: join(plan.coucher),
        interactions: join(plan.interactions)
      }))
    } catch (err) {
      setAiError(aiErrorMessage(err))
    } finally {
      setAiBusy(null)
    }
  }

  /** Une cible de prise, en une ligne lisible par le modèle. */
  function resumeCible(m: MacroEstimate): string {
    return `${m.targetKcal} kcal, ${m.proteinG} g de protéines, ${m.fatG} g de lipides, ${m.carbsG} g de glucides nets`
  }

  /** Cibles et préférences — identiques pour la semaine, une journée ou un repas. */
  function contexteMenu() {
    return {
      kcal: liveMacros?.targetKcal ?? null,
      proteinG: liveMacros?.proteinG ?? null,
      fatG: liveMacros?.fatG ?? null,
      carbsG: liveMacros?.carbsG ?? null,
      fiberG: liveMacros?.fiberG ?? null,
      foodsGood: alimentsPrivilegier,
      foodsBad: alimentsEviter,
      foodsLiked: alimentsAimes,
      foodsDisliked: alimentsPasAimes,
      proteinFoods: alimentsProteines,
      carbFoods: alimentsGlucides,
      fatFoods: alimentsLipides,
      structure,
      // SEULS les suppléments protéinés : une whey compte dans la cible de
      // protéines, une vitamine D n'a rien à faire dans la ligne d'un souper.
      supplements: supplementsProteines(supp),
      cibleRepas: cibles ? resumeCible(cibles.repas) : undefined,
      cibleCollation: cibles?.collation ? resumeCible(cibles.collation) : undefined,
      consignesSemaine: consignesPourMoment(prefsRepas, structure, 'semaine'),
      consignesWeekend: consignesPourMoment(prefsRepas, structure, 'weekend')
    }
  }

  /** IA : refait UNE journée, sans toucher aux six autres. */
  async function regenerateDay(i: number) {
    setAiError(null)
    setReprise(String(i))
    try {
      const plan = await aiAdviceService.regenerateMenuDay({
        ...contexteMenu(),
        moment: momentDeJournee(i),
        autresJournees: menuJours.filter((_, j) => j !== i)
      })
      if (plan.lignes.length) setMenuJour(i, plan.lignes.join('\n\n'))
    } catch (err) {
      setAiError(aiErrorMessage(err))
    } finally {
      setReprise(null)
    }
  }

  /** IA : refait UN repas. Le reste de la journée est conservé tel quel — y
   *  compris ce que Marie y a écrit à la main. */
  async function regenerateMeal(i: number, repas: string) {
    setAiError(null)
    setReprise(`${i}:${repas}`)
    try {
      const plan = await aiAdviceService.regenerateMenuMeal({
        ...contexteMenu(),
        moment: momentDeJournee(i),
        journee: menuJours[i] ?? '',
        repas
      })
      if (plan.ligne.trim()) setMenuJour(i, remplacerRepas(menuJours[i] ?? '', repas, plan.ligne, structure))
    } catch (err) {
      setAiError(aiErrorMessage(err))
    } finally {
      setReprise(null)
    }
  }

  /**
   * IA : estime calories, glucides et lipides de chaque repas, pour contrôle.
   *
   * Les protéines ne passent pas par là — elles sont calculées depuis les poids
   * écrits, ce qui donne un chiffre stable et recoupable.
   *
   * Le résultat reste en mémoire : il n'est ni enregistré ni transmis au
   * document du client. Voir `estimations`.
   */
  async function verifierMacros() {
    setAiError(null)
    setControleAffiche(true)
    setReprise('verif')
    try {
      const r = await aiAdviceService.verifierMacros(menuJours)
      setEstimations(r.journees)
    } catch (err) {
      setAiError(aiErrorMessage(err))
    } finally {
      setReprise(null)
    }
  }

  /**
   * Copie la consigne au presse-papiers, sans rien générer.
   *
   * Pour essayer la même demande ailleurs et comparer sur pièce. Le texte est
   * construit dans le processus principal, à partir des mêmes constantes que
   * l'appel réel : ce qui est collé est ce que l'app envoie.
   */
  async function copierPrompt() {
    setAiError(null)
    try {
      const fichier = await aiAdviceService.copyMenuPrompt(contexteMenu(), client.name)
      setPromptCopie(fichier)
      window.setTimeout(() => setPromptCopie(null), 8000)
    } catch (err) {
      setAiError(aiErrorMessage(err))
    }
  }

  /** Ouvre le dialogue d'import, remis à zéro. */
  function ouvrirImport() {
    setImportTexte('')
    setImportSource(null)
    setImportErreur(null)
    setImportAvis([])
    setImportOuvert(true)
  }

  /** Charge un fichier dans la zone de texte — la relecture reste la même. */
  async function chargerFichierMenu() {
    setImportErreur(null)
    const lu = await window.api.ai.readMenuFile()
    if (!lu) return
    setImportTexte(lu.texte)
    setImportSource(lu.fileName)
  }

  /**
   * Relit le menu collé ou chargé et remplace les sept journées.
   *
   * Rien n'est écrit tant que la relecture n'a pas abouti : un texte illisible
   * laisse le menu existant intact.
   */
  function validerImport() {
    const res = importerMenu(importTexte, MENU_NB_JOURS, structure.length)
    if (!res.ok) {
      setImportErreur(res.erreur)
      return
    }
    setMenuJours(res.menu.journees)
    setImportAvis(res.menu.avertissements)
    setImportOuvert(false)
  }

  /** IA : idées de menu (une semaine) selon les macros + aliments. */
  async function generateMenuIdeas() {
    setAiError(null)
    setAiBusy('menu')
    try {
      const plan = await aiAdviceService.generateMenuPlan(contexteMenu())
      // Ligne vide entre chaque repas → séparation visuelle lisible dans le champ.
      // (Le document filtre les lignes vides : PDF inchangé.)
      const days = plan.journees.map(j => j.lignes.join('\n\n'))
      setMenuJours(Array.from({ length: MENU_NB_JOURS }, (_, i) => days[i] ?? ''))
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
      nutritionProteinPerKg: proteinPerKgInput.trim() !== '' ? Number(proteinPerKgInput) : null,
      nutritionFatMaxG: fatMaxG.trim() !== '' ? Number(fatMaxG) : null,
      nutritionFatMode: fatMode,
      nutritionFatPct: fatPctInput.trim() !== '' ? Number(fatPctInput) : null,
      nutritionMacroManual: macroManual,
      nutritionManualProteinG: manualProteinG.trim() !== '' ? Number(manualProteinG) : null,
      nutritionManualFatG: manualFatG.trim() !== '' ? Number(manualFatG) : null,
      nutritionManualCarbG: manualCarbG.trim() !== '' ? Number(manualCarbG) : null,
      nutritionManualFiberG: manualFiberG.trim() !== '' ? Number(manualFiberG) : null,
      nutritionRepasParJour: repasParJour,
      nutritionCollationsParJour: collationsParJour,
      nutritionRatioCollation: ratioCollation,
      nutritionPrefsRepas: serializePrefsRepas(prefsRepas),
      jeunePlanning: programs,
      hydratationMlParJour: hydratationMl.trim() !== '' ? Number(hydratationMl) : null,
      supplementsNotes: serializeSuppPlan(supp),
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
    if ('nutritionProteinPerKg' in d)
      setProteinPerKgInput(
        num(d.nutritionProteinPerKg) != null ? String(d.nutritionProteinPerKg) : String(DEFAULT_PROTEIN_PER_KG)
      )
    if ('nutritionFatMaxG' in d) setFatMaxG(num(d.nutritionFatMaxG) != null ? String(d.nutritionFatMaxG) : String(DEFAULT_FAT_MAX_G))
    if ('nutritionFatMode' in d) setFatMode(d.nutritionFatMode === 'pct' ? 'pct' : 'g')
    if ('nutritionFatPct' in d) setFatPctInput(num(d.nutritionFatPct) != null ? String(d.nutritionFatPct) : String(DEFAULT_FAT_PCT))
    if ('nutritionMacroManual' in d) setMacroManual(!!d.nutritionMacroManual)
    if ('nutritionManualProteinG' in d) setManualProteinG(num(d.nutritionManualProteinG) != null ? String(d.nutritionManualProteinG) : '')
    if ('nutritionManualFatG' in d) setManualFatG(num(d.nutritionManualFatG) != null ? String(d.nutritionManualFatG) : '')
    if ('nutritionManualCarbG' in d) setManualCarbG(num(d.nutritionManualCarbG) != null ? String(d.nutritionManualCarbG) : '')
    if ('nutritionManualFiberG' in d) setManualFiberG(num(d.nutritionManualFiberG) != null ? String(d.nutritionManualFiberG) : '')
    if (num(d.nutritionRepasParJour) != null) setRepasParJour(Number(d.nutritionRepasParJour))
    if (Array.isArray(d.jeunePlanning)) setPrograms(d.jeunePlanning as FastingProgram[])
    if ('hydratationMlParJour' in d) setHydratationMl(num(d.hydratationMlParJour) != null ? String(d.hydratationMlParJour) : '')
    if ('supplementsNotes' in d) setSupp(parseSuppPlan(str(d.supplementsNotes)))
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
    <div className="p-6 lg:p-8 pb-28 max-w-7xl space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-marine font-semibold text-2xl">Nutrition</h1>
          <p className="text-marine/50 text-base mt-1">
            Ces réglages composent le document nutrition remis à {client.name.split(' ')[0]}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex flex-wrap gap-6">
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
                <label className="block text-sm font-medium text-marine mb-1">Poids cible (facultatif)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={targetWeight}
                    onChange={e => setTargetWeight(e.target.value)}
                    placeholder={wUnit === 'lb' ? '175' : '80'}
                    className={`w-28 ${fieldClass}`}
                  />
                  <span className="text-marine/50 text-base">{weightUnitLabel(wUnit)}</span>
                </div>
                <p className="text-marine/40 text-xs mt-1">Colore la variation de poids (perte vs gain) selon le sens visé.</p>
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
                    <PartKcal pct={manualParts?.protein} />
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Lipides</span>
                    <input type="number" min={0} max={400} step={5} value={manualFatG} onChange={e => setManualFatG(e.target.value)} placeholder="60" className={macroInput} />
                    <span className="text-marine/60">g</span>
                    {/* Même repère 30-40 % qu'en mode automatique. */}
                    <PartKcal
                      pct={manualParts?.fat}
                      alerte={
                        manualParts != null &&
                        (manualParts.fat < FAT_PCT_OF_KCAL_RANGE.min || manualParts.fat > FAT_PCT_OF_KCAL_RANGE.max)
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Glucides nets</span>
                    <input type="number" min={0} max={800} step={5} value={manualCarbG} onChange={e => setManualCarbG(e.target.value)} placeholder="200" className={macroInput} />
                    <span className="text-marine/60">g</span>
                    <PartKcal pct={manualParts?.carbs} />
                  </div>
                  {/* Les fibres ne dépendent pas des trois autres macros : laissé
                      vide, le champ retombe sur la règle des 14 g / 1000 kcal. */}
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Fibres</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      step={1}
                      value={manualFiberG}
                      onChange={e => setManualFiberG(e.target.value)}
                      placeholder={liveMacros ? String(liveMacros.fiberG) : "30"}
                      className={macroInput}
                    />
                    <span className="text-marine/60">
                      g<span className="text-marine/40"> · vide = calcul auto (14 g / 1000 kcal)</span>
                    </span>
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
                    <input
                      type="number"
                      min={0.5}
                      max={2.5}
                      step={0.1}
                      value={proteinPerKgInput}
                      onChange={e => setProteinPerKgInput(e.target.value)}
                      className={macroInput}
                    />
                    <span className="text-marine/60">
                      g par kg de poids corporel
                      {/* Le poids multiplié et le total, affichés : sans eux le
                          résultat en grammes tombe du ciel et rien ne permet de
                          le vérifier. Poids = dernier bilan. */}
                      {poidsActuelKg !== null && (
                        <span className="text-marine/70">
                          {' × '}
                          <strong className="font-semibold">
                            {poidsActuelKg.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} kg
                          </strong>
                          {liveMacros && (
                            <>
                              {' = '}
                              <strong className="font-semibold">{liveMacros.proteinG} g</strong>
                            </>
                          )}
                        </span>
                      )}
                      <span className="text-marine/40"> · usuel {PROTEIN_PER_KG_RANGE.min} à {PROTEIN_PER_KG_RANGE.usual}, jusqu’à {PROTEIN_PER_KG_RANGE.max}</span>
                    </span>
                  </div>
                  {/* Lipides : deux bases au choix. Le plafond en grammes est
                      l'historique ; le % des calories suit le repère 30-40 % du
                      Guide du conseiller et s'adapte seul quand les calories
                      bougent — un plafond fixe, lui, sort de la fourchette. */}
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Lipides</span>
                    <div className="flex rounded-md border border-cream-dark overflow-hidden text-xs">
                      {([
                        { v: 'g', label: 'max g' },
                        { v: 'pct', label: '% des kcal' }
                      ] as const).map(o => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => {
                            // Bascule sans rupture : on part de la valeur équivalente
                            // à ce qui est déjà affiché, pas d'un défaut arbitraire.
                            if (o.v === 'pct' && fatMode === 'g' && fatPct !== null) {
                              setFatPctInput(String(Math.round(fatPct)))
                            } else if (o.v === 'g' && fatMode === 'pct' && liveMacros) {
                              setFatMaxG(String(liveMacros.fatG))
                            }
                            setFatMode(o.v)
                          }}
                          className={`px-2 py-1 transition-colors ${fatMode === o.v ? 'bg-gold text-marine font-semibold' : 'bg-white text-marine/60 hover:text-marine'}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {fatMode === 'pct' ? (
                      <>
                        <input
                          type="number"
                          min={FAT_PCT_OF_KCAL_RANGE.min}
                          max={FAT_PCT_OF_KCAL_RANGE.max}
                          step={1}
                          value={fatPctInput}
                          onChange={e => setFatPctInput(e.target.value)}
                          placeholder={String(DEFAULT_FAT_PCT)}
                          className={macroInput}
                        />
                        <span className="text-marine/60">
                          % des calories
                          {liveMacros && (
                            <>
                              {' = '}
                              <strong className="font-semibold text-marine">{liveMacros.fatG} g</strong>
                            </>
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <input type="number" min={20} max={200} step={5} value={fatMaxG} onChange={e => setFatMaxG(e.target.value)} className={macroInput} />
                        <span className="text-marine/60">g</span>
                        {fatPct !== null && (
                          <span className={fatPctHorsFourchette ? 'text-amber-700 font-medium' : 'text-marine/60'}>
                            = {Math.round(fatPct)} % des calories
                            {fatPctHorsFourchette && fatGRange && (
                              <span className="font-normal">
                                {' '}— hors du {FAT_PCT_OF_KCAL_RANGE.min}-{FAT_PCT_OF_KCAL_RANGE.max} % visé
                                {' ('}
                                {fatGRange.min} à {fatGRange.max} g ici{')'}
                              </span>
                            )}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-marine text-sm">
                    <span className="w-20">Glucides nets</span>
                    <span className="text-marine/60">le reste des calories cibles</span>
                  </div>
                </div>
              )}

              {/* Définition des glucides nets — la notion n'est pas évidente et
                  le chiffre affiché n'est pas celui d'une étiquette nutritionnelle. */}
              <p className="mt-3 text-xs leading-relaxed text-marine/55 bg-white/60 border border-cream-dark rounded-md p-3">
                {NET_CARBS_EXPLANATION}
                <span className="block mt-1.5 text-marine/70">
                  La cible de fibres est une cible <strong className="font-semibold">à part</strong> : elle ne s’ajoute
                  pas aux glucides nets pour reconstituer un total.
                </span>
              </p>

              {/* Résultat en direct */}
              <div className="mt-4 border-t border-cream-dark pt-3">
                <p className="text-[11px] uppercase tracking-wide text-gold-dark font-semibold mb-2">Résultat</p>
                {liveMacros ? (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                    {(() => {
                      // Part de chaque macro dans les calories. Rien pour les
                      // calories (c'est la base) ni de % pour les fibres — elles
                      // sont déjà dans les glucides ; on montre leur densité,
                      // qui se compare directement à la règle des 14 g / 1000 kcal.
                      const parts = macroEnergyShares(liveMacros)
                      const densite = fiberDensityPer1000Kcal(liveMacros.fiberG, liveMacros.targetKcal)
                      const pc = (n: number | undefined) => (n === undefined ? null : `${Math.round(n)} % des kcal`)
                      return [
                        { l: 'Calories', v: liveMacros.targetKcal, u: 'kcal', sous: null, alerte: false },
                        { l: 'Protéines', v: liveMacros.proteinG, u: 'g', sous: pc(parts?.protein), alerte: false },
                        {
                          l: 'Lipides',
                          v: liveMacros.fatG,
                          u: 'g',
                          sous: pc(parts?.fat),
                          // Même repère 30-40 % qu'au réglage : utile surtout en
                          // mode manuel, où aucun contrôle ne l'affichait.
                          alerte:
                            parts != null &&
                            (parts.fat < FAT_PCT_OF_KCAL_RANGE.min || parts.fat > FAT_PCT_OF_KCAL_RANGE.max)
                        },
                        { l: 'Glucides nets', v: liveMacros.carbsG, u: 'g', sous: pc(parts?.carbs), alerte: false },
                        {
                          l: 'Fibres',
                          v: liveMacros.fiberG,
                          u: 'g',
                          sous: densite === null ? null : `${Math.round(densite)} g / 1000 kcal`,
                          alerte: false
                        }
                      ]
                    })().map(m => (
                      <div key={m.l} className="rounded-md bg-white border border-cream-dark py-2">
                        <p className="text-[10px] uppercase tracking-wide text-marine/40">{m.l}</p>
                        <p className="text-lg font-semibold tabular-nums text-marine leading-tight">{m.v.toLocaleString('fr-CA')}</p>
                        <p className="text-[10px] text-marine/40">{m.u}</p>
                        {m.sous && (
                          <p
                            className={`text-[10px] tabular-nums mt-0.5 ${m.alerte ? 'text-amber-700 font-medium' : 'text-marine/55'}`}
                            title={m.alerte ? `Hors du ${FAT_PCT_OF_KCAL_RANGE.min}-${FAT_PCT_OF_KCAL_RANGE.max} % visé` : undefined}
                          >
                            {m.sous}
                          </p>
                        )}
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
                    <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-sm text-marine/70">
                      Repas / jour
                      <select
                        value={repasParJour}
                        onChange={e => setRepasParJour(Number(e.target.value))}
                        className="px-2 py-1 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
                      >
                        {REPAS_POSSIBLES.map(n => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-marine/70">
                      Collations / jour
                      <select
                        value={collationsParJour}
                        onChange={e => setCollationsParJour(Number(e.target.value))}
                        className="px-2 py-1 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
                      >
                        {COLLATIONS_POSSIBLES.map(n => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    {collationsParJour > 0 && (
                      <label className="flex items-center gap-2 text-sm text-marine/70">
                        Une collation vaut
                        <select
                          value={ratioCollation}
                          onChange={e => setRatioCollation(Number(e.target.value))}
                          className="px-2 py-1 border border-cream-dark rounded-md bg-white text-marine text-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
                          title="Poids d’une collation par rapport à un repas"
                        >
                          <option value={33}>⅓ d’un repas</option>
                          <option value={50}>½ d’un repas</option>
                          <option value={67}>⅔ d’un repas</option>
                        </select>
                      </label>
                    )}
                    </div>
                  </div>
                  {([
                    { titre: 'Par repas', m: cibles?.repas ?? null },
                    { titre: 'Par collation', m: cibles?.collation ?? null }
                  ]).filter(x => x.m !== null).map(({ titre, m }) => (
                    <div key={titre} className="mb-3 last:mb-0">
                      <p className="text-[10px] uppercase tracking-wide text-marine/45 font-semibold mb-1">{titre}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                        {[
                          { l: 'Calories', v: m!.targetKcal, u: 'kcal' },
                          { l: 'Protéines', v: m!.proteinG, u: 'g' },
                          { l: 'Lipides', v: m!.fatG, u: 'g' },
                          { l: 'Glucides nets', v: m!.carbsG, u: 'g' },
                          { l: 'Fibres', v: m!.fiberG, u: 'g' }
                        ].map(x => (
                          <div key={x.l} className="rounded-md bg-white/70 border border-cream-dark py-2">
                            <p className="text-[10px] uppercase tracking-wide text-marine/40">{x.l}</p>
                            <p className="text-base font-semibold tabular-nums text-marine leading-tight">{x.v.toLocaleString('fr-CA')}</p>
                            <p className="text-[10px] text-marine/40">{x.u}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {cibles && cibles.collation && (
                    <p className="text-marine/40 text-xs mt-1">
                      La journée compte {cibles.parts.toLocaleString('fr-CA', { maximumFractionDigits: 2 })} parts —
                      {' '}{repasParJour} repas + {collationsParJour} collation{collationsParJour > 1 ? 's' : ''} à {ratioCollation} %.
                    </p>
                  )}
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
            title={hydraSuggestion == null ? 'Ajoutez un poids dans un bilan pour activer le calcul.' : `≈ 35 ml × ${poidsActuelKg} kg`}
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

      <Section icon={Pill} title="Suppléments" desc="Listez les suppléments, puis l’IA les répartit par moment de prise.">
        <SupplementChips items={suppLibrary} current={supp.input} onPick={line => setSuppField('input', appendLine(supp.input, line))} />
        <AutoTextarea
          value={supp.input}
          onChange={e => setSuppField('input', e.target.value)}
          minRows={5}
          placeholder="Suppléments du client, un par ligne. Ex. Vitamine D3 + K2&#10;Créatine 5 g&#10;Magnésium bisglycinate"
          className={fieldClass}
        />
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={generateSupplementsPlan}
            disabled={aiBusy !== null || supp.input.trim() === ''}
            title={supp.input.trim() === '' ? 'Ajoutez d’abord des suppléments.' : 'Répartir par moment de prise avec l’IA'}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-gold/50 text-marine/80 text-sm hover:border-gold hover:bg-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles size={15} className="text-gold-dark" />
            {aiBusy === 'supp' ? 'Génération…' : 'Répartir par moment (IA)'}
          </button>
          <span className="text-marine/40 text-xs">L’IA remplit chaque moment ci-dessous. Vous pouvez les ajuster.</span>
        </div>

        {/* Un champ éditable par moment de prise (rempli par l’IA), + interactions. */}
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {SUPP_MOMENTS.map(m => (
            <div key={m.key}>
              <label className="block text-marine/70 text-sm font-medium mb-1">{m.label}</label>
              <AutoTextarea
                value={supp[m.key]}
                onChange={e => setSuppField(m.key, e.target.value)}
                minRows={3}
                placeholder="—"
                className={fieldClass}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-marine/70 text-sm font-medium mb-1">À espacer / interactions</label>
            <AutoTextarea
              value={supp.interactions}
              onChange={e => setSuppField('interactions', e.target.value)}
              minRows={3}
              placeholder="Consignes d’espacement / interactions"
              className={fieldClass}
            />
          </div>
        </div>
      </Section>

      {/* ── Préférences par repas et par moment ─────────────────────────────── */}
      <Section
        icon={CalendarClock}
        title="Préférences par repas"
        desc="Ce qui est réaliste en semaine ne l’est pas toujours la fin de semaine. Laisser vide = aucune contrainte."
      >
        <div className="flex flex-wrap gap-1 border-b border-cream-dark mb-4">
          {structure.map((r, i) => (
            <button
              key={r}
              type="button"
              onClick={() => setOngletPref(i)}
              aria-pressed={r === repasActif}
              className={`px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
                r === repasActif
                  ? 'border-gold text-marine'
                  : 'border-transparent text-marine/50 hover:text-marine hover:border-cream-dark'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {([
            { moment: 'semaine' as const, titre: 'Semaine', sugg: libPrefSemaine },
            { moment: 'weekend' as const, titre: 'Fin de semaine', sugg: libPrefWeekend }
          ]).map(m => (
            <div key={m.moment}>
              <label className="block text-marine/70 text-sm font-medium mb-1">
                {m.titre}
                <span className="text-marine/40 font-normal"> — {repasActif}</span>
              </label>
              <SuggestChips
                items={m.sugg}
                current={prefDe(prefsRepas, repasActif)[m.moment]}
                onPick={it => setPref(repasActif, m.moment, appendLine(prefDe(prefsRepas, repasActif)[m.moment], it))}
              />
              <AutoTextarea
                value={prefDe(prefsRepas, repasActif)[m.moment]}
                onChange={e => setPref(repasActif, m.moment, e.target.value)}
                minRows={3}
                placeholder="Une contrainte par ligne"
                className={fieldClass}
              />
            </div>
          ))}
        </div>
        <p className="text-marine/40 text-xs mt-2">
          Journées 1 à 5 = semaine · journées 6 et 7 = fin de semaine.
        </p>
      </Section>

      {/* ── Sources par macronutriment ──────────────────────────────────────── */}
      <Section
        icon={Target}
        title="Sources à privilégier par macronutriment"
        desc="Ce sur quoi l’IA construit les repas. Laisser vide = elle choisit librement. Les valeurs sont indicatives, pour 100 g."
      >
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { titre: 'Protéines', v: alimentsProteines, set: setAlimentsProteines, sugg: libProteines, macro: 'p' as const },
            { titre: 'Glucides', v: alimentsGlucides, set: setAlimentsGlucides, sugg: libGlucides, macro: 'g' as const },
            { titre: 'Lipides', v: alimentsLipides, set: setAlimentsLipides, sugg: libLipides, macro: 'l' as const }
          ].map(m => (
            <div key={m.titre}>
              <label className="block text-marine/70 text-sm font-medium mb-1">{m.titre}</label>
              <SuggestChips items={m.sugg} current={m.v} onPick={it => m.set(c => appendLine(c, it))} macro={m.macro} table={tableMacros} />
              <AutoTextarea
                value={m.v}
                onChange={e => m.set(e.target.value)}
                minRows={4}
                placeholder="Un aliment par ligne"
                className={fieldClass}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Aliments ────────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section icon={Apple} title="À privilégier" desc="Aliments à mettre de l'avant.">
          <SuggestChips items={foodsGoodLib} current={alimentsPrivilegier} onPick={it => setAlimentsPrivilegier(c => appendLine(c, it))} />
          <textarea
            value={alimentsPrivilegier}
            onChange={e => setAlimentsPrivilegier(e.target.value)}
            rows={5}
            placeholder="Ex. Légumes verts, protéines maigres, légumineuses, fruits entiers, eau."
            className={`${fieldClass} resize-y`}
          />
        </Section>
        <Section icon={Ban} title="À éviter" desc="Aliments à limiter.">
          <SuggestChips items={foodsBadLib} current={alimentsEviter} onPick={it => setAlimentsEviter(c => appendLine(c, it))} />
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
        desc={`Journées types selon les macros et les aliments — ${structure.join(', ')}. Modifiables.`}
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
          <button
            type="button"
            onClick={copierPrompt}
            disabled={aiBusy !== null || reprise !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-cream-dark text-marine/60 text-sm hover:border-marine/30 hover:text-marine transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Copie la demande envoyée à l’IA, pour l’essayer ailleurs et comparer"
          >
            <ClipboardCopy size={15} />
            {promptCopie ? 'Copié' : 'Copier le prompt'}
          </button>
          {promptCopie && (
            <span className="text-marine/50 text-xs">
              L’IA écrira <span className="font-mono text-marine/70">{promptCopie}</span> — reprenez-le
              ensuite avec « Importer un menu ».
            </span>
          )}
          {/* La génération réfléchit avant de répondre : sans ce mot, une attente
              de deux minutes ressemble à une application figée. */}
          {aiBusy === 'menu' && (
            <span className="text-marine/50 text-xs">
              L’IA réfléchit avant de proposer — comptez jusqu’à deux minutes pour une semaine.
            </span>
          )}
          <button
            type="button"
            onClick={ouvrirImport}
            disabled={aiBusy !== null || reprise !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-cream-dark text-marine/60 text-sm hover:border-marine/30 hover:text-marine transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reprendre un menu produit ailleurs — colle la réponse ou choisis un fichier"
          >
            <FileInput size={15} />
            Importer un menu
          </button>
          {menuJours.some(j => j.trim()) && (
            <button
              type="button"
              onClick={() => {
                if (!confirmeEffacer) {
                  setConfirmeEffacer(true)
                  return
                }
                setMenuJours(Array.from({ length: MENU_NB_JOURS }, () => ''))
                setConfirmeEffacer(false)
              }}
              onBlur={() => setConfirmeEffacer(false)}
              disabled={aiBusy !== null || reprise !== null}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                confirmeEffacer
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-cream-dark text-marine/60 hover:border-marine/30 hover:text-marine'
              }`}
            >
              <Trash2 size={15} />
              {confirmeEffacer ? 'Confirmer — tout effacer' : 'Effacer le menu'}
            </button>
          )}
          {menuJours.some(j => j.trim()) && (
            <button
              type="button"
              onClick={verifierMacros}
              disabled={aiBusy !== null || reprise !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-cream-dark text-marine/60 text-sm hover:border-marine/30 hover:text-marine transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Protéines calculées et macros estimées, par repas — pour vérification, jamais dans le document du client"
            >
              <Check size={15} />
              {reprise === 'verif' ? 'Estimation…' : 'Vérifier les macros'}
            </button>
          )}
          {liveMacros && (
            <span className="text-marine/40 text-xs">
              Basé sur ≈ {liveMacros.targetKcal.toLocaleString('fr-CA')} kcal · {liveMacros.proteinG} P / {liveMacros.fatG} L / {liveMacros.carbsG} G
            </span>
          )}
        </div>
        {importAvis.length > 0 && (
          <div className="mb-3 rounded-md border border-gold/40 bg-gold/5 px-3 py-2">
            <p className="text-marine/70 text-sm font-medium mb-1">Menu importé — à vérifier :</p>
            <ul className="text-marine/60 text-sm list-disc pl-5 space-y-0.5">
              {importAvis.map(a => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {menuJours.map((jour, i) => {
            const occupe = aiBusy !== null || reprise !== null
            return (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <label className="block text-marine/70 text-sm font-medium">
                    Journée {i + 1}
                    <span className="text-marine/40 font-normal"> · {libelleMoment(momentDeJournee(i))}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => regenerateDay(i)}
                    disabled={occupe}
                    className="inline-flex items-center gap-1 text-xs text-marine/50 hover:text-gold-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Refaire cette journée seulement"
                  >
                    <RefreshCw size={12} className={reprise === String(i) ? 'animate-spin' : ''} />
                    {reprise === String(i) ? 'En cours…' : 'Refaire'}
                  </button>
                </div>
                <AutoTextarea
                  value={jour}
                  onChange={e => setMenuJour(i, e.target.value)}
                  minRows={6}
                  placeholder={`Journée ${i + 1} — un repas par ligne. Ex. Déjeuner : ...&#10;Dîner : ...&#10;Souper : ...&#10;Collations : ...`}
                  className={fieldClass}
                />
                {controleAffiche && (
                  <ControleJournee
                    jour={jour}
                    estimation={estimations?.[i]}
                    cibleProteinesJour={liveMacros?.proteinG}
                    table={tableMacros}
                  />
                )}
                {/* Refaire un seul repas : le reste de la journée, y compris ce
                    que Marie a retouché, n'est pas régénéré. */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-marine/35 text-xs">Refaire :</span>
                  {structure.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => regenerateMeal(i, r)}
                      disabled={occupe}
                      className="text-xs text-marine/45 hover:text-gold-dark underline decoration-dotted underline-offset-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                    >
                      {reprise === `${i}:${r}` ? `${r}…` : r}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
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

      {importOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="bg-cream rounded-2xl p-6 w-[720px] max-w-[92vw] shadow-2xl border border-cream-dark">
            <h3 className="text-marine text-lg font-semibold mb-1">Importer un menu</h3>
            <p className="text-marine/60 text-sm mb-4">
              Colle ici la réponse obtenue ailleurs, ou choisis le fichier. Les {MENU_NB_JOURS} journées
              ci-dessous seront remplacées.
            </p>

            {menuJours.some(j => j.trim()) && (
              <p className="mb-3 rounded-md border border-gold/40 bg-gold/5 px-3 py-2 text-marine/70 text-sm">
                Un menu est déjà écrit pour ce client — l’import le remplacera.
              </p>
            )}

            <textarea
              value={importTexte}
              onChange={e => {
                setImportTexte(e.target.value)
                setImportErreur(null)
              }}
              rows={10}
              spellCheck={false}
              placeholder={'{ "journees": [ { "lignes": ["Déjeuner : …", "Dîner : …", "Souper : …"] } ] }'}
              className="w-full rounded-md border border-cream-dark bg-white/60 px-3 py-2 text-marine text-sm font-mono resize-y focus:outline-none focus:border-gold"
            />

            {importSource && (
              <p className="mt-1.5 text-marine/50 text-xs">Chargé depuis {importSource}</p>
            )}
            {importErreur && (
              <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm">
                {importErreur}
              </p>
            )}

            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={validerImport}
                disabled={!importTexte.trim()}
                className="px-4 py-2 rounded-md bg-gold text-marine font-semibold text-sm hover:bg-gold-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Importer
              </button>
              <button
                type="button"
                onClick={chargerFichierMenu}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-cream-dark text-marine/60 text-sm hover:border-marine/30 hover:text-marine transition-colors"
              >
                <FileInput size={15} />
                Choisir un fichier…
              </button>
              <button
                type="button"
                onClick={() => setImportOuvert(false)}
                className="px-3.5 py-2 rounded-md text-marine/50 text-sm hover:text-marine transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
