import { ipcMain } from 'electron'
import keytar from 'keytar'
import { z } from 'zod'

/**
 * IPC pour les conseils IA via Anthropic Claude.
 *
 * La clé API vit dans le trousseau OS (keytar) — jamais en clair dans la DB
 * ni dans des fichiers JSON. Le payload envoyé à Anthropic est **anonymisé**
 * côté renderer (sexe, âge, valeurs numériques avec catégories) — voir
 * `src/contexts/AIAdviceContext.tsx` et l'ADR 0007.
 */

const KEYTAR_SERVICE = 'kinesio-outils'
const KEYTAR_ACCOUNT = 'ai-anthropic-api-key'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** Modèle de génération par défaut. Sonnet est le meilleur compromis qualité/coût
 *  pour ce type d'usage clinique léger. Si Marie-Eve veut Opus pour des cas
 *  complexes, ce sera une option future. */
const MODEL_GENERATE = 'claude-sonnet-4-6'

/** Modèle minimal pour tester la connexion (Haiku = plus rapide + moins cher). */
const MODEL_PING = 'claude-haiku-4-5-20251001'

/** Schéma du payload reçu du renderer (préalablement anonymisé). */
const MetricSchema = z.object({
  key: z.string().max(120),
  label: z.string().max(120),
  value: z.union([z.number(), z.string().max(120)]),
  unit: z.string().max(20).optional(),
  category: z.string().max(60).optional(),
  percentile: z.number().min(0).max(100).optional(),
  deltaPct: z.number().optional()
})

const PayloadSchema = z.object({
  sex: z.enum(['F', 'M']).nullable(),
  age: z.number().int().min(0).max(120).nullable(),
  metrics: z.array(MetricSchema).min(1).max(20)
})

const AnalysisSchema = z.object({
  synthese: z.string(),
  forces: z.array(z.object({ titre: z.string(), explication: z.string() })),
  aTravailler: z.array(z.object({ titre: z.string(), explication: z.string(), piste: z.string() })),
  warnings: z.array(z.string())
})

const SYSTEM_PROMPT = `Tu es un assistant pour un kinésiologue canadien.

Tu reçois le bilan complet anonyme d'un client (sexe, âge, et TOUTES ses métriques avec valeurs, catégories ACSM/OMS et percentiles). Ton rôle : aider le/la kinésiologue à IDENTIFIER les FORCES et les points À TRAVAILLER de ce bilan, avec un regard d'ensemble.

Réponds avec un objet JSON STRICT, sans aucun texte autour, suivant exactement ce schéma :

{
  "synthese": "1 à 2 phrases résumant l'état général de forme du client",
  "forces": [ { "titre": "nom court de la force (ex. Capacité cardiovasculaire)", "explication": "pourquoi c'est un atout pour sa santé (1-2 phrases)" } ],
  "aTravailler": [ { "titre": "nom court du point à travailler", "explication": "en quoi c'est un enjeu (1-2 phrases)", "piste": "une piste concrète et réaliste d'amélioration" } ],
  "warnings": ["contre-indications éventuelles ou red flags cliniques"]
}

Règles :
- Base-toi UNIQUEMENT sur les métriques fournies — n'invente aucune donnée. Si une métrique manque, ne l'évoque pas.
- Reste sobre, factuel, professionnel — pas de motivation émotionnelle.
- 2 à 5 items par liste. Si aucune force (ou aucun point faible) évident, mets une liste vide plutôt que d'inventer.
- Catégories Très bien / Excellent → forces ; Acceptable / À améliorer → à travailler ; Bien → neutre (à mentionner seulement si pertinent).
- Les « pistes » sont des recommandations d'ACTIVITÉ PHYSIQUE (le champ du kinésiologue). Pour la nutrition détaillée, réfère à un(e) nutritionniste au lieu de prescrire.
- Si tour de taille / ratio taille-hanche à risque OMS élevé, ou âge ≥ 50 avec exercice haute intensité, ajoute un warning de validation médicale.`

