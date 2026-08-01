/**
 * Récapitulatif « au repos / après l'effort » — pression artérielle et
 * fréquence cardiaque.
 *
 * ── Pourquoi un composant partagé ───────────────────────────────────────────
 * Ce bloc a d'abord été écrit directement dans le document client
 * (`EditorialReport`), et le dashboard ne l'a donc jamais eu — Nicholas
 * regardait le dashboard et ne voyait rien changer. Les deux écrans portent une
 * section « Aptitude aérobie » avec des titres différents ; j'ai supposé le
 * mauvais. Un composant unique rend l'erreur impossible à refaire.
 *
 * ── Pourquoi deux colonnes ──────────────────────────────────────────────────
 * C'est l'écart entre repos et effort qui parle, pas les quatre valeurs prises
 * séparément. Alignées, elles montrent d'un coup d'œil de combien le cœur est
 * monté et s'il redescend.
 *
 * Le libellé dit « après l'effort » et non « récup » : ce bloc apparaît aussi
 * dans le document remis au client.
 */
export function RestVsRecovery({
  paSys,
  paDia,
  fcRepos,
  paRecupSys,
  paRecupDia,
  fcRecup,
  className = ''
}: {
  paSys: number | null
  paDia: number | null
  fcRepos: number | null
  paRecupSys: number | null
  paRecupDia: number | null
  fcRecup: number | null
  className?: string
}): React.JSX.Element | null {
  // Sans aucune valeur de récupération il n'y a pas de comparaison à faire, et
  // la colonne « au repos » seule ferait doublon avec les barres au-dessus.
  if (paRecupSys === null && paRecupDia === null && fcRecup === null) return null

  const ligneP = paSys !== null || paDia !== null || paRecupSys !== null || paRecupDia !== null
  const ligneF = fcRepos !== null || fcRecup !== null

  const pa = (s: number | null, d: number | null) =>
    s === null && d === null ? '—' : `${s ?? '—'} / ${d ?? '—'}`

  return (
    <div className={className}>
      <table className="w-full">
        <thead>
          <tr className="text-marine/40">
            <th className="text-left font-normal text-xs pb-2"></th>
            <th className="text-right font-medium text-xs pb-2">Au repos</th>
            <th className="text-right font-medium text-xs pb-2">Après l’effort</th>
          </tr>
        </thead>
        <tbody className="text-marine">
          {ligneP && (
            <tr className="border-t border-cream-dark/40">
              <td className="py-2 text-marine/60 text-sm">Pression artérielle</td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {pa(paSys, paDia)}
                <span className="text-marine/40 font-normal text-xs"> mmHg</span>
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {pa(paRecupSys, paRecupDia)}
                {(paRecupSys !== null || paRecupDia !== null) && (
                  <span className="text-marine/40 font-normal text-xs"> mmHg</span>
                )}
              </td>
            </tr>
          )}
          {ligneF && (
            <tr className="border-t border-cream-dark/40">
              <td className="py-2 text-marine/60 text-sm">Fréquence cardiaque</td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {fcRepos ?? '—'}
                {fcRepos !== null && <span className="text-marine/40 font-normal text-xs"> bpm</span>}
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {fcRecup ?? '—'}
                {fcRecup !== null && <span className="text-marine/40 font-normal text-xs"> bpm</span>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {/* Précision indispensable : le repère « après l'effort » se pose sur des
          zones qui classent la PA AU REPOS. Sans cette phrase, un client dont la
          systolique monte normalement à 136 verrait son point dans l'orange et
          se croirait hypertendu. */}
      <p className="text-marine/45 text-xs mt-3 leading-snug">
        Les zones colorées classent la pression <strong className="font-medium">au repos</strong>. Après un
        effort, il est normal qu’elle soit plus élevée : ce qui compte alors, c’est le retour vers les
        valeurs de repos — plus il est rapide, mieux le cœur récupère.
      </p>
    </div>
  )
}
