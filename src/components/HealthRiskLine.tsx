import { useState } from 'react'
import { TableProperties } from 'lucide-react'
import {
  bmiRiskBar,
  healthRisk,
  healthRiskBareme,
  healthRiskExplanation,
  healthRiskFacts,
  muscularCaveat,
  waistRiskBar,
  HEALTH_RISK_HEX,
  HEALTH_RISK_LABELS,
  HEALTH_RISK_SHORT,
  HEALTH_RISK_SOURCE,
  type HealthRiskResult,
  type RiskBar
} from '../lib/norms/health-risk'
import { ReportEye } from './ReportEye'

/**
 * Risque pour la santé associé à l'IMC **et au tour de taille** (tableau 4.4 du
 * Guide du conseiller, 3ᵉ éd.). Partagée : Dashboard + document HTML.
 *
 * Ce n'est pas une cote de condition physique et ça n'entre dans aucun score :
 * l'IMC et le tour de taille alimentent déjà la composition corporelle et
 * l'indice de santé du dos par les tables CPAFLA. C'est une lecture santé, au
 * même titre que la grille de % de gras.
 *
 * ── Deux axes, un verdict ───────────────────────────────────────────────────
 * Même langage visuel que la pression artérielle : une barre continue par
 * mesure, le repère du client dessus, les seuils chiffrés dessous. C'est le seul
 * moyen de montrer *pourquoi* : l'IMC place le client dans une ligne du tableau,
 * le tour de taille décide si le risque monte. La barre du tour de taille est
 * donc coloriée en deux temps — le risque de l'IMC seul à gauche du seuil, le
 * risque combiné à droite.
 *
 * Le verdict, lui, reste **toujours** le risque combiné. Afficher la colonne IMC
 * seule sous-estimerait le risque d'une personne d'IMC normal au tour de taille
 * élevé, précisément le cas que ce tableau existe pour attraper.
 */
