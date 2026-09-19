/**
 * Mesures gardées en base mais retirées de l'affichage.
 *
 * Ces colonnes de `mesures_circonferences` existent toujours : des imports
 * anciens en contiennent des valeurs, et l'export `.kinesio` continue de les
 * transporter. Mais le formulaire de saisie ne les propose plus, donc Marie ne
 * les met jamais à jour — et une valeur figée à côté de mesures vivantes se lit
 * comme une mesure d'aujourd'hui. « Pourquoi une Poitrine à 132 cm en juillet
 * 2026, on ne l'a jamais reprise ? »
 *
 * Ce qui rend ces trois-là trompeuses en particulier : chacune a une jumelle
 * ACTIVE. « Biceps fléchi » et « Biceps fléchi (droit)» côte à côte laissent
 * croire à une mesure gauche/droite, alors que la colonne de droite vient d'un
 * ancien import et que celle de gauche n'a pas de côté.
 *
 * Voir `docs/decisions/0042-champs-mesures-legacy.md`.
 *
 * Pour réactiver une mesure : la retirer d'ici ET la rajouter au formulaire
 * (`src/lib/mesure-fields.ts`). Les points historiques reviennent d'eux-mêmes
 * dans les encadrés, les courbes et le tableau — rien n'a été effacé.
 *
 * Module PUR, sans type importé : il est lu par le processus principal comme par
 * le renderer, et `mesures-legacy-fields.test.ts` vérifie que chaque clé est bien
 * une colonne réelle du schéma (ce qu'un `keyof` ne garantirait pas à travers les
 * deux tsconfig).
 */

/** Colonnes de circonférences retirées de l'affichage. */
export const LEGACY_CIRC_FIELDS: ReadonlySet<string> = new Set([
  // Le formulaire ne prend qu'un biceps, écrit dans `bicepsG` et sans côté.
  'bicepsD',
  // Idem pour la cuisse.
  'cuisseD',
  // Remplacée par « Épaules et pec », qui mesure plus haut sur le torse.
  'poitrine'
])

/**
 * Plis retirés de l'affichage — aucun.
 *
 * Les quatre plis du calcul Durnin-Womersley et le mollet du CPAFLA sont tous
 * proposés à la saisie. La liste existe pour que le filtre soit écrit une fois
 * pour les deux familles.
 */
export const LEGACY_PLIS_FIELDS: ReadonlySet<string> = new Set([])
