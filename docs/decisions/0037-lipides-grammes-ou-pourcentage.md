# 0037 — Lipides : plafond en grammes ou % des calories, au choix par client

- **Statut** : acceptée
- **Date** : 2026-08-01
- **Version** : v0.9.108

## Contexte

Depuis l'origine, l'app fixe les lipides par un **plafond en grammes**
(`nutritionFatMaxG`, défaut 60 g) : les protéines viennent du poids corporel,
les lipides du plafond, et les glucides prennent le reste des calories cibles.

Marie-Eve a transmis le repère qu'elle utilise, tiré du **Guide du conseiller
CPAFLA / ÉCPHV, 3ᵉ éd.** :

> La quantité totale de gras d'origine alimentaire devrait correspondre à 30 à
> 40 % de l'apport calorique total, selon la quantité de glucides consommée (la
> quantité de protéines doit demeurer relativement constante).

Le repère est exprimé en **% des calories**, l'app en **grammes**. Les deux ne se
recouvrent que sur une plage étroite : 60 g valent 540 kcal, donc 30 à 40 % pour
des cibles entre **1350 et 1800 kcal seulement**. Au-delà, le plafond par défaut
passe sous les 30 % sans que rien ne le signale.

Audit de la base au moment de la décision (2 clients avec le module actif) :

| Client         | kcal | lipides | part  | verdict        |
|----------------|-----:|--------:|------:|----------------|
| Sabrina Dumais | 1662 |    60 g | 32,5 %| dans 30-40 %   |
| Nicholas Jean  | 1967 |    80 g | 36,6 %| dans 30-40 %   |

Les deux sont conformes — mais le second seulement parce que le plafond avait
été relevé à 80 g à la main. Le défaut de 60 g l'aurait mis à 27,5 %.

## Décision

Deux bases de calcul, **au choix par client** (`nutritionFatMode`) :

- `'g'` — plafond fixe en grammes. **Défaut, et comportement historique.**
- `'pct'` — part des calories cibles (`nutritionFatPct`, défaut 35 %, le milieu
  de la fourchette). Les grammes se recalculent quand les calories changent.

Dans les deux cas, les protéines restent adossées au poids corporel et les
glucides prennent le reste — la structure du calcul ne change pas, seule
l'origine du nombre de lipides change.

En mode `'g'`, l'interface affiche la part obtenue (« = 32 % des calories ») et
avertit en ambre hors de la fourchette, avec les bornes en grammes équivalentes.
Marie voit donc le repère sans être obligée d'y basculer.

## Conséquences

- **Aucun chiffre client ne change** : `null`, absent et `'g'` donnent le même
  résultat qu'avant, ce qu'un test verrouille explicitement.
- La bascule g ↔ % part de la valeur équivalente à ce qui est affiché, jamais
  d'un défaut arbitraire — Marie ne perd pas son réglage en changeant de base.
- Un réglage de plus dans un écran déjà chargé. Accepté : le mode `'pct'` est le
  seul qui reste conforme au repère quand les calories bougent, et Marie a
  demandé à garder les deux.
- Le mode et le % font partie du **modèle de protocole exportable** : un
  protocole se transmet avec sa base de calcul, sinon il ne se reproduit pas.

## Source

CPAFLA / ÉCPHV — *Guide du conseiller*, 3ᵉ éd. Attribution confirmée par
Nicholas, comme les tableaux 4.4 (IMC et tour de taille) et 4.10 (VO2max) déjà
encodés. Voir [[0036-source-table-aerobie-corrigee]] pour la correction
d'attribution qui a établi la règle : aucune source n'est inscrite dans le code
sans confirmation.

## Alternatives écartées

- **Remplacer les grammes par le %** — colle au texte et s'adapte seul, mais
  recalcule les lipides de tous les clients existants (Sabrina 60 → 65 g,
  Nicholas 80 → 76 g). Écarté : ce n'est pas à une mise à jour de modifier des
  protocoles déjà remis.
- **Garder les grammes et n'afficher que le %** — aucun risque, mais laisse
  Marie recalculer à la main à chaque changement de calories. Retenu comme
  moitié de la solution, pas comme solution entière.
