import { WAIST_BOUNDS } from '../../lib/norms/clinical'
import { bodyFatRiskZones, type BfRiskZone } from '../../lib/body-fat-risk'
import { getAcsmRange } from '../../lib/norms/acsm'
import { categoryCells } from '../../lib/norms/bareme'
import {
  useTabulations,
  Explication,
  LigneBareme,
  Table,
  Source,
  SousTitre,
  COULEUR_CAT,
  ORDRE_CAT,
  CATEGORY_LABELS
} from './bareme-ui'

/**
 * Les trois mesures de la composition corporelle, en tabulations.
 *
 * Empilées, leurs barèmes deviennent illisibles : ils n'ont pas la même forme —
 * cinq catégories pour l'IMC, trois niveaux pour le tour de taille, cinq zones
 * de risque à double extrémité pour le % de gras. Une tabulation par mesure
 * laisse chacune s'afficher dans sa propre logique.
 *
 * ⚠️ Toutes les valeurs sont **lues depuis le code**, jamais recopiées : une
 * table de référence qui se désynchronise du calcul est pire que pas de table.
 */

const ONGLETS = [
  { key: 'imc', label: 'IMC' },
  { key: 'taille', label: 'Tour de taille' },
  { key: 'gras', label: '% de gras' }
] as const

export function CompositionBaremes() {
  const { actif, barre } = useTabulations(ONGLETS)
  return (
    <div>
      {barre}
      {actif === 'imc' && <PanneauImc />}
      {actif === 'taille' && <PanneauTourDeTaille />}
      {actif === 'gras' && <PanneauGras />}
    </div>
  )
}

// ── IMC ─────────────────────────────────────────────────────────────────────

function PanneauImc() {
  // Table lue depuis le code : les deux sexes partagent les mêmes bornes.
  const r = getAcsmRange('bmi', 40, 'M')
  const cells = r ? categoryCells(r.percentiles, true) : null

  return (
    <div>
      <Explication titre="Ce que l’IMC mesure">
        <p>
          Le rapport du poids sur le carré de la taille. C’est un indicateur de <strong>corpulence</strong>, pas
          de composition : il ne distingue pas le muscle de la graisse, ni où celle-ci se situe.
        </p>
        <p>
          Un client musclé peut donc se retrouver dans la plage de surpoids sans excès de gras. C’est
          précisément pourquoi l’IMC ne se lit jamais seul dans ce protocole : il sert à choisir la{' '}
          <strong>ligne du barème</strong> dans laquelle le tour de taille et les plis sont ensuite cotés.
        </p>
        <p className="text-amber-800">
          <strong>Limite connue de cette table.</strong> Elle ne gère pas la maigreur : un IMC de 15 y ressort
          « Excellent », alors que sous 18,5 le risque remonte. Le calcul de la composition corporelle, lui, le
          traite correctement — il n’accorde que 3 points sous 18,5, jamais 4. Cette table ne sert donc qu’à
          situer une valeur d’un coup d’œil, pas à juger un client maigre.
        </p>
      </Explication>

      {cells && (
        <Table>
          {ORDRE_CAT.map(cat => (
            <LigneBareme
              key={cat}
              label={CATEGORY_LABELS[cat]}
              plage={`${cells[cat]} kg/m²`}
              couleur={COULEUR_CAT[cat]}
            />
          ))}
        </Table>
      )}
      <Source>
        Catégories de l’Organisation mondiale de la Santé — indépendantes de l’âge et du sexe. Plus bas est
        mieux, jusqu’au seuil de maigreur.
      </Source>
    </div>
  )
}

// ── Tour de taille ──────────────────────────────────────────────────────────

