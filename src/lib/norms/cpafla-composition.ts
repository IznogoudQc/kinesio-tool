/** Composition corporelle CPAFLA / ÉCPHV (Guide du conseiller CPHV, 3ᵉ éd.,
 *  Figures 7-4 hommes / 7-5 femmes ; formule p. 7-18 ; catégories Fig. 7-6).
 *
 *  Trois variables (pas le % de gras) : IMC (kg/m²), CT = circonférence de la
 *  taille (cm), S5PC = somme des CINQ plis cutanés (mm) : triceps, biceps,
 *  sous-scapulaire, crête iliaque, **mollet**. Les points de CT (colonne B) et de
 *  S5PC (colonne C) dépendent de la **plage d'IMC**. Pas de dépendance à l'âge.
 *
 *  Résultat selon les mesures disponibles (guide p. 7-17/18) :
 *    IMC + CT + S5PC → arrondi[(B × 1,5 + C) / 2,5]   (arrondi : ≥ x,5 → haut)
 *    IMC + CT        → B
 *    IMC + S5PC      → C
 *    CT seule        → B évalué dans la plage « IMC 27 » (25,0-29,9)
 *    IMC seul        → A (colonne A)
 *
 *  Validé sur l'exemple du guide (femme IMC 25,8 · CT 91 · S5PC 116,6 →
 *  B=1, C=2 → (1,5+2)/2,5 = 1,4 → 1 « Acceptable »). Voir ADR 0027.
 */

const NEG = Number.NEGATIVE_INFINITY

/** Palier d'un barème : `pts` si la valeur atteint `from` (incluse si `inc`).
 *  `label` = intervalle lisible (affichage barème). Évalués du bas vers le haut. */
interface Step {
  from: number
  inc: boolean
  pts: number
  label: string
}

function pickIndex(value: number, steps: Step[]): number {
  let idx = 0
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    if (s.inc ? value >= s.from : value > s.from) idx = i
  }
  return idx
}

interface ImcBand {
  /** Borne supérieure exclusive de la plage d'IMC. */
  imcLt: number
  /** Libellé de la plage (« 25,0–29,9 »). */
  label: string
  /** Colonne A — points de l'IMC seul. */
  a: number
  /** Colonne B — tour de taille (selon l'IMC). */
  ct: Step[]
  /** Colonne C — somme des 5 plis (selon l'IMC). */
  s5pc: Step[]
}

const ALL_CT = [{ from: NEG, inc: true, pts: 3, label: 'Toutes' }]

// ── Figure 7-4 — HOMMES ───────────────────────────────────────────────────────
const MEN: ImcBand[] = [
  { imcLt: 18.5, label: 'moins de 18,5', a: 3, ct: ALL_CT,
    s5pc: [{ from: NEG, inc: true, pts: 3, label: '< 25' }, { from: 25, inc: true, pts: 4, label: '25–54' }, { from: 55, inc: true, pts: 3, label: '55–77' }, { from: 77, inc: false, pts: 2, label: '> 77' }] },
  { imcLt: 25, label: '18,5–24,9', a: 4,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 94' }, { from: 94, inc: true, pts: 3, label: '94–101' }, { from: 101, inc: false, pts: 1, label: '> 101' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 54' }, { from: 54, inc: true, pts: 3, label: '54–77' }, { from: 77, inc: false, pts: 2, label: '> 77' }] },
  { imcLt: 30, label: '25,0–29,9', a: 3,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 94' }, { from: 94, inc: true, pts: 3, label: '94–101' }, { from: 101, inc: false, pts: 1, label: '> 101' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 54' }, { from: 54, inc: true, pts: 3, label: '54–77' }, { from: 77, inc: false, pts: 2, label: '> 77' }] },
  { imcLt: 32.5, label: '30,0–32,4', a: 2,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 94' }, { from: 94, inc: true, pts: 2, label: '94–101' }, { from: 101, inc: false, pts: 0, label: '> 101' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 54' }, { from: 54, inc: true, pts: 3, label: '54–77' }, { from: 77, inc: false, pts: 2, label: '> 77' }] },
  { imcLt: 35.05, label: '32,5–35,0', a: 1,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 94' }, { from: 94, inc: true, pts: 2, label: '94–101' }, { from: 101, inc: false, pts: 0, label: '> 101' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 54' }, { from: 54, inc: true, pts: 2, label: '54–77' }, { from: 77, inc: false, pts: 1, label: '> 77' }] },
  { imcLt: Number.POSITIVE_INFINITY, label: 'plus de 35,0', a: 0,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 94' }, { from: 94, inc: true, pts: 2, label: '94–101' }, { from: 101, inc: false, pts: 0, label: '> 101' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 54' }, { from: 54, inc: true, pts: 2, label: '54–77' }, { from: 77, inc: false, pts: 0, label: '> 77' }] }
]

