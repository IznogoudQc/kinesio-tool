import { useEffect } from 'react'
import { ACSM_TABLES } from '../lib/norms/acsm'
import { getClinicalRange } from '../lib/norms/clinical'
import type { NormRange, TestKey } from '../lib/norms/types'
import { bodyFatRiskZones, type BfRiskZone } from '../lib/body-fat-risk'

/** Document de référence des barèmes & formules — rendu pour export PDF via la
 *  fenêtre cachée (report-generator `generateBaremesPdf`). Les tables de
 *  catégorisation sont lues depuis `ACSM_TABLES` → toujours synchro avec le code. */

const nf = (n: number) => n.toLocaleString('fr-CA', { maximumFractionDigits: 4 })

/** Bornes des 5 catégories à partir des percentiles p10/p25/p50/p75. */
function catRanges(p: { p10: number; p25: number; p50: number; p75: number }, lower: boolean): string[] {
  if (!lower)
    return [`< ${nf(p.p10)}`, `${nf(p.p10)}–${nf(p.p25)}`, `${nf(p.p25)}–${nf(p.p50)}`, `${nf(p.p50)}–${nf(p.p75)}`, `≥ ${nf(p.p75)}`]
  return [`≥ ${nf(p.p10)}`, `${nf(p.p25)}–${nf(p.p10)}`, `${nf(p.p50)}–${nf(p.p25)}`, `${nf(p.p75)}–${nf(p.p50)}`, `< ${nf(p.p75)}`]
}

function rowLabel(r: NormRange, merge: boolean): string {
  const ageAgnostic = r.ageMin === 0 && r.ageMax >= 120
  const sx = merge ? 'Homme / Femme' : r.sex === 'M' ? (ageAgnostic ? 'Homme' : 'H') : ageAgnostic ? 'Femme' : 'F'
  if (ageAgnostic) return sx
  const age = r.ageMax >= 120 ? `${r.ageMin} +` : `${r.ageMin}–${r.ageMax}`
  return `${sx} ${age}`
}

interface Meta {
  test: TestKey
  label: string
  unit: string
  source: string
  hors?: boolean
  mergeSexes?: boolean
}

