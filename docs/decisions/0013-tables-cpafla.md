# ADR 0013 — Tables CPAFLA : ossature livrée, données en attente de source

**Statut** : Accepté
**Date** : 2026-07-04

## Contexte

Le système de normes est pluggable depuis la v0.1.15 (ADR 0006) : `acsm` est encodé, `cpafla` était un placeholder retournant `null` partout. CPAFLA (Canadian Physical Activity, Fitness and Lifestyle Approach, publié par la SCPE/CSEP) est **le référentiel du logiciel que Kinésio Outils remplace** — l'objectif était d'encoder ces tables pour matcher les catégories que Marie-Eve voit aujourd'hui.

## Problème découvert

Les seuils numériques exacts des « zones de bénéfices santé » CPAFLA (Excellent / Très bien / Bien / Acceptable / À améliorer) vivent dans le **CSEP-PATH Toolkit**, un document **sous droits d'auteur**. Recherche menée le 2026-07-04 :

- Statistique Canada (Enquête canadienne sur les mesures de la santé, article 82-003-x 11064) **cite** le système de cotation et les tranches d'âge (20-29 … 60-69) mais **ne republie pas** les tables de seuils.
- Les sources fitness secondaires (topendsports, cartwright, ACSM PDF) référencent CPAFLA sans reproduire les valeurs par âge/sexe/catégorie.

**Reproduire ces seuils de mémoire serait dangereux** : c'est un outil de santé, une valeur inventée classerait un client « Excellent » ou « À améliorer » à tort. Décision de ne rien fabriquer.

## Options

### A. Inventer / approximer les valeurs — **rejeté**
Risque clinique inacceptable, aucune source citable pour l'ADR.

### B. Livrer l'ossature, encoder les valeurs plus tard ← retenu
Toute l'infrastructure est prête ; `getCpaflaRange` fonctionnera dès que `TABLES` sera rempli depuis la source officielle. Rien n'est inventé.

### C. Abandonner CPAFLA — rejeté
On perd le travail d'architecture et l'objectif « matcher le logiciel actuel » reste ouvert sans trace.

## Décision (option B)

### `src/lib/norms/cpafla.ts` — scaffold complet
- Structure identique à `acsm.ts` : helper `pct(p10,p25,p50,p75,p90)` exporté, `TABLES: Record<TestKey, Ranges | null>`, `getCpaflaRange(test, age, sex)` qui `.find(...)` (donc opérationnel dès remplissage). **Aucun changement du type `NormRange`.**
- Toutes les tables à `null` pour l'instant, chacune commentée avec le TestKey CPAFLA correspondant.
- **Convention de conversion** documentée dans le fichier (catégories CPAFLA → percentiles, alignée sur la migration ACSM de l'ADR 0006) :
  - borne basse « Acceptable » → `p10`, « Bien » → `p25`, « Très bien » → `p50`, « Excellent » → `p75`
  - `p90 = 2·p75 − p50`
  - tests `lowerIsBetter` (somme des plis, % gras) → valeurs en ordre décroissant.
- Helper `cpaflaHasTables()` : vrai dès qu'une table est réellement encodée. Pilote le messaging Paramètres (pas de "codage en dur" du statut).

### TestKeys prévus (à encoder)
`pushups`, `situps`, `trunkFlexion`, `legPower` (CPAFLA en publie, contrairement à ACSM), `verticalJump`, `backEndurance` si disponible.
- `bodyFat` : CPAFLA cote la **somme des 5 plis (mm)**, pas le % de gras — notre modèle ne stocke que le %. Laissé `null` (comparaison % ↔ somme de plis serait fausse). À trancher avec Marie-Eve.
- `vo2max` : CPAFLA repose sur le mCAFT (prédictif) ; sans table fiable → `null`, ACSM reste la référence aérobie.

### Correction de bug — le rapport PDF n'était plus figé sur ACSM
`ReportPage.tsx` forçait `norms: 'acsm'` en dur : activer CPAFLA dans les Paramètres n'aurait **pas** changé le rapport. Il lit désormais `settingsService.getCategorizationNorms()` (repli `'acsm'` en cas d'erreur). Le dashboard lisait déjà la norme active ; le rapport est maintenant cohérent avec le réglage.
- `deriveBilanFields` (calcul + stockage des scores composites au save) reste volontairement sur `'acsm'` : les valeurs dérivées **stockées** ne doivent pas dépendre de la norme active au moment du save (stabilité). Seul l'**affichage** (dashboard, rapport) suit la norme active.

### Paramètres
Le radio CPAFLA reste sélectionnable ; le libellé passe à « CPAFLA (tables en attente) » et le message explique honnêtement que les barèmes ne sont pas encore encodés (tests non couverts → « — »), tant que `cpaflaHasTables()` est faux.

## Conséquences

- Sélectionner CPAFLA aujourd'hui affiche « — » partout (aucune table). C'est **assumé et signalé** — pas une régression silencieuse.
- Le jour où la source arrive : remplir `TABLES` dans `cpafla.ts`, ajouter les tests de valeurs dans `norms.test.ts`, et tout le reste (dashboard, PDF, percentiles, objectifs) fonctionne sans autre changement.

## Prochaine étape — obtenir la source

Fournir l'un de :
- le manuel **CPAFLA 3e éd.** / le **CSEP-PATH Toolkit** (tables par âge/sexe),
- ou des **captures des barèmes du logiciel actuel** de Marie-Eve (ce qui garantit le match exact voulu).

Puis valider les catégories obtenues contre quelques cas réels connus.
