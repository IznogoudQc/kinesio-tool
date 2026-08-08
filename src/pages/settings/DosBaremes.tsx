import {
  BACK_HEALTH_WEIGHTS,
  CPAFLA_TEST_LABELS,
  cpaflaCombineDetail,
  cpaflaNomogramme
} from '../../lib/norms/cpafla-combined'
import {
  useTabulations,
  Explication,
  Table,
  LigneBareme,
  SousTitre,
  TableParAge
} from './bareme-ui'

/**
 * L'indice de santé du dos, en trois temps.
 *
 * C'est la section la plus opaque du bilan : la note ne vient d'aucun test qui
 * s'appelle « dos ». Elle agrège quatre mesures, avec des poids qui changent
 * selon le sexe, et sur une échelle qui n'arrondit pas. Trois questions
 * distinctes — lesquelles, comment chacune est cotée, comment on les combine —
 * d'où trois onglets.
 *
 * ⚠️ Les poids viennent de `BACK_HEALTH_WEIGHTS`, les barèmes des tables CPAFLA,
 * et l'exemple de `cpaflaCombineDetail` — la fonction qui calcule la vraie note.
 */

const ONGLETS = [
  { key: 'composantes', label: 'Composantes' },
  { key: 'baremes', label: 'Barèmes des tests' },
  { key: 'calcul', label: 'Le calcul' }
] as const

export function DosBaremes() {
  const { actif, barre } = useTabulations(ONGLETS)
  return (
    <div>
      {barre}
      {actif === 'composantes' && <PanneauComposantes />}
      {actif === 'baremes' && <PanneauBaremes />}
      {actif === 'calcul' && <PanneauCalcul />}
    </div>
  )
}

const nf = (n: number, d = 1) => n.toLocaleString('fr-CA', { maximumFractionDigits: d })

/** Ordre de lecture : les deux tests du tronc d'abord, puis ce qui les entoure. */
const ORDRE_TESTS = ['endurance_dos_sec', 'situps', 'flexion_tronc_cm', 'tour_taille_cm']

// ── Composantes ─────────────────────────────────────────────────────────────

function PanneauComposantes() {
  return (
    <div>
      <Explication titre="Composantes et poids — figure 7-24">
        <p>Quatre mesures pondérées. L’extension du dos compte double chez tout le monde ; le tour de taille compte double chez la femme.</p>
        <p className="text-marine/50">Le guide compte aussi le niveau d’activité physique. Il n’est pas saisi : retiré du calcul, la note maximale baisse d’autant.</p>
      </Explication>

      {(['M', 'F'] as const).map(sex => {
        const w = BACK_HEALTH_WEIGHTS[sex]
        const total = ORDRE_TESTS.reduce((s, k) => s + (w[k] ?? 0), 0)
        return (
          <div key={sex} className="mb-3 last:mb-0">
            <SousTitre>{sex === 'M' ? 'Hommes' : 'Femmes'} · poids de chaque test</SousTitre>
            <Table>
              {ORDRE_TESTS.filter(k => w[k] !== undefined).map(k => (
                <LigneBareme
                  key={k}
                  label={CPAFLA_TEST_LABELS[k] ?? k}
                  plage={`× ${w[k]}`}
                  couleur={w[k] > 1 ? 'text-marine font-semibold' : 'text-marine/70'}
                />
              ))}
              <LigneBareme
                label="Total des poids"
                plage={`× ${total}`}
                couleur="text-marine/45"
              />
            </Table>
          </div>
        )
      })}

    </div>
  )
}

// ── Barèmes des tests ───────────────────────────────────────────────────────

function PanneauBaremes() {
  return (
    <div>
      <Explication titre="Barèmes des tests — figures 7-18 / 7-19">
        <p>Par âge et par sexe, cote 0 à 4. L’extension du dos plafonne à 180 secondes.</p>
        <p className="text-amber-800">Le tour de taille fait exception : ici il est coté par les tables de composition, selon la plage d’IMC — pas par le barème « moins de 94 cm » de la section d’à côté.</p>
      </Explication>

      <div className="space-y-4">
        <BaremeTest test="backEndurance" titre="Extension du dos (endurance)" unite="secondes" />
        <BaremeTest test="situps" titre="Redressements assis" unite="répétitions" />
        <BaremeTest test="trunkFlexion" titre="Flexion du tronc" unite="cm" />
      </div>

    </div>
  )
}

