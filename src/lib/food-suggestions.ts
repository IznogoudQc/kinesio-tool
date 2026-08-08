/**
 * Aliments proposés dans l'onglet Nutrition (puces cliquables) pour « À privilégier »
 * et « À éviter ». GLOBALES (valent pour tous les clients) et modifiables par Marie :
 * stockées dans les réglages (`nutrition.foods_good` / `nutrition.foods_bad`). Ces
 * valeurs sont les listes par défaut, servies tant que rien n'est personnalisé.
 * Partagé par le renderer (UI) et le main (défaut IPC).
 */

/**
 * Suggestions par MACRONUTRIMENT, dans l'esprit méditerranéen des menus.
 *
 * Ce sont des propositions cliquables, pas un barème : Marie tape ce qu'elle
 * veut par-dessus. Elles servent surtout à ce qu'un champ vide ne le reste pas
 * faute de savoir quoi y mettre.
 */
export const SUGGESTIONS_PROTEINES: string[] = [
  'Poisson blanc (morue, tilapia)',
  'Saumon, truite',
  'Poulet, dinde',
  'Œufs',
  'Légumineuses (pois chiches, lentilles)',
  'Yogourt grec',
  'Tofu, tempeh',
  'Fromage feta, ricotta',
  'Thon en conserve',
  'Crevettes'
]

export const SUGGESTIONS_GLUCIDES: string[] = [
  'Riz brun',
  'Quinoa',
  'Pâtes de blé entier',
  'Pain de blé entier, pita',
  'Patate douce',
  'Couscous de blé entier',
  'Avoine (gruau)',
  'Fruits frais',
  'Légumineuses',
  'Orge, boulgour'
]

export const SUGGESTIONS_LIPIDES: string[] = [
  'Huile d’olive',
  'Avocat',
  'Amandes, noix de Grenoble',
  'Graines de tournesol, de citrouille',
  'Olives',
  'Poissons gras (saumon, sardines)',
  'Beurre d’arachide naturel',
  'Tahini',
  'Fromage feta',
  'Graines de lin moulues'
]

export const DEFAULT_FOODS_GOOD: string[] = [
  'Légumes verts',
  'Protéines maigres (poulet, poisson, œufs)',
  'Légumineuses',
  'Fruits entiers',
  'Grains entiers',
  'Noix et graines',
  'Yogourt grec',
  'Eau'
]

export const DEFAULT_FOODS_BAD: string[] = [
  'Sucres ajoutés',
  'Boissons sucrées',
  'Aliments ultra-transformés',
  'Alcool',
  'Fritures',
  'Charcuteries',
  'Grignotage le soir'
]
