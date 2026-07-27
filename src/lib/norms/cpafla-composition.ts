/** Composition corporelle CPAFLA / ÉCPHV (Guide du conseiller CPHV, 3ᵉ éd.,
 *  Figures 7-4 hommes / 7-5 femmes ; formule p. 7-18 ; catégories Fig. 7-6).
 *
 *  Trois variables (pas le % de gras) : IMC (kg/m²), CT = circonférence de la
 *  taille (cm), S5PC = somme des CINQ plis cutanés (mm) : triceps, biceps,
 *  sous-scapulaire, crête iliaque, **mollet**. Les points de CT (colonne B) et de
 *  S5PC (colonne C) dépendent de la **plage d'IMC** (les seuils changent selon
 *  l'IMC). Pas de dépendance à l'âge — seulement le sexe.
 *
 *  Résultat selon les mesures disponibles (guide p. 7-17/18) :
 *    IMC + CT + S5PC → arrondi[(B × 1,5 + C) / 2,5]   (arrondi : ≥ x,5 → haut)
 *    IMC + CT        → B
 *    IMC + S5PC      → C
 *    CT seule        → B évalué dans la plage « IMC 27 » (25,0-29,9)
 *    IMC seul        → A (colonne A)
 *
 *  Validé sur l'exemple du guide (femme, IMC 25,8 · CT 91 · S5PC 116,6 →
 *  B=1, C=2 → (1,5+2)/2,5 = 1,4 → 1 « Acceptable »).
 *
 *  Le 5ᵉ pli (mollet) n'est pas toujours mesuré : sans S5PC, on retombe sur
 *  IMC + CT (comportement « auto »). Voir ADR 0027.
 */

const NEG = Number.NEGATIVE_INFINITY

/** Palier d'un barème : la valeur obtient `pts` si elle atteint la borne `from`
 *  (incluse si `inc`, sinon stricte). Paliers évalués du plus bas au plus haut,
 *  le dernier atteint gagne. */
interface Step {
  from: number
  inc: boolean
  pts: number
}

function pickPts(value: number, steps: Step[]): number {
  let pts = steps[0].pts
  for (const s of steps) {
    if (s.inc ? value >= s.from : value > s.from) pts = s.pts
  }
  return pts
}

interface ImcBand {
  /** Borne supérieure exclusive de la plage d'IMC (la 1re plage < 18,5, etc.). */
  imcLt: number
  /** Colonne A — points de l'IMC seul. */
  a: number
  /** Colonne B — points du tour de taille (selon l'IMC). */
  ct: Step[]
  /** Colonne C — points de la somme des 5 plis (selon l'IMC). */
  s5pc: Step[]
}

// ── Figure 7-4 — HOMMES ───────────────────────────────────────────────────────
const MEN: ImcBand[] = [
  { imcLt: 18.5, a: 3,
    ct: [{ from: NEG, inc: true, pts: 3 }],
    s5pc: [{ from: NEG, inc: true, pts: 3 }, { from: 25, inc: true, pts: 4 }, { from: 55, inc: true, pts: 3 }, { from: 77, inc: false, pts: 2 }] },
  { imcLt: 25, a: 4,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 94, inc: true, pts: 3 }, { from: 101, inc: false, pts: 1 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 54, inc: true, pts: 3 }, { from: 77, inc: false, pts: 2 }] },
  { imcLt: 30, a: 3,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 94, inc: true, pts: 3 }, { from: 101, inc: false, pts: 1 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 54, inc: true, pts: 3 }, { from: 77, inc: false, pts: 2 }] },
  { imcLt: 32.5, a: 2,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 94, inc: true, pts: 2 }, { from: 101, inc: false, pts: 0 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 54, inc: true, pts: 3 }, { from: 77, inc: false, pts: 2 }] },
  { imcLt: 35.05, a: 1,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 94, inc: true, pts: 2 }, { from: 101, inc: false, pts: 0 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 54, inc: true, pts: 2 }, { from: 77, inc: false, pts: 1 }] },
  { imcLt: Number.POSITIVE_INFINITY, a: 0,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 94, inc: true, pts: 2 }, { from: 101, inc: false, pts: 0 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 54, inc: true, pts: 2 }, { from: 77, inc: false, pts: 0 }] }
]

