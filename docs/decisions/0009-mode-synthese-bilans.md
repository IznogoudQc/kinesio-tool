# ADR 0009 — Mode « Synthèse » pour le sélecteur de bilan

**Statut** : Accepté
**Date** : 2026-05-15

## Contexte

Les bilans .docx importés depuis le logiciel actuel de Marie-Eve sont **partiels** par nature : un bilan ne contient souvent que les sections que la kinésio avait le temps de remplir ce jour-là. Concrètement :

- Bilan A (sept 2025) : VO2max, push-ups, sit-ups, mais pas de plis cutanés ni de mesures de circonférences.
- Bilan B (janv 2025) : plis cutanés + tour de taille, mais pas de VO2max.
- Bilan C (juin 2024) : seulement IMC + poids.

Marie-Eve veut « l'état le plus à jour du client » sans avoir à parcourir bilan par bilan pour reconstituer mentalement les dernières valeurs disponibles. Elle veut savoir : « quelle est la **dernière mesure connue** de chaque métrique ? »

## Options

### A. Forcer Marie-Eve à compléter chaque bilan
- Tous les bilans devraient remplir toutes les sections.
- Avantage : modèle simple, un bilan = un état complet.
- Inconvénient irréaliste : les bilans historiques importés sont *immuables* (cf. ADR sur la rétro-compatibilité .docx). Et même en saisie manuelle, Marie-Eve n'a pas toujours le temps de tout faire dans une seule session.
- **Rejeté.**

### B. Composer un « bilan virtuel synthèse » côté affichage ← retenu
- Pour chaque champ de `BilanData`, prendre la valeur la plus récente non-null parmi tous les bilans.
- Pour la comparaison ▲▼, prendre la 2e valeur non-null la plus récente du même champ.
- Avantage : Marie-Eve voit l'état réellement à jour sans naviguer.
- Inconvénient : la « date » globale du bilan synthèse n'a pas de sens — chaque valeur a sa propre date d'origine. On compense via le badge « mise à jour DATE » dans le header (la date la plus récente parmi les contributeurs).

### C. Bouton « voir le dernier bilan le plus complet »
- Détecter automatiquement le bilan ayant le plus de champs et l'afficher.
- Inconvénient : le « plus complet » n'est pas forcément le « plus à jour ». Marie-Eve veut les deux : champ par champ, le plus récent disponible.

## Décision

**Option B retenue**. Implémentation :

### Modèle (`src/lib/synthesisBilan.ts`)

```ts
buildSynthesisBilan(bilans: Bilan[]) → {
  data: BilanData,                  // valeurs latest non-null par champ
  latestContributionDate: string,   // la plus récente parmi celles utilisées
  fieldOriginDates: Record<keyof BilanData, string>,  // pour tooltips (v0.1.33)
  fieldCounts: Record<keyof BilanData, number>        // nb de bilans renseignant ce champ
}

buildPreviousSynthesisBilan(bilans: Bilan[]) → {
  data: BilanData                   // 2e valeur non-null par champ
}
```

### Sélecteur (`BilanSelectorPills`)

Premier pill spécial **Synthèse** (icône `Sparkles`, gradient marine + bordure gold quand actif, fond `bg-gold/5` quand inactif). Sous-titre : « MAJ + date la plus récente », ou « Dernières valeurs » par défaut.

Type modifié : `selectedId: string | null` (null = synthèse).

### Routing
Sentinel `?bilan=synthesis` dans l'URL. Absence du paramètre = mode synthèse (le nouveau défaut, plus pertinent pour la consultation rapide qu'un bilan ancien).

### Composants en aval
Aucun changement : `activeBilan` et `previousActiveBilan` deviennent des bilans **virtuels** (avec `id: 'synthesis'` / `'synthesis-previous'`) que les composants downstream (StatCardXL, MusculoRadar, etc.) traitent comme des bilans réels.

## Conséquences

- **Marie-Eve atterrit sur la synthèse par défaut**. Le bilan le plus récent reste accessible en un clic (pill chronologique à droite de la synthèse).
- **« Date du bilan affiché »** dans le header devient « 🔬 Synthèse — dernières valeurs disponibles (mise à jour : DATE) » en mode synthèse.
- **`isViewingOlder` mis à jour** : le bandeau « vous consultez un bilan ancien » ne s'affiche plus quand on est en mode synthèse (qui est le nouveau défaut). Le bouton « Revenir au bilan récent » devient « Revenir à la synthèse ».
- **ProgressionChart** : reçoit `activeBilanId = 'synthesis'` quand actif — aucun point n'est mis en évidence sur la timeline. Voulu (la synthèse n'a pas de point unique sur la frise).
- **Deltas ▲▼ champ par champ** : un même affichage de delta peut mélanger des comparaisons venant de bilans différents (VO2max actuel sept 2025 vs précédent oct 2024 = delta sur 11 mois ; IMC actuel janv 2025 vs précédent juin 2023 = delta sur 19 mois). C'est la nature même de la synthèse — à expliquer dans les tooltips d'origine en v0.1.33.

## Mise à jour (v0.1.40) — dette « tooltips d'origine » résolue pour les hero stats

`fieldOriginDates` est désormais exposé dans l'UI, **uniquement en mode Synthèse** :

- Les 4 `StatCardXL` du dashboard (VO2max, IMC, % gras, tour de taille) reçoivent une prop optionnelle
  `originDate?: string`. Quand elle est présente, la card affiche un rappel discret « du 12 sept 2025 » sous la
  valeur, avec un `title=` natif explicitant « valeur la plus récente disponible … mesurée le … ».
- `DashboardTab` ne passe `originDate` que si `isSynthesisMode` — en mode « bilan précis », la date serait redondante
  avec l'en-tête, donc rien n'est affiché.
- **`CompositeMiniCard` volontairement exclu** : un score composite agrège plusieurs champs de dates hétérogènes ;
  afficher une date unique serait trompeur. `BilanForm` en lecture seule (40 champs) est également laissé de côté pour
  ne pas alourdir. La dette est donc résolue là où elle comptait le plus (les indicateurs mis en avant).
- Couvert par un test dans `synthesisBilan.test.ts` (chaque champ pointe le bon bilan quand les dates diffèrent).

## Limitations connues / à surveiller

- **Tooltips d'origine limités aux hero stats** (v0.1.40) : `fieldOriginDates` n'est exposé que sur les 4 `StatCardXL`. Les composites et le formulaire lecture seule ne l'affichent pas (choix, voir ci-dessus).
- **Composants downstream ne savent pas qu'ils affichent du virtuel** : `<StatCardXL>` ne sait pas si son `value` vient de sept 2025 ou janv 2025. Pas grave actuellement parce que la sémantique reste « dernière valeur connue » — mais à garder en tête si on rajoute des comparaisons croisées.

## Si on revient en arrière

- Supprimer `src/lib/synthesisBilan.ts` + son test
- Retirer la pill Synthèse dans `BilanSelectorPills` (le 1er `<button>` du scroll list) + remettre `selectedId: string`
- Restaurer `activeBilan` dans `DashboardTab.tsx` à sa version v0.1.25 (toujours retourne un bilan existant, pas un virtuel)

Marie-Eve a validé l'orientation lors d'un échange du 2026-05-15.
