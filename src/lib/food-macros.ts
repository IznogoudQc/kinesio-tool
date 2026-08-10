/**
 * Macros indicatives des aliments proposés, pour 100 g de portion comestible.
 *
 * ── Ce que c'est, et ce que ce n'est pas ────────────────────────────────────
 *
 * Des valeurs de RÉFÉRENCE, encodées une fois, pas des estimations d'un modèle.
 * C'est ce qui les rend affichables : elles ne changent pas d'un appel à
 * l'autre, et n'importe qui peut les recouper avec une table de composition.
 *
 * Elles restent **approximatives par nature** : les propositions sont des
 * catégories (« Légumineuses (pois chiches, lentilles) », « Fruits frais »), pas
 * des aliments précis. Un pois chiche et une lentille ne sont pas identiques.
 * D'où l'affichage « ≈ » partout et le pas de 1 g — donner une décimale
 * suggérerait une précision que la catégorie n'a pas.
 *
 * Ordres de grandeur d'après le Fichier canadien sur les éléments nutritifs
 * (Santé Canada) et l'USDA FoodData Central, portions cuites quand ça a du sens
 * (riz, pâtes, légumineuses) — c'est ainsi qu'on les mange.
 *
 * ⚠️ Sert à AIDER MARIE à juger une portion, jamais à calculer l'apport d'un
 * client : ce calcul relève de la nutritionniste (voir la note « champ de
 * pratique » du projet). Aucune de ces valeurs n'entre dans un document remis.
 */

export interface MacrosPour100g {
  /** Protéines (g). */
  p: number
  /** Glucides (g). */
  g: number
  /** Lipides (g). */
  l: number
}

/**
 * Clé = intitulé EXACT de la proposition dans `food-suggestions.ts`.
 *
 * Un test vérifie que chaque proposition par défaut a son entrée : ajouter une
 * suggestion sans sa composition la laisserait muette à l'écran, sans que
 * personne s'en aperçoive.
 */
export const MACROS_PAR_100G: Record<string, MacrosPour100g> = {
  // ── Protéines ─────────────────────────────────────────────────────────────
  'Poisson blanc (morue, tilapia)': { p: 22, g: 0, l: 1 },
  'Saumon, truite': { p: 22, g: 0, l: 12 },
  'Poulet, dinde': { p: 31, g: 0, l: 4 },
  'Œufs': { p: 13, g: 1, l: 10 },
  'Légumineuses (pois chiches, lentilles)': { p: 9, g: 20, l: 2 },
  'Yogourt grec': { p: 10, g: 4, l: 0 },
  'Tofu, tempeh': { p: 15, g: 4, l: 8 },
  'Fromage feta, ricotta': { p: 12, g: 4, l: 18 },
  'Thon en conserve': { p: 25, g: 0, l: 1 },
  'Crevettes': { p: 24, g: 0, l: 1 },

  // ── Glucides ──────────────────────────────────────────────────────────────
  'Riz brun': { p: 3, g: 23, l: 1 },
  'Quinoa': { p: 4, g: 21, l: 2 },
  'Pâtes de blé entier': { p: 5, g: 27, l: 1 },
  'Pain de blé entier, pita': { p: 9, g: 43, l: 3 },
  'Patate douce': { p: 2, g: 20, l: 0 },
  'Couscous de blé entier': { p: 4, g: 23, l: 0 },
  'Avoine (gruau)': { p: 2, g: 12, l: 1 },
  'Fruits frais': { p: 1, g: 14, l: 0 },
  'Légumineuses': { p: 9, g: 20, l: 2 },
  'Orge, boulgour': { p: 3, g: 19, l: 0 },

  // ── Lipides ───────────────────────────────────────────────────────────────
  'Huile d’olive': { p: 0, g: 0, l: 100 },
  'Avocat': { p: 2, g: 9, l: 15 },
  'Amandes, noix de Grenoble': { p: 18, g: 15, l: 55 },
  'Graines de tournesol, de citrouille': { p: 23, g: 20, l: 49 },
  'Olives': { p: 1, g: 6, l: 11 },
  'Poissons gras (saumon, sardines)': { p: 22, g: 0, l: 12 },
  'Beurre d’arachide naturel': { p: 25, g: 20, l: 50 },
  'Tahini': { p: 17, g: 21, l: 54 },
  'Fromage feta': { p: 14, g: 4, l: 21 },
  'Graines de lin moulues': { p: 18, g: 29, l: 42 }
}

/** Le macro mis en avant selon la colonne où l'aliment est proposé. */
export type MacroMisEnAvant = 'p' | 'g' | 'l'

export const SUFFIXE_MACRO: Record<MacroMisEnAvant, string> = { p: 'P', g: 'G', l: 'L' }

/**
 * Composition d'un aliment, ou `null` s'il n'est pas dans la table.
 *
 * `null` est un cas NORMAL, pas une erreur : Marie ajoute ses propres aliments,
 * et ils n'auront pas de valeur. Mieux vaut ne rien afficher qu'un chiffre
 * inventé pour « Fromage cottage » parce qu'il ressemble à « Fromage feta ».
 */
export function macrosDe(aliment: string): MacrosPour100g | null {
  return MACROS_PAR_100G[aliment.trim()] ?? null
}

/** « ≈ 31 g P » — l'étiquette compacte affichée sur une proposition. */
export function etiquetteMacro(aliment: string, macro: MacroMisEnAvant): string | null {
  const m = macrosDe(aliment)
  if (!m) return null
  return `≈ ${m[macro]} g ${SUFFIXE_MACRO[macro]}`
}
