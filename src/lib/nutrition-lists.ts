/**
 * Lecture des listes d'aliments saisies à la main.
 *
 * Marie tape ses listes dans un champ libre, une ligne par aliment. Elle y
 * laisse parfois une virgule de fin — « Poulet, » — parce qu'on écrit une liste
 * comme on écrit une phrase. Sans nettoyage, cette virgule voyage :
 *
 *  · dans le prompt, la liste devient « Poulet,, Yogourt grec » ;
 *  · dans les propositions, la pastille « Poulet » ne se coche pas, parce que
 *    « poulet, » n'est pas « poulet ». Marie l'ajoute une deuxième fois.
 *
 * On NE découpe PAS sur les virgules : plusieurs propositions en contiennent
 * une à l'intérieur (« Amandes, noix de Grenoble », « Poisson blanc (morue,
 * tilapia) »). Le séparateur est le retour de ligne, et rien d'autre.
 */

/** Ponctuation de liste en début ou en fin d'élément — puce, tiret, virgule. */
const BORDURES = /^[\s,;•*\-–—]+|[\s,;]+$/g

/**
 * Les aliments d'une liste, nettoyés : sans ligne vide, sans ponctuation de
 * bord. L'intérieur de chaque élément est laissé intact.
 */
export function elementsListe(brut?: string | null): string[] {
  return (brut ?? '')
    .split('\n')
    .map(l => l.replace(BORDURES, ''))
    .filter(Boolean)
}

/** La même liste, sur une ligne — la forme qu'attend le prompt. */
export function listeLisible(brut?: string | null): string {
  return elementsListe(brut).join(', ')
}

/**
 * Forme de comparaison d'un aliment : c'est elle qui décide si une proposition
 * est déjà cochée. Insensible à la casse et à la ponctuation de bord.
 */
export function cleListe(aliment: string): string {
  return aliment.replace(BORDURES, '').toLowerCase()
}
