/**
 * Q-AAP — Questionnaire sur l'aptitude à l'activité physique (PAR-Q), version
 * SCPE révisée 2002. Formulaire standard rempli à l'admission d'un client.
 *
 * Règle clinique : **une seule réponse « OUI » ⇒ consulter un médecin AVANT**
 * d'entreprendre ou d'augmenter l'activité physique. L'autorisation est valide
 * **12 mois** (ou moins si l'état de santé change).
 *
 * Ce module est PUR (aucune dépendance Electron/DB) — testable via node --test.
 */

/** Les 7 questions officielles du Q-AAP (texte SCPE, dans l'ordre du formulaire). */
export const QAAP_QUESTIONS: readonly string[] = [
  "Votre médecin vous a-t-il déjà dit que vous souffriez d'un problème cardiaque et que vous ne deviez participer qu'aux activités physiques prescrites et approuvées par un médecin ?",
  "Ressentez-vous une douleur à la poitrine lorsque vous faites de l'activité physique ?",
  "Au cours du dernier mois, avez-vous ressenti des douleurs à la poitrine lors de périodes autres que celles où vous participiez à une activité physique ?",
  "Éprouvez-vous des problèmes d'équilibre reliés à un étourdissement ou vous arrive-t-il de perdre connaissance ?",
  "Avez-vous des problèmes osseux ou articulaires (par exemple, au dos, au genou ou à la hanche) qui pourraient s'aggraver par une modification de votre niveau de participation à une activité physique ?",
  "Des médicaments vous sont-ils actuellement prescrits pour contrôler votre tension artérielle ou un problème cardiaque (par exemple, des diurétiques) ?",
  "Connaissez-vous une autre raison pour laquelle vous ne devriez pas faire de l'activité physique ?"
] as const

export const QAAP_QUESTION_COUNT = QAAP_QUESTIONS.length

/**
 * Données saisies d'un Q-AAP. `answers` a toujours 7 entrées :
 *   `true` = OUI, `false` = NON, `null` = pas encore répondu.
 */
export interface QaapData {
  answers: (boolean | null)[]
  /** Précision libre pour la Q7 (« une autre raison ») ou remarques générales. */
  precision?: string
  /** Note interne de Marie (jamais montrée au client). */
  notes?: string
}

/** Validité réglementaire du Q-AAP, en mois, à compter de la date de passation. */
export const QAAP_VALIDITY_MONTHS = 12

/** Crée un Q-AAP vierge (7 réponses non renseignées). */
export function emptyQaap(): QaapData {
  return { answers: Array<boolean | null>(QAAP_QUESTION_COUNT).fill(null) }
}

/** `true` si au moins une réponse est « OUI » ⇒ recommandation de consulter un médecin. */
export function qaapHasWarning(data: QaapData): boolean {
  return data.answers.some(a => a === true)
}

/** `true` tant qu'aucune réponse n'est renseignée (formulaire vierge). */
export function qaapIsBlank(data: QaapData): boolean {
  return data.answers.every(a => a === null)
}

/** `true` si les 7 questions ont une réponse (OUI ou NON). */
export function qaapIsComplete(data: QaapData): boolean {
  return data.answers.length === QAAP_QUESTION_COUNT && data.answers.every(a => a !== null)
}

/** Indices (1-based) des questions répondues « OUI ». */
export function qaapYesIndices(data: QaapData): number[] {
  const out: number[] = []
  data.answers.forEach((a, i) => {
    if (a === true) out.push(i + 1)
  })
  return out
}

/**
 * Date d'expiration ISO (AAAA-MM-JJ) = date de passation + 12 mois.
 * Robuste au 29 février (retombe sur le dernier jour du mois cible si besoin).
 */
export function qaapExpiryDate(dateISO: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) // 1-12
  const d = Number(m[3])
  const totalMonths = (y * 12 + (mo - 1)) + QAAP_VALIDITY_MONTHS
  const ny = Math.floor(totalMonths / 12)
  const nmo = totalMonths % 12 // 0-11
  const lastDay = new Date(ny, nmo + 1, 0).getDate()
  const nd = Math.min(d, lastDay)
  return `${ny}-${String(nmo + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

/** `true` si le Q-AAP passé le `dateISO` est expiré au regard de `todayISO`. */
export function qaapIsExpired(dateISO: string, todayISO: string): boolean {
  const expiry = qaapExpiryDate(dateISO)
  return expiry !== null && todayISO > expiry
}