function PanneauTourDeTaille() {
  const lignes = (sex: 'M' | 'F') => {
    const [excellent, hautPotentiel] = WAIST_BOUNDS[sex]
    return [
      { cote: 4, label: 'Excellent', plage: `moins de ${excellent} cm`, couleur: 'text-green-700' },
      {
        cote: 3,
        label: 'Risque potentiel',
        plage: `${excellent} à ${hautPotentiel} cm`,
        couleur: 'text-amber-700'
      },
      { cote: 1, label: 'Risque considérable', plage: `plus de ${hautPotentiel} cm`, couleur: 'text-red-700' }
    ]
  }

  return (
    <div>
      <Explication titre="Ce que le tour de taille mesure">
        <p>
          La graisse <strong>abdominale</strong> — celle qui entoure les organes. C’est elle qui pèse le plus
          dans le risque cardio-métabolique, davantage que le poids total.
        </p>
        <p>
          Mesuré à mi-chemin entre la dernière côte et la crête iliaque, en fin d’expiration normale, sans
          comprimer la peau. Deux mesures qui diffèrent de plus d’un centimètre se reprennent.
        </p>
        <p className="text-marine/50">
          Ce test n’attribue que les cotes <strong>4, 3 et 1</strong> — il saute le 2. C’est ainsi que le barème
          est publié ; le « corriger » en 4/3/2 inventerait une cote qui n’existe pas.
        </p>
      </Explication>

      {(['M', 'F'] as const).map(sex => (
        <div key={sex} className="mb-3 last:mb-0">
          <SousTitre>{sex === 'M' ? 'Hommes' : 'Femmes'} · tous les âges</SousTitre>
          <Table>
            {lignes(sex).map(l => (
              <LigneBareme key={l.cote} cote={l.cote} label={l.label} plage={l.plage} couleur={l.couleur} />
            ))}
          </Table>
        </div>
      ))}
      <Source>
        Statistique Canada — Enquête canadienne sur les mesures de la santé, variable dérivée HWMDWSTA. La borne
        haute est incluse : 101 cm reste « Risque potentiel ».
      </Source>
    </div>
  )
}

// ── Pourcentage de gras ─────────────────────────────────────────────────────

const COULEUR_ZONE: Record<string, string> = {
  potentiel: 'text-marine/60',
  optimal: 'text-green-800',
  sante: 'text-green-700',
  modere: 'text-amber-700',
  eleve: 'text-red-700'
}

function plage(z: BfRiskZone): string {
  const f = (n: number) => n.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
  if (z.min === 0) return `moins de ${f(z.max as number)} %`
  if (z.max === null) return `${f(z.min)} % et plus`
  return `${f(z.min)} à ${f(z.max)} %`
}

function PanneauGras() {
  return (
    <div>
      <Explication titre="Ce que le pourcentage de gras mesure">
        <p>
          La part de la masse corporelle qui est du tissu adipeux. Estimée ici par la méthode des{' '}
          <strong>plis cutanés</strong> (Durnin-Womersley, conversion de Siri) — quatre sites : triceps, biceps,
          sous-scapulaire et crête iliaque.
        </p>
        <p>
          Contrairement à l’IMC, il distingue le muscle de la graisse. C’est la mesure la plus parlante pour un
          client, et celle qui bouge le plus vite quand l’entraînement porte.
        </p>
        <p className="text-marine/50">
          La grille comporte du <strong>risque aux deux extrémités</strong> : trop peu de gras est aussi un
          problème que trop. C’est pourquoi elle n’est pas une échelle « plus bas = mieux ».
        </p>
      </Explication>

      {(['M', 'F'] as const).map(sex => (
        <div key={sex} className="mb-3 last:mb-0">
          <SousTitre>{sex === 'M' ? 'Hommes' : 'Femmes'} · moins de 70 ans</SousTitre>
          <Table>
            {bodyFatRiskZones(sex).map(z => (
              <LigneBareme
                key={z.key}
                label={z.label}
                plage={plage(z)}
                couleur={COULEUR_ZONE[z.key] ?? 'text-marine/70'}
              />
            ))}
          </Table>
        </div>
      ))}
    </div>
  )
}
