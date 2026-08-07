import {
  VALIDATION,
  VALIDATION_STATUS_LABELS,
  aValider,
  compteParStatut
} from '../lib/norms/validation-status'
import { useEffect } from 'react'
import { ACSM_TABLES } from '../lib/norms/acsm'
import { CPAFLA_TABLES } from '../lib/norms/cpafla'
import { categoryCells, normSourceForTest } from '../lib/norms/bareme'
import { getClinicalRange } from '../lib/norms/clinical'
import type { NormPercentiles, NormRange, TestKey } from '../lib/norms/types'
import { bodyFatRiskZones, type BfRiskZone } from '../lib/body-fat-risk'

/** Document de référence des barèmes & formules — rendu pour export PDF via la
 *  fenêtre cachée (report-generator `generateBaremesPdf`). Les tables de
 *  catégorisation sont lues depuis le code (CPAFLA d'abord, repli ACSM) — cette
 *  feuille documente donc les barèmes **réellement** utilisés pour coter, avec la
 *  source résolue par test plutôt qu'écrite à la main (elle avait dérivé : elle
 *  annonçait ACSM pour des tests cotés en CPAFLA depuis v0.9.31). */


/** Bornes des 5 catégories — rendu partagé avec le dashboard et le rapport PDF
 *  (`src/lib/norms/bareme.ts`). L'ancienne version locale produisait des plages
 *  qui se chevauchaient (`18–24` puis `24–29`) alors que 24 est « Bien ». */
function catRanges(p: NormPercentiles, lower: boolean): string[] {
  const c = categoryCells(p, lower)
  return [c.A_AMELIORER, c.ACCEPTABLE, c.BIEN, c.TRES_BIEN, c.EXCELLENT]
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
  // Même résolution que `getRange` : CPAFLA en premier, ACSM en repli.
  const cpafla = CPAFLA_TABLES[meta.test] as NormRange[] | null
  const ranges = (cpafla && cpafla.length > 0 ? cpafla : (ACSM_TABLES[meta.test] as NormRange[] | null))
  if (!ranges) return null
  const source = cpafla && cpafla.length > 0 ? normSourceForTest(meta.test).full : meta.source
  const rows = meta.mergeSexes ? ranges.filter(r => r.sex === 'M') : ranges
  return (
    <div className="baro">
      <div className="baro-t">
        <h3>{meta.label}</h3>
        <span className="u">{meta.unit}</span>
        {meta.hors && !(cpafla && cpafla.length > 0) && <span className="badge low">hors ACSM</span>}
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
      <p className="src">Source : {source}.</p>
    </div>
  )
}