// ── Nutrition : plan de suppléments + idées de menu ─────────────────────────
const NutritionPayloadSchema = z.object({
  /** `menu` = la semaine · `menu-jour` = une journée · `menu-repas` = un repas.
   *  Les deux dernières évitent de tout refaire pour corriger une seule idée. */
  type: z.enum(['supplements', 'menu', 'menu-jour', 'menu-repas']),
  kcal: z.number().nullable().optional(),
  proteinG: z.number().nullable().optional(),
  fatG: z.number().nullable().optional(),
  carbsG: z.number().nullable().optional(),
  fiberG: z.number().nullable().optional(),
  supplements: z.string().max(3000).optional(),
  foodsGood: z.string().max(3000).optional(),
  foodsBad: z.string().max(3000).optional(),
  foodsLiked: z.string().max(3000).optional(),
  foodsDisliked: z.string().max(3000).optional(),
  /** Aliments privilégiés par macronutriment — bien plus dirigeants qu'une liste
   *  unique : le modèle sait quoi mettre à quelle place dans l'assiette. */
  proteinFoods: z.string().max(1500).optional(),
  carbFoods: z.string().max(1500).optional(),
  fatFoods: z.string().max(1500).optional(),
  /** Reprise partielle — les autres journées déjà écrites, pour ne pas les répéter
   *  mot pour mot ni proposer exactement la même chose. */
  autresJournees: z.array(z.string().max(2000)).max(7).optional(),
  /** Reprise d'un repas — la journée telle qu'elle est, pour rester cohérent. */
  journee: z.string().max(2000).optional(),
  /** `menu-repas` : quel repas refaire (« Déjeuner », « Collation 2 »…). */
  repas: z.string().max(40).optional(),
  /** Les lignes attendues dans une journée, dans l'ordre — construites par
   *  `structureJournee` selon le nombre de repas et de collations du client.
   *  Sans elle, le modèle proposait toujours quatre repas, y compris à qui n'en
   *  prend que deux et aucune collation. */
  structure: z.array(z.string().max(40)).min(1).max(6).optional(),
  /** Consignes par repas pour une journée de SEMAINE — « Déjeuner : rapide ». */
  consignesSemaine: z.array(z.string().max(300)).max(6).optional(),
  /** Idem pour une journée de FIN DE SEMAINE. */
  consignesWeekend: z.array(z.string().max(300)).max(6).optional(),
  /** `menu-jour` / `menu-repas` : de quel moment relève la journée visée. */
  moment: z.enum(['semaine', 'weekend']).optional(),
  /** Cibles d'UN repas et d'UNE collation, déjà réparties. Sans elles, le modèle
   *  proposait des collations aussi copieuses qu'un souper. */
  cibleRepas: z.string().max(200).optional(),
  cibleCollation: z.string().max(200).optional()
})

/** Plan de suppléments structuré : une liste de lignes par moment de prise. */
const SuppPlanSchema = z.object({
  reveil: z.array(z.string()).default([]),
  dejeuner: z.array(z.string()).default([]),
  apresEntrainement: z.array(z.string()).default([]),
  souper: z.array(z.string()).default([]),
  coucher: z.array(z.string()).default([]),
  interactions: z.array(z.string()).default([])
})

/**
 * Idées de menu structurées : une semaine, chaque journée une liste de lignes.
 * Le plafond doit rester ≥ au nombre de journées du formulaire — un `.max()`
 * trop bas ferait échouer tout le parse au lieu de tronquer.
 */
const MenuPlanSchema = z.object({
  journees: z.array(z.object({ lignes: z.array(z.string()) })).max(7).default([])
})

/** Une seule journée refaite. */
const MenuJourSchema = z.object({ lignes: z.array(z.string()).default([]) })

/** Un seul repas refait — la ligne complète, « Déjeuner : ... ». */
const MenuRepasSchema = z.object({ ligne: z.string().default('') })

const SUPPLEMENTS_SYSTEM = `Tu es un assistant pour un(e) kinésiologue au Québec.

On te donne la liste des suppléments qu'un client prévoit prendre. Répartis CHAQUE supplément dans le bon MOMENT de prise, et rédige de courtes consignes d'espacement / interactions.

Réponds avec un objet JSON STRICT, sans aucun texte autour, SANS Markdown, suivant exactement ce schéma :

{
  "reveil": ["suppléments à prendre au réveil / à jeun"],
  "dejeuner": ["suppléments au déjeuner (préciser AVEC ou SANS nourriture)"],
  "apresEntrainement": ["suppléments après l'entraînement"],
  "souper": ["suppléments au souper"],
  "coucher": ["suppléments au coucher"],
  "interactions": ["consignes d'espacement / interactions (ex. zinc et calcium/fer à distance ; fer avec vitamine C mais loin du café/thé)"]
}

Règles :
- Chaque élément de tableau = UNE ligne courte, en français, SANS puce et SANS Markdown (pas de #, *, -, >, tableaux, émojis).
- Base-toi UNIQUEMENT sur les suppléments fournis. N'invente ni supplément ni dosage.
- Laisse un tableau VIDE [] pour un moment sans supplément. Place chaque supplément dans UN SEUL moment (le plus pertinent).
- N'ajoute AUCUNE mention finale : l'application l'ajoute automatiquement.`

