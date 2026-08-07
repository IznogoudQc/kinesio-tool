import {
  MUSCULO_WEIGHTS,
  BACK_HEALTH_WEIGHTS,
  CPAFLA_TEST_LABELS,
  cpaflaCombineDetail,
  cpaflaNomogramme
} from '../../lib/norms/cpafla-combined'
import { sayersLegPower } from '../../lib/vo2max-calculator'
import {
  useTabulations,
  Explication,
  Table,
  LigneBareme,
  Source,
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
      <Explication titre="Ce que la note regroupe">
        <p>
          Cinq tests, qui couvrent les trois qualités musculaires : la <strong>force</strong> (bras, jambes),
          l’<strong>endurance</strong> (abdominaux, extenseurs du dos) et la <strong>souplesse</strong>.
        </p>
        <p>
          Le test qui compte double change selon le sexe : l’<strong>extension des bras</strong> chez l’homme, la{' '}
          <strong>flexion du tronc</strong> chez la femme. Le total des poids reste le même dans les deux cas.
        </p>
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

      <Source>
        Figure 7-20 du Guide du conseiller. Le guide compte aussi la <strong>force de préhension</strong> au
        dynamomètre, qui n’est pas mesurée ici : elle est retirée du calcul plutôt qu’estimée, et la note
        maximale baisse d’autant.
      </Source>
    </div>
  )
}

// ── Barèmes des tests ───────────────────────────────────────────────────────

function PanneauBaremes() {
  // Exemple calculé par la vraie équation — un saut et un poids plausibles.
  const exempleWatts = sayersLegPower(45, 75)

  return (
    <div>
      <Explication titre="Comment chaque test est coté">
        <p>
          Les cinq tests sont cotés par âge et par sexe, sur cinq catégories. Chacun devient une cote de 0 à 4
          avant d’entrer dans la moyenne pondérée.
        </p>
        <p className="text-marine/50">
          La <strong>puissance des jambes</strong> ne se mesure pas directement : elle est calculée à partir du
          saut vertical et du poids, par l’équation de Sayers (1999) —{' '}
          <span className="tabular-nums">(60,7 × saut en cm) + (45,3 × poids en kg) − 2055</span>. Par exemple un
          saut de 45 cm à 75 kg donne{' '}
          <span className="tabular-nums">{exempleWatts === null ? '—' : exempleWatts.toLocaleString('fr-CA')}</span>{' '}
          watts. C’est cette valeur en watts qui est cotée, pas la hauteur du saut.
        </p>
      </Explication>

      <div className="space-y-4">
        <BaremeTest test="pushups" titre="Extension des bras (push-ups)" unite="répétitions" />
        <BaremeTest test="legPower" titre="Puissance des jambes" unite="watts" />
        <BaremeTest test="situps" titre="Redressements assis" unite="répétitions" />
        <BaremeTest test="backEndurance" titre="Extension du dos (endurance)" unite="secondes" />
        <BaremeTest test="trunkFlexion" titre="Flexion du tronc" unite="cm" />
      </div>

      <Source>
        Figures 7-18 (hommes) et 7-19 (femmes) du Guide du conseiller — les mêmes tables que celles de l’indice
        de santé du dos, pour les tests communs aux deux notes.
      </Source>
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

  // Tests présents à la fois ici et dans l'indice de santé du dos — déduits des
  // deux tables de poids, pour que la liste suive toute modification de l'une.
  const communs = Object.keys(w).filter(k => BACK_HEALTH_WEIGHTS[sex][k] !== undefined)

  return (
    <div>
      <Explication titre="Comment les cinq cotes deviennent une note">
        <p>
          Comme pour l’indice du dos : chaque cote est multipliée par son poids, on additionne, et on divise par
          le maximum possible <em>des tests réellement mesurés</em>.
        </p>
        <p className="text-marine/75">note = (somme des cotes pondérées ÷ somme des maximums) × 4</p>
        <p className="text-marine/50">
          La note garde ses <strong>décimales</strong>, comme dans l’ancien logiciel. Le nomogramme du guide
          (Fig. 7-21) n’en est que la version arrondie.
        </p>
      </Explication>

      <SousTitre>Exemple — un homme, cinq tests mesurés</SousTitre>
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

      <p className="text-marine/60 text-sm mt-4 leading-relaxed">
        <strong className="text-marine/75">À savoir : </strong>
        {communs.length} de ces tests ({communs.map(k => CPAFLA_TEST_LABELS[k] ?? k).join(', ')}) comptent{' '}
        <strong>aussi</strong> dans l’indice de santé du dos. Comme les deux notes entrent chacune dans le score
        global, progresser sur l’un d’eux fait bouger le score deux fois. C’est ainsi que le guide construit ses
        deux indices — mais mieux vaut le savoir avant de s’étonner qu’un seul test déplace autant l’aiguille.
      </p>

      <Source>
        Reproduit les résultats de l’ancien logiciel sur les six bilans vérifiés. Les chiffres de cet exemple
        sont calculés par la fonction qui produit les vraies notes.
      </Source>
    </div>
  )
}
