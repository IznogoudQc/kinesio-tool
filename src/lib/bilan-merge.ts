/** Fusion d'un bilan importé avec un bilan déjà en base, à la même date.
 *
 *  Règle : le bilan importé fait autorité **sur les champs qu'il contient**, et
 *  seulement ceux-là. Les champs absents du .docx gardent leur valeur en base.
 *
 *  Ça couvre les deux cas réels :
 *   • correction d'une valeur (saut 43 → 48 cm) → la nouvelle écrase l'ancienne
 *   • .docx partiel réimporté → on ne perd pas les champs qu'il ne contient pas
 *
 *  L'ancienne règle « on garde le bilan avec le plus de champs remplis » ignorait
 *  toute correction, puisque corriger une valeur ne change pas le nombre de champs.
 */

const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === ''

export interface MergeResult {
  data: Record<string, unknown>
  /** Clés dont la valeur a réellement changé (ajouts inclus). */
  changedKeys: string[]
}

export function mergeBilanData(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): MergeResult {
  const data: Record<string, unknown> = { ...existing }
  const changedKeys: string[] = []

  for (const [key, value] of Object.entries(incoming)) {
    // Une valeur absente du .docx n'efface jamais ce qui est en base.
    if (isEmpty(value)) continue
    if (!Object.is(existing[key], value)) {
      data[key] = value
      changedKeys.push(key)
    }
  }

  return { data, changedKeys }
}
