/**
 * Le titre de la couverture du document remis au client.
 *
 * Module à part — et non une fonction de plus dans `EditorialReport.tsx` — pour
 * deux raisons : c'est la **première phrase** qu'un client lit sur son bilan,
 * donc elle mérite d'être testée ; et `node --test` ne sait pas charger un
 * `.tsx`, donc une règle enfouie dans le composant reste hors de portée des
 * tests.
 *
 * Deux règles, dans cet ordre :
 *
 * 1. **Jamais de reproche.** Un client qui a régressé est invité à faire le
 *    point, pas sermonné.
 *
 * 2. **Jamais de félicitation sur un bilan faible.** « Vous tenez le cap »
 *    au-dessus d'un 0,6 sur 4 affirme que le cap est bon — il ne l'est pas.
 *    Sous « Bien », le titre reste neutre quelle que soit la variation.
 *
 * Le niveau se lit par la CATÉGORIE, pas par un seuil chiffré : elle vient du
 * même calcul que la phrase juste en dessous (« jugée acceptable »), donc les
 * deux ne peuvent pas se contredire.
 */

import type { Category } from '../lib/norms/types'

/** Ce que le titre consulte d'un `BilanComputed` — rien de plus. */
export interface HeadlineScore {
  overall: { score: number | null; category: Category | null }
}

/** Écart en deçà duquel on considère le score stable (bruit de mesure). */
const SEUIL = 0.1

export function headlineFor(
  firstName: string,
  computed: HeadlineScore,
  previous?: HeadlineScore
): string {
  const neutre = `${firstName}, voici où vous en êtes.`
  const now = computed.overall.score
  const before = previous?.overall.score
  if (now === null || before === null || before === undefined) return neutre

  const delta = now - before
  if (delta <= -SEUIL) return `${firstName}, faisons le point.`

  const cat = computed.overall.category
  if (cat === 'A_AMELIORER' || cat === 'ACCEPTABLE') return neutre

  if (delta >= SEUIL) return `${firstName}, vous avez progressé.`
  return `${firstName}, vous tenez le cap.`
}
