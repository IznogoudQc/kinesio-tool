/**
 * Recommandations du Guide alimentaire canadien (Santé Canada, 2019).
 *
 * Source : Guide alimentaire canadien — « Guide alimentaire en bref »,
 * guide-alimentaire.canada.ca. Texte officiel repris tel quel, sans reformulation :
 * ce sont des messages de santé publique, pas une interprétation clinique.
 *
 * Le guide les présente en DEUX volets, distinction conservée ici : ce que l'on
 * mange, et la manière de manger. Les quatre derniers ne portent sur aucun
 * aliment — les fondre dans une liste unique de huit ferait perdre ce sens.
 *
 * Champ de pratique : recommandations générales de santé publique, sans
 * quantités ni prescription individuelle — donc dans le champ du kinésiologue,
 * contrairement à un plan nutritionnel personnalisé (acte réservé, OPDQ).
 *
 * Module autonome (aucun import) : il traverse la frontière Electron/renderer.
 */

export interface GuideAlimentaireVolet {
  /** Intitulé du volet, tel que le guide l'organise. */
  titre: string
  conseils: string[]
}

export const GUIDE_ALIMENTAIRE_VOLETS: GuideAlimentaireVolet[] = [
  {
    titre: 'Ce que vous mangez',
    conseils: [
      'Mangez des légumes et des fruits en abondance',
      'Consommez des aliments protéinés',
      'Choisissez des aliments à grains entiers',
      'Faites de l’eau votre boisson de choix'
    ]
  },
  {
    titre: 'Votre manière de manger',
    conseils: [
      'Prenez conscience de vos habitudes alimentaires',
      'Cuisinez plus souvent',
      'Savourez vos aliments',
      'Prenez vos repas en bonne compagnie'
    ]
  }
]

/** Attribution à afficher sous les conseils — jamais de conseils sans leur source. */
export const GUIDE_ALIMENTAIRE_SOURCE = 'Guide alimentaire canadien — Santé Canada, 2019'

/** Les huit conseils à plat, quand la mise en page ne permet pas les deux volets. */
export function guideAlimentaireConseils(): string[] {
  return GUIDE_ALIMENTAIRE_VOLETS.flatMap(v => v.conseils)
}
