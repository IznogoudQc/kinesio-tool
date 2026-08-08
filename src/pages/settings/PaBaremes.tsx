import { BloodPressureBar } from '../../components/BloodPressureBar'
import { BP_BOUNDS, BP_ZONES, systolicRatingLegacy } from '../../lib/norms/clinical'
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
 * ⚠️ Les bornes viennent de `BP_BOUNDS` et la cote de `systolicRatingLegacy` :
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

/** Les quatre points connus de l'ancien logiciel — ce qui a servi au rétro-calcul. */
const POINTS_CONNUS = [112, 113, 122, 129]

function PanneauCote() {
  return (
    <div>
      <Explication titre="La cote 0-4, qui n’est pas la couleur">
        <p>
          Le score global n’utilise <strong>pas</strong> les cinq zones ci-contre. Il applique une règle bien plus
          sévère : <strong>moins de 120 mmHg vaut 4, tout le reste vaut 0</strong>. Pas de valeurs intermédiaires.
        </p>
        <p className="text-amber-800">
          Cette règle est <strong>déduite</strong>, pas documentée. Elle a été retrouvée en comparant quatre
          bilans de l’ancien logiciel — c’est le seul barème du bilan dans ce cas.
        </p>
      </Explication>

      <SousTitre>Ce que donne la règle appliquée</SousTitre>
      <Table>
        {POINTS_CONNUS.map(v => (
          <LigneBareme
            key={v}
            label={`${v} mmHg`}
            plage={`${systolicRatingLegacy(v)} / 4`}
            couleur={systolicRatingLegacy(v) === 4 ? COULEUR_CAT.EXCELLENT : COULEUR_CAT.A_AMELIORER}
          />
        ))}
      </Table>
      <Source>
        Les quatre valeurs connues de l’ancien logiciel, recalculées ici par la fonction qui alimente réellement
        le score.
      </Source>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
        <p className="text-marine/70 text-sm leading-relaxed">
          <strong className="text-marine">Pourquoi pas les zones cliniques ?</strong> Ce serait plus cohérent,
          mais les chiffres le refusent : une tension de 122 mmHg tombe dans « Normale », ce qui vaudrait{' '}
          {CATEGORY_LABELS.TRES_BIEN.toLowerCase()} — or l’ancien logiciel lui donne <strong>0</strong>. Une
          recherche exhaustive sur toutes les combinaisons de seuils possibles ne trouve de solution qu’avec des
          zones d’environ 1 mmHg, ce qui n’a aucun sens clinique.
        </p>
        <p className="text-marine/70 text-sm leading-relaxed mt-2">
          Trancher demande la fenêtre <strong>Propriétés</strong> du test dans l’ancien logiciel, onglet des
          cotes. En attendant, la règle déduite est conservée : elle reproduit les quatre bilans connus.
        </p>
      </div>
    </div>
  )
}