// ── Figure 7-5 — FEMMES ───────────────────────────────────────────────────────
const WOMEN: ImcBand[] = [
  { imcLt: 18.5, label: 'moins de 18,5', a: 3, ct: ALL_CT,
    s5pc: [{ from: NEG, inc: true, pts: 3, label: '< 46' }, { from: 46, inc: true, pts: 4, label: '46–83' }, { from: 84, inc: true, pts: 3, label: '84–113' }, { from: 113, inc: false, pts: 2, label: '> 113' }] },
  { imcLt: 25, label: '18,5–24,9', a: 4,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 80' }, { from: 80, inc: true, pts: 3, label: '80–87' }, { from: 87, inc: false, pts: 1, label: '> 87' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 83' }, { from: 83, inc: true, pts: 3, label: '83–113' }, { from: 113, inc: false, pts: 2, label: '> 113' }] },
  { imcLt: 30, label: '25,0–29,9', a: 3,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 80' }, { from: 80, inc: true, pts: 3, label: '80–87' }, { from: 87, inc: false, pts: 1, label: '> 87' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 83' }, { from: 83, inc: true, pts: 3, label: '83–113' }, { from: 113, inc: false, pts: 2, label: '> 113' }] },
  { imcLt: 32.5, label: '30,0–32,4', a: 2,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 80' }, { from: 80, inc: true, pts: 2, label: '80–87' }, { from: 87, inc: false, pts: 0, label: '> 87' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 83' }, { from: 83, inc: true, pts: 3, label: '83–113' }, { from: 113, inc: false, pts: 2, label: '> 113' }] },
  { imcLt: 35.05, label: '32,5–35,0', a: 1,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 80' }, { from: 80, inc: true, pts: 2, label: '80–87' }, { from: 87, inc: false, pts: 0, label: '> 87' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 83' }, { from: 83, inc: true, pts: 2, label: '83–113' }, { from: 113, inc: false, pts: 1, label: '> 113' }] },
  { imcLt: Number.POSITIVE_INFINITY, label: 'plus de 35,0', a: 0,
    ct: [{ from: NEG, inc: true, pts: 4, label: '< 80' }, { from: 80, inc: true, pts: 2, label: '80–87' }, { from: 87, inc: false, pts: 0, label: '> 87' }],
    s5pc: [{ from: NEG, inc: true, pts: 4, label: '< 83' }, { from: 83, inc: true, pts: 2, label: '83–113' }, { from: 113, inc: false, pts: 0, label: '> 113' }] }
]

function bandIndexForImc(bands: ImcBand[], imc: number): number {
  const i = bands.findIndex(b => imc < b.imcLt)
  return i === -1 ? bands.length - 1 : i
}

export interface CpaflaCompositionInput {
  imc: number | null | undefined
  /** Tour de taille (cm). */
  ct: number | null | undefined
  /** Somme des 5 plis cutanés (mm) — `null` si le mollet manque. */
  s5pc: number | null | undefined
  sex: 'F' | 'M' | null
}

