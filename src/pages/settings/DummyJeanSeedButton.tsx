import { useState } from 'react'
import { CheckCircle2, FlaskConical, Loader2 } from 'lucide-react'
import { clientsService } from '../../services/clients'
import { mesuresService } from '../../services/mesures'
import { bilansService } from '../../services/bilans'
import { calculateAge, calculateBodyFat } from '../../lib/body-fat-calculator'
import dummyJeanFullbody from '../../assets/dummy-jean.png'
import dummyJeanSquare from '../../assets/dummy-jean-square.png'

/**
 * ⚠ Outil de développement temporaire ⚠
 *
 * Crée un client de démo « Dummy Jean » avec :
 *  - 36 sessions mensuelles de circonférences (janv 2023 → déc 2025)
 *  - 36 sessions mensuelles de plis cutanés
 *  - 6 bilans semestriels (janv 2023 → juill 2025)
 *
 * Anti-doublon : refuse si un client `dummy@kinesio-outils.test` existe déjà.
 * Le client n'a aucun lien avec un vrai utilisateur — supprimable proprement
 * depuis la liste Clients pour repartir à zéro.
 */

const DUMMY_EMAIL = 'dummy@kinesio-outils.test'
const DUMMY_BIRTHDATE = '1978-06-15'
const DUMMY_HEIGHT_CM = 178
const HEIGHT_M = DUMMY_HEIGHT_CM / 100

/** Trajectoire de poids (lb) sur 36 mois — non-linéaire, plateau croissant. */
function weightLbForMonth(month: number): number {
  if (month <= 12) return 300 - month * 3.75 // an 1 : −45 lb
  if (month <= 24) return 255 - (month - 12) * 2.92 // an 2 : −35 lb
  return 220 - (month - 24) * 1.67 // an 3 : −20 lb (plateau)
}