/**
 * Le style des menus, partagé par les trois portées (semaine / journée / repas).
 *
 * Écrit une fois : trois prompts qui décrivent le même style finissent par en
 * décrire trois. Une journée refaite doit ressembler aux six autres.
 *
 * Ces règles répondent à un constat de Marie — « les idées sont parfois
 * bizarres ». Trois causes identifiées dans le prompt d'origine :
 *
 *  · il EXIGEAIT que tout diffère d'un jour à l'autre, ce qui poussait vers
 *    l'exotique dès le milieu de semaine ;
 *  · il criait la cible de fibres, ce qui faisait empiler graines et son ;
 *  · il n'ancrait aucune cuisine ni aucune contrainte de simplicité.
 */
const MENU_STYLE = `Style imposé — cuisine MÉDITERRANÉENNE et repas SIMPLES :
- Chaque ligne doit être un PLAT RÉEL, qu'on pourrait nommer dans une conversation ordinaire et retrouver dans un livre de cuisine. Un assemblage d'aliments corrects n'est pas un plat : « salade de fromage cottage » n'existe pas, même si la salade et le cottage sont tous deux excellents. Dans le doute, choisis le plat le plus banal qui respecte les cibles.
- Respecte la façon dont chaque aliment se mange VRAIMENT : le fromage cottage se prend nature, avec des fruits ou en trempette, pas en salade composée ; le yogourt au déjeuner ou en collation, pas au souper.
- Base méditerranéenne : légumes, légumineuses, poisson, volaille, œufs, yogourt grec, feta, huile d'olive, noix, grains entiers, fruits frais, herbes fraîches. Viande rouge rare.
- SIMPLE avant tout : 5 à 6 ingrédients courants par repas, 30 minutes maximum, rien qui demande une épicerie spécialisée. Ce sont des gens qui cuisinent le soir après le travail.
- Vocabulaire québécois : « déjeuner » le matin, « dîner » le midi, « souper » le soir.
- RÉPÉTER un plat dans la semaine est normal et souhaitable. Ne force pas la nouveauté : sept déjeuners tous différents ne ressemblent à la vie de personne.
- Les fibres viennent naturellement de cette cuisine (légumineuses, légumes, grains entiers, fruits). N'empile PAS graines, son ou poudres pour gonfler un total.
- La SOURCE DE PROTÉINES de chaque repas porte TOUJOURS une quantité : « yogourt grec 0 % (¾ tasse) », « saumon (1 filet, 150 g) », « 2 œufs ». C'est elle qui décide si la cible est atteinte — sans chiffre, la ligne ne sert à rien.
- Pour le reste, portions concrètes et approximatives (« 1 tasse », « une poignée »), jamais de grammes au gramme près.
- Une ligne par repas, format « Repas : aliments ». SANS puce et SANS Markdown (pas de #, *, tableaux, émojis). Aucun total de calories, de macros ou de fibres.

Exemple d'une journée bien faite :
Déjeuner : yogourt grec, petits fruits, une poignée d'amandes, filet de miel
Dîner : salade de pois chiches, concombre, tomates, feta et huile d'olive, pain pita de blé entier
Souper : filet de saumon au citron, riz brun, brocoli rôti à l'ail
Collations : pomme et fromage, ou houmous avec bâtonnets de carotte`

