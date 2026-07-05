# ADR 0016 — « Âge en forme » et trajectoire projetée dans le rapport

**Statut** : Accepté
**Date** : 2026-07-05

## Contexte

Après le module objectif chiffré (ADR 0015), deux ajouts au rapport pour le rendre plus parlant et motivant :
1. **Âge en forme** — traduire le VO2max en âge physiologique (« votre cardio = celui d'une personne de 38 ans »).
2. **Trajectoire projetée** — prolonger la courbe de poids jusqu'à la cible, à l'échéance calculée par le module objectif.

## Décision

### Âge en forme — `src/lib/fitness-age.ts`
`fitnessAge(vo2max, sex)` inverse une **courbe de référence VO2max→âge dédiée** (`MEDIAN_VO2MAX`, médianes de
population par sexe, décroissantes) par interpolation linéaire, bornée à [20, 80].

**Pourquoi une courbe dédiée et non les tables de catégorisation `norms/acsm.ts` ?** Certaines tranches ACSM y sont
recalibrées localement (ADR 0006 — p. ex. H 40-49 ajusté pour le cas Nicholas) et **ne sont pas monotones en âge** :
les inverser donnerait un âge physiologique incohérent (un VO2max moyen pourrait « rajeunir » en vieillissant). La courbe
dédiée est lissée, monotone, indicative, documentée comme telle. Basée sur le VO2max seul (meilleur prédicteur de la
condition cardiorespiratoire). Sans VO2max ou sexe → rien affiché.

Rendu : bannière en Vue d'ensemble (Section 1), avec l'écart à l'âge réel (« X ans de moins que votre âge réel »).

### Trajectoire projetée — `WeightProjectionChart` (ReportPage)
Graphique dans l'encadré « Votre objectif » : ligne **pleine** = poids réel (historique des bilans), ligne **pointillée**
= projection linéaire du poids actuel vers le **poids-cible** (calculé par `bodyFatGoal`), à l'échéance estimée
(`estimatedGoalDate`, basée sur le rythme). Affiché uniquement si le module objectif est actif, qu'une cible est
calculable et qu'il reste du poids à perdre. Poids affiché dans l'unité du client.

## Conséquences

- **+** Deux repères très lisibles ; la trajectoire boucle le module objectif (ADR 0015).
- **+** Purement additif et conditionnel — aucun impact quand VO2max/objectif absents.
- **−** L'âge en forme repose sur des médianes approximatives (non sourcées à une étude unique) — assumé, valeur
  indicative. À affiner si Marie-Eve dispose d'une référence préférée.
- **−** La projection est linéaire (rythme constant) et l'axe des X est catégoriel (l'écart temporel jusqu'à la cible
  n'est pas à l'échelle) — schéma volontairement simple.
