# 0038 — Les glucides affichés sont les glucides **nets**

- **Statut** : acceptée
- **Date** : 2026-08-02
- **Version** : v0.9.113

## Contexte

Marie-Eve travaille en glucides **nets** (glucides totaux moins les fibres), pas
en glucides totaux. L'app affichait « Glucides » sans préciser lequel.

Ce n'est pas qu'une étiquette : si le nombre saisi devient un glucide net, la
question se pose de savoir d'où viennent les calories.

## Décision

Le chiffre saisi et affiché est le **glucide net**, et les **fibres sont comptées
à 0 kcal**. L'énergie reste donc :

```
kcal = protéines×4 + glucides nets×4 + lipides×9
```

Autrement dit : seul le **sens** du nombre change, pas sa **valeur**. Un client
dont le protocole indiquait « 147 g de glucides » lit maintenant « 147 g de
glucides nets », et ses calories sont inchangées. Un test verrouille cette
non-régression.

Les glucides **totaux** restent calculables et sont affichés en contexte
(`nets + fibres`), mais n'entrent dans aucun calcul.

## Pourquoi ne pas compter les fibres dans les glucides

Ce serait circulaire. Les fibres sont dérivées des calories cibles
(14 g / 1000 kcal, cf. [[0037-lipides-grammes-ou-pourcentage]] pour un cas
analogue). Si les glucides totaux valaient `nets + fibres` **et** contribuaient
à l'énergie, alors :

```
fibres ← targetKcal ← glucides totaux ← fibres
```

La convention « fibres à 0 kcal » brise la boucle et reste défendable : les
fibres ne sont pas absorbées comme les autres glucides, et les conventions
d'étiquetage les comptent entre 0 et 2 kcal/g.

## Conséquences

- **Aucun chiffre client ne bouge.** Les protocoles déjà remis restent valides ;
  seul leur libellé change à la prochaine génération de document.
- Une **définition** accompagne le chiffre, dans l'onglet de Marie et dans le
  document client — la notion n'est pas évidente, et le nombre ne correspond pas
  à celui d'une étiquette nutritionnelle. Le document client ajoute la façon de
  le retrouver sur une étiquette.
- Le texte de définition ne contient **aucune quantité recommandée** : c'est une
  définition, pas un conseil nutritionnel (acte réservé, OPDQ — voir
  [[nutrition_ai_scope]]). Un test refuse tout chiffre dans cette chaîne.
- Le prompt du menu IA précise « glucides nets (hors fibres) », sans quoi le
  modèle viserait des glucides totaux et proposerait des journées trop riches.

## Alternative écartée

**Saisir les nets et en déduire les totaux pour l'énergie** (`totaux = nets +
fibres`, comptés à 4 kcal/g). Plus proche des tables de composition, mais crée
la circularité décrite plus haut *et* modifie les calories de tous les clients
existants. Écarté pour les deux raisons.
