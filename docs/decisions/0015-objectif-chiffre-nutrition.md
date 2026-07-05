# ADR 0015 — Objectif chiffré & module nutrition (opt-in par client)

**Statut** : Accepté
**Date** : 2026-07-05

## Contexte

Le rapport gagnait en v0.1.60 un champ « Objectif du client » (texte libre, par bilan). Nicholas veut aller plus loin :
un **objectif chiffré** — le client vise un **% de gras cible** (ex. 15 %), et l'app calcule **combien de livres perdre**
pour l'atteindre, avec en option des **macros alimentaires**. Le tout doit être **activable par client** depuis son dossier.

## Enjeu de champ de pratique (important)

Au Québec, la kinésiologie n'est **pas** un ordre à titre réservé, et la **planification nutritionnelle relève des
nutritionnistes/diététistes (OPDQ)**. La FKQ recommande de référer pour la nutrition. Donner des macros personnalisées sur
un rapport signé par Marie-Eve peut l'exposer. Décision produit (validée avec Nicholas) : **inclure les macros mais avec un
avertissement clair** (« Estimation générale à titre indicatif — consultez un(e) nutritionniste/diététiste »), et rendre
tout le module **désactivé par défaut** (opt-in explicite par client).

Le calcul « livres à perdre » (masse maigre préservée) est de l'arithmétique de composition corporelle, pas une
prescription — il reste affiché sans réserve particulière.

## Décision

### Portée : par client (pas par bilan)
La cible et l'activité sont des paramètres stables du client → 3 colonnes sur la table `clients` (migration `0008`) :
- `nutrition_enabled` (booléen, défaut `false`) — opt-in.
- `nutrition_target_body_fat` (réel, nullable) — % de gras visé (3–60).
- `nutrition_activity_level` (texte nullable) — `sedentaire | leger | modere | actif | tres_actif`.

Le **calcul** utilise les mesures du **bilan le plus récent** (poids, % de gras Durnin, taille, âge, sexe).

### Moteur pur `src/lib/nutrition.ts` (+ tests)
- `bodyFatGoal(poidsKg, %grasActuel, %cible)` → `{ goalKg, toLoseKg, leanKg }`, masse maigre constante :
  `maigre = poids × (1 − %gras/100)` ; `poids-cible = maigre / (1 − %cible/100)`.
- `mifflinBmr({...})` → BMR Mifflin-St Jeor.
- `estimateMacros({...})` → `{ bmr, tdee, targetKcal, proteinG, carbsG, fatG }`. TDEE = BMR × facteur d'activité ;
  déficit modéré −20 % (jamais sous le BMR) ; protéines 2,0 g/kg du poids-cible ; lipides 25 % des kcal ; glucides = reste.
  **Indicatif** — toujours accompagné de l'avertissement.

### UI — dossier client (`EditClientModal`)
Section « Objectif chiffré & nutrition » : case d'activation + (si activé) champ « % de gras visé » et menu « Niveau
d'activité ». Validation front (% entre 3 et 60) + zod IPC (`min(3).max(60)`).

### Rapport (`ObjectifBlock` en tête de la Vue d'ensemble)
- Toujours : le texte libre `objectif` s'il existe (v0.1.60).
- Si module activé + % de gras + poids disponibles : bloc chiffré « actuel → cible », livres à perdre, poids visé
  (dans l'unité du client). Si déjà à la cible → message de maintien.
- Si niveau d'activité fourni : 4 repères (calories, protéines, glucides, lipides) + **avertissement**.
- Entièrement masqué si le module est désactivé (aucun impact sur les rapports existants).

## Conséquences

- **+** Objectif motivant et concret ; le rapport relie mesures et intention du client.
- **+** Rétro-compatible : colonnes à défaut/nullable, module off par défaut, rendu conditionnel.
- **−** Le calcul dépend d'un % de gras fiable (plis cutanés) ; sans lui, le bloc chiffré ne s'affiche pas.

## Mise à jour v0.1.62 — rythme de perte paramétrable

Ajout d'une 4ᵉ colonne `nutrition_rate_kg_per_week` (migration `0009`) + sélecteur dans le dossier (Lent/Modéré/Soutenu/
Rapide, défaut Modéré 0,5 kg/sem). Le rythme pilote **deux** sorties d'un même réglage :
- **échéance estimée** dans le rapport (`weeksToGoal`, date = bilan + semaines) ;
- **déficit calorique des macros** (`dailyDeficitForRate` = rythme × 7700 ÷ 7), remplaçant le −20 % fixe quand un rythme
  est défini. `estimateMacros` accepte désormais `dailyDeficitKcal` (défaut −20 % si absent → rétro-compatible).

## Mise à jour v0.1.66 — formule des macros visible et modifiable

À la demande de Marie : la **formule des macros** est affichée et **modifiable par client** (dossier → Modifier), au lieu
d'être figée. Nouvelle formule (paramètres modifiables) :
- **protéines** = `nutritionProteinPerLbLean` g par **livre de masse maigre** (défaut 1) — remplace l'ancien 2 g/kg de
  poids-cible ;
- **lipides** = plafond `nutritionFatMaxG` g (défaut 60) — remplace l'ancien 25 % des kcal ;
- **glucides** = le reste des calories cibles (inchangé dans le principe).

Colonnes `nutrition_protein_per_lb_lean` + `nutrition_fat_max_g` (migration `0010`, nullable → défauts). `estimateMacros`
prend `leanKg` (masse maigre, fournie par `bodyFatgoal.leanKg`), `proteinPerLbLean`, `fatMaxG`. Les calories cibles
restent issues du métabolisme (Mifflin-St Jeor) moins le déficit du rythme.
