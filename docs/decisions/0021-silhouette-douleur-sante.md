# ADR 0021 — Silhouette de douleur (questionnaire de santé)

**Statut** : Accepté
**Date** : 2026-07-18
**Révise** : la décision de l'[ADR 0020](0020-questionnaires-admission.md) « schéma corporel simplifié en cases à cocher »

## Contexte

L'ADR 0020 avait choisi, pour les zones de tension du questionnaire de santé, de **simplifier le schéma
corporel du formulaire papier en cases à cocher** (pas de carte cliquable, jugée trop coûteuse). Après avoir
vu le formulaire, Nicholas a demandé la **silhouette cliquable avec zones colorées** (jaune/rouge) pour
identifier visuellement où le client a mal — plus proche de la feuille papier (2 silhouettes avant/arrière).

## Décision

Remplacer la grille de cases par une **silhouette cliquable avant + arrière** (`src/pages/client/BodyPainMap.tsx`).

- **Rendu** : SVG maison (aucune dépendance), silhouette stylisée en capsules, identique face/dos. ~35 zones
  cliquables (ellipses) définies en données pures dans `src/lib/sante.ts` (`BODY_REGIONS`, testé).
- **Interaction** : chaque zone cycle **rien → jaune (tension légère) → rouge (douleur) → rien** au clic
  (`cyclePain`). Zones non marquées visibles en pointillé (repère de ce qui est cliquable). Légende + champ
  « autre zone » en texte conservé.
- **Données** : `SanteData.zonesSeverity: Record<idRégion, 'jaune' | 'rouge'>` (remplace `zones: string[]`,
  conservé en lecture pour rétro-compat). Aucune migration (JSON dans `questionnaires.data`).
- **Historique** : la carte liste les zones (douleurs d'abord) avec un compte douleurs / tensions.

## Conséquences

- **+** Saisie visuelle rapide et fidèle au papier ; distingue face/dos, gauche/droite, et 2 niveaux de sévérité.
- **+** Prototypé en HTML/PNG (cairosvg) avant portage → géométrie validée sans lancer Electron.
- **−** Silhouette stylisée (capsules), pas anatomique ; les régions sont des ellipses approximatives.
- **−** Les anciens questionnaires en `zones: string[]` (cases) ne s'affichent pas sur la silhouette (données
  conservées mais non converties) — acceptable, aucun questionnaire de santé réel avant cette version.
