/** Signaux santé à surveiller — seuils cliniques absolus, PAS des percentiles.
 *
 *  Le reste du Dashboard situe le client dans sa population (percentiles ACSM) :
 *  un tour de taille de 105 cm peut être « dans la moyenne » et rester un risque
 *  cardiométabolique. Ce module lit les seuils reconnus, indépendamment de l'âge
 *  et du sexe (sauf pour le tour de taille, où le seuil diffère).
 *
 *  Repères utilisés :
 *   • Pression artérielle — Hypertension Canada (mesure au bureau)
 *   • Tour de taille — seuils de risque accru OMS / NIH
 *   • IMC — classification OMS
 *   • FC de repos — tachycardie au repos > 100 bpm
 *
 *  Ce ne sont pas des diagnostics : ils signalent quand orienter vers un médecin.
 */

export type FlagLevel = 'warn' | 'alert'

export interface HealthFlag {
  id: string
  level: FlagLevel
  /** Titre court, ex. « Pression artérielle élevée ». */
  title: string
  /** Valeur mesurée, formatée, ex. « 145/95 mmHg ». */
  value: string
  /** Le seuil franchi, ex. « seuil : ≥ 140/90 mmHg ». */
  threshold: string
  /** Pourquoi ça compte, en une phrase pour Marie-Eve. */
  why: string
}

const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null)

export function detectHealthFlags(data: BilanData, sex: 'F' | 'M' | null): HealthFlag[] {
  const flags: HealthFlag[] = []

  // ── Pression artérielle ────────────────────────────────────────────────────
  const sys = num(data.pa_systolique)
  const dia = num(data.pa_diastolique)
  if (sys !== null || dia !== null) {
    const shown = `${sys ?? '—'}/${dia ?? '—'} mmHg`
    if ((sys !== null && sys >= 180) || (dia !== null && dia >= 110)) {
      flags.push({
        id: 'pa-crise',
        level: 'alert',
        title: 'Pression artérielle très élevée',
        value: shown,
        threshold: 'seuil : ≥ 180/110 mmHg',
        why: 'Ne pas faire d’effort maximal. Orienter vers un médecin sans tarder.'
      })
    } else if ((sys !== null && sys >= 140) || (dia !== null && dia >= 90)) {
      flags.push({
        id: 'pa-hta',
        level: 'alert',
        title: 'Pression artérielle élevée',
        value: shown,
        threshold: 'seuil : ≥ 140/90 mmHg',
        why: 'Correspond au seuil d’hypertension. À confirmer par un suivi médical.'
      })
    } else if ((sys !== null && sys >= 130) || (dia !== null && dia >= 85)) {
      flags.push({
        id: 'pa-limite',
        level: 'warn',
        title: 'Pression artérielle à la limite',
        value: shown,
        threshold: 'zone limite : 130-139 / 85-89 mmHg',
        why: 'Sous le seuil d’hypertension, mais mérite d’être resuivi au prochain bilan.'
      })
    }
  }

  // ── Tour de taille (seuils distincts H / F) ────────────────────────────────
  const waist = num(data.tour_taille_cm)
  if (waist !== null && sex !== null) {
    const high = sex === 'M' ? 102 : 88
    const moderate = sex === 'M' ? 94 : 80
    if (waist > high) {
      flags.push({
        id: 'taille-eleve',
        level: 'alert',
        title: 'Tour de taille à risque élevé',
        value: `${waist} cm`,
        threshold: `seuil : > ${high} cm (${sex === 'M' ? 'homme' : 'femme'})`,
        why: 'Le gras abdominal est associé à un risque cardiométabolique accru.'
      })
    } else if (waist > moderate) {
      flags.push({
        id: 'taille-modere',
        level: 'warn',
        title: 'Tour de taille à risque modéré',
        value: `${waist} cm`,
        threshold: `zone modérée : > ${moderate} cm (${sex === 'M' ? 'homme' : 'femme'})`,
        why: 'Premier palier de risque — une cible utile pour un objectif de composition.'
      })
    }
  }

  // ── IMC ────────────────────────────────────────────────────────────────────
  const imc = num(data.imc)
  if (imc !== null) {
    const shown = `${imc.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} kg/m²`
    if (imc >= 30) {
      flags.push({
        id: 'imc-obesite',
        level: 'alert',
        title: 'IMC en zone d’obésité',
        value: shown,
        threshold: 'seuil : ≥ 30 kg/m²',
        why: 'À lire avec le % de gras : un IMC élevé peut aussi venir d’une forte masse musculaire.'
      })
    } else if (imc >= 25) {
      flags.push({
        id: 'imc-embonpoint',
        level: 'warn',
        title: 'IMC en zone d’embonpoint',
        value: shown,
        threshold: 'zone : 25 à 29,9 kg/m²',
        why: 'À lire avec le % de gras et le tour de taille avant d’en tirer une conclusion.'
      })
    } else if (imc < 18.5) {
      flags.push({
        id: 'imc-insuffisance',
        level: 'warn',
        title: 'IMC sous la zone normale',
        value: shown,
        threshold: 'seuil : < 18,5 kg/m²',
        why: 'Insuffisance pondérale — vérifier l’apport énergétique avant d’ajouter du volume.'
      })
    }
  }

  // ── FC de repos ────────────────────────────────────────────────────────────
  const fc = num(data.fc_repos)
  if (fc !== null) {
    if (fc > 100) {
      flags.push({
        id: 'fc-tachy',
        level: 'alert',
        title: 'FC de repos élevée',
        value: `${fc} bpm`,
        threshold: 'seuil : > 100 bpm',
        why: 'Tachycardie au repos. Écarter stress, caféine ou fièvre, sinon orienter vers un médecin.'
      })
    } else if (fc >= 90) {
      flags.push({
        id: 'fc-limite',
        level: 'warn',
        title: 'FC de repos à surveiller',
        value: `${fc} bpm`,
        threshold: 'zone limite : 90 à 100 bpm',
        why: 'Souvent un marqueur de déconditionnement — devrait baisser avec l’entraînement.'
      })
    }
  }

  // Les alertes d'abord, les avertissements ensuite.
  return flags.sort((a, b) => (a.level === b.level ? 0 : a.level === 'alert' ? -1 : 1))
}
