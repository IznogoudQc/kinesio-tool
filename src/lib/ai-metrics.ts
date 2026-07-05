/** Collecte automatique de TOUTES les métriques présentes d'un bilan, avec leur
 *  catégorie ACSM/OMS et percentile, pour l'analyse « forces & à travailler » par
 *  l'IA. Remplace la sélection manuelle métrique par métrique.
 *
 *  Les données restent anonymes (aucun nom / courriel / note) — cf. ADR 0007. */

import type { MetricSelection } from '../contexts/AIAdviceContext'
import {
  getCategorization,
  getPercentile,
  getDeltaVsAverage,
  type Category,
  type NormsType
} from './norms'
import { BILAN_TO_TEST_KEY } from './norms/bilan-keys'

const CATEGORY_FR: Record<Category, string> = {
  A_AMELIORER: 'À améliorer',
  ACCEPTABLE: 'Acceptable',
  BIEN: 'Bien',
  TRES_BIEN: 'Très bien',
  EXCELLENT: 'Excellent'
}

const FIELDS: { key: keyof BilanData; label: string; unit?: string }[] = [
  { key: 'vo2max', label: 'VO2max', unit: 'ml/kg/min' },
  { key: 'imc', label: 'IMC', unit: 'kg/m²' },
  { key: 'pourcentage_gras', label: '% de gras', unit: '%' },
  { key: 'tour_taille_cm', label: 'Tour de taille', unit: 'cm' },
  { key: 'pa_systolique', label: 'Pression systolique', unit: 'mmHg' },
  { key: 'pa_diastolique', label: 'Pression diastolique', unit: 'mmHg' },
  { key: 'fc_repos', label: 'FC repos', unit: 'bpm' },
  { key: 'pushups', label: 'Pompes', unit: 'reps' },
  { key: 'situps', label: 'Redressements', unit: 'reps' },
  { key: 'saut_vertical_cm', label: 'Saut vertical', unit: 'cm' },
  { key: 'puissance_jambes_watts', label: 'Puissance des jambes', unit: 'W' },
  { key: 'flexion_tronc_cm', label: 'Flexion du tronc', unit: 'cm' },
  { key: 'endurance_dos_sec', label: 'Endurance du dos', unit: 's' }
]

/** Construit la liste des métriques renseignées du bilan pour l'IA. Chaque métrique
 *  reçoit sa catégorie + percentile quand une norme existe ; sinon juste sa valeur
 *  brute (utile comme contexte, ex. pression artérielle). `[]` si profil incomplet. */
export function gatherBilanMetrics(
  data: BilanData,
  age: number | null,
  sex: 'F' | 'M' | null,
  norms: NormsType
): MetricSelection[] {
  if (age === null || sex === null) return []
  const out: MetricSelection[] = []
  for (const f of FIELDS) {
    const v = data[f.key]
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    const testKey = BILAN_TO_TEST_KEY[f.key]
    let category: string | undefined
    let percentile: number | undefined
    let deltaPct: number | undefined
    if (testKey) {
      const cat = getCategorization(testKey, v, age, sex, norms)
      if (cat) category = CATEGORY_FR[cat]
      const p = getPercentile(testKey, v, age, sex, norms)
      if (p !== null) percentile = p
      const d = getDeltaVsAverage(testKey, v, age, sex, norms)
      if (d) deltaPct = d.deltaPct
    }
    out.push({ key: f.key as string, label: f.label, value: v, unit: f.unit, category, percentile, deltaPct })
  }
  return out
}
