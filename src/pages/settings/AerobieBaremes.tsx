import { computeMet } from '../../lib/norms/calc'
import { VO2MAX_PROTOCOLES } from '../../lib/vo2max-calculator'
import {
  useTabulations,
  Explication,
  LigneBareme,
  Table,
  Source,
  SousTitre,
  TableParAge
} from './bareme-ui'

/**
 * L'aptitude aérobie, en trois temps — parce que trois choses distinctes se
 * cachent derrière une seule note : comment on estime le VO2max (l'équation, qui
 * dépend du protocole), comment on le cote (la table CPAFLA), et comment cette
 * cote rejoint le score global (les METS).
 *
 * Les mélanger était la source de la confusion : « Bruce » n'est pas un barème,
 * c'est une façon d'obtenir la valeur qu'on cote ensuite.
 *
 * ⚠️ Rien n'est recopié : les équations viennent de `VO2MAX_PROTOCOLES` (déclaré
 * à côté de son implémentation) et la table de `TableParAge`, qui lit `CPAFLA_TABLES`.
 */

const ONGLETS = [
  { key: 'protocoles', label: 'Protocoles' },
  { key: 'bareme', label: 'Barème VO₂max' },
  { key: 'mets', label: 'METS et score' }
] as const

export function AerobieBaremes() {
  const { actif, barre } = useTabulations(ONGLETS)
  return (
    <div>
      {barre}
      {actif === 'protocoles' && <PanneauProtocoles />}
      {actif === 'bareme' && <PanneauBareme />}
      {actif === 'mets' && <PanneauMets />}
    </div>
  )
}

const nf = (n: number, d = 1) => n.toLocaleString('fr-CA', { maximumFractionDigits: d })

// ── Protocoles ──────────────────────────────────────────────────────────────

function PanneauProtocoles() {
  return (
    <div>
      <Explication titre="Comment le VO₂max est obtenu">
        <p>
          Le VO₂max ne se mesure pas directement en bilan de terrain — il faudrait un analyseur de gaz. On
          l’<strong>estime</strong> à partir d’un effort maximal, par une équation propre au protocole employé.
        </p>
        <p>
          Le protocole se choisit à la saisie du bilan. Il change l’équation, pas le barème : quelle que soit la
          façon d’obtenir la valeur, elle est ensuite cotée sur la même table.
        </p>
      </Explication>

      <div className="space-y-3">
        {VO2MAX_PROTOCOLES.map(p => {
          const ex = p.exemple()
          return (
            <div key={p.key} className="rounded-md border border-cream-dark bg-white p-3">
              <p className="text-marine font-semibold text-sm">{p.nom}</p>
              <p className="text-marine/55 text-sm mt-0.5">{p.mesure}</p>
              <p className="text-marine/75 text-sm mt-2 tabular-nums">
                VO₂max = {p.formule}
              </p>
              <p className="text-marine/45 text-xs mt-1.5">
                Exemple : {ex.entree} → <span className="tabular-nums">{nf(ex.vo2max)}</span> ml/kg/min · {p.source}
              </p>
            </div>
          )
        })}
      </div>

      <Source>
        Une valeur peut aussi être saisie à la main, si elle vient d’un test fait ailleurs. Le test navette de
        Léger a été validé chez les 8-19 ans : au-delà, l’équation reste utilisable mais devient optimiste, et
        elle finit par donner des valeurs impossibles chez une personne âgée qui s’arrête tôt. Vérifier que le
        résultat a du sens avant de le retenir.
      </Source>
    </div>
  )
}

// ── Barème VO2max ───────────────────────────────────────────────────────────

function PanneauBareme() {
  return (
    <div>
      <Explication titre="Comment le VO₂max est coté">
        <p>
          Le barème dépend de l’<strong>âge et du sexe</strong> : le VO₂max décline naturellement avec l’âge, donc
          une même valeur ne vaut pas la même cote à 25 ans et à 55 ans.
        </p>
        <p>
          Les catégories sont celles du bénéfice pour la santé, pas d’une performance sportive. « Excellent »
          signifie que le niveau protège déjà bien, pas qu’il faut viser plus haut.
        </p>
        <p className="text-marine/50">
          La table couvre <strong>15 à 69 ans</strong>. En dehors, la cotation retombe sur la table ACSM plutôt
          que d’extrapoler — c’est le seul test où deux barèmes coexistent.
        </p>
      </Explication>

      <div className="space-y-3">
        {(['M', 'F'] as const).map(sex => (
          <TableParAge key={sex} test="vo2max" sex={sex} unite="ml/kg/min" />
        ))}
      </div>

      <Source>
        CPAFLA / ÉCPHV — Guide du conseiller, 3ᵉ éd., tableau 4.10 « VO₂max estimé : évaluation des avantages pour
        la santé ».
      </Source>
    </div>
  )
}

// ── METS ────────────────────────────────────────────────────────────────────

/** Repères d'effort courants, pour rendre les METS concrets. */
const REPERES_METS: { mets: number; quoi: string }[] = [
  { mets: 1, quoi: 'Au repos, assis' },
  { mets: 3, quoi: 'Marche lente, tâches ménagères légères' },
  { mets: 5, quoi: 'Marche rapide, vélo tranquille' },
  { mets: 8, quoi: 'Jogging, montée d’escaliers soutenue' },
  { mets: 11, quoi: 'Course rapide, sport d’équipe intense' }
]

function PanneauMets() {
  // Le MET affiché vient de la vraie fonction de conversion, pas d'une division
  // réécrite ici : c'est elle qui alimente le score global.
  const exemple = computeMet(35)

  return (
    <div>
      <Explication titre="Du VO₂max aux METS">
        <p>
          Un <strong>MET</strong> est la dépense d’énergie au repos. Le VO₂max exprimé en METS répond donc à une
          question simple : <em>combien de fois son métabolisme de repos la personne peut-elle soutenir ?</em>
        </p>
        <p className="text-marine/75 tabular-nums">
          METS = VO₂max ÷ 3,5 — par exemple 35 ml/kg/min ÷ 3,5 = {exemple === null ? '—' : nf(exemple)} METS.
        </p>
        <p>
          C’est la forme la plus parlante pour un client : elle se traduit directement en activités qu’il
          reconnaît. Un VO₂max de 35 veut dire peu de choses ; « tu peux soutenir un jogging » se comprend.
        </p>
      </Explication>

      <SousTitre>Ce que chaque niveau permet</SousTitre>
      <Table>
        {REPERES_METS.map(r => (
          <LigneBareme
            key={r.mets}
            label={r.quoi}
            plage={`${r.mets} MET${r.mets > 1 ? 'S' : ''}`}
            couleur="text-marine/75"
          />
        ))}
      </Table>

      <Source>
        Convention historique : 1 MET = 3,5 ml/kg/min. Les repères d’effort ci-dessus servent à illustrer l’ordre
        de grandeur — ils ne sont pas un barème et n’entrent dans aucun calcul. C’est la <strong>cote 0-4</strong>{' '}
        du VO₂max, pas les METS, qui entre dans le score global.
      </Source>
    </div>
  )
}