const MENU_SYSTEM = `Tu es un assistant pour un(e) kinésiologue au Québec.

Propose EXACTEMENT 7 EXEMPLES de journées (IDÉES DE MENU génériques, NON prescriptives) qui respectent approximativement les cibles de calories et de macros fournies, en tenant compte des aliments à privilégier / à éviter / aimés / non aimés.

${MENU_STYLE}

Réponds avec un objet JSON STRICT, sans aucun texte autour, SANS Markdown, suivant exactement ce schéma :

{
  "journees": [
    { "lignes": ["Déjeuner : ...", "Dîner : ...", "Souper : ...", "Collations : ..."] }
  ]
}

Règles :
- EXACTEMENT 7 journées dans « journees » — une semaine complète, aucune journée omise.
- Une collation est nettement PLUS PETITE qu'un repas : respecte les cibles par prise données dans le message.
- Les journées 1 à 5 sont des journées de SEMAINE, les journées 6 et 7 des journées de FIN DE SEMAINE. Respecte les contraintes propres à chacune : ce qui est trop long à préparer en semaine ne doit pas y apparaître.
- Chaque journée suit la STRUCTURE EXACTE donnée dans le message : une ligne par élément, dans l'ordre, une seule phrase chacune. N'ajoute AUCUN repas absent de cette liste — pas de collation si elle n'y figure pas, pas de déjeuner si la journée commence au dîner.
- Ne mets PAS d'en-tête « Journée N » : la numérotation est ajoutée par l'application.
- Si un supplément PROTÉINÉ est fourni (whey, caséine, isolat), intègre-le au repas correspondant à son moment de prise, entre parenthèses à la fin de la ligne : « Déjeuner : yogourt grec 0 % (¾ tasse), petits fruits, amandes (+ 1 mesure de protéine whey) », et compte-le dans la cible de protéines de ce repas. N'en invente AUCUN, ne change pas la dose, et n'ajoute JAMAIS de vitamine, minéral ou autre supplément non protéiné à une ligne de repas — ils ont leur propre section.
- Les listes d'aliments à privilégier sont une PALETTE où puiser, pas une liste à caser. Rien ne t'oblige à utiliser chaque élément : si un aliment ne s'intègre pas naturellement à un repas, ne l'y mets pas — il servira ailleurs dans la semaine, ou pas du tout. Si une liste est « non précisés », choisis librement dans le style méditerranéen.
- PRIORISE les aliments aimés, EXCLUS ceux non aimés / à éviter. N'invente aucune allergie ni restriction non fournie.
- N'ajoute AUCUNE mention finale : l'application l'ajoute automatiquement.`

const MENU_JOUR_SYSTEM = `Tu es un assistant pour un(e) kinésiologue au Québec.

Propose UNE SEULE journée d'exemple (IDÉE DE MENU générique, NON prescriptive) qui respecte approximativement les cibles fournies.

${MENU_STYLE}

Réponds avec un objet JSON STRICT, sans aucun texte autour, SANS Markdown :

{ "lignes": ["Déjeuner : ...", "Dîner : ...", "Souper : ...", "Collations : ..."] }

Règles :
- Une ligne par élément de la STRUCTURE EXACTE donnée dans le message, dans l'ordre, et rien d'autre.
- On te donne les autres journées de la semaine. Propose autre chose qu'une copie de l'une d'elles, sans chercher l'originalité à tout prix : un aliment qui revient est normal.
- PRIORISE les aliments aimés, EXCLUS ceux non aimés / à éviter.`

const MENU_REPAS_SYSTEM = `Tu es un assistant pour un(e) kinésiologue au Québec.

Refais UN SEUL repas d'une journée d'exemple. On te donne la journée complète et le repas à remplacer.

${MENU_STYLE}

Réponds avec un objet JSON STRICT, sans aucun texte autour, SANS Markdown :

{ "ligne": "Déjeuner : ..." }

Règles :
- UNE seule ligne, commençant par le nom du repas demandé suivi de « : ».
- Reste COHÉRENT avec le reste de la journée : ne répète pas un aliment déjà présent aux autres repas de cette même journée.
- Propose autre chose que la version actuelle du repas.
- PRIORISE les aliments aimés, EXCLUS ceux non aimés / à éviter.`

const SUPPLEMENT_TIMING_SYSTEM = `Tu es un assistant pour un(e) kinésiologue au Québec.

On te donne le NOM d'un supplément. Donne le MEILLEUR MOMENT de prise, en une courte phrase française (5 à 22 mots), en précisant si pertinent AVEC ou SANS nourriture et les interactions importantes (ex. à distance du calcium/fer, loin du café/thé).

TOLÉRANCE DIGESTIVE : si le supplément est souvent mal toléré à jeun ou peut causer des nausées / inconfort digestif (ex. zinc, fer, magnésium, oméga-3), ajoute la nuance « avec une petite collation si inconfort » (ou équivalent court).

Réponds UNIQUEMENT avec le moment de prise — PAS le nom du supplément, PAS de phrase complète, PAS de guillemets, PAS de Markdown, PAS de point final.
Exemples de réponses : à jeun le matin, avec une petite collation si nausées, à distance du calcium et du fer / au déjeuner, avec un corps gras / au coucher, avec un peu de nourriture si inconfort.`

