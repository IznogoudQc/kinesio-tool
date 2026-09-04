/**
 * Un pli, plusieurs prises : « 5/5,5 » vaut 5,25 mm.
 *
 * Marie reprend chaque pli deux ou trois fois — le pincement bouge, la lecture
 * aussi — et c'est la moyenne qui est retenue. Elle écrit les prises dans le
 * champ, séparées par une barre oblique, plutôt que de faire le calcul de tête.
 *
 * Une seule valeur reste une valeur : le champ se saisit comme avant.
 */

/** Ce que le champ contient, une fois relu. */
export interface SaisiePlis {
  /** Valeur retenue — la moyenne des prises. `null` = saisie illisible ou vide. */
  valeur: number | null
  /** Combien de prises ont été écrites (1 = saisie ordinaire). */
  prises: number
}

/**
 * Relit le contenu d'un champ de pli.
 *
 * La virgule décimale est acceptée : au Québec on écrit « 5,5 » avant « 5.5 ».
 * Les segments vides sont ignorés, sinon la valeur disparaîtrait pendant la
 * frappe, entre la barre oblique et le chiffre suivant.
 *
 * Un nombre seul n'est PAS arrondi — on rend exactement ce qui est écrit. La
 * moyenne, elle, est arrondie au dixième : elle est calculée, pas mesurée, et
 * trois décimales donneraient une fausse impression de précision.
 */
export function lireSaisiePlis(texte: string): SaisiePlis {
  const segments = texte
    .split('/')
    .map(p => p.trim().replace(',', '.'))
    .filter(p => p !== '')
  if (segments.length === 0) return { valeur: null, prises: 0 }

  const prises: number[] = []
  for (const seg of segments) {
    const n = Number(seg)
    // Un pli négatif n'existe pas, et « abc » n'est pas une mesure : dans les
    // deux cas on préfère ne rien retenir plutôt que d'inventer un chiffre.
    if (!Number.isFinite(n) || n < 0) return { valeur: null, prises: segments.length }
    prises.push(n)
  }

  if (prises.length === 1) return { valeur: prises[0], prises: 1 }
  const moyenne = prises.reduce((a, b) => a + b, 0) / prises.length
  return { valeur: Math.round(moyenne * 10) / 10, prises: prises.length }
}
