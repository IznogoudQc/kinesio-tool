# ADR 0018 — Conseils IA : analyse « forces & à travailler » du bilan complet

**Statut** : Accepté
**Date** : 2026-07-05

## Contexte

Le « Mode conseils IA » (ADR 0007/0008) demandait à Marie-Eve de **cocher manuellement** des métriques, puis générait un
« programme intégré ». Friction : il faut savoir *quoi* cocher, et l'IA est justement meilleure qu'une checklist pour lire
le bilan dans son ensemble. Demande : que l'IA **identifie elle-même les forces et faiblesses** du bilan.

## Décision

Remplacement de la sélection manuelle par une **analyse en un clic du bilan complet**.

- **Collecte automatique** : `src/lib/ai-metrics.ts` → `gatherBilanMetrics(data, age, sex, norms)` rassemble toutes les
  métriques présentes avec catégorie ACSM/OMS + percentile. Toujours **anonyme** (aucun nom/courriel/note — ADR 0007).
- **Nouvelle sortie** (`electron/ipc/ai.ts`, schéma + prompt) : `{ synthese, forces: [{titre, explication}],
  aTravailler: [{titre, explication, piste}], warnings }`. Les « pistes » sont des recommandations d'**activité physique**
  (champ du kinésiologue) ; pour la nutrition détaillée, le prompt référe à un(e) nutritionniste.
- **UI** (`AIAdvicePanel.tsx` → `AIAnalysisPanel`) : un bouton « Analyser avec l'IA » à côté du bloc « Forces & à
  travailler » du Dashboard → aperçu anonyme → génération → forces (vert) / à travailler + pistes (ambre) / avertissements.
- **Retiré** : le toggle « Mode conseils IA », le bandeau, le FAB de comptage et la sélection multi-métriques dans
  `DashboardLayout`.

## Conséquences

- **+** Un clic au lieu d'une sélection ; l'IA a une vue d'ensemble → forces/faiblesses plus pertinentes ; enrichit le bloc
  règles existant (`StrengthsAndWeaknesses`) d'une lecture expliquée + pistes.
- **+** Anonymisation préservée.
- **−** Code désormais mort : `AIAdviceContext` (provider/mode/selection) et `MetricSelectable` ne servent plus qu'à porter
  le type `MetricSelection` et à un rendu passthrough. À nettoyer dans un lot séparé (tâche de fond) pour éviter de toucher
  de nombreux composants de cartes dans ce changement.
- **−** Le programme intégré détaillé (cardio/muscu/souplesse/habitudes) est abandonné au profit de forces/faiblesses/pistes
  (choix produit — cf. la question à Nicholas).
