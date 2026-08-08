import {
  MUSCULO_WEIGHTS,
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
 * L'aptitude musculosquelettique globale, en trois temps.
 *
 * Même découpage que l'indice de santé du dos, et pour la même raison : la note
 * n'est le résultat d'aucun test unique. Elle réunit cinq mesures pondérées.
 *
 * ⚠️ Poids, barèmes et exemple viennent tous du code de cotation
 * (`MUSCULO_WEIGHTS`, `CPAFLA_TABLES`, `cpaflaCombineDetail`). Rien n'est recopié.
 */

const ONGLETS = [
  { key: 'composantes', label: 'Composantes' },
  { key: 'baremes', label: 'Barèmes des tests' },
  { key: 'calcul', label: 'Le calcul' }
] as const

export function MusculoBaremes() {
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

/** Force, puis endurance, puis souplesse — l'ordre dans lequel on lit une aptitude. */
const ORDRE_TESTS = [
  'pushups',
  'puissance_jambes_watts',
  'situps',
  'endurance_dos_sec',
  'flexion_tronc_cm'
]

// ── Composantes ─────────────────────────────────────────────────────────────

function PanneauComposantes() {
  return (
    <div>
      <Explication titre="Composantes et poids — figure 7-20">
        <p>Cinq tests pondérés. L’extension des bras compte double chez l’homme, la flexion du tronc chez la femme. Total identique dans les deux cas.</p>
        <p className="text-marine/50">Le guide compte aussi la force de préhension au dynamomètre. Elle n’est pas mesurée : retirée du calcul, la note maximale baisse d’autant.</p>
      </Explication>

      {(['M', 'F'] as const).map(sex => {
        const w = MUSCULO_WEIGHTS[sex]
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
              <LigneBareme label="Total des poids" plage={`× ${total}`} couleur="text-marine/45" />
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
        <p>Par âge et par sexe, cote 0 à 4.</p>
        <p className="text-marine/50">La puissance des jambes n’est pas mesurée : elle vient du saut vertical et du poids, par Sayers (1999) — <span className="tabular-nums">(60,7 × saut en cm) + (45,3 × poids en kg) − 2055</span>. C’est la valeur en watts qui est cotée.</p>
      </Explication>

      <div className="space-y-4">
        <BaremeTest test="pushups" titre="Extension des bras (push-ups)" unite="répétitions" />
        <BaremeTest test="legPower" titre="Puissance des jambes" unite="watts" />
        <BaremeTest test="situps" titre="Redressements assis" unite="répétitions" />
        <BaremeTest test="backEndurance" titre="Extension du dos (endurance)" unite="secondes" />
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
  test: 'pushups' | 'legPower' | 'situps' | 'backEndurance' | 'trunkFlexion'
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

/** Un cas concret, passé par la VRAIE fonction de calcul. */
const EXEMPLE_COTES: Record<string, number> = {
  pushups: 3,
  puissance_jambes_watts: 2,
  situps: 3,
  endurance_dos_sec: 2,
  flexion_tronc_cm: 4
}

function PanneauCalcul() {
  const sex = 'M' as const
  const w = MUSCULO_WEIGHTS[sex]
  const detail = cpaflaCombineDetail(
    ORDRE_TESTS.filter(k => w[k] !== undefined).map(
      k => [k, EXEMPLE_COTES[k], w[k]] as [string, number, number]
    )
  )
  const arrondi = cpaflaNomogramme(detail.score)

  return (
    <div>
      <Explication titre="Formule">
        <p className="text-marine/75">Note = (somme des cotes pondérées ÷ somme des maximums) × 4</p>
        <p className="text-marine/50">Identique à l’indice de santé du dos. La note garde ses décimales.</p>
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