export function HealthRiskLine({
  imc,
  waist,
  sex,
  className = ''
}: {
  imc: number | null | undefined
  waist: number | null | undefined
  sex: 'F' | 'M' | null
  className?: string
}): React.JSX.Element | null {
  const [showBareme, setShowBareme] = useState(false)
  const r = healthRisk({ imc, waist, sex })
  if (!r) return null

  const faits = healthRiskFacts({ imc, waist, sex }, r)
  const nuance = muscularCaveat(r)
  const barreImc = bmiRiskBar(imc)
  const barreTaille = waistRiskBar(waist, r)

  return (
    <div className={`bg-white border border-cream-dark/30 rounded-xl p-5 shadow-sm ${className}`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <p className="text-marine/40 text-xs font-semibold uppercase tracking-wider">Risque pour la santé</p>
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg leading-none" style={{ color: HEALTH_RISK_HEX[r.risk] }}>
            {HEALTH_RISK_LABELS[r.risk]}
          </span>
          <button
            type="button"
            onClick={() => setShowBareme(b => !b)}
            aria-pressed={showBareme}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              showBareme
                ? 'bg-gold/15 text-gold-dark hover:bg-gold/25'
                : 'bg-cream/70 text-marine/70 hover:bg-cream-dark hover:text-marine'
            }`}
            title="Afficher le tableau 4.4 complet"
          >
            <TableProperties size={13} />
            Barème
          </button>
          <ReportEye section="risqueSante" />
        </div>
      </div>

      <div className="space-y-5">
        <RiskAxis
          titre="Indice de masse corporelle"
          valeur={faits.imc}
          unite=""
          bar={barreImc}
          etat={`plage ${faits.imcBand}`}
        />
        {barreTaille ? (
          <RiskAxis
            titre="Tour de taille"
            valeur={faits.waist ? faits.waist.replace(' cm', '') : null}
            unite="cm"
            bar={barreTaille}
            etat={
              faits.waist === null
                ? 'non mesuré'
                : r.waistRaised
                  ? `au-dessus du seuil de ${faits.waistThreshold}`
                  : `sous le seuil de ${faits.waistThreshold}`
            }
          />
        ) : (
          // Pas de seuil applicable : on dit pourquoi plutôt que de laisser un
          // vide qu'on prendrait pour un oubli.
          <p className="text-marine/45 text-xs">
            {sex === null
              ? 'Tour de taille : les seuils diffèrent entre hommes et femmes — renseignez le sexe à la fiche du client.'
              : 'Le tableau n’évalue pas le tour de taille sous un IMC de 18,5.'}
          </p>
        )}
      </div>

      <p className="text-marine/55 text-xs mt-4 leading-relaxed">{healthRiskExplanation(r)}</p>

      {/* Nuance du guide pour un client musclé à IMC de surpoids mais tour de
          taille sous la limite. Détachée : c'est une réserve sur la lecture du
          risque, pas un complément de calcul. */}
      {nuance && (
        <p className="text-amber-800/90 text-xs mt-3 pl-2.5 border-l-2 border-amber-300 leading-snug">{nuance}</p>
      )}

      {showBareme && <BaremeTable sex={sex} r={r} />}

      <p className="text-marine/30 text-[10px] mt-3">{HEALTH_RISK_SOURCE}.</p>
    </div>
  )
}

/**
 * Une mesure sur son axe : nom des zones, repère du client, barre, seuils.
 *
 * Décalque de `BloodPressureBar` — même disposition, mêmes proportions. Deux
 * échelles de santé présentées différemment obligeraient le lecteur à réapprendre
 * à lire à chaque bloc.
 */
function RiskAxis({
  titre,
  valeur,
  unite,
  bar,
  etat
}: {
  titre: string
  valeur: string | null
  unite: string
  bar: RiskBar
  etat: string
}) {
  const span = bar.scaleMax - bar.scaleMin
  const largeur = (z: RiskBar['zones'][number]) => ((z.max - z.min) / span) * 100
  const marqueur = bar.markerRatio === null ? null : bar.markerRatio * 100

  return (
    <div>
      <p className="text-sm text-marine/60">
        {titre}
        <span className="text-marine/35"> · {etat}</span>
      </p>

      <div className="mt-2">
        {/* Nom des zones, au-dessus de la barre. */}
        <div className="flex">
          {bar.zones.map((z, i) => (
            <span
              key={i}
              className="px-0.5 text-center text-[8.5px] uppercase leading-tight tracking-wide text-marine/40 truncate"
              style={{ width: `${largeur(z)}%` }}
              title={HEALTH_RISK_LABELS[z.risk]}
            >
              {HEALTH_RISK_SHORT[z.risk]}
            </span>
          ))}
        </div>

        {/* Repère + valeur du client. */}
        <div className="relative mt-1.5 h-5">
          {marqueur !== null && valeur !== null && (
            <div
              className="absolute -translate-x-1/2 whitespace-nowrap text-center"
              style={{ left: `${Math.max(7, Math.min(93, marqueur))}%` }}
            >
              <span className="text-xs font-bold tabular-nums text-marine">
                {valeur}
                {unite && ` ${unite}`}
              </span>
            </div>
          )}
        </div>

        {/* Barre segmentée. */}
        <div className="relative h-3 w-full overflow-hidden rounded-full">
          <div className="flex h-full w-full">
            {bar.zones.map((z, i) => (
              <div key={i} style={{ width: `${largeur(z)}%`, background: z.hex }} />
            ))}
          </div>
          {marqueur !== null && (
            <div
              className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-marine"
              style={{ left: `${marqueur}%`, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9)' }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Seuils chiffrés sous la barre. */}
        <div className="relative mt-1 h-4">
          {bar.bounds.map(b => (
            <span
              key={b}
              className="absolute -translate-x-1/2 text-[10px] tabular-nums text-marine/40"
              style={{ left: `${((b - bar.scaleMin) / span) * 100}%` }}
            >
              {String(b).replace('.', ',')}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Tableau 4.4 en entier, ligne du client surlignée. */
function BaremeTable({ sex, r }: { sex: 'F' | 'M' | null; r: HealthRiskResult }) {
  const rows = healthRiskBareme(sex, r)
  return (
    <div className="mt-4 pt-4 border-t border-cream-dark/40">
      <p className="text-marine/70 text-xs font-medium mb-2">
        Tableau 4.4 — {sex === 'F' ? 'femmes' : sex === 'M' ? 'hommes' : 'seuils selon le sexe'}
        <span className="text-marine/40 font-normal"> · la ligne surlignée est celle du client</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-marine/45 text-left">
              <th className="font-medium py-1.5 pr-3">IMC</th>
              <th className="font-medium py-1.5 pr-3">Risque IMC</th>
              <th className="font-medium py-1.5 pr-3 whitespace-nowrap">Tour de taille</th>
              <th className="font-medium py-1.5">Risque combiné</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.imcLabel}
                className={row.active ? 'bg-gold/10 font-semibold text-marine' : 'text-marine/70'}
              >
                <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{row.imcLabel}</td>
                <td className="py-1.5 pr-3" style={{ color: HEALTH_RISK_HEX[row.risk] }}>
                  {row.riskLabel}
                </td>
                <td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">
                  {row.waist !== null ? `≥ ${row.waist} cm` : '—'}
                </td>
                <td
                  className="py-1.5"
                  style={{ color: row.combined ? HEALTH_RISK_HEX[row.combined] : undefined }}
                >
                  {row.combinedLabel ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