const PAIN_SUGGESTIONS_SYSTEM = `Tu es un assistant pour un(e) kinésiologue au Québec qui remplit un questionnaire de santé.

On te donne une ZONE du corps (et parfois la sévérité et le contexte de santé). Propose 6 à 8 courtes descriptions de douleur / tension / symptôme TYPIQUES et pertinentes pour cette zone, telles que le kinésiologue les noterait.

Contraintes :
- Français, 2 à 6 mots par description, sans point final.
- Concret et clinique (type de douleur, mouvement déclencheur, irradiation, raideur, etc.).
- Reste dans le champ du kinésiologue : PAS de diagnostic médical affirmé, PAS de traitement.
- Réponds UNIQUEMENT par un tableau JSON de chaînes, sans texte autour, sans Markdown.
Exemple : ["Douleur en flexion", "Raideur matinale", "Irradie dans la jambe"]`

function buildNutritionMessage(p: z.infer<typeof NutritionPayloadSchema>): string {
  if (p.type === 'supplements') {
    return `Suppléments à organiser en horaire :\n${(p.supplements ?? '').trim() || '(aucun supplément fourni)'}`
  }
  const macros: string[] = []
  if (typeof p.kcal === 'number') macros.push(`${Math.round(p.kcal)} kcal`)
  if (typeof p.proteinG === 'number') macros.push(`${Math.round(p.proteinG)} g de protéines`)
  if (typeof p.fatG === 'number') macros.push(`${Math.round(p.fatG)} g de lipides`)
  if (typeof p.carbsG === 'number') macros.push(`${Math.round(p.carbsG)} g de glucides nets (hors fibres)`)
  const clean = (s?: string) => (s ?? '').trim().replace(/\n/g, ', ') || 'non précisés'
  const fiberLine =
    typeof p.fiberG === 'number'
      ? `Cible de fibres : environ ${Math.round(p.fiberG)} g/jour — construis des journées RICHES EN FIBRES pour t'en approcher (sans écrire de total de fibres).`
      : `Vise des journées riches en fibres (légumes, fruits, légumineuses, grains entiers).`
  const structure = p.structure ?? ['Déjeuner', 'Dîner', 'Souper', 'Collation']
  const lines = [
    `Structure EXACTE de chaque journée, dans cet ordre — ${structure.length} ligne(s), ni plus ni moins : ${structure.join(' · ')}.`,
    `Cibles quotidiennes : ${macros.length ? macros.join(', ') : 'non précisées'}.`,
    fiberLine,
    `Aliments à privilégier (recommandation) : ${clean(p.foodsGood)}.`,
    `Sources de PROTÉINES à privilégier : ${clean(p.proteinFoods)}.`,
    `Sources de GLUCIDES à privilégier : ${clean(p.carbFoods)}.`,
    `Sources de LIPIDES à privilégier : ${clean(p.fatFoods)}.`,
    `Aliments à éviter (recommandation) : ${clean(p.foodsBad)}.`,
    `Aliments que la personne AIME : ${clean(p.foodsLiked)}.`,
    `Aliments que la personne N'AIME PAS / à exclure : ${clean(p.foodsDisliked)}.`
  ]

  // Suppléments : Marie les a déjà répartis par moment. Les rattacher au repas
  // correspondant évite au client de lire deux documents pour savoir quand
  // prendre sa protéine — mais l'IA n'a pas le droit d'en ajouter.
  if (p.supplements?.trim()) {
    lines.push(`
Suppléments PROTÉINÉS prescrits par la kinésiologue, par moment de prise :
${p.supplements.trim()}`)
  }

  if (p.cibleRepas) {
    lines.push(`Cible approximative par REPAS : ${p.cibleRepas}.`)
    if (p.cibleCollation) lines.push(`Cible approximative par COLLATION : ${p.cibleCollation}.`)
  }

  // Contraintes de vie réelle : ce qui est faisable un mardi matin ne l'est pas
  // un dimanche. Sans elles, le modèle propose une omelette sept jours sur sept.
  const cs = p.consignesSemaine ?? []
  const cw = p.consignesWeekend ?? []
  if (p.type === 'menu' && (cs.length || cw.length)) {
    lines.push(
      `\nContraintes par repas — journées 1 à 5 (SEMAINE) :\n${cs.length ? cs.join('\n') : '(aucune)'}`
    )
    lines.push(
      `Contraintes par repas — journées 6 et 7 (FIN DE SEMAINE) :\n${cw.length ? cw.join('\n') : '(aucune)'}`
    )
  }
  if (p.type !== 'menu' && p.moment) {
    const c = p.moment === 'semaine' ? cs : cw
    lines.push(`\nCette journée est une journée de ${p.moment === 'semaine' ? 'SEMAINE' : 'FIN DE SEMAINE'}.`)
    if (c.length) lines.push(`Contraintes par repas :\n${c.join('\n')}`)
  }

  // Reprise partielle : le modèle a besoin de voir ce qui existe déjà, sinon il
  // repropose la même chose ou casse la cohérence de la journée.
  if (p.type === 'menu-jour') {
    const autres = (p.autresJournees ?? []).map(j => j.trim()).filter(Boolean)
    lines.push(
      autres.length
        ? `\nAutres journées déjà proposées cette semaine (ne les recopie pas) :\n${autres.join('\n---\n')}`
        : '\n(aucune autre journée écrite pour l\'instant)'
    )
  }
  if (p.type === 'menu-repas') {
    lines.push(`\nRepas à refaire : ${p.repas ?? 'Déjeuner'}.`)
    lines.push(`Journée actuelle :\n${(p.journee ?? '').trim() || '(vide)'}`)
  }

  return lines.join('\n')
}

