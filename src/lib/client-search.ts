/**
 * Tri et recherche de la liste des clients.
 *
 * Module pur, séparé de la page : c'est du texte français, et deux détails s'y
 * jouent qu'un tri naïf rate — les ACCENTS et la CASSE. `"É" < "a"` en
 * comparaison binaire, si bien qu'« Émilie » se retrouverait avant « Alain ».
 */

/** Retire accents et casse — sert à la RECHERCHE, jamais à l'affichage. */
function normalise(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/**
 * Trie par nom, ordre alphabétique français.
 *
 * `localeCompare('fr')` et non `<` : la comparaison binaire range les
 * majuscules avant les minuscules et rejette les lettres accentuées à la fin
 * de l'alphabet. `numeric` garde « Client 2 » avant « Client 10 ».
 *
 * Le tableau d'entrée n'est pas modifié — trier sur place une liste venue d'un
 * état React la ferait muter sans que React le sache.
 */
export function trierClients<T extends { name: string }>(clients: readonly T[]): T[] {
  return [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true })
  )
}

/**
 * Filtre par nom. Insensible aux accents, à la casse et aux espaces de bord.
 *
 * Une requête vide rend la liste entière : chercher « rien » ne veut pas dire
 * « aucun résultat ».
 *
 * La recherche porte sur le NOM seul, comme demandé — pas sur le courriel :
 * taper « gmail » ne doit pas remonter la moitié du fichier.
 */
export function filtrerClients<T extends { name: string }>(
  clients: readonly T[],
  requete: string
): T[] {
  const q = normalise(requete)
  if (!q) return [...clients]
  return clients.filter(c => normalise(c.name).includes(q))
}
