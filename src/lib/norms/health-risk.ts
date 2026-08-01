/**
 * Risque pour la santé associé à l'IMC et au tour de taille.
 *
 * Source : **tableau 4.4** du Guide du conseiller en condition physique et
 * habitudes de vie, 3e éd. — « Risque pour la santé associé à l'IMC et à l'IMC
 * combiné au tour de taille ». L'aide-mémoire ÉAS (SPAP-SCPE) reproduit ce même
 * tableau ; c'est lui qui avait servi de source au départ (voir ADR 0036).
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

/** Échelle de risque du tableau 4.4, du meilleur au pire. */
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

/** Bandes d'IMC du tableau 4.4, avec le libellé exact imprimé. */
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
 * Risque santé combiné, tel que l'imprime le tableau 4.4.
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

/**
 * Source à citer sous l'affichage.
 *
 * **Tableau 4.4** du Guide du conseiller, 3ᵉ éd. Ces valeurs avaient d'abord été
 * attribuées à l'aide-mémoire ÉAS (SPAP-SCPE), qui reproduit ce tableau : les
 * six lignes encodées étaient donc justes, mais l'app renvoyait Marie vers un
 * document qu'elle n'a pas sous la main. Même correction que pour la table
 * aérobie — voir ADR 0036.
 *
 * La restriction d'âge, elle, figure bien en note de bas du tableau du guide.
 */
export const HEALTH_RISK_SOURCE =
  'CPAFLA / ÉCPHV — Guide du conseiller, 3ᵉ éd., tableau 4.4 — adultes de 20 à 65 ans'

/**
 * La nuance « entraînement musculaire » du tableau 4.4 s'applique-t-elle ?
 *
 * Note de bas de tableau, mot pour mot :
 *
 * > Les clients qui font de l'entraînement musculaire et qui ont un IMC dans la
 * > catégorie de surpoids, mais dont le tour de taille est inférieur aux
 * > limites, sont moins susceptibles de présenter un risque accru pour la santé.
 *
 * Cela vise un profil très concret chez Marie : quelqu'un de musclé, à IMC 27 et
 * tour de taille 88 cm, que l'app affichait « risque accru » sans réserve alors
 * que le guide dit précisément l'inverse pour lui. L'IMC ne distingue pas le
 * muscle de la graisse ; le tour de taille, si.
 *
 * Deux conditions **mesurables** sont vérifiées ici — IMC dans la plage de
 * surpoids (25 à 29,9) et tour de taille réellement mesuré sous le seuil. La
 * troisième — le client fait-il de l'entraînement musculaire ? — l'application
 * ne la connaît pas. La nuance est donc présentée à Marie comme une question,
 * jamais comme une conclusion : c'est elle qui sait.
 *
 * Volontairement limité à la plage de surpoids, comme l'écrit le guide. Étendre
 * la remarque aux plages d'obésité serait notre interprétation, pas la sienne.
 */
export function muscularCaveatApplies(r: HealthRiskResult): boolean {
  return r.band === '25,0–29,9' && r.waistKnown && !r.waistRaised
}

/* ── Barème affichable ───────────────────────────────────────────────────── */

export interface HealthRiskCell {
  risk: HealthRisk
  label: string
  /**
   * Libellé court pour la graduation du barème.
   *
   * Cinq colonnes se partagent la largeur : « Extrêmement élevé » s'y coupe en
   * « Extrêmement… », ce qui ne veut plus rien dire. Le libellé complet reste
   * affiché en verdict et dans l'infobulle.
   */
  shortLabel: string
  /** Couleur du palier — la même partout (dashboard, PDF, HTML). */
  hex: string
  /** Palier où se situe le client. */
  active: boolean
}

/**
 * Libellés courts pour les graduations d'échelle.
 *
 * Cinq zones se partagent la largeur d'une barre : « Extrêmement élevé » s'y
 * coupe en « Extrêmem… », qui ne veut plus rien dire. Le libellé complet reste
 * le verdict et l'infobulle.
 */
