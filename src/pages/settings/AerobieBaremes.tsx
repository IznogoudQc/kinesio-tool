import { computeMet } from '../../lib/norms/calc'
import { VO2MAX_PROTOCOLES } from '../../lib/vo2max-calculator'
import {
  useTabulations,
  useBoutonBareme,
  BarreOnglets,
  Explication,
  TableParAge
} from './bareme-ui'

/**
 * L'aptitude aérobie : l'équation qui donne la valeur, puis sa traduction en
 * METS. Le barème lui-même s'ouvre par le bouton, comme pour la composition —
 * une table de six tranches d'âge × cinq catégories ne se consulte pas à chaque
 * visite, et en faire un onglet la mettait sur le même plan que le reste.
 *
 * « Bruce » n'est pas un barème : c'est une façon d'obtenir la valeur qu'on cote
 * ensuite. Les confondre était la source de la confusion d'origine.
 *
 * ⚠️ Rien n'est recopié : les équations viennent de `VO2MAX_PROTOCOLES` (déclaré
 * à côté de son implémentation) et la table de `TableParAge`, qui lit `CPAFLA_TABLES`.
 */

const ONGLETS = [
  { key: 'protocoles', label: 'Protocoles' },
  { key: 'mets', label: 'METS et score' }
] as const

export function AerobieBaremes() {
  const { actif, barre } = useTabulations(ONGLETS)
  const { ouvert, bouton } = useBoutonBareme('Afficher le barème VO₂max par âge et par sexe')

  return (
    <div>
      <BarreOnglets barre={barre} bouton={bouton} />
      {ouvert && <PanneauBareme />}
      {actif === 'protocoles' && <PanneauProtocoles />}
      {actif === 'mets' && <PanneauMets />}
    </div>
  )
}

const nf = (n: number, d = 1) => n.toLocaleString('fr-CA', { maximumFractionDigits: d })

// ── Protocoles ──────────────────────────────────────────────────────────────

function PanneauProtocoles() {
  return (
    <div>
      <Explication titre="Équation d’estimation">
        <p>Marie n’utilise que le tapis roulant. Une valeur venue d’un test fait ailleurs peut aussi être saisie à la main — elle est alors cotée sur la même table.</p>
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

    </div>
  )
}

// ── Barème VO2max ───────────────────────────────────────────────────────────

function PanneauBareme() {
  return (
    <div className="mb-5 rounded-lg border border-gold/30 bg-gold/[0.04] p-3">
      <Explication titre="Barème — Guide du conseiller, tableau 4.10">
        <p>Par âge et par sexe, en ml/kg/min.</p>
        <p className="text-marine/50">Couvre 15 à 69 ans. En dehors, la cotation retombe sur la table ACSM — seul test du bilan où deux barèmes coexistent.</p>
      </Explication>

      <div className="space-y-3">
        {(['M', 'F'] as const).map(sex => (
          <TableParAge key={sex} test="vo2max" sex={sex} unite="ml/kg/min" />
        ))}
      </div>

    </div>
  )
}

// ── METS ────────────────────────────────────────────────────────────────────

function PanneauMets() {
  // Le MET affiché vient de la vraie fonction de conversion, pas d'une division
  // réécrite ici : c'est elle qui alimente le score global.
  const exemple = computeMet(35)

  return (
    <div>
      <Explication titre="Conversion en METS">
        <p className="text-marine/75 tabular-nums">METS = VO₂max ÷ 3,5 — par exemple 35 ml/kg/min ÷ 3,5 = {exemple === null ? '—' : nf(exemple)} METS.</p>
        <p className="text-marine/50">Les METS servent à l’affichage. C’est la cote 0-4 du VO₂max qui entre dans le score global.</p>
      </Explication>


    </div>
  )
}