// ── Figure 7-5 — FEMMES ───────────────────────────────────────────────────────
const WOMEN: ImcBand[] = [
  { imcLt: 18.5, a: 3,
    ct: [{ from: NEG, inc: true, pts: 3 }],
    s5pc: [{ from: NEG, inc: true, pts: 3 }, { from: 46, inc: true, pts: 4 }, { from: 84, inc: true, pts: 3 }, { from: 113, inc: false, pts: 2 }] },
  { imcLt: 25, a: 4,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 80, inc: true, pts: 3 }, { from: 87, inc: false, pts: 1 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 83, inc: true, pts: 3 }, { from: 113, inc: false, pts: 2 }] },
  { imcLt: 30, a: 3,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 80, inc: true, pts: 3 }, { from: 87, inc: false, pts: 1 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 83, inc: true, pts: 3 }, { from: 113, inc: false, pts: 2 }] },
  { imcLt: 32.5, a: 2,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 80, inc: true, pts: 2 }, { from: 87, inc: false, pts: 0 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 83, inc: true, pts: 3 }, { from: 113, inc: false, pts: 2 }] },
  { imcLt: 35.05, a: 1,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 80, inc: true, pts: 2 }, { from: 87, inc: false, pts: 0 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 83, inc: true, pts: 2 }, { from: 113, inc: false, pts: 1 }] },
  { imcLt: Number.POSITIVE_INFINITY, a: 0,
    ct: [{ from: NEG, inc: true, pts: 4 }, { from: 80, inc: true, pts: 2 }, { from: 87, inc: false, pts: 0 }],
    s5pc: [{ from: NEG, inc: true, pts: 4 }, { from: 83, inc: true, pts: 2 }, { from: 113, inc: false, pts: 0 }] }
]

function bandForImc(bands: ImcBand[], imc: number): ImcBand {
  return bands.find(b => imc < b.imcLt) ?? bands[bands.length - 1]
}

export interface CpaflaCompositionInput {
  imc: number | null | undefined
  /** Tour de taille (cm). */
  ct: number | null | undefined
  /** Somme des 5 plis cutanés (mm) — `null` si le mollet manque. */
  s5pc: number | null | undefined
  sex: 'F' | 'M' | null
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Score de composition corporelle CPAFLA (0-4), ou `null` si sexe / mesures
 *  insuffisants. Voir en-tête pour les combinaisons. */
export function cpaflaComposition(input: CpaflaCompositionInput): number | null {
  const { sex } = input
  if (sex !== 'F' && sex !== 'M') return null
  const bands = sex === 'M' ? MEN : WOMEN
  const hasImc = isNum(input.imc)
  const hasCt = isNum(input.ct)
  const hasS5 = isNum(input.s5pc)
  if (!hasImc && !hasCt) return null // ni IMC ni CT → rien d'exploitable

  // Bande d'IMC : celle du client, ou « IMC 27 » (25-29,9) pour le cas « CT seule ».
  const band = bandForImc(bands, hasImc ? (input.imc as number) : 27)
  const B = hasCt ? pickPts(input.ct as number, band.ct) : null
  const C = hasS5 ? pickPts(input.s5pc as number, band.s5pc) : null

  if (hasImc && hasCt && hasS5) {
    // Arrondi « à la demie supérieure » (≥ x,5 → haut) — Math.round sur les positifs.
    return Math.round(((B as number) * 1.5 + (C as number)) / 2.5)
  }
  if (hasImc && hasCt) return B
  if (hasImc && hasS5) return C
  if (hasCt) return B // CT seule (IMC de référence 27)
  return band.a // IMC seul
}
