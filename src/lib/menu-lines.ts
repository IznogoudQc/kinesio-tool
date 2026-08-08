/**
 * Manipulation des lignes d'une journée de menu.
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

/** Les quatre repas, dans l'ordre où ils apparaissent dans une journée. */
export const REPAS = ['Déjeuner', 'Dîner', 'Souper', 'Collations'] as const
export type Repas = (typeof REPAS)[number]

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

/**
 * Vrai si `ligne` est la ligne du repas donné.
 *
 * Le nom doit être suivi d'un **deux-points** : sans cette exigence, une note
 * libre comme « Souper léger les soirs d'entraînement » serait prise pour le
 * souper et écrasée.
 */
export function estLigneDe(ligne: string, repas: Repas): boolean {
  const l = normalise(ligne).replace(/^[-*•\s]+/, '')
  return new RegExp(`^${normalise(repas)}\\s*:`).test(l)
}

/** La ligne actuelle du repas dans la journée, ou `null` si elle n'y est pas. */
export function ligneDuRepas(journee: string, repas: Repas): string | null {
  for (const ligne of journee.split('\n')) {
    if (ligne.trim() && estLigneDe(ligne, repas)) return ligne.trim()
  }
  return null
}

/**
 * Remplace la ligne d'un repas par `nouvelle`, en gardant tout le reste intact.
 *
 * Si le repas n'existe pas encore dans la journée, la ligne est **insérée à sa
 * place** dans l'ordre Déjeuner → Dîner → Souper → Collations, plutôt qu'ajoutée
 * à la fin : une journée dont le déjeuner arrive après le souper se relit mal.
 *
 * Les lignes vides de séparation sont préservées telles quelles.
 */
export function remplacerRepas(journee: string, repas: Repas, nouvelle: string): string {
  const propre = nouvelle.trim()
  if (!propre) return journee

  const lignes = journee.split('\n')
  const i = lignes.findIndex(l => l.trim() && estLigneDe(l, repas))
  if (i !== -1) {
    lignes[i] = propre
    return lignes.join('\n')
  }

  // Absent : insérer avant le premier repas qui vient APRÈS lui dans l'ordre.
  const rang = REPAS.indexOf(repas)
  const suivants = REPAS.slice(rang + 1)
  const j = lignes.findIndex(l => l.trim() && suivants.some(r => estLigneDe(l, r)))
  if (j === -1) {
    const base = journee.trimEnd()
    return base ? `${base}\n\n${propre}` : propre
  }
  lignes.splice(j, 0, propre, '')
  return lignes.join('\n')
}