export type CpaflaCompositionCombo = 'imc+ct+s5pc' | 'imc+ct' | 'imc+s5pc' | 'ct' | 'imc' | null

export interface CpaflaCompositionDetail {
  score: number | null
  combo: CpaflaCompositionCombo
  imcBandLabel: string | null
  a: number | null
  b: number | null
  c: number | null
  raw: number | null
  /** Index de la plage d'IMC (pour surligner la bonne ligne du barème). */
  imcIndex: number | null
  /** Index du palier de tour de taille atteint (colonne B). */
  ctIndex: number | null
  /** Index du palier de somme des 5 plis atteint (colonne C). */
  s5pcIndex: number | null
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Détail du calcul — sert à **expliquer** la note et à **surligner** le barème. */
export function cpaflaCompositionDetail(input: CpaflaCompositionInput): CpaflaCompositionDetail {
  const empty: CpaflaCompositionDetail = { score: null, combo: null, imcBandLabel: null, a: null, b: null, c: null, raw: null, imcIndex: null, ctIndex: null, s5pcIndex: null }
  const { sex } = input
  if (sex !== 'F' && sex !== 'M') return empty
  const bands = sex === 'M' ? MEN : WOMEN
  const hasImc = isNum(input.imc)
  const hasCt = isNum(input.ct)
  const hasS5 = isNum(input.s5pc)
  if (!hasImc && !hasCt) return empty

  const idx = bandIndexForImc(bands, hasImc ? (input.imc as number) : 27)
  const band = bands[idx]
  const ctIndex = hasCt ? pickIndex(input.ct as number, band.ct) : null
  const s5pcIndex = hasS5 ? pickIndex(input.s5pc as number, band.s5pc) : null
  const b = ctIndex === null ? null : band.ct[ctIndex].pts
  const c = s5pcIndex === null ? null : band.s5pc[s5pcIndex].pts
  const a = band.a
  const imcBandLabel = band.label
  const base = { imcBandLabel, a, b, c, imcIndex: idx, ctIndex, s5pcIndex }

  if (hasImc && hasCt && hasS5) {
    const raw = ((b as number) * 1.5 + (c as number)) / 2.5
    return { ...base, score: Math.round(raw), combo: 'imc+ct+s5pc', raw }
  }
  if (hasImc && hasCt) return { ...base, score: b, combo: 'imc+ct', c: null, s5pcIndex: null, raw: null }
  if (hasImc && hasS5) return { ...base, score: c, combo: 'imc+s5pc', b: null, ctIndex: null, raw: null }
  if (hasCt) return { ...base, score: b, combo: 'ct', c: null, s5pcIndex: null, raw: null }
  return { ...base, score: a, combo: 'imc', b: null, c: null, ctIndex: null, s5pcIndex: null, raw: null }
}

/** Score de composition corporelle CPAFLA (0-4), ou `null`. */
export function cpaflaComposition(input: CpaflaCompositionInput): number | null {
  return cpaflaCompositionDetail(input).score
}

// ── Barème pour l'affichage (bouton « Barème ») ───────────────────────────────
export interface CpaflaBaremeCell {
  range: string
  pts: number
}
export interface CpaflaBaremeRow {
  imcLabel: string
  a: number
  ct: CpaflaBaremeCell[]
  s5pc: CpaflaBaremeCell[]
}

/** Table de la composition corporelle (Fig. 7-4 hommes / 7-5 femmes) pour affichage. */
export function cpaflaCompositionBareme(sex: 'F' | 'M'): CpaflaBaremeRow[] {
  const bands = sex === 'M' ? MEN : WOMEN
  return bands.map(b => ({
    imcLabel: b.label,
    a: b.a,
    ct: b.ct.map(s => ({ range: s.label, pts: s.pts })),
    s5pc: b.s5pc.map(s => ({ range: s.label, pts: s.pts }))
  }))
}
