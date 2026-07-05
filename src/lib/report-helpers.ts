/** Helpers purs pour le rapport PDF (`src/pages/ReportPage.tsx`).
 *  Isolés ici pour être testables via `node --test` sans dépendre du rendu React. */

const RECOVERY_KEYS = [
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

/** Vrai si au moins une valeur de récupération post-effort est renseignée. */
export function hasRecoveryData(data: Record<string, unknown>): boolean {
  return RECOVERY_KEYS.some(k => typeof data[k] === 'number' && Number.isFinite(data[k] as number))
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