function buildUserMessage(payload: z.infer<typeof PayloadSchema>): string {
  const sex = payload.sex === 'F' ? 'Femme' : payload.sex === 'M' ? 'Homme' : 'sexe non renseigné'
  const age = payload.age !== null ? `${payload.age} ans` : 'âge non renseigné'
  const lines = [`Profil anonyme : ${sex}, ${age}.`, '', 'Métriques du bilan :']
  for (const m of payload.metrics) {
    let line = `- ${m.label} : ${m.value}`
    if (m.unit) line += ` ${m.unit}`
    if (m.category) line += ` (${m.category})`
    if (typeof m.percentile === 'number') line += `, ${Math.round(m.percentile)}e percentile`
    if (typeof m.deltaPct === 'number') {
      const sign = m.deltaPct >= 0 ? '+' : ''
      line += ` — ${sign}${Math.round(m.deltaPct)} % vs moyenne`
    }
    lines.push(line)
  }
  return lines.join('\n')
}

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>
  error?: { type: string; message: string }
}

/** Code d'erreur normalisé pour les consumers côté renderer. */
type AIErrorCode = 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'BAD_RESPONSE' | 'TIMEOUT'

class AIError extends Error {
  constructor(public code: AIErrorCode, message: string) {
    super(message)
    this.name = 'AIError'
  }
}

async function getApiKey(): Promise<string | null> {
  return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
}

async function callAnthropic(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<AnthropicMessageResponse> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw new AIError('TIMEOUT', 'Anthropic n\'a pas répondu dans le délai imparti.')
    }
    throw new AIError('NETWORK', 'Erreur réseau lors de l\'appel à Anthropic.')
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 401) throw new AIError('INVALID_KEY', 'Clé API Anthropic invalide ou révoquée.')
  if (res.status === 429) throw new AIError('RATE_LIMIT', 'Limite de débit Anthropic atteinte. Réessayez dans un instant.')
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = (await res.json()) as AnthropicMessageResponse
      if (j.error?.message) detail = j.error.message
    } catch {
      // ignore
    }
    throw new AIError('BAD_RESPONSE', `Anthropic a renvoyé une erreur : ${detail}`)
  }
  return res.json() as Promise<AnthropicMessageResponse>
}

function extractText(response: AnthropicMessageResponse): string {
  const text = response.content?.find(c => c.type === 'text')?.text ?? ''
  if (!text) throw new AIError('BAD_RESPONSE', 'Anthropic n\'a pas renvoyé de texte.')
  return text
}

/** Anthropic peut rajouter du texte avant/après le JSON — on extrait l'objet
 *  via une regex permissive. */
function parseAdviceJson(raw: string): unknown {
  const trimmed = raw.trim()
  // Cherche le premier { et le dernier } (objet JSON complet).
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) {
    throw new AIError('BAD_RESPONSE', 'Réponse Anthropic non-JSON.')
  }
  try {
    return JSON.parse(trimmed.slice(first, last + 1))
  } catch {
    throw new AIError('BAD_RESPONSE', 'Le JSON renvoyé par Anthropic n\'est pas parsable.')
  }
}

