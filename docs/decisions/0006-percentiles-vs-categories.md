# ADR 0006 — Percentiles ACSM comme base, catégories dérivées

**Statut** : Accepté
**Date** : 2026-05-14

## Contexte

La v0.1.15 a introduit la catégorisation des résultats de tests via 4 seuils (`aAmeliorer / acceptable / bien / tresBien`) → 5 catégories (À améliorer / Acceptable / Bien / Très bien / Excellent).

Cette structure couvre l'usage de base — savoir si un client est « au-dessus » ou « en dessous » — mais elle ne dit pas **où exactement** dans la population. Marie-Eve voulait pouvoir dire à un client : « tu es dans le 88e percentile » ou « +35 % vs la moyenne ». C'est plus parlant qu'une étiquette.

En parallèle, les tables CPAFLA (à venir en v0.1.20) sont publiées sous forme de percentiles. Choisir une structure percentile dès maintenant évite une 2e migration.

## Options

### A. Garder les 4 seuils {aAmeliorer/acceptable/bien/tresBien} + ajouter un calcul de percentile par interpolation
Conservait la rétrocompatibilité. Mais le calcul de percentile fin (88, 92…) demande au moins une 5e ancre (P90) pour ne pas saturer à 100 % dès qu'on dépasse `tresBien`. Donc on revient à 5 valeurs dans tous les cas.

### B. Migrer vers 5 percentiles {P10, P25, P50, P75, P90} ← retenu
Structure plus riche, alignée sur les publications ACSM 11e éd. et CPAFLA. Dérive triviale vers les 5 catégories via les cutoffs P10/P25/P50/P75. Permet d'interpoler un percentile précis sur l'intervalle [0, 100].

### C. Stocker une distribution complète (quantile chaque 5 %)
Trop verbeux pour l'usage, et la précision additionnelle n'est pas utilisée par l'UI.

## Décision

**Option B**. Le type `NormRange` porte désormais `percentiles: { p10, p25, p50, p75, p90 }`. Les fonctions d'API publiques sont :

- `getCategorization(test, value, age, sex, norms)` → `Category | null` (inchangée — dérivée des percentiles via cutoffs P10/P25/P50/P75)
- `getPercentile(test, value, age, sex, norms)` → `number | null` (interpolation linéaire entre les 5 ancres)
- `getPopulationAverage(test, age, sex, norms)` → `number | null` (retourne P50)
- `getDeltaVsAverage(test, value, age, sex, norms)` → `{ deltaPct, isBetter } | null` (gère `lowerIsBetter` automatiquement)

Mapping des catégories aux cutoffs (cf. brief v0.1.18) :

| Cutoff | Catégorie |
|---|---|
| `< P10` | À améliorer |
| `P10 ≤ x < P25` | Acceptable |
| `P25 ≤ x < P50` | Bien |
| `P50 ≤ x < P75` | Très bien |
| `≥ P75` | Excellent |

Pour les tests `lowerIsBetter` (% gras, IMC, tour de taille), les valeurs sont rangées en ordre **décroissant** (p10 > p25 > p50 > p75 > p90) et la comparaison est inversée.

## Migration

Les tables existantes ont été migrées **mécaniquement** :
- `aAmeliorer` → `p10`
- `acceptable` → `p25`
- `bien` → `p50`
- `tresBien` → `p75`
- `p90` extrapolé : `2 × p75 - p50` (pour les tests à distribution ~normale)

Trois entrées ont été **recalibrées** sur les valeurs ACSM 11e éd. publiées pour matcher les attentes du brief (Nicholas Jean, 48 ans) :
- VO2max H 40-49 : `{p10: 23, p25: 30, p50: 35, p75: 43, p90: 50}` → un VO2max de 49 → 88e percentile, +40 % vs moyenne
- % gras M 40-49 : `{p10: 35, p25: 30, p50: 25, p75: 20, p90: 14}` (lowerIsBetter) → 30.2 → ~25e percentile, -21 % (moins bon)
- Push-ups M 40-49 : `{p10: 9, p25: 12, p50: 16, p75: 22, p90: 28}` → 28 push-ups → ~90e percentile

⚠️ **Conséquence sur les catégories** : pour Nicholas (H 48y, VO2max 49), la catégorie passe de TRES_BIEN (v0.1.15 thresholds) à EXCELLENT (v0.1.18 calibrated percentiles), parce que les valeurs publiées ACSM 11e éd. sont plus basses que les thresholds initiaux. C'est la calibration correcte.

Les autres tables conservent le mapping mécanique : la catégorisation reste **identique** à v0.1.15, par construction (les seuils numériques n'ont pas bougé, seuls leurs noms changent).

## CPAFLA — préparation v0.1.20

Le placeholder `src/lib/norms/cpafla.ts` retourne toujours `null`. Quand Marie-Eve confirmera les tables CPAFLA, il suffira de remplir les ranges avec la même structure `percentiles`. Aucune autre modification.

## Conséquences

- `BilanForm`, `AerobicSection` et `DashboardTab` affichent désormais le percentile + le delta vs moyenne sous chaque valeur catégorisée (via `<PercentileIndicator>`).
- La couche scoring (synthèse 0.5-4.5 + composites) continue de fonctionner — elle s'appuie sur la catégorie dérivée des percentiles, sans rien changer côté API.
- Pour Marie-Eve : un client peut maintenant voir « 88e percentile · +40 % vs moyenne H 40-49 » au lieu d'un simple « Très bien ». C'est plus motivant et plus éducatif.

## Si on revient en arrière

- Type `NormRange` retomberait sur `thresholds: {aAmeliorer/acceptable/bien/tresBien}`.
- `getPercentile`, `getPopulationAverage`, `getDeltaVsAverage` disparaîtraient.
- `<PercentileIndicator>` deviendrait inerte.
- La synthèse + catégorisation continueraient de fonctionner inchangées.

Marie-Eve a validé l'orientation lors d'un échange du 14 mai 2026 — feu vert pour la migration.