export const HEALTH_RISK_SHORT: Record<HealthRisk, string> = {
  MOINDRE: 'Moindre',
  ACCRU: 'Accru',
  ELEVE: 'Élevé',
  TRES_ELEVE: 'Très élevé',
  EXTREMEMENT_ELEVE: 'Extrême'
}

/**
 * Les cinq paliers de risque, avec celui du client marqué.
 *
 * Même intention que `categoryCells` pour les tests de condition physique :
 * montrer l'échelle plutôt qu'un mot isolé. « Accru » ne dit rien tant qu'on ne
 * voit pas qu'il y a un palier en dessous et trois au-dessus.
 */
export function healthRiskScale(r: HealthRiskResult): HealthRiskCell[] {
  return HEALTH_RISK_ORDER.map(risk => ({
    risk,
    label: HEALTH_RISK_LABELS[risk],
    shortLabel: HEALTH_RISK_SHORT[risk],
    hex: HEALTH_RISK_HEX[risk],
    active: risk === r.risk
  }))
}

export interface HealthRiskFacts {
  /** « IMC 27,3 » — la valeur mesurée, arrondie au dixième. */
  imc: string
  /** « plage 25,0–29,9 » — la ligne du tableau qui s'applique. */
  imcBand: string
  /** « 88 cm » ou `null` si non mesuré. */
  waist: string | null
  /** « seuil 100 cm » ou `null` si la plage d'IMC n'en définit pas. */
  waistThreshold: string | null
}

/**
 * Les chiffres qui ont produit le risque, prêts à afficher.
 *
 * C'est ce qui rend le verdict vérifiable : sans eux, « Accru » est à prendre ou
 * à laisser. Avec eux, Marie et son client voient l'IMC mesuré, la ligne du
 * tableau où il tombe, le tour de taille et le seuil qu'il n'a pas franchi.
 */
export function healthRiskFacts(input: HealthRiskInput, r: HealthRiskResult): HealthRiskFacts {
  // Pas de décimale inutile : « 88 cm » se lit mieux que « 88,0 cm ».
  const nombre = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))
  return {
    imc: typeof input.imc === 'number' ? nombre(input.imc) : '—',
    imcBand: r.band,
    waist: r.waistKnown && typeof input.waist === 'number' ? `${nombre(input.waist)} cm` : null,
    waistThreshold: r.waistThreshold !== null ? `${r.waistThreshold} cm` : null
  }
}

/* ── Barres à axe numérique, façon pression artérielle ───────────────────── */

export interface RiskZone {
  min: number
  max: number
  risk: HealthRisk
  hex: string
}

export interface RiskBar {
  zones: RiskZone[]
  scaleMin: number
  scaleMax: number
  /** Position du client sur l'axe, de 0 à 1. `null` si la valeur est absente. */
  markerRatio: number | null
  /** Bornes internes à chiffrer sous la barre. */
  bounds: number[]
}

/**
 * Bornes d'affichage de l'axe d'IMC.
 *
 * 15 et 45 encadrent largement les six bandes du tableau tout en gardant les
 * seuils lisibles. Une valeur en dehors n'est pas rejetée : le repère est
 * simplement plaqué contre le bord, comme pour la pression artérielle.
 */
const IMC_AXE = { min: 15, max: 45 }

/**
 * Barre de l'IMC seul, colorée par le risque de la colonne « Risque associé à
 * l'IMC » du tableau 4.4.
 *
 * Attention : cette barre montre le risque de l'IMC **pris isolément**, ce que
 * ce module refuse d'afficher comme verdict. Elle n'a de sens qu'à côté de la
 * barre du tour de taille et sous le verdict combiné — c'est un axe de lecture,
 * pas une conclusion.
 */
