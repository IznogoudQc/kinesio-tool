/**
 * Risque pour la santé associé à l'IMC et au tour de taille.
 *
 * Source : aide-mémoire « Évaluation des avantages pour la santé » (ÉAS),
 * SPAP-SCPE — la feuille que Marie-Eve utilise, section « Risque pour la santé
 * associé à l'IMC et à l'IMC combiné au tour de taille ».
 *
 * ── Ce que cette échelle N'EST PAS ──────────────────────────────────────────
 * Ce n'est pas l'échelle de condition physique (Excellent → Médiocre, cotée
 * 4 → 0). C'est une échelle de **risque santé**, en sens inverse : « Moindre »
 * est le bon côté, « Extrêmement élevé » le mauvais. Les deux ne se mélangent
 * pas et ce module ne produit donc aucune cote.
 *
 * ── Pourquoi ça ne touche pas aux scores ────────────────────────────────────
 * L'IMC et le tour de taille alimentent DÉJÀ deux composites, par un autre
 * chemin : les tables de composition CPAFLA Fig. 7-4/7-5 (`cpaflaComposition`,
 * `cpaflaWaistPoints`). Les recoter ici les compterait deux fois et ferait
 * bouger le score global, qui reproduit aujourd'hui l'ancien logiciel sur 7
 * bilans sur 7. Ce module sert uniquement à **afficher** le risque — même
 * patron que la grille de % de gras de Marie (ADR 0024) : on montre la lecture
 * santé, la valeur brute continue d'alimenter les scores en coulisse.
 */

/** Échelle de risque de l'aide-mémoire, du meilleur au pire. */
export type HealthRisk = 'MOINDRE' | 'ACCRU' | 'ELEVE' | 'TRES_ELEVE' | 'EXTREMEMENT_ELEVE'

export const HEALTH_RISK_LABELS: Record<HealthRisk, string> = {
  MOINDRE: 'Moindre',
  ACCRU: 'Accru',
  ELEVE: 'Élevé',
  TRES_ELEVE: 'Très élevé',
  EXTREMEMENT_ELEVE: 'Extrêmement élevé'
}

/** Ordre croissant de gravité — pour les barres et les comparaisons. */
export const HEALTH_RISK_ORDER: HealthRisk[] = [
  'MOINDRE',
  'ACCRU',
  'ELEVE',
  'TRES_ELEVE',
  'EXTREMEMENT_ELEVE'
]

/** Bandes d'IMC de l'aide-mémoire, avec le libellé exact de la feuille. */
export interface BmiBand {
  /** Borne supérieure exclusive ; `Infinity` pour la dernière bande. */
  ltImc: number
  /** Libellé de la plage tel qu'imprimé (« 18,5–24,9 »). */
  label: string
  risk: HealthRisk
  /** Tour de taille (cm) à partir duquel le risque combiné s'applique, par
   *  sexe. `null` sous 18,5 : la feuille n'y évalue pas le tour de taille. */
  waist: { M: number; F: number } | null
  /** Risque quand l'IMC est dans cette bande ET que le tour de taille atteint
   *  le seuil. `null` là où la feuille imprime « – ». */
  combined: HealthRisk | null
}

/**
 * Colonne « Risque associé à l'IMC ».
 *
 * Note : un IMC sous 18,5 est classé « Accru », comme la zone 25–29,9 — le
 * risque remonte des deux côtés. C'est bien ce qu'imprime la feuille, et non
 * une erreur de transcription : l'insuffisance pondérale est un risque au même
 * titre que l'excès.
 */
export const BMI_BANDS: BmiBand[] = [
  { ltImc: 18.5, label: 'moins de 18,5', risk: 'ACCRU', waist: null, combined: null },
  { ltImc: 25, label: '18,5–24,9', risk: 'MOINDRE', waist: { M: 90, F: 80 }, combined: 'ELEVE' },
  { ltImc: 30, label: '25,0–29,9', risk: 'ACCRU', waist: { M: 100, F: 90 }, combined: 'TRES_ELEVE' },
  { ltImc: 35, label: '30,0–34,9', risk: 'ELEVE', waist: { M: 110, F: 105 }, combined: 'EXTREMEMENT_ELEVE' },
  { ltImc: 40, label: '35,0–39,9', risk: 'TRES_ELEVE', waist: { M: 125, F: 115 }, combined: 'EXTREMEMENT_ELEVE' },
  { ltImc: Infinity, label: '40 et plus', risk: 'EXTREMEMENT_ELEVE', waist: { M: 125, F: 125 }, combined: 'EXTREMEMENT_ELEVE' }
]

export interface BmiRiskResult {
  risk: HealthRisk
  /** Libellé de la bande (« 25,0–29,9 »), pour situer la valeur. */
  band: string
}

