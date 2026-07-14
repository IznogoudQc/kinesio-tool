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
  type: z.enum(['supplements', 'menu']),
  kcal: z.number().nullable().optional(),
  proteinG: z.number().nullable().optional(),
  fatG: z.number().nullable().optional(),
  carbsG: z.number().nullable().optional(),
  supplements: z.string().max(3000).optional(),
  foodsGood: z.string().max(3000).optional(),
  foodsBad: z.string().max(3000).optional(),
  foodsLiked: z.string().max(3000).optional(),
  foodsDisliked: z.string().max(3000).optional()
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

/** Idées de menu structurées : jusqu'à quelques journées, chacune une liste de lignes. */
const MenuPlanSchema = z.object({
  journees: z.array(z.object({ lignes: z.array(z.string()) })).max(3).default([])
})

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

const MENU_SYSTEM = `Tu es un assistant pour un(e) kinésiologue au Québec.

Propose 1 à 2 EXEMPLES de journées (IDÉES DE MENU génériques, NON prescriptives) qui respectent approximativement les cibles de calories et de macros fournies, en tenant compte des aliments à privilégier / à éviter / aimés / non aimés.

Réponds avec un objet JSON STRICT, sans aucun texte autour, SANS Markdown, suivant exactement ce schéma :

{
  "journees": [
    { "lignes": [
      "Déjeuner : aliments et portions approximatives",
      "Dîner : ...",
      "Souper : ...",
      "Collations : ..."
    ] }
  ]
}

Règles :
- 1 à 2 journées. Chaque « lignes » = des lignes « Repas : aliments », SANS puce et SANS Markdown (pas de #, *, tableaux, émojis).
- Ne mets PAS d'en-tête « Journée N » dans les lignes : la numérotation est ajoutée par l'application.
- N'ajoute AUCUN total de calories ou de macros : ces calculs relèvent d'une nutritionniste et ne doivent pas figurer.
- VARIE les journées : aliments principaux DIFFÉRENTS d'une journée à l'autre.
- PRIORISE les aliments aimés, EXCLUS ceux non aimés / à éviter. N'invente aucune allergie ni restriction non fournie.
- N'ajoute AUCUNE mention finale : l'application l'ajoute automatiquement.`

function buildNutritionMessage(p: z.infer<typeof NutritionPayloadSchema>): string {
  if (p.type === 'supplements') {
    return `Suppléments à organiser en horaire :\n${(p.supplements ?? '').trim() || '(aucun supplément fourni)'}`
  }
  const macros: string[] = []
  if (typeof p.kcal === 'number') macros.push(`${Math.round(p.kcal)} kcal`)
  if (typeof p.proteinG === 'number') macros.push(`${Math.round(p.proteinG)} g de protéines`)
  if (typeof p.fatG === 'number') macros.push(`${Math.round(p.fatG)} g de lipides`)
  if (typeof p.carbsG === 'number') macros.push(`${Math.round(p.carbsG)} g de glucides`)
  const clean = (s?: string) => (s ?? '').trim().replace(/\n/g, ', ') || 'non précisés'
  const lines = [
    `Cibles quotidiennes : ${macros.length ? macros.join(', ') : 'non précisées'}.`,
    `Aliments à privilégier (recommandation) : ${clean(p.foodsGood)}.`,
    `Aliments à éviter (recommandation) : ${clean(p.foodsBad)}.`,
    `Aliments que la personne AIME : ${clean(p.foodsLiked)}.`,
    `Aliments que la personne N'AIME PAS / à exclure : ${clean(p.foodsDisliked)}.`
  ]
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
      const response = await callAnthropic(apiKey, {
        model: MODEL_GENERATE,
        max_tokens: 1600,
        system: payload.type === 'supplements' ? SUPPLEMENTS_SYSTEM : MENU_SYSTEM,
        messages: [{ role: 'user', content: buildNutritionMessage(payload) }]
      })
      const parsed = parseAdviceJson(extractText(response))
      if (payload.type === 'supplements') {
        return { ok: true, plan: SuppPlanSchema.parse(parsed) }
      }
      return { ok: true, plan: MenuPlanSchema.parse(parsed) }
    } catch (err) {
      if (err instanceof AIError) return { ok: false, error: err.message, code: err.code }
      if (err instanceof z.ZodError) {
        return { ok: false, error: 'Le JSON Anthropic ne correspond pas au schéma attendu.', code: 'BAD_RESPONSE' as AIErrorCode }
      }
      return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue', code: 'BAD_RESPONSE' as AIErrorCode }
    }
  })
}