// `source` n'est qu'un repli : `Baro` déduit la provenance de la table retenue.
const CARDIO: Meta[] = [
  { test: 'vo2max', label: 'VO2max', unit: 'ml/kg/min', source: 'CPAFLA / ÉCPHV — Guide du conseiller, 3ᵉ éd., tableau 4.10' }
]
const COMPO: Meta[] = [
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

/** Pastille d'état à poser à côté d'un barème ou d'une formule. */
function Etat({ id }: { id: string }) {
  const e = VALIDATION.find(v => v.id === id)
  if (!e) return null
  const cls = e.statut === 'confirme' ? 'ok' : e.statut === 'a_confirmer' ? 'warn' : 'bad'
  return (
    <span className={`etat ${cls}`}>
      {e.statut === 'confirme' ? '☑' : '☐'} {VALIDATION_STATUS_LABELS[e.statut]}
    </span>
  )
}

/**
 * Checklist de validation, en tête du document.
 *
 * Deux colonnes de cases : celle de gauche est l'état connu de l'application,
 * celle de droite reste **vide** — c'est celle que Marie coche au crayon pendant
 * la revue. Sans case vierge, le document se lit mais ne se remplit pas.
 */
function ChecklistValidation() {
  const ouverts = aValider()
  const n = compteParStatut()
  return (
    <div className="chk">
      <div className="chk-h">
        <h2>Ce qui reste à valider avec Marie</h2>
        <span className="chk-n">
          {n.confirme} confirmé{n.confirme > 1 ? 's' : ''} · {n.a_confirmer} à confirmer · {n.deduit} déduit
          {n.deduit > 1 ? 's' : ''}
        </span>
      </div>
      <p className="chk-lead">
        Les points ci-dessous reposent sur une déduction ou une source jamais recontrôlée. Ceux marqués
        <b> « entre dans le score »</b> peuvent fausser une note remise à un client ; les autres ne touchent qu'un
        libellé. Cochez la colonne de droite au fur et à mesure.
      </p>
      <table className="chk-t">
        <thead>
          <tr>
            <th>Vu&nbsp;?</th>
            <th>Point</th>
            <th>Ce qu'il faut</th>
            <th>Portée</th>
          </tr>
        </thead>
        <tbody>
          {ouverts.map(e => (
            <tr key={e.id}>
              <td className="box">☐</td>
              <td>
                <b>{e.label}</b>
                <span className="chk-src">{e.source}</span>
              </td>
              <td>{e.manque}</td>
              <td className={e.entreDansLeScore ? 'port bad' : 'port'}>
                {e.entreDansLeScore ? 'Entre dans le score' : 'Affichage'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
        source et leur état de validation. Les tableaux sont générés à partir des mêmes données que le logiciel.</p>

      <ChecklistValidation />

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
      <p className="src">Tables ACSM <Etat id="vo2max-acsm" /> · Tests hors ACSM <Etat id="hors-acsm" /></p>
      {CARDIO.map(m => <Baro key={m.test} meta={m} />)}

      <h2>3 · Composition corporelle</h2>
      <p className="src">Tables CPAFLA <Etat id="composition-cpafla" /> · Grille du % de gras <Etat id="pourcentage-gras-grille" /></p>
      {COMPO.map(m => <Baro key={m.test} meta={m} />)}
      <BodyFatRiskTable />

      <h2>4 · Force &amp; souplesse</h2>
      {FORCE.map(m => <Baro key={m.test} meta={m} />)}

      <h2>5 · Seuils cliniques</h2>
      <p className="src">Systolique <Etat id="pa-systolique-cote" /> · Diastolique <Etat id="pa-diastolique-seuils" /></p>
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

      <h2>6 · Risque cardio-métabolique</h2>
      <p className="src">Risque IMC + tour de taille (tableau 4.4) <Etat id="risque-sante-4-4" /> · Tour de taille jugé
        seul <Etat id="tour-taille-autonome" /> — Statistique Canada, variable dérivée <b>HWMDWSTA</b> ; cotes 4 / 3 / 1
        (la cote 2 n'existe pas dans ce test) et borne haute incluse. Le ratio taille/hanche reste sur les seuils OMS.</p>
      <div className="baro">
        <table>
          <thead><tr><th>Mesure</th><th className="c5">Faible</th><th className="c2">Élevé</th><th className="c1">Très élevé</th></tr></thead>
          <tbody>
            <tr><td>Tour de taille — Homme</td><td className="c5">&lt;94 cm</td><td className="c2">94–101</td><td className="c1">&gt;101</td></tr>
            <tr><td>Tour de taille — Femme</td><td className="c5">&lt;80 cm</td><td className="c2">80–87</td><td className="c1">&gt;87</td></tr>
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
% gras = (4,95 / D − 4,50) × 100   (conversion Siri)</pre>
      <h3>Fréquence cardiaque</h3>
      <pre className="f">FC max = 208 − 0,7 × âge   (Tanaka 2001)
Zones = FC max × 60 % … 90 % (par pas de 5 %)</pre>
      <h3>Puissance des jambes</h3>
      <pre className="f">Puissance (W) = 60,7·saut(cm) + 45,3·poids(kg) − 2055   (Sayers 1999)</pre>

      <h2>8 · Score « Santé et condition physique globale » (0 à 4)</h2>
      <p>Formule de l'ancien logiciel, relevée dans sa fenêtre Propriétés — identique pour les hommes et les femmes.
        Chaque composante est ramenée à sa <b>cote entière 0-4</b>, puis toutes comptent également. Une composante
        non mesurée est <b>exclue</b>, pas comptée 0. <Etat id="score-global-formule" /></p>
      <pre className="f">AverageRatings([Questionnaire combiné]×1, [Composition corporelle]×1,
  [Pression artérielle systolique]×1, [METS max]×1, [Indice de santé du dos]×1,
  [Aptitudes musculosquelettiques]×1, [166]×1)

Sept composantes — cinq sont calculées :</pre>
      <table className="plain">
        <tbody>
          <tr><td>Composition corporelle</td><td>Cote issue des tables CPAFLA (fig. 7-4 / 7-5) <Etat id="composition-cpafla" /></td></tr>
          <tr><td>Aptitude aérobie (METS max)</td><td>VO2max ÷ 3,5, coté par le tableau 4.10 <Etat id="aerobie-cpafla" /></td></tr>
          <tr><td>Pression artérielle systolique</td><td>Moins de 120 mmHg → 4, sinon 0 <Etat id="pa-systolique-cote" /></td></tr>
          <tr><td>Indice de santé du dos</td><td>Tables CPAFLA <Etat id="dos-musculo" /></td></tr>
          <tr><td>Aptitude musculosquelettique</td><td>Tables CPAFLA</td></tr>
          <tr><td><i>Questionnaire combiné</i></td><td><i>Exclu — Marie ne le remplit pas à chaque fois</i> <Etat id="questionnaire-dans-score" /></td></tr>
          <tr><td><i>Test [166]</i></td><td><i>Exclu — Marie ne l'utilise pas</i></td></tr>
        </tbody>
      </table>
      <p className="src">Exemple de lecture : cotes 0 · 1 · 0 · 2 · 2 → somme 5 sur un maximum de 20 →
        5 ÷ 20 × 4 = <b>1</b>.</p>

      <h2>8 bis · Questionnaires</h2>
      <table className="plain">
        <tbody>
          <tr><td>FANTASTIC</td><td>25 énoncés, cotes 0-4 de gauche à droite, total ramené sur 100 au prorata des
            énoncés répondus <Etat id="fantastic" /></td></tr>
          <tr><td>ÉAS</td><td>3 questions, cotation <b>dépendante du sexe</b>, maximum 11 dans les deux colonnes
            <Etat id="eas" /></td></tr>
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
masse maigre = poids × (1 − %gras/100)   ·   poids-cible = maigre / (1 − %cible/100)</pre>
      <table className="plain">
        <tbody>
          <tr><td>Protéines</td><td>1 à 1,4 g par kg de <b>poids corporel</b>, jusqu'à 1,6 chez les plus actifs
            (défaut 1,4) <Etat id="proteines-par-kg" /></td></tr>
          <tr><td>Lipides</td><td>Plafond en grammes, <b>ou</b> part des calories — 30 à 40 % visés
            <Etat id="lipides-30-40" /></td></tr>
          <tr><td>Glucides <b>nets</b></td><td>Le reste des calories cibles. Nets = glucides de l'aliment moins ses
            fibres, calculé <b>par aliment</b> <Etat id="glucides-nets" /></td></tr>
          <tr><td>Fibres</td><td>14 g par 1000 kcal — cible <b>indépendante</b>, elle ne s'ajoute pas aux glucides nets
            <Etat id="fibres-14g" /></td></tr>
        </tbody>
      </table>
      <p className="src">Les fibres sont comptées à 0 kcal : l'énergie vaut protéines×4 + glucides nets×4 + lipides×9.</p>

      <h2>9 bis · Repères du Guide alimentaire canadien</h2>
      <p>Huit recommandations affichées dans le document nutrition, en deux volets — quatre sur les aliments, quatre sur
        la manière de manger. Texte officiel repris mot pour mot. <Etat id="guide-alimentaire" /></p>

      <h2>10 · Sources</h2>
      <ul className="src-list">
        <li>ACSM's Guidelines for Exercise Testing and Prescription, 11ᵉ éd. (2021).</li>
        <li><b>Capacité aérobie</b> — Guide du conseiller en condition physique et habitudes de vie, 3ᵉ éd.,
          <b>tableau 4.10</b> « VO2max estimé — évaluation des avantages pour la santé ». Groupes d’âge de 15 à 69 ans,
          cotation distincte par sexe.</li>
        <li>Durnin &amp; Womersley (1974), avec conversion densité → % de gras de Siri (1961) — plis cutanés.</li>
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
/* Pastilles d'état — posées à côté d'un barème ou d'une formule. */
.etat{font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:20px;white-space:nowrap;margin-left:6px}
.etat.ok{background:#e6f0dd;color:#2c7a2c}
.etat.warn{background:#fbe7d6;color:#a5641f}
.etat.bad{background:#fbe4e0;color:#a3352a}
/* Checklist de validation — reste d'un seul tenant à l'impression, sinon la
   colonne à cocher se retrouve séparée de ce qu'elle coche. */
.chk{border:1.5px solid #b8834a;border-radius:8px;padding:10px 13px;margin:14px 0 4px;background:#fdfaf4;break-inside:avoid}
.chk-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.chk-h h2{margin:0;border:0;padding:0;font-size:15px}
.chk-n{font-size:10px;color:#6b6555;font-weight:600}
.chk-lead{font-size:11px;color:#6b6555;margin:4px 0 8px}
.chk-t{font-size:11px}
.chk-t th{background:#f6efe1}
.chk-t td{text-align:left;vertical-align:top;padding:5px 7px}
.chk-t td.box{text-align:center;font-size:15px;width:34px;color:#0a1c5e}
.chk-t td:first-child{width:34px}
.chk-src{display:block;color:#6b6555;font-weight:400;font-size:10px;margin-top:2px}
.port{font-size:10px;color:#6b6555;width:78px}
.port.bad{color:#a3352a;font-weight:700}
.foot{margin-top:22px;font-size:10px;color:#6b6555;text-align:center}
`