/** Risque associé à l'IMC seul. `null` si l'IMC est absent ou aberrant. */
export function bmiRisk(imc: number | null | undefined): BmiRiskResult | null {
  if (typeof imc !== 'number' || Number.isNaN(imc) || imc <= 0) return null
  const band = BMI_BANDS.find(b => imc < b.ltImc)
  return band ? { risk: band.risk, band: band.label } : null
}

// ── Risque combiné IMC + tour de taille ──────────────────────────────────────

export interface HealthRiskResult {
  risk: HealthRisk
  /** Libellé de la bande d'IMC (« 25,0–29,9 »), pour situer la valeur. */
  band: string
  /** `true` si le tour de taille a fait monter le risque au-dessus de celui de
   *  l'IMC seul — c'est l'information que la feuille sert à faire ressortir. */
  waistRaised: boolean
  /** Seuil de tour de taille de la ligne (cm), ou `null` si la feuille n'en
   *  prévoit pas (IMC sous 18,5) ou si le sexe est inconnu. */
  waistThreshold: number | null
  /** Le tour de taille a-t-il réellement été mesuré ? Distingue « mesuré et
   *  sous le seuil » de « pas mesuré » — sans quoi on affirmerait qu'un tour de
   *  taille absent est sous le seuil, ce qui est faux. */
  waistKnown: boolean
}

export interface HealthRiskInput {
  imc: number | null | undefined
  /** Tour de taille en cm. */
  waist?: number | null
  sex?: 'F' | 'M' | null
}

/**
 * Risque santé combiné, tel que l'imprime l'aide-mémoire.
 *
 * Le tour de taille ne fait que **relever** le risque : sous le seuil (ou s'il
 * est inconnu), c'est le risque de l'IMC seul qui vaut. Un homme d'IMC normal
 * mais de tour de taille ≥ 90 cm passe ainsi de « Moindre » à « Élevé » — c'est
 * exactement le cas que ce tableau existe pour attraper, et la raison pour
 * laquelle on n'affiche jamais la colonne IMC toute seule.
 */
export function healthRisk({ imc, waist, sex }: HealthRiskInput): HealthRiskResult | null {
  if (typeof imc !== 'number' || Number.isNaN(imc) || imc <= 0) return null
  const band = BMI_BANDS.find(b => imc < b.ltImc)
  if (!band) return null

  const threshold = band.waist && (sex === 'M' || sex === 'F') ? band.waist[sex] : null
  const waistKnown = typeof waist === 'number' && !Number.isNaN(waist)
  const reaches = threshold !== null && waistKnown && (waist as number) >= threshold

  if (reaches && band.combined) {
    return {
      risk: band.combined,
      band: band.label,
      waistRaised: true,
      waistThreshold: threshold,
      waistKnown
    }
  }
  return { risk: band.risk, band: band.label, waistRaised: false, waistThreshold: threshold, waistKnown }
}

/**
 * Phrase d'explication sous le risque — **une seule** implémentation pour le
 * dashboard, le PDF et le HTML. Chaque surface l'écrivait de son côté ; c'est
 * exactement ainsi qu'on se retrouve avec trois textes qui divergent (cf. les
 * barèmes, v0.9.64 à 0.9.66).
 */
export function healthRiskExplanation(r: HealthRiskResult): string {
  if (r.waistThreshold === null) return `Plage d’IMC ${r.band}.`
  if (r.waistRaised) {
    return `Relevé par le tour de taille : à partir de ${r.waistThreshold} cm dans la plage d’IMC ${r.band}, le risque monte au-dessus de celui de l’IMC seul.`
  }
  if (!r.waistKnown) {
    // Ne jamais affirmer qu'un tour de taille non mesuré est sous le seuil.
    return `Plage d’IMC ${r.band} · tour de taille non mesuré, le risque combiné n’a pas pu être évalué (seuil ${r.waistThreshold} cm).`
  }
  return `Plage d’IMC ${r.band} · tour de taille sous ${r.waistThreshold} cm, qui ne relève donc pas le risque.`
}

/** Couleurs de l'échelle de risque — partagées par le dashboard, le PDF et le
 *  document HTML, pour qu'un même risque ait la même couleur partout.
 *  Progression volontairement distincte des couleurs de catégorie de condition
 *  physique : ce n'est pas la même échelle et le vert n'y est pas un but. */
export const HEALTH_RISK_HEX: Record<HealthRisk, string> = {
  MOINDRE: '#15803d',
  ACCRU: '#ca8a04',
  ELEVE: '#ea580c',
  TRES_ELEVE: '#dc2626',
  EXTREMEMENT_ELEVE: '#991b1b'
}

/** Source à citer sous l'affichage — le libellé exact de la feuille de Marie. */
export const HEALTH_RISK_SOURCE = 'Aide-mémoire ÉAS (SPAP-SCPE) — adultes de 20 à 65 ans'
