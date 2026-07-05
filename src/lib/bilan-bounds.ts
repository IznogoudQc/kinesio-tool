/** Bornes de plausibilité des champs numériques d'un bilan.
 *
 *  Deux niveaux :
 *  - bornes **souples** (`softMin`/`softMax`) : la valeur est inhabituelle →
 *    avertissement visuel dans le formulaire, la sauvegarde reste permise
 *    (Marie-Eve reste maître de ses données).
 *  - bornes **dures** (`hardMin`/`hardMax`) : la valeur est physiquement
 *    impossible → erreur dans le formulaire ET rejet zod à la frontière IPC.
 *
 *  Les bornes dures sont volontairement très généreuses : elles ne doivent
 *  JAMAIS rejeter une donnée réelle (notamment les bilans .docx importés).
 *  Partagé entre le renderer (feedback de saisie) et le main process (schéma
 *  zod de `electron/ipc/bilans.ts`) — ce module ne dépend d'aucun type ambiant.
 */

export interface FieldBound {
  hardMin?: number
  hardMax?: number
  softMin?: number
  softMax?: number
}

export type BoundLevel = 'ok' | 'warn' | 'error'

export interface BoundResult {
  level: BoundLevel
  message?: string
}

const PLI: FieldBound = { softMin: 2, softMax: 60, hardMin: 0, hardMax: 100 }
const PA_SYS: FieldBound = { softMin: 70, softMax: 220, hardMin: 0, hardMax: 300 }
const PA_DIA: FieldBound = { softMin: 40, softMax: 140, hardMin: 0, hardMax: 200 }
const FC: FieldBound = { softMin: 30, softMax: 220, hardMin: 0, hardMax: 250 }

/** Clés = clés numériques de `BilanData`. Un champ absent de la table n'est
 *  jamais borné (ex. `puissance_jambes_watts`, qui peut dépasser 6000 W). */
export const BILAN_FIELD_BOUNDS: Record<string, FieldBound> = {
  taille_cm: { softMin: 100, softMax: 230, hardMin: 0, hardMax: 260 },
  poids_kg: { softMin: 30, softMax: 250, hardMin: 0, hardMax: 400 },
  imc: { softMin: 12, softMax: 60, hardMin: 0, hardMax: 150 },
  tour_taille_cm: { softMin: 45, softMax: 180, hardMin: 0, hardMax: 250 },
  tour_hanche_cm: { softMin: 55, softMax: 200, hardMin: 0, hardMax: 250 },
  pli_triceps: PLI,
  pli_biceps: PLI,
  pli_sous_scap: PLI,
  pli_iliaque: PLI,
  pli_mollet: PLI,
  pli_cuisse: PLI,
  pourcentage_gras: { softMin: 3, softMax: 60, hardMin: 0, hardMax: 100 },
  vo2max: { softMin: 10, softMax: 90, hardMin: 0, hardMax: 100 },
  bruce_duration_sec: { softMin: 60, softMax: 1800, hardMin: 0, hardMax: 3600 },
  cooper_distance_m: { softMin: 800, softMax: 4500, hardMin: 0, hardMax: 6000 },
  leger_palier: { softMin: 1, softMax: 21, hardMin: 0, hardMax: 25 },
  fc_repos: { softMin: 30, softMax: 120, hardMin: 0, hardMax: 250 },
  pa_systolique: PA_SYS,
  pa_diastolique: PA_DIA,
  recup_1min_pa_sys: PA_SYS,
  recup_1min_pa_dia: PA_DIA,
  recup_1min_fc: FC,
  recup_3min_pa_sys: PA_SYS,
  recup_3min_pa_dia: PA_DIA,
  recup_3min_fc: FC,
  recup_5min_pa_sys: PA_SYS,
  recup_5min_pa_dia: PA_DIA,
  recup_5min_fc: FC,
  pushups: { softMin: 0, softMax: 120, hardMin: 0, hardMax: 200 },
  situps: { softMin: 0, softMax: 120, hardMin: 0, hardMax: 200 },
  saut_vertical_cm: { softMin: 5, softMax: 100, hardMin: 0, hardMax: 150 },
  // Sit-and-reach : un résultat négatif (doigts n'atteignant pas les orteils) est légitime.
  flexion_tronc_cm: { softMin: -15, softMax: 60, hardMin: -30, hardMax: 80 },
  endurance_dos_sec: { softMin: 5, softMax: 600, hardMin: 0, hardMax: 1200 }
}

const fmt = (n: number): string => String(n).replace('.', ',')

/** Évalue une valeur saisie contre les bornes de son champ.
 *  `ok` si la valeur est absente, non numérique ou si le champ n'a pas de bornes. */
export function validateBilanField(key: string, value: number | null | undefined): BoundResult {
  if (value === null || value === undefined || Number.isNaN(value)) return { level: 'ok' }
  const b = BILAN_FIELD_BOUNDS[key]
  if (!b) return { level: 'ok' }
  if ((b.hardMin !== undefined && value < b.hardMin) || (b.hardMax !== undefined && value > b.hardMax)) {
    return {
      level: 'error',
      message: `Valeur impossible — attendu entre ${fmt(b.hardMin ?? -Infinity)} et ${fmt(b.hardMax ?? Infinity)}`
    }
  }
  if ((b.softMin !== undefined && value < b.softMin) || (b.softMax !== undefined && value > b.softMax)) {
    return {
      level: 'warn',
      message: `Valeur inhabituelle — vérifiez (habituellement ${fmt(b.softMin ?? -Infinity)} à ${fmt(b.softMax ?? Infinity)})`
    }
  }
  return { level: 'ok' }
}
