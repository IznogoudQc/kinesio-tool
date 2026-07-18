/**
 * Suggestions de description de douleur — puces cliquables proposées quand Marie
 * marque une zone sur la silhouette (voir BodyPainMap / questionnaire de santé).
 *
 * Regroupées par **famille** de zones (dos, genou, épaule…) + un jeu **commun**
 * montré partout. GLOBALES et éditables par Marie : stockées dans les réglages
 * (`pain.suggestions`). Ces valeurs sont les listes par défaut, servies tant que
 * rien n'est personnalisé. Module PUR (partagé renderer + main).
 */

/** Bibliothèque de suggestions : clé de famille → liste de phrases. */
export type PainSuggestionLib = Record<string, string[]>

/** Familles de zones (ordre d'affichage dans l'éditeur des réglages). */
export const PAIN_FAMILIES: readonly { key: string; label: string }[] = [
  { key: 'commun', label: 'Commun (toutes zones)' },
  { key: 'cou', label: 'Cou / nuque' },
  { key: 'epaule', label: 'Épaule' },
  { key: 'bras', label: 'Bras / main' },
  { key: 'tronc', label: 'Poitrine / abdomen' },
  { key: 'dos', label: 'Dos' },
  { key: 'bassin', label: 'Hanche / fessiers' },
  { key: 'cuisse', label: 'Cuisse' },
  { key: 'genou', label: 'Genou' },
  { key: 'jambe', label: 'Jambe / mollet' },
  { key: 'pied', label: 'Pied / cheville' }
] as const

/** Mappe chaque id de région de la silhouette vers sa famille. */
export const REGION_FAMILY: Record<string, string> = {
  f_cou: 'cou', d_nuque: 'cou',
  f_epaule_g: 'epaule', f_epaule_d: 'epaule', d_epaule_g: 'epaule', d_epaule_d: 'epaule',
  f_bras_g: 'bras', f_bras_d: 'bras', f_main_g: 'bras', f_main_d: 'bras',
  d_bras_g: 'bras', d_bras_d: 'bras', d_main_g: 'bras', d_main_d: 'bras',
  f_poitrine: 'tronc', f_abdomen: 'tronc',
  d_haut_dos: 'dos', d_bas_dos: 'dos',
  f_hanche_g: 'bassin', f_hanche_d: 'bassin', d_fessiers: 'bassin',
  f_cuisse_g: 'cuisse', f_cuisse_d: 'cuisse', d_ischio_g: 'cuisse', d_ischio_d: 'cuisse',
  f_genou_g: 'genou', f_genou_d: 'genou',
  f_tibia_g: 'jambe', f_tibia_d: 'jambe', d_mollet_g: 'jambe', d_mollet_d: 'jambe',
  f_pied_g: 'pied', f_pied_d: 'pied', d_talon_g: 'pied', d_talon_d: 'pied'
}

/** Famille d'une région (défaut `commun` si inconnue). */
export function familyForRegion(regionId: string): string {
  return REGION_FAMILY[regionId] ?? 'commun'
}

export const DEFAULT_PAIN_SUGGESTIONS: PainSuggestionLib = {
  commun: ['Douleur au repos', "Douleur à l'effort", 'Douleur chronique', 'Apparition récente', 'Suite à une blessure', "S'aggrave le soir"],
  cou: ['Raideur', 'Torticolis', 'Céphalées de tension', 'Irradie dans le bras', 'Limitation de rotation'],
  epaule: ["Limitation d'amplitude", 'Douleur nocturne', "Douleur à l'élévation", 'Tension au trapèze', "Sensation d'accrochage"],
  bras: ['Engourdissements', 'Fourmillements', 'Perte de force', 'Douleur au coude', 'Douleur au poignet'],
  tronc: ['Tension abdominale', 'Douleur costale', 'Douleur en respirant', 'Raideur thoracique'],
  dos: ['Raideur matinale', 'Douleur en flexion', 'Douleur en extension', 'Tension musculaire', 'Irradie dans la jambe (sciatalgie)'],
  bassin: ['Douleur à la marche', 'Raideur de hanche', 'Douleur en position assise prolongée', 'Bascule du bassin'],
  cuisse: ['Tension des ischio-jambiers', 'Douleur du quadriceps', 'Crampes', 'Tiraillement'],
  genou: ['Douleur en flexion', 'Instabilité', 'Craquements', 'Gonflement', 'Douleur dans les escaliers'],
  jambe: ['Crampes au mollet', 'Tension du tibia (périostite)', 'Lourdeur', 'Douleur à la marche'],
  pied: ['Douleur au talon (fasciite)', 'Douleur à la cheville', 'Instabilité', 'Fourmillements', "Douleur à l'appui"]
}

/**
 * Suggestions à proposer pour une région : celles de sa famille, puis le commun,
 * dédupliquées (en gardant l'ordre). `lib` absente → valeurs par défaut.
 */
export function suggestionsForRegion(regionId: string, lib: PainSuggestionLib = DEFAULT_PAIN_SUGGESTIONS): string[] {
  const fam = familyForRegion(regionId)
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of [...(lib[fam] ?? []), ...(lib.commun ?? [])]) {
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
}
