/** Tables CPAFLA / CSEP-PATH (Société canadienne de physiologie de l'exercice —
 *  Canadian Physical Activity, Fitness and Lifestyle Approach).
 *
 *  ⚠️ STATUT : ossature prête, **valeurs non encore encodées**.
 *
 *  Les seuils numériques exacts des « zones de bénéfices santé » CPAFLA
 *  (Excellent / Très bien / Bien / Acceptable / À améliorer) vivent dans le
 *  CSEP-PATH Toolkit, qui est **sous droits d'auteur** et non reproductible
 *  librement (les sources publiques — Statistique Canada, ACSM — citent le
 *  système de cotation mais ne republient pas les tables). Tant que la source
 *  officielle (manuel CSEP-PATH ou captures du logiciel de Marie-Eve) n'est pas
 *  fournie, chaque table reste `null` et `getCpaflaRange` retourne `null` —
 *  l'UI affiche « — » via `CategoryBadge`, exactement comme un test hors barème.
 *  Aucune valeur n'est inventée (ce serait dangereux pour un outil de santé).
 *  Voir ADR 0013.
 *
 *  ── Comment remplir (une fois la source obtenue) ─────────────────────────────
 *  Le type `NormRange` est identique à celui d'ACSM : on encode 5 percentiles
 *  P10/P25/P50/P75/P90 par (test, tranche d'âge, sexe). Comme CPAFLA publie des
 *  **catégories** (bornes de zone) et non des percentiles, on convertit avec la
 *  même convention que la migration ACSM (ADR 0006) :
 *
 *    borne basse « Acceptable »  → p10
 *    borne basse « Bien »        → p25
 *    borne basse « Très bien »   → p50
 *    borne basse « Excellent »   → p75
 *    p90 = 2·p75 − p50           (extrapolation)
 *
 *  Pour les tests `lowerIsBetter` (somme des plis, % gras) : ranger les valeurs
 *  en ordre **décroissant** (p10 > p25 > p50 > p75 > p90), comme dans `acsm.ts`.
 *
 *  Tranches d'âge CPAFLA usuelles : 15-19, 20-29, 30-39, 40-49, 50-59, 60-69,
 *  par sexe (F / M).
 *
 *  TestKeys couvrables par CPAFLA (à encoder) :
 *    - `pushups`       (extension des bras)
 *    - `situps`        (redressements assis partiels / partial curl-ups)
 *    - `trunkFlexion`  (flexion avant du tronc / sit-and-reach, en cm)
 *    - `legPower`      (puissance des jambes — CPAFLA en publie, contrairement à ACSM)
 *    - `verticalJump`  (saut vertical, si la source le fournit)
 *    - `backEndurance` (endurance des extenseurs du dos, si disponible)
 *
 *  `bodyFat` : CPAFLA cote la **somme des 5 plis** (mm), pas le % de gras — notre
 *  modèle ne stocke que le %. Laissé `null` pour éviter une comparaison erronée
 *  (à trancher avec Marie-Eve). `vo2max` : CPAFLA repose sur le mCAFT (test
 *  prédictif) ; sans table fiable → `null`, ACSM reste la référence aérobie.
 */

import type { NormPercentiles, NormRange, NormSet, TestKey } from './types'

type Ranges = NormRange[]

/** Helper : construit une plage à partir des 5 percentiles littéraux.
 *  Exporté pour l'encodage futur des tables (même signature que dans `acsm.ts`). */
export function pct(p10: number, p25: number, p50: number, p75: number, p90: number): NormPercentiles {
  return { p10, p25, p50, p75, p90 }
}

// ── Tables CPAFLA — à encoder depuis la source officielle CSEP-PATH ───────────
// Exemple de format attendu (valeurs FICTIVES, ne pas utiliser) :
//   const PUSHUPS: Ranges = [
//     { ageMin: 20, ageMax: 29, sex: 'M', percentiles: pct(/* acceptable */ 17, /* bien */ 22, /* très bien */ 29, /* excellent */ 36, /* p90 */ 43) },
//     ...
//   ]
const PUSHUPS: Ranges | null = null
const SITUPS: Ranges | null = null
const TRUNK_FLEXION: Ranges | null = null
const LEG_POWER: Ranges | null = null
const VERTICAL_JUMP: Ranges | null = null
const BACK_ENDURANCE: Ranges | null = null

const TABLES: Record<TestKey, Ranges | null> = {
  vo2max: null, // mCAFT — pas de table fiable ; ACSM reste la référence aérobie.
  bodyFat: null, // CPAFLA cote la somme des plis (mm), pas le % — non mappable ici.
  pushups: PUSHUPS,
  situps: SITUPS,
  trunkFlexion: TRUNK_FLEXION,
  legPower: LEG_POWER,
  verticalJump: VERTICAL_JUMP,
  backEndurance: BACK_ENDURANCE,
  bmi: null, // IMC = catégories OMS (agnostiques à la norme fitness) — voir clinical/acsm.
  waistCircumference: null, // Tour de taille = seuils Santé Canada — indépendant de CPAFLA.
  // Seuils cliniques (PA, FC repos) — fournis par `clinical.ts`, hors CPAFLA.
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  restingHeartRate: null
}

/** Retourne la plage CPAFLA pour (test, âge, sexe), ou `null` si non encodée.
 *  Structure identique à `getAcsmRange` — fonctionnera dès que `TABLES` sera rempli. */
export function getCpaflaRange(test: TestKey, age: number, sex: 'F' | 'M'): NormRange | null {
  const ranges = TABLES[test]
  if (!ranges) return null
  return ranges.find(r => r.sex === sex && age >= r.ageMin && age <= r.ageMax) ?? null
}

/** Vrai si au moins une table CPAFLA est encodée. Permet à l'UI (Paramètres)
 *  d'annoncer honnêtement l'état : tables disponibles vs en attente de source. */
export function cpaflaHasTables(): boolean {
  return Object.values(TABLES).some(r => r !== null && r.length > 0)
}

export const cpaflaNorms: NormSet = {
  getRange: getCpaflaRange
}