function BaremeTest({
  test,
  titre,
  unite
}: {
  test: 'backEndurance' | 'situps' | 'trunkFlexion'
  titre: string
  unite: string
}) {
  return (
    <div>
      <p className="text-marine font-semibold text-sm mb-2">{titre}</p>
      <div className="space-y-2">
        {(['M', 'F'] as const).map(sex => (
          <TableParAge key={sex} test={test} sex={sex} unite={unite} />
        ))}
      </div>
    </div>
  )
}

// ── Le calcul ───────────────────────────────────────────────────────────────

/** Un cas concret, passé par la VRAIE fonction de calcul — jamais une arithmétique
 *  réécrite ici. Si la pondération change, ce tableau change avec elle. */
const EXEMPLE_COTES: Record<string, number> = {
  endurance_dos_sec: 2,
  situps: 3,
  flexion_tronc_cm: 4,
  tour_taille_cm: 3
}

function PanneauCalcul() {
  const sex = 'F' as const
  const w = BACK_HEALTH_WEIGHTS[sex]
  const detail = cpaflaCombineDetail(
    ORDRE_TESTS.filter(k => w[k] !== undefined).map(k => [k, EXEMPLE_COTES[k], w[k]] as [string, number, number])
  )
  const arrondi = cpaflaNomogramme(detail.score)

  return (
    <div>
      <Explication titre="Formule">
        <p className="text-marine/75">Note = (somme des cotes pondérées ÷ somme des maximums) × 4</p>
        <p className="text-marine/50">Seuls les tests mesurés comptent, des deux côtés de la division : un test absent ne pénalise pas. La note garde ses décimales.</p>
      </Explication>

      <div className="rounded-md border border-cream-dark bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream-dark/60">
              <th className="py-1.5 pl-2 text-left font-medium text-marine/45 text-xs">Test</th>
              <th className="py-1.5 px-2 text-right font-medium text-marine/45 text-xs">Cote</th>
              <th className="py-1.5 px-2 text-right font-medium text-marine/45 text-xs">Poids</th>
              <th className="py-1.5 px-2 text-right font-medium text-marine/45 text-xs">Obtenu</th>
              <th className="py-1.5 pr-2 text-right font-medium text-marine/45 text-xs">Maximum</th>
            </tr>
          </thead>
          <tbody>
            {detail.rows.map(r => (
              <tr key={r.key} className="border-b border-cream-dark/50">
                <td className="py-1.5 pl-2 text-marine/70">{CPAFLA_TEST_LABELS[r.key] ?? r.key}</td>
                <td className="py-1.5 px-2 text-right text-marine/70 tabular-nums">{r.cote ?? '—'}</td>
                <td className="py-1.5 px-2 text-right text-marine/70 tabular-nums">× {r.poids}</td>
                <td className="py-1.5 px-2 text-right text-marine font-medium tabular-nums">{r.points ?? '—'}</td>
                <td className="py-1.5 pr-2 text-right text-marine/45 tabular-nums">{r.maxPoints}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 pl-2 text-marine/45 text-xs uppercase tracking-wide font-semibold" colSpan={3}>
                Total
              </td>
              <td className="py-1.5 px-2 text-right text-marine font-semibold tabular-nums">{detail.obtenue}</td>
              <td className="py-1.5 pr-2 text-right text-marine/70 tabular-nums">{detail.max}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-marine/75 text-sm mt-3 tabular-nums">
        ({detail.obtenue} ÷ {detail.max}) × 4 ={' '}
        <strong>{detail.score === null ? '—' : nf(detail.score)}</strong> sur 4
        {arrondi !== null && (
          <span className="text-marine/45"> · le nomogramme du guide arrondirait à {arrondi}</span>
        )}
      </p>

    </div>
  )
}
