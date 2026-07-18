import type { MetricSelection } from '../contexts/AIAdviceContext'

export interface AIAdvicePayload {
  sex: 'F' | 'M' | null
  age: number | null
  metrics: MetricSelection[]
}

export interface AIForce {
  titre: string
  explication: string
}
export interface AIWeakness {
  titre: string
  explication: string
  piste: string
}
/** Analyse « forces & à travailler » du bilan complet (remplace l'ancien
 *  programme intégré sur sélection manuelle). */
export interface AIAdvice {
  synthese: string
  forces: AIForce[]
  aTravailler: AIWeakness[]
  warnings: string[]
}

/** Code d'erreur normalisé renvoyé par l'IPC pour permettre au renderer
 *  d'afficher des messages contextuels (notamment NO_API_KEY → modal vers
 *  les paramètres). */
export type AIErrorCode =
  | 'NO_API_KEY'
  | 'INVALID_KEY'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'BAD_RESPONSE'
  | 'TIMEOUT'

export class AIAdviceError extends Error {
  constructor(public code: AIErrorCode, message: string) {
    super(message)
    this.name = 'AIAdviceError'
  }
}

/**
 * Service de génération de conseils IA — appelle Anthropic Claude via l'IPC.
 * La clé API vit dans le trousseau OS (keytar) — le renderer ne la voit jamais.
 */
export const aiAdviceService = {
  async hasApiKey(): Promise<boolean> {
    return window.api.ai.hasApiKey()
  },

  async setApiKey(key: string): Promise<void> {
    return window.api.ai.setApiKey(key)
  },

  async removeApiKey(): Promise<void> {
    return window.api.ai.removeApiKey()
  },

  /** Petit appel de ping pour valider la clé. Retourne null si OK, sinon
   *  un message d'erreur lisible. */
  async testConnection(): Promise<{ ok: true } | { ok: false; error: string; code: AIErrorCode }> {
    const res = await window.api.ai.testConnection()
    if (res.ok) return { ok: true }
    return { ok: false, error: res.error ?? 'Erreur inconnue', code: (res.code as AIErrorCode) ?? 'BAD_RESPONSE' }
  },

  async generate(payload: AIAdvicePayload): Promise<AIAdvice> {
    const res = await window.api.ai.generate(payload)
    if (!res.ok || !res.advice) {
      throw new AIAdviceError(
        (res.code as AIErrorCode) ?? 'BAD_RESPONSE',
        res.error ?? 'Erreur inconnue lors de la génération.'
      )
    }
    return res.advice as AIAdvice
  },

  /** IA : répartit les suppléments saisis dans les moments de prise (structuré). */
  async generateSupplementsPlan(supplements: string): Promise<AiSuppPlan> {
    const res = await window.api.ai.generateNutrition({ type: 'supplements', supplements })
    if (!res.ok || !res.plan) {
      throw new AIAdviceError(
        (res.code as AIErrorCode) ?? 'BAD_RESPONSE',
        res.error ?? 'Erreur inconnue lors de la génération.'
      )
    }
    return res.plan as AiSuppPlan
  },

  /** IA : idées de menu structurées (jusqu'à 2 journées) selon macros + aliments. */
  async generateMenuPlan(payload: {
    kcal?: number | null
    proteinG?: number | null
    fatG?: number | null
    carbsG?: number | null
    fiberG?: number | null
    foodsGood?: string
    foodsBad?: string
    foodsLiked?: string
    foodsDisliked?: string
  }): Promise<AiMenuPlan> {
    const res = await window.api.ai.generateNutrition({ type: 'menu', ...payload })
    if (!res.ok || !res.plan) {
      throw new AIAdviceError(
        (res.code as AIErrorCode) ?? 'BAD_RESPONSE',
        res.error ?? 'Erreur inconnue lors de la génération.'
      )
    }
    return res.plan as AiMenuPlan
  },

  /** IA : moment de prise recommandé pour un supplément (nom → phrase courte). */
  async suggestSupplementTiming(name: string): Promise<string> {
    const res = await window.api.ai.supplementTiming(name)
    if (!res.ok || typeof res.timing !== 'string') {
      throw new AIAdviceError(
        (res.code as AIErrorCode) ?? 'BAD_RESPONSE',
        res.error ?? 'Erreur inconnue lors de la suggestion.'
      )
    }
    return res.timing
  },

  /** IA : suggestions de description de douleur pour une zone du corps. */
  async suggestPainDescriptions(payload: {
    zone: string
    severity?: 'jaune' | 'rouge'
    conditions?: string
  }): Promise<string[]> {
    const res = await window.api.ai.painSuggestions(payload)
    if (!res.ok || !Array.isArray(res.suggestions)) {
      throw new AIAdviceError(
        (res.code as AIErrorCode) ?? 'BAD_RESPONSE',
        res.error ?? 'Erreur inconnue lors de la suggestion.'
      )
    }
    return res.suggestions
  }
}

/** Plan de suppléments renvoyé par l'IA : lignes par moment de prise. */
export interface AiSuppPlan {
  reveil: string[]
  dejeuner: string[]
  apresEntrainement: string[]
  souper: string[]
  coucher: string[]
  interactions: string[]
}

/** Idées de menu renvoyées par l'IA : journées, chacune une liste de lignes. */
export interface AiMenuPlan {
  journees: { lignes: string[] }[]
}

/** Formate une `AIAdvice` (forces & à travailler) en markdown — bouton « Copier ». */
export function formatAdviceAsText(advice: AIAdvice): string {
  const lines: string[] = []
  lines.push('# Forces & à travailler\n')
  lines.push(advice.synthese + '\n')
  lines.push('## Forces')
  for (const f of advice.forces) lines.push(`- **${f.titre}** — ${f.explication}`)
  lines.push('\n## À travailler')
  for (const w of advice.aTravailler) lines.push(`- **${w.titre}** — ${w.explication}\n  Piste : ${w.piste}`)
  if (advice.warnings.length) {
    lines.push('\n## Avertissements')
    for (const w of advice.warnings) lines.push(`- ${w}`)
  }
  return lines.join('\n')
}
