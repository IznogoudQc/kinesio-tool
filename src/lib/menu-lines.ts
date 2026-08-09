/**
 * Structure et manipulation des lignes d'une journée de menu.
 *
 * Une journée est stockée en TEXTE LIBRE dans un `<textarea>` — Marie doit
 * pouvoir tout réécrire à la main. Refaire un seul repas demande donc de
 * retrouver sa ligne dans ce texte, sans toucher au reste ni à ce qu'elle a
 * pu modifier elle-même.
 *
 * Module pur et testé : ce genre de découpage échoue en silence (une ligne
 * dupliquée, un repas qui disparaît) et le défaut ne se voit qu'au document
 * remis au client.
 */

/**
 * Les repas nommés, selon le nombre pris dans la journée.
 *
 * Deux repas veut dire **pas de déjeuner** — c'est le matin qui saute, pas le
 * souper (demande de Nicholas, 2026-08-08). Un seul repas ne garde que le
 * souper : c'est la forme que prend un jeûne intermittent poussé.
 */
const NOMS_REPAS: Record<number, string[]> = {
  1: ['Souper'],
  2: ['Dîner', 'Souper'],
  3: ['Déjeuner', 'Dîner', 'Souper']
}

/** Nombre de repas nommés proposés au choix. */
export const REPAS_POSSIBLES = [1, 2, 3] as const
/** Nombre de collations proposé au choix — zéro est un choix valide. */
export const COLLATIONS_POSSIBLES = [0, 1, 2, 3] as const

/**
 * Les lignes attendues dans une journée, dans l'ordre de lecture.
 *
 * C'est la SEULE source de cette structure : le prompt de l'IA, les boutons
 * « Refaire » et le remplacement de ligne la lisent tous ici. Trois endroits qui
 * décideraient chacun quels repas existent finiraient par ne plus s'accorder —
 * et Marie verrait un bouton « Collation » sur une journée qui n'en a pas.
 */
export function structureJournee(repas: number, collations: number): string[] {
  const r = NOMS_REPAS[Math.min(3, Math.max(1, Math.round(repas)))] ?? NOMS_REPAS[3]
  const n = Math.min(3, Math.max(0, Math.round(collations)))
  const c = n === 0 ? [] : n === 1 ? ['Collation'] : Array.from({ length: n }, (_, i) => `Collation ${i + 1}`)
  return [...r, ...c]
}

/**
 * Reconnaît le début d'une ligne de repas, tolérante à ce que Marie a pu taper :
 * accents absents, minuscules, espace avant le deux-points, tiret de liste.
 * « dejeuner: ... » et « - Déjeuner : ... » désignent le même repas.
 */
function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Échappe ce qui a un sens en expression régulière (« Collation 1 » n'en a pas,
 *  mais le nom vient d'une donnée : mieux vaut ne pas en dépendre). */
function echappe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Vrai si `ligne` est la ligne du repas donné.
 *
 * Le nom doit être suivi d'un **deux-points** : sans cette exigence, une note
 * libre comme « Souper léger les soirs d'entraînement » serait prise pour le
 * souper et écrasée.
 */
export function estLigneDe(ligne: string, repas: string): boolean {
  const l = normalise(ligne).replace(/^[-*•\s]+/, '')
  return new RegExp(`^${echappe(normalise(repas))}\\s*:`).test(l)
}

/** La ligne actuelle du repas dans la journée, ou `null` si elle n'y est pas. */
export function ligneDuRepas(journee: string, repas: string): string | null {
  for (const ligne of journee.split('\n')) {
    if (ligne.trim() && estLigneDe(ligne, repas)) return ligne.trim()
  }
  return null
}

/**
 * Remplace la ligne d'un repas par `nouvelle`, en gardant tout le reste intact.
 *
 * Si le repas n'existe pas encore dans la journée, la ligne est **insérée à sa
 * place** selon `ordre`, plutôt qu'ajoutée à la fin : une journée dont le
 * déjeuner arrive après le souper se relit mal.
 *
 * Les lignes vides de séparation sont préservées telles quelles.
 */
export function remplacerRepas(
  journee: string,
  repas: string,
  nouvelle: string,
  ordre: string[] = structureJournee(3, 1)
): string {
  const propre = nouvelle.trim()
  if (!propre) return journee

  const lignes = journee.split('\n')
  const i = lignes.findIndex(l => l.trim() && estLigneDe(l, repas))
  if (i !== -1) {
    lignes[i] = propre
    return lignes.join('\n')
  }

  // Absent : insérer avant le premier repas qui vient APRÈS lui dans l'ordre.
  const suivants = ordre.slice(ordre.indexOf(repas) + 1)
  const j =
    ordre.indexOf(repas) === -1
      ? -1
      : lignes.findIndex(l => l.trim() && suivants.some(r => estLigneDe(l, r)))
  if (j === -1) {
    const base = journee.trimEnd()
    return base ? `${base}\n\n${propre}` : propre
  }
  lignes.splice(j, 0, propre, '')
  return lignes.join('\n')
}
