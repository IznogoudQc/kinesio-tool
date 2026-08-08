import { BloodPressureBar } from '../../components/BloodPressureBar'
import { BP_BOUNDS, BP_ZONES, systolicRating } from '../../lib/norms/clinical'
import { useTabulations, Explication, Table, LigneBareme, SousTitre, COULEUR_CAT } from './bareme-ui'

/**
 * La pression artérielle, en deux temps — parce que deux barèmes distincts
 * cohabitent et qu'on les confond facilement.
 *
 * Les **zones cliniques** (Optimale → Hypertension 2) colorent la barre montrée
 * au client. La **cote 0-4** qui entre dans le score global suit une autre règle,
 * beaucoup plus sévère. Une seule carte les présentait ensemble, sous un unique
 * état « Déduit » — ce qui donnait à croire que la barre affichée était douteuse
 * alors que seule la cote l'est.
 *
 * ⚠️ Les bornes viennent de `BP_BOUNDS` et la cote de `systolicRating` :
 * les mêmes fonctions que celles qui colorent le dashboard et alimentent le score.
 */

const ONGLETS = [
  { key: 'zones', label: 'Zones cliniques' },
  { key: 'cote', label: 'Cote dans le score' }
] as const

export function PaBaremes() {
  const { actif, barre } = useTabulations(ONGLETS)
  return (
    <div>
      {barre}
      {actif === 'zones' && <PanneauZones />}
      {actif === 'cote' && <PanneauCote />}
    </div>
  )
}

// ── Zones cliniques ─────────────────────────────────────────────────────────

/** Plages lisibles déduites des bornes — jamais recopiées. */
function plages(kind: 'systolic' | 'diastolic'): string[] {
  const b = BP_BOUNDS[kind]
  return [
    `moins de ${b[0]}`,
    `${b[0]} à ${b[1] - 1}`,
    `${b[1]} à ${b[2] - 1}`,
    `${b[2]} à ${b[3] - 1}`,
    `${b[3]} et plus`
  ]
}

function PanneauZones() {
  return (
    <div>
      <Explication titre="Zones cliniques">
        <p>Cinq zones, sans distinction d’âge ni de sexe. Bornes de l’ancien logiciel.</p>
        <p className="text-marine/50">Elles classent la pression au repos.</p>
      </Explication>

      {(['systolic', 'diastolic'] as const).map(kind => (
        <div key={kind} className="mb-5 last:mb-0">
          <SousTitre>{kind === 'systolic' ? 'Systolique' : 'Diastolique'} · mmHg</SousTitre>
          {/* La même barre que le dashboard, sans valeur : elle rend alors les
              zones seules, sans repère de client. */}
          <BloodPressureBar value={null} kind={kind} className="mb-2" />
          <Table>
            {BP_ZONES.map((z, i) => (
              <LigneBareme
                key={z.label}
                label={z.label}
                plage={`${plages(kind)[i]} mmHg`}
                couleur={COULEUR_CAT[z.category]}
              />
            ))}
          </Table>
        </div>
      ))}

    </div>
  )
}

// ── Cote dans le score ──────────────────────────────────────────────────────

/** Une valeur par zone, pour montrer la correspondance sans la recopier. */
const EXEMPLES = [112, 122, 135, 148, 165]

function PanneauCote() {
  return (
    <div>
      <Explication titre="Cote dans le score">
        <p>La cote reprend exactement les cinq zones : Optimale vaut 4, Hypertension 2 vaut 0.</p>
      </Explication>

      <SousTitre>Une valeur par zone</SousTitre>
      <Table>
        {EXEMPLES.map(v => {
          const cote = systolicRating(v)
          const zone = BP_ZONES[4 - (cote ?? 0)]
          return (
            <LigneBareme
              key={v}
              cote={cote ?? undefined}
              label={zone.label}
              plage={`${v} mmHg`}
              couleur={COULEUR_CAT[zone.category]}
            />
          )
        })}
      </Table>

    </div>
  )
}
