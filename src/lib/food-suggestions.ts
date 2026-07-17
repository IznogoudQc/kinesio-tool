/**
 * Aliments proposés dans l'onglet Nutrition (puces cliquables) pour « À privilégier »
 * et « À éviter ». GLOBALES (valent pour tous les clients) et modifiables par Marie :
 * stockées dans les réglages (`nutrition.foods_good` / `nutrition.foods_bad`). Ces
 * valeurs sont les listes par défaut, servies tant que rien n'est personnalisé.
 * Partagé par le renderer (UI) et le main (défaut IPC).
 */

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
