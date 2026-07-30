import { useState } from 'react'
import { CheckCircle2, FlaskConical, Loader2 } from 'lucide-react'
import { clientsService } from '../../services/clients'
import { mesuresService } from '../../services/mesures'
import { bilansService } from '../../services/bilans'
import { calculateAge, calculateBodyFat } from '../../lib/body-fat-calculator'
import dummyJeanFullbody from '../../assets/dummy-jean.png'
import dummyJeanSquare from '../../assets/dummy-jean-square.png'
import {
  circForMonth,
  DUMMY_BIRTHDATE,
  DUMMY_HEIGHT_CM,
  plisForMonth,
  SCENARIOS,
  type DummyScenario
} from '../../lib/dummy-scenarios'

const HEIGHT_M = DUMMY_HEIGHT_CM / 100
const round1 = (n: number): number => Math.round(n * 10) / 10

/** Ordre d'affichage : du meilleur cas au plus difficile, puis le neutre. */
const SCENARIO_ORDER: DummyScenario[] = ['progression', 'regression', 'neutre']

const SCENARIO_STYLE: Record<DummyScenario, string> = {
  progression: 'bg-gold text-marine hover:bg-gold-dark',
  regression: 'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100',
  neutre: 'border border-cream-dark bg-cream/70 text-marine/80 hover:bg-cream-dark hover:text-marine'
}

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

function isoOnMonth(startYear: number, startMonth0: number, day: number, offsetMonths: number): string {
  // Construit une date UTC pour éviter le décalage de fuseau.
  const d = new Date(Date.UTC(startYear, startMonth0 + offsetMonths, day))
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function round0(n: number): number {
  return Math.round(n)
}

/** Convertit un asset importé (URL bundlée) en base64, pour l'avatar. */
async function assetToBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function DummyJeanSeedButton() {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [lastScenario, setLastScenario] = useState<DummyScenario | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSeed(sc: DummyScenario) {
    const conf = SCENARIOS[sc]
    if (
      !window.confirm(
        `Créer « ${conf.name} » ?\n\nCela va insérer 1 client + 36 mesures de circonférences + 36 plis cutanés + 6 bilans (78 entrées au total).\n\nL'opération est annulée si un client ${conf.email} existe déjà.`
      )
    ) {
      return
    }

    setBusy(true)
    setLastScenario(sc)
    setError(null)
    setProgress(null)
    setDone(null)

    try {
      // Anti-doublon : refuse si l'email existe déjà.
      setProgress('Vérification anti-doublon…')
      const existing = await clientsService.list()
      if (existing.some(c => c.email === conf.email)) {
        setError(`« ${conf.name} » existe déjà. Supprimez-le d'abord depuis la liste Clients pour le recréer.`)
        setBusy(false)
        return
      }

      // 1) Création du client.
      setProgress('Création du client…')
      const client = await clientsService.create({
        name: conf.name,
        email: conf.email,
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
        // ±0.5 lb de bruit : rend la courbe organique. Volontairement ici et non
        // dans le module, pour que les tests restent deterministes.
        const c = circForMonth(m, sc, Math.random() - 0.5)
        await mesuresService.circonferences.create(client.id, { date, ...c })
      }

      // 3) 36 sessions de plis cutanés.
      for (let m = 0; m < 36; m++) {
        setProgress(`Plis cutanés ${m + 1}/36…`)
        const date = isoOnMonth(2023, 0, 15, m)
        const p = plisForMonth(m, sc)
        await mesuresService.plis.create(client.id, { date, ...p })
      }

      // 4) 6 bilans semestriels avec anthropo cohérente.
      for (let i = 0; i < conf.bilans.length; i++) {
        const b = conf.bilans[i]
        setProgress(`Bilan ${i + 1}/6 (${b.date})…`)
        const circ = circForMonth(b.monthOffset, sc)
        const plis = plisForMonth(b.monthOffset, sc)
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
      setDone(conf.name)
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
        Crée un client fictif avec 3 ans d'historique (36 mesures mensuelles + 6 bilans semestriels).
        Trois trajectoires, pour voir chaque écran dans les trois cas que vous rencontrez en pratique.
        Les trois clients peuvent coexister.
      </p>

      {error && (
        <div className="mb-3 text-red-700 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {done && !error && (
        <div className="mb-3 text-green-700 text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2 inline-flex items-center gap-2">
          <CheckCircle2 size={15} />« {done} » créé. Allez sur la liste des clients pour le consulter.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {SCENARIO_ORDER.map(sc => (
          <div key={sc} className="rounded-lg border border-cream-dark/60 bg-cream/30 p-3.5">
            <button
              type="button"
              onClick={() => handleSeed(sc)}
              disabled={busy}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${SCENARIO_STYLE[sc]}`}
            >
              {busy && lastScenario === sc && <Loader2 size={15} className="animate-spin" />}
              {busy && lastScenario === sc ? progress ?? 'Création…' : SCENARIOS[sc].bouton}
            </button>
            <p className="text-marine/50 text-xs mt-2.5 leading-relaxed">{SCENARIOS[sc].resume}</p>
          </div>
        ))}
      </div>

      <p className="text-marine/40 text-xs mt-4">
        Profil commun : H, 178 cm, né le 1978-06-15, bilans de janv. 2023 à juill. 2025. Chaque scénario a
        son propre courriel, donc les trois coexistent. Supprimables proprement depuis la liste Clients.
      </p>
    </section>
  )
}
