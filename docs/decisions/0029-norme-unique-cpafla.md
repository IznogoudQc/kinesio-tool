# 0029 — Norme unique : CPAFLA (retrait du choix ACSM/CPAFLA)

- **Statut** : accepté
- **Date** : 2026-07-27
- **Contexte** : réglages / cotation
- **Complète** : ADR 0028 (parité dos + musculo), remplace la partie « norme sélectionnable » de l'ADR 0025

## Contexte

Le choix de norme (ACSM ou CPAFLA) avait été introduit pour permettre de calibrer
CPAFLA sans casser le comportement existant. La calibration est terminée : l'ADR 0028
démontre la parité exacte avec le logiciel d'origine sur 6 rapports réels. Garder deux
référentiels n'a plus d'intérêt — c'est une source d'écarts silencieux (selon le
réglage, Marie verrait des chiffres différents pour le même bilan) et une question de
plus dans les Paramètres pour une utilisatrice unique.

## Décision

**L'app suit uniquement le CPAFLA.** Le réglage disparaît :

- La carte « Normes de catégorisation » des Paramètres devient **informative** (plus de
  radio-boutons). Le bouton « Exporter les barèmes » y reste.
- Les 4 écrans qui lisaient le réglage (dashboard, détail de bilan, création de bilan,
  rapport) utilisent la constante `DEFAULT_NORMS`.
- La plomberie du réglage est supprimée : méthodes du service, `preload`, handlers IPC
  `settings:norms:*`, schéma zod, entrée `env.d.ts`, clé `categorization_norms`.
  Une ligne résiduelle en base est simplement ignorée.

## Ce qui n'est PAS supprimé

Le type `NormsType` et les **tables ACSM restent nécessaires** : plusieurs tests n'ont
pas de barème CPAFLA (VO2max, IMC, tour de taille en tant que mesure isolée) et
retombent sur ACSM via `getRange`. Le % de gras suit la grille de Marie (ADR 0024).

Autrement dit, on retire le **choix**, pas le mécanisme de repli. Réintroduire un
sélecteur plus tard resterait simple.

## Conséquences

- Un utilisateur qui avait explicitement enregistré « ACSM » bascule sur CPAFLA — c'est
  voulu, ses scores deviennent conformes à ses rapports d'origine.
- La mention « modifiable dans Paramètres » du détail de bilan est retirée, et le texte
  du rapport ne cite plus « ACSM » nommément (il mélangeait déjà les deux référentiels).
