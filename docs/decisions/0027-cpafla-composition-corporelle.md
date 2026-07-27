# 0027 — Composition corporelle CPAFLA (IMC + tour de taille + somme des 5 plis)

- **Statut** : accepté (sous norme CPAFLA)
- **Date** : 2026-07-19
- **Contexte** : bilan / score de composition corporelle
- **Complète** : ADR 0025/0026 (CPAFLA), 0024 (% gras grille)

## Contexte

Le score de composition corporelle de l'app (moyenne 0-4 de IMC + % gras-grille + tour
de taille) divergeait fortement de l'ancien logiciel de Marie (ex. 2,0 vs 4,0). Le guide
CPHV (3ᵉ éd.) calcule la composition autrement — Figures **7-4** (hommes) / **7-5** (femmes),
formule p. 7-18, catégories Fig. 7-6.

## Décision

Nouveau module `src/lib/norms/cpafla-composition.ts` — `cpaflaComposition({ imc, ct, s5pc, sex })` :

- **Trois variables** : IMC (kg/m²), CT = tour de taille (cm), S5PC = somme des **5** plis
  (triceps, biceps, sous-scapulaire, crête iliaque, **mollet**). **Pas** le % de gras. **Pas**
  de dépendance à l'âge (seulement le sexe).
- Les points de CT (colonne B) et de S5PC (colonne C) dépendent de la **plage d'IMC** (tables
  Fig. 7-4/7-5, encodées par paliers `Step`).
- **Combinaisons** (p. 7-17/18) selon les mesures présentes :
  IMC+CT+S5PC → `arrondi[(B×1,5 + C)/2,5]` (≥ x,5 → haut) ; IMC+CT → B ; IMC+S5PC → C ;
  CT seule → B dans la plage « IMC 27 » ; IMC seul → A.
- Validé sur l'exemple du guide (femme IMC 25,8 · CT 91 · S5PC 116,6 → 1,4 → « Acceptable »).

Câblé dans `bilan-computed` : **si `norms === 'cpafla'`** (sexe connu), la composition suit
cette méthode ; sinon (ACSM, défaut) la moyenne historique est conservée.

## 5ᵉ pli (mollet) — mode « auto »

Marie ne mesure d'habitude que 4 plis. Choix retenu : **auto**.
- Champ **« Mollet »** ajouté au formulaire (le modèle `pli_mollet` existait déjà).
- Si les **5** plis sont saisis → vraie S5PC → formule complète IMC+CT+S5PC.
- Sinon → **repli automatique** sur IMC+CT (le guide le prévoit : « parfois la S5PC n'est pas
  prise »). La somme sur 4 plis n'est **jamais** comparée aux seuils S5PC (calibrés pour 5).

## Conséquences

- Sous CPAFLA, la composition se rapproche de l'ancien logiciel. Le % de gras garde par ailleurs
  sa grille de Marie (ADR 0024) pour l'affichage — les deux coexistent (rôles distincts).
- Score composite = entier 0-4 sous CPAFLA.
- À valider sur des cas réels vs le logiciel de Marie (surtout la bascule 4↔5 plis).
