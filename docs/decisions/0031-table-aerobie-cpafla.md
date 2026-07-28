# ADR 0031 — Capacité aérobie cotée par la table CPAFLA (outil n° 26 SPAP-SCPE)

- **Statut** : acceptée
- **Date** : 2026-07-28
- **Contexte lié** : [[0025-encodage-cpafla-repli-acsm]], [[0029-norme-unique-cpafla]]

## Contexte

Depuis la v0.9.31 l'app cote uniquement en CPAFLA. Mais `CPAFLA_TABLES.vo2max`
valait `null` : faute de table, `getCategorization` repliait sur l'ACSM. La
capacité aérobie — une des cinq composantes du score global — était donc la
seule à être jugée sur un autre référentiel que le reste du bilan.

Marie-Eve a fourni la table qu'elle utilise réellement : l'aide-mémoire
« Évaluation des avantages pour la santé », **outil n° 26 (SPAP-SCPE)**,
VO2max en ml·kg⁻¹·min⁻¹, six tranches d'âge (15-19 à 60-69) × sexe, cinq
catégories (Médiocre → Excellent).

## Décision

Encoder cette table dans `CPAFLA_TABLES.vo2max`, selon la convention `band()`
déjà utilisée pour les tables musculosquelettiques (borne basse de catégorie →
percentile).

Conséquence assumée : **27 % des combinaisons (âge × sexe × VO2max) changent de
cote.** Exemples pour un homme de 45 ans : 30 ml/kg/min passe de « Bien » (ACSM)
à « À améliorer » (CPAFLA) ; 25 passe d'« Acceptable » à « À améliorer ». La
table CPAFLA est nettement plus exigeante dans le bas de l'échelle.

Ce n'est pas une régression : c'est l'alignement sur le référentiel que Marie
applique déjà en consultation. L'écart précédent signifiait que l'app annonçait
une cote différente de la sienne pour le même client.

## Vérification

- Les 12 lignes de la table ont été rejouées à travers `categoryCells` et
  comparées à la feuille imprimée : **les 60 intervalles correspondent
  exactement**, cellule pour cellule.
- Les tests de parité avec l'ancien logiciel (`cpafla-parite.test.ts`) passent
  toujours : sur les bilans de référence, le VO2max était assez haut pour être
  « Excellent » dans les deux normes, donc le score global est inchangé.

## Conséquences

- La source affichée est **déduite** (`normSourceForTest`) et distingue les deux
  publications CPAFLA : le guide (tests musculo) et l'aide-mémoire (aérobie).
  Les citer indifféremment aurait recréé le défaut corrigé en v0.9.64/66.
- Reste sur ACSM, faute de table CPAFLA : IMC et tour de taille (seuils Santé
  Canada de toute façon indépendants). Le % de gras suit la grille de Marie.
- La feuille « Exporter les barèmes » de Marie doit être réimprimée : la section
  cardio annonçait l'ACSM.
