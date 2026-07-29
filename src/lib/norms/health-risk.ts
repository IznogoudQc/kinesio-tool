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
  { ltImc: 18.5, label: 'moins de 18,5', risk: 'ACCRU' },
  { ltImc: 25, label: '18,5–24,9', risk: 'MOINDRE' },
  { ltImc: 30, label: '25,0–29,9', risk: 'ACCRU' },
  { ltImc: 35, label: '30,0–34,9', risk: 'ELEVE' },
  { ltImc: 40, label: '35,0–39,9', risk: 'TRES_ELEVE' },
  { ltImc: Infinity, label: '40 et plus', risk: 'EXTREMEMENT_ELEVE' }
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

// ── Risque combiné IMC + tour de taille — EN ATTENTE ─────────────────────────
//
// La feuille donne aussi des seuils de tour de taille par sexe et un risque
// combiné. Volontairement NON encodé : sur la photo fournie, les colonnes
// « TT, hommes » et « TT, femmes » sont décalées d'environ une demi-ligne par
// rapport aux tranches d'IMC (6 tranches d'IMC pour 5 valeurs de tour de
// taille, et « ≥ 125 » lu deux fois de suite chez les hommes). Les chiffres
// sont lisibles, leur ligne d'appartenance ne l'est pas.
//
// Se tromper d'une ligne ferait afficher « risque extrêmement élevé » à un
// client dont le risque est « élevé ». À encoder dès qu'une photo à plat de ce
// seul tableau sera disponible.
