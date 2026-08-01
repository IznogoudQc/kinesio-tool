/** Helpers purs pour le rapport PDF (`src/pages/ReportPage.tsx`).
 *  Isolés ici pour être testables via `node --test` sans dépendre du rendu React. */

/**
 * Modèle **détaillé** — relevés à 1, 3 et 5 min après l'effort.
 *
 * Ne vient plus que des imports .docx de l'ancien logiciel : le formulaire ne
 * propose plus ces champs depuis la v0.3.3.
 */
const RECOVERY_KEYS_DETAILLE = [
  'recup_1min_pa_sys',
  'recup_1min_pa_dia',
  'recup_1min_fc',
  'recup_3min_pa_sys',
  'recup_3min_pa_dia',
  'recup_3min_fc',
  'recup_5min_pa_sys',
  'recup_5min_pa_dia',
  'recup_5min_fc'
] as const

/**
 * Modèle **simplifié** — un seul relevé, celui de la feuille papier de Marie.
 *
 * ⚠️ Ces valeurs étaient saisies depuis la v0.3.3 (17 juillet) et n'étaient
 * affichées **nulle part** : ni au dashboard, ni dans le PDF, ni dans le
 * document client. `hasRecoveryData` ne regardait que le modèle détaillé, donc
 * la section « Récupération post-effort » du rapport ne s'ouvrait jamais.
 */
const RECOVERY_KEYS_SIMPLE = ['pa_recup_sys', 'pa_recup_dia', 'fc_recup'] as const

function nombre(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Vrai si au moins une valeur de récupération post-effort est renseignée. */
export function hasRecoveryData(data: Record<string, unknown>): boolean {
  return [...RECOVERY_KEYS_SIMPLE, ...RECOVERY_KEYS_DETAILLE].some(k => nombre(data[k]) !== null)
}

export interface RecoveryRow {
  label: string
  fc: number | null
  sys: number | null
  dia: number | null
}

/**
 * Lignes de récupération à afficher, quel que soit le modèle utilisé.
 *
 * Le modèle simplifié prime : c'est celui que le formulaire remplit aujourd'hui.
 * Le modèle détaillé ne sert qu'aux bilans importés de l'ancien logiciel, et
 * seules ses lignes réellement renseignées sont retournées — une ligne « 5 min »
 * vide donnerait l'impression d'une mesure manquée.
 */
export function recoveryRows(data: Record<string, unknown>): RecoveryRow[] {
  const simple: RecoveryRow = {
    label: 'Récupération',
    fc: nombre(data.fc_recup),
    sys: nombre(data.pa_recup_sys),
    dia: nombre(data.pa_recup_dia)
  }
  if (simple.fc !== null || simple.sys !== null || simple.dia !== null) return [simple]

  return [
    { label: '1 min', fc: nombre(data.recup_1min_fc), sys: nombre(data.recup_1min_pa_sys), dia: nombre(data.recup_1min_pa_dia) },
    { label: '3 min', fc: nombre(data.recup_3min_fc), sys: nombre(data.recup_3min_pa_sys), dia: nombre(data.recup_3min_pa_dia) },
    { label: '5 min', fc: nombre(data.recup_5min_fc), sys: nombre(data.recup_5min_pa_sys), dia: nombre(data.recup_5min_pa_dia) }
  ].filter(r => r.fc !== null || r.sys !== null || r.dia !== null)
}

/** Libellé du protocole aérobie utilisé + son paramètre brut, ou `null` si inconnu. */
export function aerobicProtocolLabel(
  data: Record<string, unknown>,
  formatMmSs: (s: number) => string
): string | null {
  const t = data.aerobie_test_type
  if (t === 'bruce' && typeof data.bruce_duration_sec === 'number') {
    return `Tapis roulant de Bruce — ${formatMmSs(data.bruce_duration_sec)}`
  }
  if (t === 'cooper' && typeof data.cooper_distance_m === 'number') {
    return `Test de Cooper (12 min) — ${Math.round(data.cooper_distance_m)} m`
  }
  if (t === 'leger' && typeof data.leger_palier === 'number') {
    return `Test de Léger (navette 20 m) — palier ${data.leger_palier}`
  }
  if (typeof data.test_aerobie === 'string' && data.test_aerobie.trim() !== '') {
    return data.test_aerobie
  }
  return null
}