function isoOnMonth(startYear: number, startMonth0: number, day: number, offsetMonths: number): string {
  // Construit une date UTC pour éviter le décalage de fuseau.
  const d = new Date(Date.UTC(startYear, startMonth0 + offsetMonths, day))
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round0(n: number): number {
  return Math.round(n)
}

/** Pour le poids lb → kg, l'IPC reçoit kg. */
function lbToKg(lb: number): number {
  return lb / 2.20462
}

/** Génère une session de circonférences cohérente avec un mois donné (0-35). */
function circForMonth(month: number) {
  // ±0.5 lb de bruit pour rendre la courbe organique.
  const poidsLb = weightLbForMonth(month) + (Math.random() - 0.5)
  // Les circonférences sont corrélées au poids ; pour les muscles (biceps, épaules),
  // léger gain progressif avec le temps (entraînement).
  const lostLb = 300 - poidsLb
  return {
    poidsKg: round1(lbToKg(poidsLb)),
    cou: round1(46 - lostLb * 0.06),
    epaule: round1(128 - lostLb * 0.05 + month * 0.04),
    bicepsG: round1(38 + month * 0.04),
    bicepsD: round1(38.3 + month * 0.04),
    poitrine: round1(120 - lostLb * 0.1),
    taille: round1(132 - lostLb * 0.37),
    abdomen: round1(135 - lostLb * 0.38),
    hanche: round1(128 - lostLb * 0.3),
    cuisseG: round1(72 - lostLb * 0.08),
    cuisseD: round1(72.5 - lostLb * 0.08),
    molletG: round1(45 - lostLb * 0.04),
    molletD: round1(45.3 - lostLb * 0.04)
  }
}

function plisForMonth(month: number) {
  const poidsLb = weightLbForMonth(month)
  const lostLb = 300 - poidsLb
  // Les plis décroissent fortement avec la perte de masse grasse.
  const triceps = Math.max(4, round1(28 - lostLb * 0.18))
  const biceps = Math.max(3, round1(20 - lostLb * 0.13))
  const sousscapulaire = Math.max(5, round1(38 - lostLb * 0.2))
  const iliaque = Math.max(5, round1(45 - lostLb * 0.25))
  return { triceps, biceps, sousscapulaire, iliaque }
}

/** Bilans semestriels — valeurs cibles tirées du brief. */
interface BilanSpec {
  date: string
  monthOffset: number // pour récupérer la circonférence + plis du mois correspondant
  vo2max: number
  bruceDurationSec: number
  fcRepos: number
  paSys: number
  paDia: number
  pushups: number
  situps: number
  sautCm: number
  flexionCm: number
  enduranceDosSec: number
}

const BILANS: BilanSpec[] = [
  { date: '2023-01-15', monthOffset: 0, vo2max: 18, bruceDurationSec: 5 * 60 + 18, fcRepos: 92, paSys: 148, paDia: 96, pushups: 3, situps: 6, sautCm: 18, flexionCm: 20, enduranceDosSec: 32 },
  { date: '2023-07-15', monthOffset: 6, vo2max: 22, bruceDurationSec: 6 * 60 + 36, fcRepos: 86, paSys: 142, paDia: 92, pushups: 7, situps: 11, sautCm: 23, flexionCm: 26, enduranceDosSec: 53 },
  { date: '2024-01-15', monthOffset: 12, vo2max: 26, bruceDurationSec: 7 * 60 + 54, fcRepos: 80, paSys: 136, paDia: 88, pushups: 11, situps: 15, sautCm: 28, flexionCm: 29, enduranceDosSec: 75 },
  { date: '2024-07-15', monthOffset: 18, vo2max: 30, bruceDurationSec: 9 * 60, fcRepos: 75, paSys: 130, paDia: 84, pushups: 15, situps: 19, sautCm: 33, flexionCm: 31, enduranceDosSec: 95 },
  { date: '2025-01-15', monthOffset: 24, vo2max: 33, bruceDurationSec: 9 * 60 + 45, fcRepos: 70, paSys: 126, paDia: 80, pushups: 18, situps: 22, sautCm: 37, flexionCm: 33, enduranceDosSec: 110 },
  { date: '2025-07-15', monthOffset: 30, vo2max: 37, bruceDurationSec: 10 * 60 + 51, fcRepos: 66, paSys: 122, paDia: 78, pushups: 22, situps: 25, sautCm: 41, flexionCm: 35, enduranceDosSec: 120 }
]

/** Charge un asset bundlé Vite et retourne sa version base64 (sans prefix). */
async function assetToBase64(assetUrl: string): Promise<string> {
  const blob = await fetch(assetUrl).then(r => r.blob())
  const buf = new Uint8Array(await blob.arrayBuffer())
  // String.fromCharCode(...) explose pour les gros tableaux — on chunk.
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < buf.length; i += chunkSize) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function DummyJeanSeedButton() {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSeed() {
    if (
      !window.confirm(
        'Créer Dummy Jean ?\n\nCela va insérer 1 client + 36 mesures de circonférences + 36 plis cutanés + 6 bilans (78 entrées au total).\n\nL\'opération est annulée si un client dummy@kinesio-outils.test existe déjà.'
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)
    setProgress(null)

    try {
      // Anti-doublon : refuse si l'email existe déjà.
      setProgress('Vérification anti-doublon…')
      const existing = await clientsService.list()
      if (existing.some(c => c.email === DUMMY_EMAIL)) {
        setError('Dummy Jean existe déjà. Supprimez-le d\'abord depuis la liste Clients pour le recréer.')
        setBusy(false)
        return
      }

      // 1) Création du client.
      setProgress('Création du client…')
      const client = await clientsService.create({
        name: 'Dummy Jean',
        email: DUMMY_EMAIL,
        birthdate: DUMMY_BIRTHDATE,
        sex: 'M',
        unitLength: 'cm',
        unitWeight: 'lb'
      })

      // Photo de profil — utilise les 2 versions bundlées dans src/assets/.
      // On loggue silencieusement les erreurs : l'absence d'avatar ne doit pas
      // faire échouer tout le seed (les mesures sont la valeur principale).
      try {
        setProgress('Photo de profil…')
        const [squareB64, fullbodyB64] = await Promise.all([
          assetToBase64(dummyJeanSquare),
          assetToBase64(dummyJeanFullbody)
        ])
        await clientsService.setAvatar(client.id, squareB64, fullbodyB64)
      } catch (err) {
        console.warn('Impossible de définir la photo de profil de Dummy Jean :', err)
      }

      // 2) 36 sessions de circonférences (janv 2023 → déc 2025).
      for (let m = 0; m < 36; m++) {
        setProgress(`Circonférences ${m + 1}/36…`)
        const date = isoOnMonth(2023, 0, 15, m)
        const c = circForMonth(m)
        await mesuresService.circonferences.create(client.id, { date, ...c })
      }

      // 3) 36 sessions de plis cutanés.
      for (let m = 0; m < 36; m++) {
        setProgress(`Plis cutanés ${m + 1}/36…`)
        const date = isoOnMonth(2023, 0, 15, m)
        const p = plisForMonth(m)
        await mesuresService.plis.create(client.id, { date, ...p })
      }

      // 4) 6 bilans semestriels avec anthropo cohérente.
      for (let i = 0; i < BILANS.length; i++) {
        const b = BILANS[i]
        setProgress(`Bilan ${i + 1}/6 (${b.date})…`)
        const circ = circForMonth(b.monthOffset)
        const plis = plisForMonth(b.monthOffset)
        // % gras Durnin-Womersley pour ce moment précis (cohérent avec les plis).
        const age = calculateAge(DUMMY_BIRTHDATE)
        const bodyFat = calculateBodyFat(
          {
            triceps: plis.triceps,
            biceps: plis.biceps,
            sousscapulaire: plis.sousscapulaire,
            iliaque: plis.iliaque
          },
          age,
          'M'
        )
        const imc = round1(circ.poidsKg / (HEIGHT_M * HEIGHT_M))

        const data: BilanData = {
          // Anthropométrie
          taille_cm: DUMMY_HEIGHT_CM,
          poids_kg: circ.poidsKg,
          imc,
          tour_taille_cm: circ.taille,
          tour_hanche_cm: circ.hanche,
          pli_triceps: plis.triceps,
          pli_biceps: plis.biceps,
          pli_sous_scap: plis.sousscapulaire,
          pli_iliaque: plis.iliaque,
          pourcentage_gras: round1(bodyFat.bodyFatSiri),
          // Aérobie
          test_aerobie: 'Tapis Roulant de Bruce',
          aerobie_test_type: 'bruce',
          bruce_duration_sec: b.bruceDurationSec,
          vo2max: b.vo2max,
          met_equivalent: round1(b.vo2max / 3.5),
          fc_repos: b.fcRepos,
          fc_max_predite: round0(208 - 0.7 * age),
          pa_systolique: b.paSys,
          pa_diastolique: b.paDia,
          // Musculo
          pushups: b.pushups,
          situps: b.situps,
          saut_vertical_cm: b.sautCm,
          puissance_jambes_watts: round0(60.7 * b.sautCm + 45.3 * circ.poidsKg - 2055),
          flexion_tronc_cm: b.flexionCm,
          endurance_dos_sec: b.enduranceDosSec
        }
        await bilansService.create(client.id, { date: b.date, data, source: 'manuel' })
      }

      setProgress(null)
      setDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Erreur pendant l'insertion : ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white border border-cream-dark rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1">
        <FlaskConical size={18} className="text-gold" />
        <h2 className="text-marine font-semibold text-lg">Outils de développement</h2>
      </div>
      <p className="text-marine/55 text-sm mb-4">
        Crée un client fictif <code className="bg-cream/60 px-1 rounded">Dummy Jean</code> avec 3 ans
        d'historique (36 mesures mensuelles + 6 bilans semestriels). Utilisé pour tester le dashboard
        et les graphiques d'évolution sur un dataset riche et réaliste.
      </p>

      {error && (
        <div className="mb-3 text-red-700 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {done && !error && (
        <div className="mb-3 text-green-700 text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2 inline-flex items-center gap-2">
          <CheckCircle2 size={15} />
          Dummy Jean créé. Allez sur la liste des clients pour le consulter.
        </div>
      )}

      <button
        type="button"
        onClick={handleSeed}
        disabled={busy || done}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-marine font-semibold rounded-md text-sm hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        {done ? '✓ Créé' : busy ? progress ?? 'Création…' : 'Créer Dummy Jean'}
      </button>

      <p className="text-marine/40 text-xs mt-3">
        Profil : H, 178 cm, 1978-06-15. Trajectoire 300 lb → 200 lb sur 3 ans avec gain musculaire
        progressif. Supprimable proprement depuis la liste Clients.
      </p>
    </section>
  )
}