export function bmiRiskBar(imc: number | null | undefined): RiskBar {
  const zones: RiskZone[] = []
  let debut = IMC_AXE.min
  for (const b of BMI_BANDS) {
    const fin = Math.min(b.ltImc, IMC_AXE.max)
    if (fin > debut) zones.push({ min: debut, max: fin, risk: b.risk, hex: HEALTH_RISK_HEX[b.risk] })
    debut = fin
    if (debut >= IMC_AXE.max) break
  }
  const span = IMC_AXE.max - IMC_AXE.min
  const ratio =
    typeof imc === 'number' && !Number.isNaN(imc)
      ? Math.max(0, Math.min(1, (imc - IMC_AXE.min) / span))
      : null
  return {
    zones,
    scaleMin: IMC_AXE.min,
    scaleMax: IMC_AXE.max,
    markerRatio: ratio,
    bounds: [18.5, 25, 30, 35, 40]
  }
}

/**
 * Barre du tour de taille pour la ligne d'IMC du client.
 *
 * Deux zones seulement, parce que le tableau ne donne qu'un seuil par ligne et
 * par sexe. Le coloriage dit exactement ce que fait le tour de taille : sous le
 * seuil, le risque reste celui de l'IMC ; au-dessus, il devient le risque
 * combiné. C'est la lecture que ce tableau existe pour rendre évidente.
 *
 * `null` quand aucun seuil ne s'applique — IMC sous 18,5 (le tableau n'y évalue
 * pas le tour de taille) ou sexe inconnu (les seuils diffèrent).
 */
export function waistRiskBar(waist: number | null | undefined, r: HealthRiskResult): RiskBar | null {
  if (r.waistThreshold === null) return null
  const band = BMI_BANDS.find(b => b.label === r.band)
  if (!band || !band.combined) return null

  // L'axe s'ajuste au seuil : il doit rester lisible pour un seuil de 80 comme
  // pour un de 125, sans écraser le repère contre un bord.
  const min = Math.min(60, r.waistThreshold - 30)
  const max = Math.max(140, r.waistThreshold + 25)
  const span = max - min

  const ratio =
    typeof waist === 'number' && !Number.isNaN(waist) ? Math.max(0, Math.min(1, (waist - min) / span)) : null

  return {
    zones: [
      { min, max: r.waistThreshold, risk: band.risk, hex: HEALTH_RISK_HEX[band.risk] },
      { min: r.waistThreshold, max, risk: band.combined, hex: HEALTH_RISK_HEX[band.combined] }
    ],
    scaleMin: min,
    scaleMax: max,
    markerRatio: ratio,
    bounds: [r.waistThreshold]
  }
}

/** Ligne du barème complet, pour la table dépliable. */
export interface BaremeRow {
  imcLabel: string
  risk: HealthRisk
  riskLabel: string
  /** Seuil du sexe demandé, ou `null` si la ligne n'en prévoit pas. */
  waist: number | null
  combined: HealthRisk | null
  combinedLabel: string | null
  /** Ligne où se situe le client. */
  active: boolean
}

/** Le tableau 4.4 en entier, pour le sexe donné, ligne du client marquée. */
export function healthRiskBareme(sex: 'F' | 'M' | null, r: HealthRiskResult | null): BaremeRow[] {
  return BMI_BANDS.map(b => ({
    imcLabel: b.label,
    risk: b.risk,
    riskLabel: HEALTH_RISK_LABELS[b.risk],
    waist: b.waist && (sex === 'M' || sex === 'F') ? b.waist[sex] : null,
    combined: b.combined,
    combinedLabel: b.combined ? HEALTH_RISK_LABELS[b.combined] : null,
    active: r !== null && b.label === r.band
  }))
}

/** Le texte de la nuance, si elle s'applique. `null` sinon. */
export function muscularCaveat(r: HealthRiskResult): string | null {
  if (!muscularCaveatApplies(r)) return null
  return (
    'Si le client fait de l’entraînement musculaire : avec un IMC dans la plage de surpoids ' +
    'mais un tour de taille sous la limite, il est moins susceptible de présenter un risque ' +
    'accru pour la santé — l’IMC ne distingue pas le muscle de la graisse.'
  )
}
