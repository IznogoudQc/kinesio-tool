/**
 * Préférences de menu par repas et par moment de la semaine.
 *
 * Ce qui est réaliste un mardi matin ne l'est pas un dimanche matin : pas le
 * temps de faire une omelette en semaine, mais oui le week-end. Et ça se décide
 * repas par repas — « le midi, souvent des salades » ne dit rien du souper.
 *
 * Rangé en JSON dans une seule colonne plutôt qu'en huit champs : le tableau
 * fait 4 × 2 aujourd'hui, mais sa largeur suit la structure des journées, qui
 * change déjà selon le nombre de repas et de collations. Une colonne par case
 * aurait demandé une migration à chaque ajustement.
 */

export type MomentSemaine = 'semaine' | 'weekend'

/** Ce que Marie note pour un repas, aux deux moments. */
export interface PrefRepas {
  semaine: string
  weekend: string
}

/** Clé = nom du repas (« Déjeuner », « Collation 2 »…), tel que `structureJournee`. */
export type PrefsRepas = Record<string, PrefRepas>

/**
 * Journées 1 à 5 = semaine, 6 et 7 = fin de semaine (choix de Nicholas,
 * 2026-08-08). L'index est celui du tableau, donc à partir de zéro.
 */
export const JOURS_DE_SEMAINE = 5

export function momentDeJournee(index: number): MomentSemaine {
  return index < JOURS_DE_SEMAINE ? 'semaine' : 'weekend'
}

/** Libellé affiché sous le numéro de journée. */
export function libelleMoment(moment: MomentSemaine): string {
  return moment === 'semaine' ? 'semaine' : 'fin de semaine'
}

const VIDE: PrefRepas = { semaine: '', weekend: '' }

/**
 * Relit le JSON stocké, en tolérant tout ce qu'il peut être devenu : `null`,
 * chaîne vide, JSON invalide, ou objet d'une version antérieure dont la forme a
 * changé. Une préférence perdue est ennuyeuse ; un écran qui plante parce
 * qu'une valeur n'est pas une chaîne l'est davantage.
 */
export function parsePrefsRepas(raw: string | null | undefined): PrefsRepas {
  if (!raw?.trim()) return {}
  let brut: unknown
  try {
    brut = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {}
  const out: PrefsRepas = {}
  for (const [repas, v] of Object.entries(brut as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    out[repas] = {
      semaine: typeof o.semaine === 'string' ? o.semaine : '',
      weekend: typeof o.weekend === 'string' ? o.weekend : ''
    }
  }
  return out
}

/** `null` quand rien n'est renseigné — évite d'écrire `{}` en base à chaque
 *  enregistrement d'un client qui n'utilise pas cette section. */
export function serializePrefsRepas(prefs: PrefsRepas): string | null {
  const utiles: PrefsRepas = {}
  for (const [repas, p] of Object.entries(prefs)) {
    if (p.semaine.trim() || p.weekend.trim()) {
      utiles[repas] = { semaine: p.semaine.trim(), weekend: p.weekend.trim() }
    }
  }
  return Object.keys(utiles).length ? JSON.stringify(utiles) : null
}

/** La préférence d'un repas, jamais `undefined` — l'interface lie des champs. */
export function prefDe(prefs: PrefsRepas, repas: string): PrefRepas {
  return prefs[repas] ?? VIDE
}

/**
 * Les consignes à donner à l'IA pour un moment donné, une ligne par repas
 * renseigné. Vide si rien n'est noté : le prompt n'a alors pas à en parler.
 *
 * Suit `structure` et non les clés de `prefs` : une préférence laissée pour un
 * repas que le client ne prend plus ne doit pas revenir dans le menu.
 */
export function consignesPourMoment(
  prefs: PrefsRepas,
  structure: string[],
  moment: MomentSemaine
): string[] {
  const out: string[] = []
  for (const repas of structure) {
    const texte = prefDe(prefs, repas)[moment].trim()
    if (texte) out.push(`${repas} : ${texte.replace(/\s*\n\s*/g, ' · ')}`)
  }
  return out
}
