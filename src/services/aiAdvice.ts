import type { MetricSelection } from '../contexts/AIAdviceContext'

export interface AIAdvicePayload {
  sex: 'F' | 'M' | null
  age: number | null
  metrics: MetricSelection[]
}

export interface AIAdvice {
  diagnostic: string
  objectifsPrioritaires: string[]
  programmeIntegre: {
    cardio: string[]
    musculation: string[]
    souplesse: string[]
    habitudes: string[]
  }
  echeance: string
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
  }
}

/** Formate une `AIAdvice` en markdown — utilisé par le bouton « Copier ». */
export function formatAdviceAsText(advice: AIAdvice): string {
  const lines: string[] = []
  lines.push('# Conseils kinésiologie\n')
  lines.push('## Diagnostic')
  lines.push(advice.diagnostic + '\n')
  lines.push('## Objectifs prioritaires')
  for (const o of advice.objectifsPrioritaires) lines.push(`- ${o}`)
  lines.push('\n## Programme intégré')
  lines.push('\n### Cardio')
  for (const x of advice.programmeIntegre.cardio) lines.push(`- ${x}`)
  lines.push('\n### Musculation')
  for (const x of advice.programmeIntegre.musculation) lines.push(`- ${x}`)
  lines.push('\n### Souplesse')
  for (const x of advice.programmeIntegre.souplesse) lines.push(`- ${x}`)
  lines.push('\n### Habitudes')
  for (const x of advice.programmeIntegre.habitudes) lines.push(`- ${x}`)
  lines.push('\n## Échéance')
  lines.push(advice.echeance + '\n')
  lines.push('## Avertissements')
  for (const w of advice.warnings) lines.push(`- ${w}`)
  return lines.join('\n')
}