export function registerAIHandlers(): void {
  // ── Gestion de la clé API ───────────────────────────────────────────────
  ipcMain.handle('ai:has-api-key', async () => {
    const k = await getApiKey()
    return k !== null && k.length > 0
  })

  ipcMain.handle('ai:set-api-key', async (_e, key: unknown) => {
    const validated = z.string().min(1).max(500).parse(key)
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, validated)
  })

  ipcMain.handle('ai:remove-api-key', async () => {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
  })

  // ── Test de connexion ──────────────────────────────────────────────────
  ipcMain.handle('ai:test-connection', async () => {
    const apiKey = await getApiKey()
    if (!apiKey) return { ok: false, error: 'Aucune clé API configurée.', code: 'NO_API_KEY' as AIErrorCode }
    try {
      await callAnthropic(apiKey, {
        model: MODEL_PING,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }]
      })
      return { ok: true }
    } catch (err) {
      if (err instanceof AIError) return { ok: false, error: err.message, code: err.code }
      return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue', code: 'BAD_RESPONSE' as AIErrorCode }
    }
  })

  // ── Génération des conseils ────────────────────────────────────────────
  ipcMain.handle('ai:generate', async (_e, rawPayload: unknown) => {
    const apiKey = await getApiKey()
    if (!apiKey) {
      return { ok: false, error: 'Aucune clé API Anthropic configurée.', code: 'NO_API_KEY' as AIErrorCode }
    }

    let payload: z.infer<typeof PayloadSchema>
    try {
      payload = PayloadSchema.parse(rawPayload)
    } catch {
      return { ok: false, error: 'Payload invalide.', code: 'BAD_RESPONSE' as AIErrorCode }
    }

    try {
      const response = await callAnthropic(apiKey, {
        model: MODEL_GENERATE,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(payload) }]
      })
      const text = extractText(response)
      const parsed = parseAdviceJson(text)
      const advice = AnalysisSchema.parse(parsed)
      return { ok: true, advice }
    } catch (err) {
      if (err instanceof AIError) return { ok: false, error: err.message, code: err.code }
      if (err instanceof z.ZodError) {
        return { ok: false, error: 'Le JSON Anthropic ne correspond pas au schéma attendu.', code: 'BAD_RESPONSE' as AIErrorCode }
      }
      return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue', code: 'BAD_RESPONSE' as AIErrorCode }
    }
  })

  // ── Génération nutrition (plan de suppléments / idées de menu) ─────────────
  // Retourne du TEXTE éditable (pas de JSON strict) : Marie l'ajuste ensuite.
  ipcMain.handle('ai:generate-nutrition', async (_e, rawPayload: unknown) => {
    const apiKey = await getApiKey()
    if (!apiKey) {
      return { ok: false, error: 'Aucune clé API Anthropic configurée.', code: 'NO_API_KEY' as AIErrorCode }
    }
    let payload: z.infer<typeof NutritionPayloadSchema>
    try {
      payload = NutritionPayloadSchema.parse(rawPayload)
    } catch {
      return { ok: false, error: 'Payload invalide.', code: 'BAD_RESPONSE' as AIErrorCode }
    }
    try {
      const SYSTEMES = {
        supplements: SUPPLEMENTS_SYSTEM,
        menu: MENU_SYSTEM,
        'menu-jour': MENU_JOUR_SYSTEM,
        'menu-repas': MENU_REPAS_SYSTEM
      } as const
      // Sept journées ne tiennent pas dans le budget d'une seule : une réponse
      // coupée casse le JSON et remonte en « BAD_RESPONSE ».
      const BUDGETS = { supplements: 1600, menu: 4000, 'menu-jour': 700, 'menu-repas': 250 } as const
      const response = await callAnthropic(apiKey, {
        model: MODEL_GENERATE,
        max_tokens: BUDGETS[payload.type],
        // Un menu n'est pas un exercice de créativité. À la température par défaut
        // (1,0), le modèle allait chercher l'inhabituel — c'est l'essentiel du
        // « bizarre » signalé par Marie. Les suppléments restent à leur réglage.
        ...(payload.type === 'supplements' ? {} : { temperature: 0.3 }),
        system: SYSTEMES[payload.type],
        messages: [{ role: 'user', content: buildNutritionMessage(payload) }]
      })
      const parsed = parseAdviceJson(extractText(response))
      if (payload.type === 'supplements') return { ok: true, plan: SuppPlanSchema.parse(parsed) }
      if (payload.type === 'menu-jour') return { ok: true, plan: MenuJourSchema.parse(parsed) }
      if (payload.type === 'menu-repas') return { ok: true, plan: MenuRepasSchema.parse(parsed) }
      return { ok: true, plan: MenuPlanSchema.parse(parsed) }
    } catch (err) {
      if (err instanceof AIError) return { ok: false, error: err.message, code: err.code }
      if (err instanceof z.ZodError) {
        return { ok: false, error: 'Le JSON Anthropic ne correspond pas au schéma attendu.', code: 'BAD_RESPONSE' as AIErrorCode }
      }
      return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue', code: 'BAD_RESPONSE' as AIErrorCode }
    }
  })

  // ── Moment de prise recommandé pour un supplément (bibliothèque) ────────────
  ipcMain.handle('ai:supplement-timing', async (_e, rawPayload: unknown) => {
    const apiKey = await getApiKey()
    if (!apiKey) {
      return { ok: false, error: 'Aucune clé API Anthropic configurée.', code: 'NO_API_KEY' as AIErrorCode }
    }
    let name: string
    try {
      name = z.object({ name: z.string().min(1).max(120) }).parse(rawPayload).name
    } catch {
      return { ok: false, error: 'Nom de supplément invalide.', code: 'BAD_RESPONSE' as AIErrorCode }
    }
    try {
      const response = await callAnthropic(apiKey, {
        model: MODEL_GENERATE,
        max_tokens: 80,
        system: SUPPLEMENT_TIMING_SYSTEM,
        messages: [{ role: 'user', content: `Supplément : ${name}` }]
      })
      // Nettoie guillemets et point final éventuels renvoyés par le modèle.
      const timing = extractText(response).trim().replace(/^[«»"']+|[«»"'.\s]+$/g, '').trim()
      return { ok: true, timing }
    } catch (err) {
      if (err instanceof AIError) return { ok: false, error: err.message, code: err.code }
      return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue', code: 'BAD_RESPONSE' as AIErrorCode }
    }
  })

  // ── Suggestions de description de douleur pour une zone (silhouette) ─────────
  ipcMain.handle('ai:pain-suggestions', async (_e, rawPayload: unknown) => {
    const apiKey = await getApiKey()
    if (!apiKey) {
      return { ok: false, error: 'Aucune clé API Anthropic configurée.', code: 'NO_API_KEY' as AIErrorCode }
    }
    let payload: { zone: string; severity?: string; conditions?: string }
    try {
      payload = z
        .object({
          zone: z.string().min(1).max(80),
          severity: z.enum(['jaune', 'rouge']).optional(),
          conditions: z.string().max(500).optional()
        })
        .parse(rawPayload)
    } catch {
      return { ok: false, error: 'Zone invalide.', code: 'BAD_RESPONSE' as AIErrorCode }
    }
    const parts = [`Zone : ${payload.zone}`]
    if (payload.severity) parts.push(`Sévérité : ${payload.severity === 'rouge' ? 'douleur' : 'tension légère'}`)
    if (payload.conditions?.trim()) parts.push(`Contexte santé : ${payload.conditions.trim()}`)
    try {
      const response = await callAnthropic(apiKey, {
        model: MODEL_GENERATE,
        max_tokens: 200,
        system: PAIN_SUGGESTIONS_SYSTEM,
        messages: [{ role: 'user', content: parts.join('\n') }]
      })
      const raw = extractText(response).trim().replace(/^```(json)?|```$/g, '').trim()
      let arr: unknown
      try {
        arr = JSON.parse(raw)
      } catch {
        return { ok: false, error: 'Réponse IA illisible.', code: 'BAD_RESPONSE' as AIErrorCode }
      }
      const suggestions = Array.isArray(arr)
        ? arr.filter((s): s is string => typeof s === 'string').map(s => s.trim().replace(/[.]+$/, '')).filter(s => s.length > 0 && s.length <= 80).slice(0, 8)
        : []
      return { ok: true, suggestions }
    } catch (err) {
      if (err instanceof AIError) return { ok: false, error: err.message, code: err.code }
      return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue', code: 'BAD_RESPONSE' as AIErrorCode }
    }
  })
}