function Baro({ meta }: { meta: Meta }) {
  const ranges = ACSM_TABLES[meta.test] as NormRange[] | null
  if (!ranges) return null
  const rows = meta.mergeSexes ? ranges.filter(r => r.sex === 'M') : ranges
  return (
    <div className="baro">
      <div className="baro-t">
        <h3>{meta.label}</h3>
        <span className="u">{meta.unit}</span>
        {meta.hors && <span className="badge low">hors ACSM</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th>Groupe</th>
            <th className="c1">À améliorer</th>
            <th className="c2">Acceptable</th>
            <th className="c3">Bien</th>
            <th className="c4">Très bien</th>
            <th className="c5">Excellent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const c = catRanges(r.percentiles, r.lowerIsBetter ?? false)
            return (
              <tr key={i}>
                <td>{rowLabel(r, !!meta.mergeSexes)}</td>
                <td className="c1">{c[0]}</td>
                <td className="c2">{c[1]}</td>
                <td className="c3">{c[2]}</td>
                <td className="c4">{c[3]}</td>
                <td className="c5">{c[4]}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="src">Source : {meta.source}.</p>
    </div>
  )
}

const CARDIO: Meta[] = [{ test: 'vo2max', label: 'VO2max', unit: 'ml/kg/min', source: 'ACSM 11ᵉ éd.' }]
const COMPO: Meta[] = [
  { test: 'bmi', label: 'IMC', unit: 'kg/m²', source: 'OMS · indépendant de l’âge/sexe', mergeSexes: true },
  { test: 'waistCircumference', label: 'Tour de taille', unit: 'cm', source: 'Santé Canada / ACSM' }
  // Le % de gras utilise une grille de risque dédiée — voir <BodyFatRiskTable>.
]

/** Plage formatée d'une zone de risque (« < 15 », « 15–25 », « ≥ 42 »). */
function riskRange(z: BfRiskZone): string {
  const f = (n: number) => n.toLocaleString('fr-CA', { maximumFractionDigits: 1 })
  if (z.min === 0) return `< ${f(z.max as number)}`
  if (z.max === null) return `≥ ${f(z.min)}`
  return `${f(z.min)}–${f(z.max)}`
}

/** % de gras — grille de **risque** (5 zones, palier « < 70 ans »). Colonnes
 *  différentes des autres tests : risque aux deux extrémités. Lue depuis
 *  `body-fat-risk.ts` → toujours synchro avec les barres du client. */
function BodyFatRiskTable() {
  const zonesF = bodyFatRiskZones('F')
  const zonesM = bodyFatRiskZones('M')
  // Couleur de cellule par zone : neutre (trop maigre) → verts → ambre → rouge.
  const cls = ['c3', 'c5', 'c4', 'c2', 'c1']
  const cells = (zones: BfRiskZone[]) => zones.map((z, i) => <td key={z.key} className={cls[i]}>{riskRange(z)}</td>)
  return (
    <div className="baro">
      <div className="baro-t">
        <h3>% de gras corporel</h3>
        <span className="u">%</span>
        <span className="badge low">grille de risque</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Groupe</th>
            {zonesF.map((z, i) => <th key={z.key} className={cls[i]}>{z.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr><td>Homme &lt; 70</td>{cells(zonesM)}</tr>
          <tr><td>Femme &lt; 70</td>{cells(zonesF)}</tr>
        </tbody>
      </table>
      <p className="src">
        Source : grille de référence (ancien logiciel de Marie) — à valider. Le score de composition corporelle (§ 8)
        continue d'utiliser les percentiles ACSM pour le % de gras.
      </p>
    </div>
  )
}
const FORCE: Meta[] = [
  { test: 'pushups', label: 'Pompes', unit: 'reps', source: 'ACSM 11ᵉ éd.' },
  { test: 'situps', label: 'Redressements assis', unit: 'reps', source: 'ACSM 11ᵉ éd.' },
  { test: 'trunkFlexion', label: 'Flexion du tronc', unit: 'cm', source: 'ACSM 11ᵉ éd.' },
  { test: 'backEndurance', label: 'Endurance du dos (Sorensen)', unit: 's', source: 'hors ACSM — Biering-Sørensen 1984', hors: true },
  { test: 'verticalJump', label: 'Saut vertical', unit: 'cm', source: 'hors ACSM — Heyward 2010', hors: true },
  { test: 'legPower', label: 'Puissance des jambes', unit: 'W', source: 'hors ACSM — dérivé de Sayers 1999', hors: true }
]

/** Table clinique FC repos, lue depuis clinical.ts (lowerIsBetter). */
function FcReposTable() {
  const m = getClinicalRange('restingHeartRate', 'M')
  const f = getClinicalRange('restingHeartRate', 'F')
  if (!m || !f) return null
  const row = (label: string, r: NormRange) => {
    const c = catRanges(r.percentiles, true)
    return (
      <tr>
        <td>{label}</td>
        <td className="c1">{c[0]}</td>
        <td className="c2">{c[1]}</td>
        <td className="c3">{c[2]}</td>
        <td className="c4">{c[3]}</td>
        <td className="c5">{c[4]}</td>
      </tr>
    )
  }
  return (
    <div className="baro">
      <div className="baro-t"><h3>Fréquence cardiaque au repos</h3><span className="u">bpm</span></div>
      <table>
        <thead><tr><th>Groupe</th><th className="c1">À améliorer</th><th className="c2">Acceptable</th><th className="c3">Bien</th><th className="c4">Très bien</th><th className="c5">Excellent</th></tr></thead>
        <tbody>{row('Homme', m)}{row('Femme', f)}</tbody>
      </table>
      <p className="src">Source : ACSM (chart FC repos).</p>
    </div>
  )
}

export function BaremesPage() {
  useEffect(() => {
    // Signale au générateur PDF (report-generator) que le rendu est prêt.
    ;(window as unknown as { __REPORT_READY__?: boolean }).__REPORT_READY__ = true
  }, [])

  return (
    <div className="bwrap">
      <style>{CSS}</style>
      <p className="eyebrow">Kinésio Outils · document de référence</p>
      <h1>Barèmes &amp; formules de référence</h1>
      <p className="lead">Tous les barèmes de catégorisation et formules de calcul utilisés par l'application, avec leur
        source. Les tableaux sont générés à partir des mêmes données que le logiciel.</p>

      <h2>1 · Principe de catégorisation</h2>
      <p>Chaque test est comparé aux percentiles (P10, P25, P50, P75) de la population de même âge et sexe :
        &lt; P10 = À améliorer, P10–P25 = Acceptable, P25–P50 = Bien, P50–P75 = Très bien, ≥ P75 = Excellent
        (échelle 0 à 4, comme l'ancien logiciel : ≥ 3,5 = Excellent). Pour les mesures où plus bas = mieux
        (IMC, tour de taille, tension, FC repos), l'échelle est inversée. Un score composite est la moyenne
        des scores des tests qui le composent.</p>
      <p><b>Exception — le % de gras</b> est présenté au client via une <b>grille de risque dédiée</b> (5 zones, palier
        « moins de 70 ans » — voir § 3), avec du risque aux deux extrémités (trop maigre comme trop gras). Les percentiles
        ACSM du % de gras restent utilisés en coulisse pour le score de composition corporelle.</p>

      <h2>2 · Cardio &amp; endurance</h2>
      {CARDIO.map(m => <Baro key={m.test} meta={m} />)}

      <h2>3 · Composition corporelle</h2>
      {COMPO.map(m => <Baro key={m.test} meta={m} />)}
      <BodyFatRiskTable />

      <h2>4 · Force &amp; souplesse</h2>
      {FORCE.map(m => <Baro key={m.test} meta={m} />)}

      <h2>5 · Seuils cliniques</h2>
      <div className="baro">
        <div className="baro-t"><h3>Pression artérielle</h3><span className="u">mmHg · OMS/JNC</span></div>
        <table>
          <thead><tr><th>Zone</th><th className="c5">Excellent</th><th className="c4">Très bien</th><th className="c3">Bien</th><th className="c2">Acceptable</th><th className="c1">À améliorer</th></tr></thead>
          <tbody>
            <tr><td>Systolique</td><td className="c5">Optimale &lt;120</td><td className="c4">Normale 120–129</td><td className="c3">Pré-HT 130–139</td><td className="c2">HT1 · 140–159</td><td className="c1">HT2 · ≥160</td></tr>
            <tr><td>Diastolique</td><td className="c5">Optimale &lt;80</td><td className="c4">Normale 80–84</td><td className="c3">Pré-HT 85–89</td><td className="c2">HT1 · 90–99</td><td className="c1">HT2 · ≥100</td></tr>
          </tbody>
        </table>
        <p className="src">Source : seuils OMS / JNC.</p>
      </div>
      <FcReposTable />

      <h2>6 · Risque cardio-métabolique (OMS)</h2>
      <div className="baro">
        <table>
          <thead><tr><th>Mesure</th><th className="c5">Faible</th><th className="c2">Élevé</th><th className="c1">Très élevé</th></tr></thead>
          <tbody>
            <tr><td>Tour de taille — Homme</td><td className="c5">&lt;94 cm</td><td className="c2">94–102</td><td className="c1">≥102</td></tr>
            <tr><td>Tour de taille — Femme</td><td className="c5">&lt;80 cm</td><td className="c2">80–88</td><td className="c1">≥88</td></tr>
            <tr><td>Ratio taille/hanche — Homme</td><td className="c5">&lt;0,90</td><td className="c2">0,90–1,00</td><td className="c1">≥1,00</td></tr>
            <tr><td>Ratio taille/hanche — Femme</td><td className="c5">&lt;0,80</td><td className="c2">0,80–0,85</td><td className="c1">≥0,85</td></tr>
          </tbody>
        </table>
        <p className="src">Source : seuils OMS.</p>
      </div>

      <h2>7 · Formules de calcul</h2>
      <h3>IMC</h3>
      <pre className="f">IMC = poids(kg) / taille(m)²</pre>
      <h3>VO2max (protocoles de terrain)</h3>
      <pre className="f">Bruce · T = durée en minutes
Homme : 14,76 − 1,379·T + 0,451·T² − 0,012·T³   (Foster/Pollock 1984)
Femme : 4,38·T − 3,9   (Pollock 1982)
Cooper (12 min) : (distance_m − 504,9) / 44,73
Léger (navette 20 m) : 31,025 + 3,238·palier − 3,248·âge + 0,1536·palier·âge
MET = VO2max / 3,5</pre>
      <h3>% de gras — 4 plis cutanés</h3>
      <pre className="f">densité D = c − m · log₁₀(Σ 4 plis)   (Durnin-Womersley 1974, c/m selon âge &amp; sexe)
% gras Siri   = (4,95 / D − 4,50) × 100
% gras Brožek = (4,57 / D − 4,142) × 100</pre>
      <h3>Fréquence cardiaque</h3>
      <pre className="f">FC max = 208 − 0,7 × âge   (Tanaka 2001)
Zones = FC max × 60 % … 90 % (par pas de 5 %)</pre>
      <h3>Puissance des jambes</h3>
      <pre className="f">Puissance (W) = 60,7·saut(cm) + 45,3·poids(kg) − 2055   (Sayers 1999)</pre>

      <h2>8 · Scores composites (1 à 5)</h2>
      <table className="plain">
        <tbody>
          <tr><td>Composition corporelle</td><td>IMC + % de gras + tour de taille</td></tr>
          <tr><td>Cœur &amp; endurance</td><td>VO2max</td></tr>
          <tr><td>Force musculaire</td><td>Pompes + redressements + saut vertical + puissance des jambes</td></tr>
          <tr><td>Dos &amp; souplesse</td><td>Flexion du tronc + endurance du dos + redressements</td></tr>
          <tr><td>Score global</td><td>Moyenne des 4 scores ci-dessus</td></tr>
        </tbody>
      </table>

      <h2>9 · Nutrition &amp; objectif</h2>
      <p className="lead">Volet activable par client. Macros indicatives — la planification alimentaire relève d'un(e)
        nutritionniste.</p>
      <pre className="f">BMR (Mifflin-St Jeor) · Base = 10·poids + 6,25·taille − 5·âge
Homme : Base + 5      Femme : Base − 161
TDEE = BMR × activité (Sédentaire 1,20 · Léger 1,375 · Modéré 1,55 · Actif 1,725 · Très actif 1,90)
Calories cibles = TDEE − déficit (jamais sous le BMR), ou valeur manuelle
Déficit/jour = rythme(kg/sem) × 7700 ÷ 7   (1 kg gras ≈ 7700 kcal)
Protéines = 1 g / lb de masse maigre   ·   Lipides = plafond 60 g   ·   Glucides = le reste
masse maigre = poids × (1 − %gras/100)   ·   poids-cible = maigre / (1 − %cible/100)</pre>

      <h2>10 · Sources</h2>
      <ul className="src-list">
        <li>ACSM's Guidelines for Exercise Testing and Prescription, 11ᵉ éd. (2021).</li>
        <li>Durnin &amp; Womersley (1974) · Siri (1961) · Brožek (1963) — calcul du % de gras (plis cutanés).</li>
        <li><b>Grille de risque du % de gras</b> (palier &lt; 70 ans) — reprise de l'ancien logiciel de Marie, <b>source à valider</b>.</li>
        <li>Foster/Pollock (1984), Cooper (1968), Léger (1988) — VO2max.</li>
        <li>Tanaka (2001), Sayers (1999), Mifflin-St Jeor (1990), OMS/JNC.</li>
        <li><b>Hors ACSM (à valider en priorité)</b> : endurance du dos, saut vertical, puissance en watts, FC repos.</li>
      </ul>
      <p className="foot">Kinésio Outils · document généré depuis l'application — reflète le code actuel.</p>
    </div>
  )
}

const CSS = `
.bwrap{font-family:'Inter',system-ui,sans-serif;color:#2b2f3a;font-size:12px;line-height:1.5;background:#fff;padding:4mm 6mm}
.bwrap h1{font-family:'Fraunces',Georgia,serif;color:#0a1c5e;font-size:24px;margin:0 0 3px}
.bwrap h2{font-family:'Fraunces',Georgia,serif;color:#0a1c5e;font-size:17px;margin:20px 0 10px;padding-bottom:5px;border-bottom:2px solid #b8834a;break-after:avoid}
.bwrap h3{font-size:13px;font-weight:700;color:#0a1c5e;margin:14px 0 5px}
.eyebrow{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#966a33;font-weight:700}
.lead{color:#6b6555;max-width:100%}
.baro{margin:12px 0;break-inside:avoid}
.baro-t{display:flex;align-items:baseline;gap:8px;margin-bottom:3px}
.baro-t h3{margin:0}
.baro-t .u{color:#6b6555;font-size:11px}
.badge.low{font-size:10px;background:#b8834a;color:#0a1c5e;padding:1px 7px;border-radius:20px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:11.5px}
th,td{padding:4px 7px;text-align:center;border-bottom:1px solid #e5e0d2;font-variant-numeric:tabular-nums}
th{font-size:9.5px;letter-spacing:.02em;text-transform:uppercase;color:#6b6555;font-weight:700;background:#faf6ec}
td:first-child,th:first-child{text-align:left;font-weight:600;color:#0a1c5e}
.c1{background:#fbe4e0;color:#a3352a}.c2{background:#fbe7d6;color:#a5641f}.c3{background:#f2ecdb;color:#6b6152}
.c4{background:#e6f0dd;color:#3f7d32}.c5{background:#d4e9cd;color:#2c7a2c;font-weight:600}
.src{font-size:11px;color:#6b6555;font-style:italic;margin:4px 0 0}
.f{background:#0f1f4a;color:#eef1fa;border-radius:8px;padding:9px 13px;font-family:ui-monospace,Consolas,monospace;
  font-size:11.5px;line-height:1.65;white-space:pre-wrap;margin:6px 0;break-inside:avoid}
table.plain td{text-align:left;border-bottom:1px solid #e5e0d2}
table.plain td:first-child{color:#0a1c5e;width:38%}
.src-list{color:#6b6555;font-size:11.5px;line-height:1.6;margin:6px 0}
.foot{margin-top:22px;font-size:10px;color:#6b6555;text-align:center}
`
