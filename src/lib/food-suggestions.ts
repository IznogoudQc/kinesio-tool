/** Les cinq listes d'aliments proposés, éditables dans les Paramètres. */
export type FoodListName =
  | 'good'
  | 'bad'
  | 'proteines'
  | 'glucides'
  | 'lipides'
  | 'pref_semaine'
  | 'pref_weekend'

/** Icône de chaque liste, par son nom lucide — résolue par la carte. */
export const FOOD_LIST_ICONES: Record<FoodListName, 'apple' | 'ban' | 'target' | 'clock'> = {
  good: 'apple',
  bad: 'ban',
  proteines: 'target',
  glucides: 'target',
  lipides: 'target',
  pref_semaine: 'clock',
  pref_weekend: 'clock'
}

/** Intitulé de chaque liste — un seul endroit pour les nommer. */
export const FOOD_LIST_TITRES: Record<FoodListName, string> = {
  good: 'Aliments à privilégier',
  bad: 'Aliments à éviter',
  proteines: 'Sources de protéines',
  glucides: 'Sources de glucides',
  lipides: 'Sources de lipides',
  pref_semaine: 'Contraintes de semaine',
  pref_weekend: 'Contraintes de fin de semaine'
}

/**
 * Propositions pour « Préférences par repas ».
 *
 * Ce ne sont PAS des aliments : ce sont des contraintes de vie réelle — combien
 * de temps on a, ce qu'on peut préparer d'avance, ce qui se transporte. Les
 * aliments se choisissent déjà ailleurs ; ici on décrit la situation, et l'IA en
 * déduit quoi proposer.
 */
export const SUGGESTIONS_PREF_SEMAINE: string[] = [
  'Rapide, moins de 15 minutes',
  'Sans cuisson',
  'Préparé la veille',
  'Se transporte (boîte à lunch)',
  'Restes du souper',
  'Se mange froid',
  'Sur le pouce',
  'Peu de vaisselle',
  'Souvent des salades',
  'Léger'
]

export const SUGGESTIONS_PREF_WEEKEND: string[] = [
  'Plus de temps pour cuisiner',
  'Cuisson possible (four, poêle)',
  'Brunch',
  'Repas familial',
  'Occasion de cuisiner en double pour la semaine',
  'Plat mijoté',
  'Poisson frais',
  'Déjeuner plus copieux',
  'Sortie ou repas au restaurant',
  'Dessert occasionnel'
]

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
