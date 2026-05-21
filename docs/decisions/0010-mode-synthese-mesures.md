# ADR 0010 — Mode « Synthèse » + sélecteur de date sur le sous-onglet Mesures

**Statut** : Accepté
**Date** : 2026-05-15

## Contexte

Le sous-onglet **Mesures** du dashboard et le sous-onglet **Bilan** affichaient leurs prises de façon incohérente :

- **Bilan** (depuis ADR 0009) : sélecteur de pills en haut, premier pill « Synthèse » actif par défaut, état dans l'URL (`?bilan=`).
- **Mesures** : un sélecteur de session de circonférences en **bas** de page (« Historique des prises »), pas de mode synthèse, état en `useState` local (non bookmarkable).

Marie-Eve passe d'un sous-onglet à l'autre — l'asymétrie est déroutante. Et comme pour les bilans, les prises de mesures historiques sont **partielles** : une session ne mesure parfois que taille + hanche, une autre ajoute les biceps. Sans synthèse, reconstituer « l'état le plus à jour » oblige à cliquer prise par prise.

Difficulté supplémentaire propre aux mesures : il y a **deux datasets indépendants** (circonférences et plis cutanés), saisis à des dates qui ne coïncident pas forcément.

## Options

### A. Sélecteur unique de date, snapshot temporel strict ← retenu
- Une pill par date (union des dates circ + plis). Quand une date est choisie, on cherche **pour chaque dataset** la session dont la date est ≤ date sélectionnée.
- Conséquence : circ et plis affichés peuvent venir de **jours différents**. On l'affiche clairement (badge « Circonférences du X · Plis du Y »).
- Avantage : reflète la réalité des données historiques sans rien inventer.

### B. Sélecteur unique forçant circ + plis pris ensemble
- N'autoriser une date que si circ ET plis ont été saisis ce jour-là.
- **Rejeté** : irréaliste pour les datasets importés/historiques où les deux mesures sont rarement synchrones. Beaucoup de dates deviendraient inaccessibles.

### C. Deux sélecteurs séparés (un pour circ, un pour plis)
- **Rejeté** : double la charge visuelle et casse la parité avec le sous-onglet Bilan (un seul sélecteur).

## Décision

**Option A retenue**. Implémentation :

### Modèle (`src/lib/synthesisMesures.ts`)

```ts
buildSynthesisCirc(circList)        → { data, fieldOriginDates, latestContributionDate }
buildPreviousSynthesisCirc(circList) → { data, fieldOriginDates }   // 2e valeur par champ
findLatestPlis / findPreviousPlis(plisList)
findCircAtOrBefore / findPlisAtOrBefore(list, targetDate)
buildUnifiedDates(circList, plisList) → { date, hasCirc, hasPlis }[]  // trié desc
```

Les **circonférences** sont agrégées champ par champ (latest non-null). Les **plis** ne le sont pas : les 4 plis sont mesurés en bloc, donc la synthèse plis = la dernière session complète.

### Sélecteur (`MesureSelectorPills`)

Modelé sur `BilanSelectorPills` : premier pill spécial « Synthèse » (icône `Sparkles`, gradient marine + bordure gold). Chaque pill date porte des **points indicateurs** (point marine = circonférences, point doré = plis cutanés) pour montrer quels datasets existent ce jour-là.

### Routing

Sentinel `?mesure=synthesis` ou `?mesure=<date-ISO>` dans l'URL. Absence du paramètre = mode synthèse (le défaut). Bookmark, retour navigateur et navigation inter-onglets fonctionnent gratuitement.

## Conséquences

- **Marie-Eve atterrit sur la synthèse par défaut**, cohérent avec le sous-onglet Bilan.
- **Section « Historique des prises (circonférences) »** en bas de page **supprimée** — redondante avec le sélecteur de pills en haut.
- **Badge de header** : en mode synthèse, « 🔬 Synthèse — dernières valeurs disponibles · MAJ DATE · N mesures agrégées ». En mode date avec circ et plis de jours différents, les deux dates sont affichées explicitement.
- **Comparaison ▲▼** : en mode synthèse, le « précédent » est la 2e valeur non-null par champ ; en mode date, c'est la session immédiatement antérieure. Le delta peut donc mélanger des écarts de durées variables — c'est la nature de la synthèse (cf. ADR 0009).
- **Graphique d'évolution + sélecteur de métrique** (bas de page) : inchangés, continuent de montrer toute la série temporelle.

## Si on revient en arrière

- Supprimer `src/lib/synthesisMesures.ts` + son test et `MesureSelectorPills.tsx`
- Restaurer dans `MesuresOverview.tsx` l'état `selectedCircId` + le helper `findPreviousValue` + la timeline pills en bas (version v0.1.34)
