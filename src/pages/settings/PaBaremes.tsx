import { BloodPressureBar } from '../../components/BloodPressureBar'
import { BP_BOUNDS, BP_ZONES, systolicRating } from '../../lib/norms/clinical'
import { CATEGORY_LABELS } from '../../lib/norms'
import { useTabulations, Explication, Table, LigneBareme, Source, SousTitre, COULEUR_CAT } from './bareme-ui'

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
      <Explication titre="Les zones qui colorent la barre">
        <p>
          Cinq zones, <strong>indépendantes de l’âge et du sexe</strong> — la tension se juge aux mêmes seuils
          pour tout le monde. Ce sont elles que le client voit sur son bilan.
        </p>
        <p className="text-marine/50">
          Elles classent la pression <strong>au repos</strong>. Après un effort, il est normal qu’elle soit plus
          élevée : ce qui compte alors est la vitesse du retour vers les valeurs de repos, pas la zone atteinte.
        </p>
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

      <Source>
        Seuils OMS / JNC — références publiques, les mêmes que celles de l’ancien logiciel.
      </Source>
    </div>
  )
}

// ── Cote dans le score ──────────────────────────────────────────────────────

/** Une valeur par zone, pour montrer la correspondance sans la recopier. */
const EXEMPLES = [112, 122, 135, 148, 165]

function PanneauCote() {
  return (
    <div>
      <Explication titre="De la zone à la cote">
        <p>
          Le score global reprend <strong>exactement</strong> les cinq zones de l’onglet précédent. La couleur que
          voit le client et la cote qui entre dans son score disent donc la même chose — Optimale vaut 4,
          Hypertension 2 vaut 0, et les trois niveaux entre les deux se suivent.
        </p>
        <p>
          Aucune distinction d’âge ni de sexe, comme pour les zones elles-mêmes.
        </p>
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
      <Source>
        Cotes calculées ici par la fonction qui alimente réellement le score, pas recopiées.
      </Source>

      <div className="mt-4 rounded-lg border border-cream-dark bg-cream/30 p-3">
        <p className="text-marine/70 text-sm leading-relaxed">
          <strong className="text-marine">Ce qui a changé.</strong> Jusqu’à la version 0.9.144, la cote était
          binaire : {CATEGORY_LABELS.EXCELLENT.toLowerCase()} sous 120 mmHg, {CATEGORY_LABELS.A_AMELIORER.toLowerCase()}{' '}
          au-dessus. Cette règle venait d’un rétro-calcul sur quatre anciens bilans, faute de barème documenté.
        </p>
        <p className="text-marine/70 text-sm leading-relaxed mt-2">
          Elle reproduisait mieux deux rapports de l’ancien logiciel, qui passent de 2,2 à 2,8 avec les zones.
          L’écart est assumé : une échelle publiée et cohérente avec ce que voit le client a été préférée à la
          reproduction de deux bilans. Les scores étant recalculés à l’affichage, aucune donnée n’a été modifiée.
        </p>
      </div>
    </div>
  )
}
